import path from 'node:path';

export type SessionState = 'working' | 'needs_input' | 'idle' | 'ended';

export interface SessionSummary {
  id: string;
  folder: string;
  label: string;
  state: SessionState;
  lastActivity: string;
}

export interface TrackedSession {
  readonly id: string;
  readonly cwd: string;
  onExit(listener: () => void): unknown;
}

export interface HookEvent {
  hook_event_name: string;
  tool_name?: unknown;
  notification_type?: unknown;
  prompt?: unknown;
}

export interface SessionStateTrackerOptions {
  now?: () => Date;
}

type ChangeListener = (summary: SessionSummary) => void;

const LABEL_LENGTH = 80;
const ESCAPE = '\x1b';
const CTRL_C = '\x03';
const ASK_USER_QUESTION = 'AskUserQuestion';

interface Entry {
  summary: SessionSummary;
  labelFromPrompt: boolean;
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

function labelOf(prompt: unknown): string {
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
    const summary: SessionSummary = {
      id: session.id,
      folder: session.cwd,
      label: path.basename(session.cwd) || session.cwd,
      state: 'idle',
      lastActivity: this.#now().toISOString(),
    };
    this.#entries.set(session.id, { summary, labelFromPrompt: false });
    this.#notify(summary);
    session.onExit(() => this.#update(session.id, { state: 'ended', lastActivity: this.#now().toISOString() }));
  }

  applyHookEvent(sessionId: string, event: HookEvent): boolean {
    const entry = this.#entries.get(sessionId);
    if (!entry) return false;
    const state = stateOf(event);
    if (entry.summary.state === 'ended' || state === undefined) return true;
    const isIdleReminder = event.hook_event_name === 'Notification' && event.notification_type === 'idle_prompt';
    if (isIdleReminder && entry.summary.state === 'idle') return true;
    const changes: Partial<SessionSummary> = { state };
    if (!isIdleReminder) changes.lastActivity = this.#now().toISOString();
    if (event.hook_event_name === 'UserPromptSubmit' && !entry.labelFromPrompt) {
      const label = labelOf(event.prompt);
      if (label !== '') {
        changes.label = label;
        entry.labelFromPrompt = true;
      }
    }
    this.#update(sessionId, changes);
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
    this.#update(sessionId, changes);
  }

  get(sessionId: string): SessionSummary | undefined {
    const entry = this.#entries.get(sessionId);
    return entry && { ...entry.summary };
  }

  list(): SessionSummary[] {
    return [...this.#entries.values()].map((entry) => ({ ...entry.summary }));
  }

  onChange(listener: ChangeListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #update(sessionId: string, changes: Partial<SessionSummary>): void {
    const entry = this.#entries.get(sessionId);
    if (!entry) return;
    entry.summary = { ...entry.summary, ...changes };
    this.#notify(entry.summary);
  }

  #notify(summary: SessionSummary): void {
    for (const listener of this.#listeners) listener({ ...summary });
  }
}
