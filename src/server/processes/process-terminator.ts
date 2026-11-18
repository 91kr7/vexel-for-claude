import { classifyProcesses } from './process-kind.js';
import type { ProcessReader } from './process-reader.js';

export type TerminateOutcome = 'ended' | 'gone' | 'running' | 'not_allowed';

export interface TerminateResult {
  outcome: TerminateOutcome;
  /** Runs once the answer is sent: the current instance signals itself only then. */
  afterAnswer?: () => void;
}

interface HostedSession {
  pid: number;
  exited: boolean;
  stop(): void;
  onExit(listener: () => void): () => unknown;
}

export interface ProcessTerminatorDeps {
  reader: Pick<ProcessReader, 'readProcesses' | 'isRunning'>;
  registry: { list(): HostedSession[] };
  ownPid: number;
  appName: string;
  signal?: (pid: number, signal: NodeJS.Signals) => void;
  endTimeoutMs?: number;
  sessionEndTimeoutMs?: number;
  pollMs?: number;
}

const DEFAULT_END_TIMEOUT_MS = 5000;
// Session.stop() sends SIGKILL after 5 s: the wait covers it.
const DEFAULT_SESSION_END_TIMEOUT_MS = 7000;
const DEFAULT_POLL_MS = 100;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
}

export class ProcessTerminator {
  readonly #deps: ProcessTerminatorDeps;
  readonly #signal: (pid: number, signal: NodeJS.Signals) => void;

  constructor(deps: ProcessTerminatorDeps) {
    this.#deps = deps;
    this.#signal = deps.signal ?? ((pid, signal) => process.kill(pid, signal));
  }

  async terminate(pid: number, startedAt: number): Promise<TerminateResult> {
    const { reader, ownPid, appName } = this.#deps;
    if (!Number.isInteger(pid) || pid < 1) return { outcome: 'gone' };
    const facts = await reader.readProcesses();
    const fact = facts.find((candidate) => candidate.pid === pid);
    if (fact?.startedAt !== startedAt || !classifyProcesses(facts, { appName, ownPid }).has(pid)) return { outcome: 'gone' };
    if (pid === ownPid) return { outcome: 'ended', afterAnswer: () => this.#signal(ownPid, 'SIGTERM') };
    const session = this.#deps.registry.list().find((candidate) => candidate.pid === pid && !candidate.exited);
    if (session) return { outcome: await this.#stopSession(session) };
    return { outcome: await this.#signalAndWait(pid, fact.startTicks) };
  }

  async #stopSession(session: HostedSession): Promise<TerminateOutcome> {
    let unsubscribe = () => {};
    let timer: NodeJS.Timeout | undefined;
    await new Promise<void>((resolve) => {
      unsubscribe = session.onExit(resolve);
      timer = setTimeout(resolve, this.#deps.sessionEndTimeoutMs ?? DEFAULT_SESSION_END_TIMEOUT_MS);
      session.stop();
    });
    unsubscribe();
    clearTimeout(timer);
    return session.exited ? 'ended' : 'running';
  }

  async #signalAndWait(pid: number, startTicks: string): Promise<TerminateOutcome> {
    try {
      this.#signal(pid, 'SIGTERM');
    } catch (error) {
      const code = errorCode(error);
      if (code === 'EPERM') return 'not_allowed';
      if (code === 'ESRCH') return 'ended';
      throw error;
    }
    const deadline = Date.now() + (this.#deps.endTimeoutMs ?? DEFAULT_END_TIMEOUT_MS);
    const pollMs = this.#deps.pollMs ?? DEFAULT_POLL_MS;
    while (await this.#deps.reader.isRunning(pid, startTicks)) {
      if (Date.now() >= deadline) return 'running';
      await delay(pollMs);
    }
    return 'ended';
  }
}
