import type { ExternalSessionScanner } from '../external/external-session-scanner.js';
import type { ConversationItem, ItemRef, TranscriptReader } from '../external/transcript-reader.js';
import { type RunningTool, runningToolOf } from './running-tool.js';
import type { SessionState, SessionStateTracker } from './session-state-tracker.js';

export interface RunningToolMonitorSources {
  tracker: Pick<SessionStateTracker, 'list' | 'onChange' | 'onRemove' | 'claudeSessionId'>;
  scanner: Pick<ExternalSessionScanner, 'list' | 'onChange'>;
  reader: Pick<TranscriptReader, 'locate' | 'readFrom' | 'readItem'>;
  intervalMs?: number;
}

export type RunningToolListener = (sessionId: string, runningTool: RunningTool | undefined) => void;

interface OpenCall {
  name: string;
  ref?: ItemRef;
  input?: unknown;
  inputRead: boolean;
}

interface Transcript {
  claudeSessionId: string;
  file?: string;
  offset: number;
  calls: Map<string, OpenCall>;
  reading: boolean;
}

interface Shown {
  tool: RunningTool;
  callId: string;
  since: number;
  holdTimer?: NodeJS.Timeout;
}

interface WatchedSession {
  id: string;
  hosted: boolean;
  folder: string;
  state: SessionState;
  transcript?: Transcript;
  shown?: Shown;
}

interface ObservedSummary {
  id: string;
  folder: string;
  state: SessionState;
}

const DEFAULT_INTERVAL_MS = 500;
const HOLD_MS = 1000;

function parseInput(text: string | undefined): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function applyItems(calls: Map<string, OpenCall>, items: readonly ConversationItem[]): void {
  for (const item of items) {
    if (item.kind === 'user') calls.clear();
    else if (item.kind === 'tool_call' && item.id !== undefined) calls.set(item.id, { name: item.name, ref: item.ref, inputRead: false });
    else if (item.kind === 'tool_result' && item.toolUseId !== undefined) calls.delete(item.toolUseId);
  }
}

const sameTool = (a: RunningTool, b: RunningTool) => a.name === b.name && a.argument === b.argument && a.others === b.others;

export class RunningToolMonitor {
  readonly #tracker: RunningToolMonitorSources['tracker'];
  readonly #reader: RunningToolMonitorSources['reader'];
  readonly #intervalMs: number;
  readonly #sessions = new Map<string, WatchedSession>();
  readonly #listeners = new Set<RunningToolListener>();
  #generation = 0;
  #running = false;
  #timer: NodeJS.Timeout | undefined;

  constructor({ tracker, scanner, reader, intervalMs = DEFAULT_INTERVAL_MS }: RunningToolMonitorSources) {
    this.#tracker = tracker;
    this.#reader = reader;
    this.#intervalMs = intervalMs;
    for (const session of tracker.list()) this.#observe(session, true);
    for (const session of scanner.list()) this.#observe(session, false);
    tracker.onChange((session) => this.#observe(session, true));
    tracker.onRemove((id) => this.#forget(id));
    scanner.onChange((change) => (change.type === 'session' ? this.#observe(change.session, false) : this.#forget(change.id)));
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    void this.#loop(++this.#generation);
  }

  stop(): void {
    this.#running = false;
    this.#generation += 1;
    clearTimeout(this.#timer);
    this.#timer = undefined;
    for (const session of this.#sessions.values()) clearTimeout(session.shown?.holdTimer);
  }

  async poll(): Promise<void> {
    const working = [...this.#sessions.values()].filter((session) => session.state === 'working');
    await Promise.all(working.map((session) => this.#read(session)));
  }

  get(sessionId: string): RunningTool | undefined {
    const tool = this.#sessions.get(sessionId)?.shown?.tool;
    return tool && { ...tool };
  }

  onChange(listener: RunningToolListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async #loop(generation: number): Promise<void> {
    await this.poll();
    if (generation !== this.#generation) return;
    this.#timer = setTimeout(() => void this.#loop(generation), this.#intervalMs);
    this.#timer.unref();
  }

  #observe({ id, folder, state }: ObservedSummary, hosted: boolean): void {
    const session = this.#sessions.get(id);
    if (!session) {
      this.#sessions.set(id, { id, hosted, folder, state });
      return;
    }
    Object.assign(session, { hosted, folder, state });
    if (state !== 'working') this.#setShown(session, undefined);
  }

  #forget(sessionId: string): void {
    const session = this.#sessions.get(sessionId);
    if (!session) return;
    this.#sessions.delete(sessionId);
    this.#setShown(session, undefined);
  }

  #transcriptOf(session: WatchedSession): Transcript | undefined {
    const claudeSessionId = session.hosted ? this.#tracker.claudeSessionId(session.id) : session.id;
    if (claudeSessionId === undefined) return undefined;
    if (session.transcript?.claudeSessionId !== claudeSessionId) {
      session.transcript = { claudeSessionId, offset: 0, calls: new Map(), reading: false };
    }
    return session.transcript;
  }

  async #read(session: WatchedSession): Promise<void> {
    const transcript = this.#transcriptOf(session);
    if (!transcript || transcript.reading) return;
    transcript.reading = true;
    try {
      transcript.file ??= await this.#reader.locate(session.folder, transcript.claudeSessionId);
      if (transcript.file !== undefined) {
        const { items, offset } = await this.#reader.readFrom(transcript.file, transcript.offset);
        transcript.offset = offset;
        applyItems(transcript.calls, items);
        const last = [...transcript.calls.values()].at(-1);
        if (last && !last.inputRead && last.ref) {
          last.input = parseInput(await this.#reader.readItem(transcript.file, last.ref));
        }
        if (last) last.inputRead = true;
      }
    } catch {
      return;
    } finally {
      transcript.reading = false;
    }
    if (this.#sessions.get(session.id) !== session || session.transcript !== transcript || session.state !== 'working') return;
    const lastCallId = [...transcript.calls.keys()].at(-1);
    const tool = runningToolOf([...transcript.calls.values()]);
    this.#setShown(session, tool && lastCallId !== undefined ? { tool, callId: lastCallId } : undefined);
  }

  #setShown(session: WatchedSession, next: { tool: RunningTool; callId: string } | undefined): void {
    const shown = session.shown;
    if (next) {
      if (shown?.callId === next.callId) {
        clearTimeout(shown.holdTimer);
        shown.holdTimer = undefined;
        if (sameTool(shown.tool, next.tool)) return;
        shown.tool = next.tool;
      } else {
        clearTimeout(shown?.holdTimer);
        session.shown = { ...next, since: Date.now() };
      }
      this.#notify(session.id, next.tool);
      return;
    }
    if (!shown) return;
    const remaining = shown.since + HOLD_MS - Date.now();
    if (session.state === 'working' && this.#sessions.get(session.id) === session && remaining > 0) {
      shown.holdTimer ??= setTimeout(() => {
        if (session.shown !== shown) return;
        session.shown = undefined;
        this.#notify(session.id, undefined);
      }, remaining);
      return;
    }
    clearTimeout(shown.holdTimer);
    session.shown = undefined;
    this.#notify(session.id, undefined);
  }

  #notify(sessionId: string, tool: RunningTool | undefined): void {
    for (const listener of this.#listeners) listener(sessionId, tool && { ...tool });
  }
}
