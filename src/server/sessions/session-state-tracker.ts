import path from 'node:path';

export type SessionState = 'working' | 'needs_input' | 'idle' | 'ended';

export interface SessionSummary {
  id: string;
  folder: string;
  label: string;
  state: SessionState;
  lastActivity: string;
  waitingTool?: string;
}

export interface TrackedSession {
  readonly id: string;
  readonly cwd: string;
  onExit(listener: () => void): unknown;
  readonly resumedFrom?: { sessionId: string; firstUserMessage?: string | null } | undefined;
}

export interface HookEvent {
  hook_event_name: string;
  tool_name?: unknown;
  notification_type?: unknown;
  prompt?: unknown;
  session_id?: unknown;
}

export interface SessionStateTrackerOptions {
  now?: () => Date;
}

export type ChangeCause =
  | { type: 'track' }
  | { type: 'hook'; hookEventName: string }
  | { type: 'input' }
  | { type: 'exit' };

type ChangeListener = (summary: SessionSummary, cause: ChangeCause) => void;

const LABEL_LENGTH = 80;
const ESCAPE = '\x1b';
const CTRL_C = '\x03';
const ASK_USER_QUESTION = 'AskUserQuestion';

interface Entry {
  summary: SessionSummary;
  labelFromPrompt: boolean;
  claudeSessionId: string | undefined;
  lastPreToolUse?: string;
}

function isToolName(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function stateOf(event: HookEvent): SessionState | undefined {
  switch (event.hook_event_name) {
    case 'UserPromptSubmit':
    case 'PostToolUse':
      return 'working';
    case 'PreToolUse':
      return event.tool_name === ASK_USER_QUESTION ? 'needs_input' : 'working';
    case 'PermissionRequest':
      return 'needs_input';
    case 'Stop':
      return 'idle';
    case 'Notification':
      if (event.notification_type === 'permission_prompt' || event.notification_type === 'elicitation_dialog') {
        return 'needs_input';
      }
      return event.notification_type === 'idle_prompt' ? 'idle' : undefined;
    default:
      return undefined;
  }
}

export function labelOf(prompt: unknown): string {
  if (typeof prompt !== 'string') return '';
  return Array.from(prompt.replace(/\s+/g, ' ').trim()).slice(0, LABEL_LENGTH).join('');
}

export class SessionStateTracker {
  readonly #now: () => Date;
  readonly #entries = new Map<string, Entry>();
  readonly #listeners = new Set<ChangeListener>();

  constructor(options: SessionStateTrackerOptions = {}) {
    this.#now = options.now ?? (() => new Date());
  }

  track(session: TrackedSession): void {
    const resumedLabel = labelOf(session.resumedFrom?.firstUserMessage);
    const summary: SessionSummary = {
      id: session.id,
      folder: session.cwd,
      label: resumedLabel || path.basename(session.cwd) || session.cwd,
      state: 'idle',
      lastActivity: this.#now().toISOString(),
    };
    this.#entries.set(session.id, {
      summary,
      labelFromPrompt: resumedLabel !== '',
      claudeSessionId: session.resumedFrom?.sessionId,
    });
    this.#notify(summary, { type: 'track' });
    session.onExit(() =>
      this.#update(session.id, { state: 'ended', lastActivity: this.#now().toISOString() }, { type: 'exit' }),
    );
  }

  applyHookEvent(sessionId: string, event: HookEvent): boolean {
    const entry = this.#entries.get(sessionId);
    if (!entry) return false;
    if (entry.summary.state !== 'ended' && typeof event.session_id === 'string' && event.session_id !== '') {
      entry.claudeSessionId = event.session_id;
    }
    const state = stateOf(event);
    if (entry.summary.state === 'ended' || state === undefined) return true;
    const isIdleReminder = event.hook_event_name === 'Notification' && event.notification_type === 'idle_prompt';
    if (isIdleReminder && entry.summary.state === 'idle') return true;
    if (event.hook_event_name === 'PreToolUse' && isToolName(event.tool_name)) entry.lastPreToolUse = event.tool_name;
    const changes: Partial<SessionSummary> = { state };
    if (!isIdleReminder) changes.lastActivity = this.#now().toISOString();
    if (event.hook_event_name === 'PermissionRequest' && isToolName(event.tool_name)) {
      changes.waitingTool = event.tool_name;
    } else if (event.hook_event_name === 'Notification' && event.notification_type === 'permission_prompt') {
      changes.waitingTool = entry.summary.waitingTool ?? entry.lastPreToolUse;
    }
    if (event.hook_event_name === 'UserPromptSubmit' && !entry.labelFromPrompt) {
      const label = labelOf(event.prompt);
      if (label !== '') {
        changes.label = label;
        entry.labelFromPrompt = true;
      }
    }
    this.#update(sessionId, changes, { type: 'hook', hookEventName: event.hook_event_name });
    return true;
  }

  applyUserInput(sessionId: string, data: string): void {
    const entry = this.#entries.get(sessionId);
    if (!entry || entry.summary.state === 'ended') return;
    const changes: Partial<SessionSummary> = { lastActivity: this.#now().toISOString() };
    const interrupts = data === ESCAPE || data === CTRL_C;
    if (interrupts && (entry.summary.state === 'working' || entry.summary.state === 'needs_input')) {
      changes.state = 'idle';
    }
    this.#update(sessionId, changes, { type: 'input' });
  }

  get(sessionId: string): SessionSummary | undefined {
    const entry = this.#entries.get(sessionId);
    return entry && { ...entry.summary };
  }

  claudeSessionId(sessionId: string): string | undefined {
    return this.#entries.get(sessionId)?.claudeSessionId;
  }

  liveClaudeSessionIds(): Set<string> {
    const ids = new Set<string>();
    for (const entry of this.#entries.values()) {
      if (entry.summary.state !== 'ended' && entry.claudeSessionId) ids.add(entry.claudeSessionId);
    }
    return ids;
  }

  list(): SessionSummary[] {
    return [...this.#entries.values()].map((entry) => ({ ...entry.summary }));
  }

  onChange(listener: ChangeListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #update(sessionId: string, changes: Partial<SessionSummary>, cause: ChangeCause): void {
    const entry = this.#entries.get(sessionId);
    if (!entry) return;
    entry.summary = { ...entry.summary, ...changes };
    if (entry.summary.state !== 'needs_input' || entry.summary.waitingTool === undefined) delete entry.summary.waitingTool;
    this.#notify(entry.summary, cause);
  }

  #notify(summary: SessionSummary, cause: ChangeCause): void {
    for (const listener of this.#listeners) listener({ ...summary }, { ...cause });
  }
}
