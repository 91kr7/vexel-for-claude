import { isHanging } from './hanging-rule.js';
import { classifyProcesses, type ProcessKind } from './process-kind.js';
import type { ProcessReader } from './process-reader.js';

export interface ProcessRow {
  kind: ProcessKind;
  pid: number;
  startedAt: number;
  port?: number;
  folder?: string;
  label?: string;
  thisInstance: boolean;
  hosted: boolean;
  hanging: boolean;
}

export interface ProcessListDeps {
  reader: Pick<ProcessReader, 'readProcesses' | 'readListeningPorts'>;
  registry: { hostedPids(): Iterable<number> };
  tracker: { get(sessionId: string): { label: string } | undefined };
  ownPid: number;
  appName: string;
}

const KIND_ORDER: ProcessKind[] = ['app-server', 'test-server', 'fake-claude', 'claude-session'];

function compareRows(a: ProcessRow, b: ProcessRow): number {
  return (
    Number(b.thisInstance) - Number(a.thisInstance) ||
    KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
    a.startedAt - b.startedAt ||
    a.pid - b.pid
  );
}

export class ProcessList {
  readonly #deps: ProcessListDeps;
  #inFlight: Promise<ProcessRow[]> | undefined;
  #next: Promise<ProcessRow[]> | undefined;

  constructor(deps: ProcessListDeps) {
    this.#deps = deps;
  }

  // A call never gets the rows of a read that started before it: calls that arrive during a read share the next one.
  list(): Promise<ProcessRow[]> {
    if (!this.#inFlight) return this.#start();
    this.#next ??= this.#inFlight.then(
      () => this.#start(),
      () => this.#start(),
    );
    return this.#next;
  }

  #start(): Promise<ProcessRow[]> {
    this.#next = undefined;
    const read = this.#read().finally(() => {
      if (this.#inFlight === read) this.#inFlight = undefined;
    });
    this.#inFlight = read;
    return read;
  }

  async #read(): Promise<ProcessRow[]> {
    const { reader, registry, tracker, ownPid, appName } = this.#deps;
    const facts = await reader.readProcesses();
    const kinds = classifyProcesses(facts, { appName, ownPid });
    const serverPids = [...kinds].filter(([, kind]) => kind === 'app-server' || kind === 'test-server').map(([pid]) => pid);
    const ports = await reader.readListeningPorts(serverPids);
    const hosted = new Set(registry.hostedPids());
    const rows: ProcessRow[] = [];
    for (const fact of facts) {
      const kind = kinds.get(fact.pid);
      if (kind === undefined) continue;
      const row: ProcessRow = {
        kind,
        pid: fact.pid,
        startedAt: fact.startedAt,
        thisInstance: fact.pid === ownPid,
        hosted: hosted.has(fact.pid),
        hanging: isHanging(fact, kinds, facts, ownPid),
      };
      const port = ports.get(fact.pid)?.[0];
      if (port !== undefined) row.port = port;
      if ((kind === 'fake-claude' || kind === 'claude-session') && fact.cwd !== undefined) row.folder = fact.cwd;
      const sessionId = fact.markers.sessionId;
      const label = row.hosted && sessionId !== undefined ? tracker.get(sessionId)?.label : undefined;
      if (label !== undefined) row.label = label;
      rows.push(row);
    }
    return rows.sort(compareRows);
  }
}
