import path from 'node:path';
import type { ExternalSessionCheck, RunningSessionFile } from '../history/external-session-check.js';
import type { SessionHistory } from '../history/session-history.js';
import { labelOf } from '../sessions/session-state-tracker.js';

export interface ExternalSessionSummary {
  id: string;
  folder: string;
  label: string;
  state: 'working' | 'needs_input' | 'idle';
  lastActivity: string;
  external: true;
}

export type ExternalSessionChange =
  | { type: 'session'; session: ExternalSessionSummary }
  | { type: 'session-removed'; id: string };

export interface ExternalSessionScannerDependencies {
  check: Pick<ExternalSessionCheck, 'runningSessions'>;
  history: Pick<SessionHistory, 'get'>;
  hostedPids: () => Iterable<number>;
  intervalMs?: number;
  now?: () => Date;
}

const DEFAULT_INTERVAL_MS = 2000;

interface Entry {
  summary: ExternalSessionSummary;
  labelFromMessage: boolean;
  firstSeen: string;
}

function sameSummary(a: ExternalSessionSummary, b: ExternalSessionSummary): boolean {
  return a.folder === b.folder && a.label === b.label && a.state === b.state && a.lastActivity === b.lastActivity;
}

function stateOf(status: string | undefined): ExternalSessionSummary['state'] {
  if (status === 'busy') return 'working';
  return status === 'waiting' ? 'needs_input' : 'idle';
}

function interactiveFiles(files: RunningSessionFile[]): Map<string, RunningSessionFile & { cwd: string }> {
  const bySessionId = new Map<string, RunningSessionFile & { cwd: string }>();
  for (const file of files) {
    if (file.kind !== 'interactive' || typeof file.cwd !== 'string' || file.cwd === '') continue;
    const known = bySessionId.get(file.sessionId);
    if (!known || (file.updatedAt ?? -Infinity) > (known.updatedAt ?? -Infinity)) {
      bySessionId.set(file.sessionId, file as RunningSessionFile & { cwd: string });
    }
  }
  return bySessionId;
}

export class ExternalSessionScanner {
  readonly #deps: ExternalSessionScannerDependencies;
  readonly #intervalMs: number;
  readonly #now: () => Date;
  readonly #entries = new Map<string, Entry>();
  readonly #listeners = new Set<(change: ExternalSessionChange) => void>();
  #generation = 0;
  #running = false;
  #timer: NodeJS.Timeout | undefined;

  constructor(deps: ExternalSessionScannerDependencies) {
    this.#deps = deps;
    this.#intervalMs = deps.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.#now = deps.now ?? (() => new Date());
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

  async scan(): Promise<void> {
    let files: RunningSessionFile[];
    try {
      files = await this.#deps.check.runningSessions(this.#deps.hostedPids());
    } catch {
      return;
    }
    const found = interactiveFiles(files);
    const scanTime = this.#now().toISOString();
    for (const [id, file] of found) {
      const known = this.#entries.get(id);
      const firstSeen = known?.firstSeen ?? scanTime;
      let label = known?.labelFromMessage ? known.summary.label : '';
      let labelFromMessage = known?.labelFromMessage ?? false;
      if (!labelFromMessage) {
        const message = await this.#deps.history
          .get(id)
          .then((past) => labelOf(past?.firstUserMessage))
          .catch(() => '');
        labelFromMessage = message !== '';
        label = message || path.basename(file.cwd) || file.cwd;
      }
      const summary: ExternalSessionSummary = {
        id,
        folder: file.cwd,
        label,
        state: stateOf(file.status),
        lastActivity: typeof file.updatedAt === 'number' ? new Date(file.updatedAt).toISOString() : firstSeen,
        external: true,
      };
      this.#entries.set(id, { summary, labelFromMessage, firstSeen });
      if (!known || !sameSummary(known.summary, summary)) this.#notify({ type: 'session', session: { ...summary } });
    }
    for (const id of [...this.#entries.keys()]) {
      if (found.has(id)) continue;
      this.#entries.delete(id);
      this.#notify({ type: 'session-removed', id });
    }
  }

  list(): ExternalSessionSummary[] {
    return [...this.#entries.values()].map((entry) => ({ ...entry.summary }));
  }

  get(id: string): ExternalSessionSummary | undefined {
    const entry = this.#entries.get(id);
    return entry && { ...entry.summary };
  }

  onChange(listener: (change: ExternalSessionChange) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async #loop(generation: number): Promise<void> {
    await this.scan();
    if (generation !== this.#generation) return;
    this.#timer = setTimeout(() => void this.#loop(generation), this.#intervalMs);
    this.#timer.unref();
  }

  #notify(change: ExternalSessionChange): void {
    for (const listener of this.#listeners) listener(change);
  }
}
