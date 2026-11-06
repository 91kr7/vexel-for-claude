import type { ExternalSessionScanner } from '../external/external-session-scanner.js';
import type { TranscriptReader } from '../external/transcript-reader.js';
import { type ContextOccupancy, contextAfter } from './context-occupancy.js';
import type { SessionStateTracker } from './session-state-tracker.js';

export interface SessionUsage {
  context?: ContextOccupancy;
}

export interface UsageMonitorSources {
  tracker: Pick<SessionStateTracker, 'list' | 'onChange' | 'onRemove' | 'claudeSessionId'>;
  scanner: Pick<ExternalSessionScanner, 'list' | 'onChange'>;
  reader: Pick<TranscriptReader, 'locate' | 'readEntriesFrom'>;
  intervalMs?: number;
  maxBytesPerPoll?: number;
}

export type UsageListener = (sessionId: string, usage: SessionUsage | undefined) => void;

interface Transcript {
  claudeSessionId: string;
  file?: string;
  offset: number;
  context?: ContextOccupancy;
  reading: boolean;
}

interface WatchedSession {
  id: string;
  hosted: boolean;
  folder: string;
  transcript?: Transcript;
  context?: ContextOccupancy;
}

const DEFAULT_INTERVAL_MS = 1000;
const DEFAULT_MAX_BYTES_PER_POLL = 4 * 1024 * 1024;

const sameContext = (a: ContextOccupancy | undefined, b: ContextOccupancy | undefined) =>
  a === b || (a !== undefined && b !== undefined && a.used === b.used && a.window === b.window);

const usageOf = (context: ContextOccupancy | undefined): SessionUsage | undefined => context && { context: { ...context } };

export class UsageMonitor {
  readonly #tracker: UsageMonitorSources['tracker'];
  readonly #reader: UsageMonitorSources['reader'];
  readonly #intervalMs: number;
  readonly #maxBytesPerPoll: number;
  readonly #sessions = new Map<string, WatchedSession>();
  readonly #listeners = new Set<UsageListener>();
  #generation = 0;
  #running = false;
  #timer: NodeJS.Timeout | undefined;

  constructor({ tracker, scanner, reader, intervalMs = DEFAULT_INTERVAL_MS, maxBytesPerPoll = DEFAULT_MAX_BYTES_PER_POLL }: UsageMonitorSources) {
    this.#tracker = tracker;
    this.#reader = reader;
    this.#intervalMs = intervalMs;
    this.#maxBytesPerPoll = maxBytesPerPoll;
    for (const session of tracker.list()) this.#observe(session, true);
    for (const session of scanner.list()) this.#observe(session, false);
    tracker.onChange((session) => this.#observe(session, true));
    tracker.onRemove((id) => this.#sessions.delete(id));
    scanner.onChange((change) => (change.type === 'session' ? this.#observe(change.session, false) : this.#sessions.delete(change.id)));
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
  }

  async poll(): Promise<void> {
    await Promise.all([...this.#sessions.values()].map((session) => this.#read(session)));
  }

  get(sessionId: string): SessionUsage | undefined {
    return usageOf(this.#sessions.get(sessionId)?.context);
  }

  onChange(listener: UsageListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async #loop(generation: number): Promise<void> {
    await this.poll();
    if (generation !== this.#generation) return;
    this.#timer = setTimeout(() => void this.#loop(generation), this.#intervalMs);
    this.#timer.unref();
  }

  #observe({ id, folder }: { id: string; folder: string }, hosted: boolean): void {
    const session = this.#sessions.get(id);
    if (session) Object.assign(session, { hosted, folder });
    else this.#sessions.set(id, { id, hosted, folder });
  }

  #transcriptOf(session: WatchedSession): Transcript | undefined {
    const claudeSessionId = session.hosted ? this.#tracker.claudeSessionId(session.id) : session.id;
    if (session.transcript?.claudeSessionId === claudeSessionId) return session.transcript;
    session.transcript = claudeSessionId === undefined ? undefined : { claudeSessionId, offset: 0, reading: false };
    this.#setContext(session, undefined);
    return session.transcript;
  }

  async #read(session: WatchedSession): Promise<void> {
    const transcript = this.#transcriptOf(session);
    if (!transcript || transcript.reading) return;
    transcript.reading = true;
    try {
      transcript.file ??= await this.#reader.locate(session.folder, transcript.claudeSessionId);
      if (transcript.file === undefined) return;
      const { entries, offset, more } = await this.#reader.readEntriesFrom(transcript.file, transcript.offset, this.#maxBytesPerPoll);
      transcript.offset = offset;
      transcript.context = contextAfter(transcript.context, entries);
      if (more) return;
    } catch {
      return;
    } finally {
      transcript.reading = false;
    }
    if (this.#sessions.get(session.id) !== session || session.transcript !== transcript) return;
    this.#setContext(session, transcript.context);
  }

  #setContext(session: WatchedSession, context: ContextOccupancy | undefined): void {
    if (sameContext(session.context, context)) return;
    session.context = context;
    for (const listener of this.#listeners) listener(session.id, usageOf(context));
  }
}
