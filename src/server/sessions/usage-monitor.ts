import type { ExternalSessionScanner } from '../external/external-session-scanner.js';
import { type TranscriptReader, subagentFilesOf } from '../external/transcript-reader.js';
import { type ContextOccupancy, contextAfter } from './context-occupancy.js';
import { modelResponseOf } from './model-response.js';
import { ResponseLedger, type TokenTotals } from './response-ledger.js';
import type { SessionStateTracker } from './session-state-tracker.js';

export interface SessionUsage {
  context?: ContextOccupancy;
  tokens?: TokenTotals;
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
  offsets: Map<string, number>;
  context?: ContextOccupancy;
  ledger: ResponseLedger;
  reading: boolean;
}

interface WatchedSession {
  id: string;
  hosted: boolean;
  folder: string;
  transcript?: Transcript;
  usage?: SessionUsage;
}

const DEFAULT_INTERVAL_MS = 1000;
const DEFAULT_MAX_BYTES_PER_POLL = 4 * 1024 * 1024;

const sameContext = (a: ContextOccupancy | undefined, b: ContextOccupancy | undefined) =>
  a === b || (a !== undefined && b !== undefined && a.used === b.used && a.window === b.window);

const sameTokens = (a: TokenTotals | undefined, b: TokenTotals | undefined) =>
  a === b ||
  (a !== undefined && b !== undefined && a.input === b.input && a.output === b.output && a.cacheWrite === b.cacheWrite && a.cacheRead === b.cacheRead);

const sameUsage = (a: SessionUsage | undefined, b: SessionUsage | undefined) => sameContext(a?.context, b?.context) && sameTokens(a?.tokens, b?.tokens);

function usageOf(context: ContextOccupancy | undefined, tokens: TokenTotals | undefined): SessionUsage | undefined {
  if (!context && !tokens) return undefined;
  return { ...(context && { context: { ...context } }), ...(tokens && { tokens: { ...tokens } }) };
}

const copyOf = (usage: SessionUsage | undefined) => usage && usageOf(usage.context, usage.tokens);

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
    return copyOf(this.#sessions.get(sessionId)?.usage);
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
    session.transcript =
      claudeSessionId === undefined ? undefined : { claudeSessionId, offsets: new Map(), ledger: new ResponseLedger(), reading: false };
    this.#setUsage(session, undefined);
    return session.transcript;
  }

  async #read(session: WatchedSession): Promise<void> {
    const transcript = this.#transcriptOf(session);
    if (!transcript || transcript.reading) return;
    transcript.reading = true;
    try {
      transcript.file ??= await this.#reader.locate(session.folder, transcript.claudeSessionId);
      if (transcript.file === undefined) return;
      if (!(await this.#readFiles(transcript, transcript.file))) return;
    } catch {
      return;
    } finally {
      transcript.reading = false;
    }
    if (this.#sessions.get(session.id) !== session || session.transcript !== transcript) return;
    this.#setUsage(session, usageOf(transcript.context, transcript.ledger.totals()));
  }

  /** Reads the main file, then the subagent files, within one byte budget. True when every file reached its end. */
  async #readFiles(transcript: Transcript, main: string): Promise<boolean> {
    let budget = this.#maxBytesPerPoll;
    for (const file of [main, ...(await subagentFilesOf(main))]) {
      if (budget <= 0) return false;
      const start = transcript.offsets.get(file) ?? 0;
      const { entries, offset, more } = await this.#reader.readEntriesFrom(file, start, budget);
      transcript.offsets.set(file, offset);
      budget -= offset - start;
      if (file === main) transcript.context = contextAfter(transcript.context, entries);
      for (const entry of entries) {
        const response = modelResponseOf(entry);
        if (response) transcript.ledger.add(response);
      }
      if (more) return false;
    }
    return true;
  }

  #setUsage(session: WatchedSession, usage: SessionUsage | undefined): void {
    if (sameUsage(session.usage, usage)) return;
    session.usage = usage;
    for (const listener of this.#listeners) listener(session.id, copyOf(usage));
  }
}
