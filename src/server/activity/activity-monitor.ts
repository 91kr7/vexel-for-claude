import path from 'node:path';
import type { ExternalSessionScanner } from '../external/external-session-scanner.js';
import { type TranscriptReader, subagentFilesOf, subagentMetaOf } from '../external/transcript-reader.js';
import type { SessionState, SessionStateTracker } from '../sessions/session-state-tracker.js';
import { type LiveActivity, liveActivityOf } from './live-activity.js';
import { TurnModel } from './turn-model.js';
import type { WaitingFor } from './waiting-for.js';

export interface ActivityMonitorSources {
  tracker: Pick<SessionStateTracker, 'list' | 'onChange' | 'onRemove' | 'claudeSessionId'>;
  scanner: Pick<ExternalSessionScanner, 'list' | 'onChange'>;
  reader: Pick<TranscriptReader, 'locate' | 'readEntriesFrom'>;
  intervalMs?: number;
  maxBytesPerPoll?: number;
}

export type ActivityListener = (sessionId: string, activity: LiveActivity | undefined) => void;

interface Transcript {
  claudeSessionId: string;
  file?: string;
  offsets: Map<string, number>;
  model: TurnModel;
  finishedSubagents: Set<string>;
  loaded: boolean;
  reading: boolean;
}

interface WatchedSession {
  id: string;
  hosted: boolean;
  folder: string;
  state: SessionState;
  settled: boolean;
  transcript?: Transcript;
  activity?: LiveActivity;
}

interface ObservedSummary {
  id: string;
  folder: string;
  state: SessionState;
}

const DEFAULT_INTERVAL_MS = 500;
const DEFAULT_MAX_BYTES_PER_POLL = 4 * 1024 * 1024;

const subagentIdOf = (file: string) => path.basename(file, '.jsonl');

const copyOf = (activity: LiveActivity | undefined): LiveActivity | undefined =>
  activity && {
    ...activity,
    ...(activity.latestText && { latestText: { ...activity.latestText } }),
    ...(typeof activity.waitingFor === 'object' && { waitingFor: { ...activity.waitingFor } }),
  };

const sameWaitingFor = (a: WaitingFor | undefined, b: WaitingFor | undefined) =>
  a === b ||
  (typeof a === 'object' &&
    typeof b === 'object' &&
    a.subagentType === b.subagentType &&
    a.name === b.name &&
    a.argument === b.argument &&
    a.others === b.others);

const sameActivity = (a: LiveActivity | undefined, b: LiveActivity | undefined) =>
  a === b ||
  (a !== undefined &&
    b !== undefined &&
    a.atWork === b.atWork &&
    a.latestText?.text === b.latestText?.text &&
    a.latestText?.subagentType === b.latestText?.subagentType &&
    a.latestText?.at === b.latestText?.at &&
    a.lastEventAt === b.lastEventAt &&
    sameWaitingFor(a.waitingFor, b.waitingFor));

export class ActivityMonitor {
  readonly #tracker: ActivityMonitorSources['tracker'];
  readonly #reader: ActivityMonitorSources['reader'];
  readonly #intervalMs: number;
  readonly #maxBytesPerPoll: number;
  readonly #sessions = new Map<string, WatchedSession>();
  readonly #listeners = new Set<ActivityListener>();
  #generation = 0;
  #running = false;
  #timer: NodeJS.Timeout | undefined;

  constructor({ tracker, scanner, reader, intervalMs = DEFAULT_INTERVAL_MS, maxBytesPerPoll = DEFAULT_MAX_BYTES_PER_POLL }: ActivityMonitorSources) {
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
    const unsettled = [...this.#sessions.values()].filter((session) => !session.settled);
    await Promise.all(unsettled.map((session) => this.#read(session)));
  }

  get(sessionId: string): LiveActivity | undefined {
    return copyOf(this.#sessions.get(sessionId)?.activity);
  }

  onChange(listener: ActivityListener): () => void {
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
      this.#sessions.set(id, { id, hosted, folder, state, settled: false });
      return;
    }
    const previous = session.state;
    Object.assign(session, { hosted, folder, state });
    if (previous === state) return;
    session.settled = false;
    // The user line of a new turn reaches the transcript just after this change: the next read computes the value.
    if (state === 'working' && (previous === 'idle' || previous === 'ended')) return;
    this.#publish(session);
  }

  #transcriptOf(session: WatchedSession): Transcript | undefined {
    const claudeSessionId = session.hosted ? this.#tracker.claudeSessionId(session.id) : session.id;
    if (session.transcript?.claudeSessionId === claudeSessionId) return session.transcript;
    session.transcript =
      claudeSessionId === undefined
        ? undefined
        : { claudeSessionId, offsets: new Map(), model: new TurnModel(), finishedSubagents: new Set(), loaded: false, reading: false };
    this.#publish(session);
    return session.transcript;
  }

  async #read(session: WatchedSession): Promise<void> {
    const transcript = this.#transcriptOf(session);
    if (!transcript || transcript.reading) return;
    const endedAtStart = session.state === 'ended';
    let complete = false;
    transcript.reading = true;
    try {
      transcript.file ??= await this.#reader.locate(session.folder, transcript.claudeSessionId);
      complete = transcript.file === undefined || (await this.#readFiles(transcript, transcript.file));
    } catch {
      return;
    } finally {
      transcript.reading = false;
    }
    if (this.#sessions.get(session.id) !== session || session.transcript !== transcript) return;
    if (complete && endedAtStart && session.state === 'ended') session.settled = true;
    if (complete && transcript.file !== undefined) transcript.loaded = true;
    this.#publish(session);
  }

  /** True when every file reached its end within the byte budget. */
  async #readFiles(transcript: Transcript, main: string): Promise<boolean> {
    let budget = this.#maxBytesPerPoll;
    for (const file of [main, ...(await subagentFilesOf(main))]) {
      if (budget <= 0) return false;
      const start = transcript.offsets.get(file) ?? 0;
      const { entries, offset, more } = await this.#reader.readEntriesFrom(file, start, budget);
      transcript.offsets.set(file, offset);
      budget -= offset - start;
      if (file === main) transcript.model.addMainEntries(entries);
      else await this.#readSubagent(transcript, file, entries);
      if (more) return false;
    }
    return true;
  }

  async #readSubagent(transcript: Transcript, file: string, entries: readonly Record<string, unknown>[]): Promise<void> {
    const id = subagentIdOf(file);
    transcript.model.addSubagentEntries(id, entries);
    if (entries.length === 0 && transcript.finishedSubagents.has(id)) return;
    const meta = await subagentMetaOf(file);
    // A metadata file caught while Claude Code rewrites it reads as empty: the known fields stay.
    if (Object.keys(meta).length > 0) transcript.model.setSubagentMeta(id, meta);
    if (meta.finished === true) transcript.finishedSubagents.add(id);
    else if (Object.keys(meta).length > 0) transcript.finishedSubagents.delete(id);
  }

  #publish(session: WatchedSession): void {
    const next = session.transcript?.loaded ? liveActivityOf(session.transcript.model, session.state) : undefined;
    if (sameActivity(session.activity, next)) return;
    session.activity = next;
    for (const listener of this.#listeners) listener(session.id, copyOf(next));
  }
}
