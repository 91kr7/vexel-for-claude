import { readdir, readFile, readlink, stat } from 'node:fs/promises';
import path from 'node:path';

export const LAUNCHER_VARIABLE = 'AI_CLIENT_LAUNCHER';
export const TEST_SERVER_VARIABLE = 'AI_CLIENT_TEST_SERVER';
const SESSION_ID_VARIABLE = 'AI_CLIENT_SESSION_ID';
const CLAUDE_CLI_VARIABLE = 'AI_CLIENT_CLAUDE_CLI';
// USER_HZ: the unit of the start time in /proc/<pid>/stat on Linux.
const CLOCK_TICKS_PER_SECOND = 100;
const TCP_LISTEN_STATE = '0A';

export interface ProcessMarkers {
  sessionId?: string;
  launcher?: { pid: number; startTicks: string };
  testServer: boolean;
  claudeCli?: string;
}

export interface ProcessFacts {
  pid: number;
  ppid: number;
  startTicks: string;
  startedAt: number;
  argv: string[];
  cwd?: string;
  cwdPackageName?: string;
  markers: ProcessMarkers;
}

export interface ProcessReaderOptions {
  procDir?: string;
  uid?: number;
}

function parseStat(text: string): { ppid: number; startTicks: string } | undefined {
  const fields = text.slice(text.lastIndexOf(')') + 2).split(' ');
  const ppid = Number(fields[1]);
  const startTicks = fields[19];
  if (!Number.isInteger(ppid) || startTicks === undefined || !/^\d+$/.test(startTicks)) return undefined;
  return { ppid, startTicks };
}

function parseMarkers(environ: string | undefined): ProcessMarkers {
  const markers: ProcessMarkers = { testServer: false };
  if (environ === undefined) return markers;
  for (const entry of environ.split('\0')) {
    const separator = entry.indexOf('=');
    if (separator < 0) continue;
    const name = entry.slice(0, separator);
    const value = entry.slice(separator + 1);
    if (name === SESSION_ID_VARIABLE) markers.sessionId = value;
    else if (name === TEST_SERVER_VARIABLE) markers.testServer = value === '1';
    else if (name === CLAUDE_CLI_VARIABLE) markers.claudeCli = value;
    else if (name === LAUNCHER_VARIABLE) {
      const match = /^(\d+):(\d+)$/.exec(value);
      if (match?.[1] !== undefined && match[2] !== undefined) markers.launcher = { pid: Number(match[1]), startTicks: match[2] };
    }
  }
  return markers;
}

function listeningInodes(table: string): Map<string, number> {
  const inodes = new Map<string, number>();
  for (const line of table.split('\n').slice(1)) {
    const fields = line.trim().split(/\s+/);
    const localAddress = fields[1];
    const inode = fields[9];
    if (fields[3] !== TCP_LISTEN_STATE || localAddress === undefined || inode === undefined) continue;
    const port = Number.parseInt(localAddress.slice(localAddress.lastIndexOf(':') + 1), 16);
    if (Number.isInteger(port)) inodes.set(inode, port);
  }
  return inodes;
}

export class ProcessReader {
  readonly #procDir: string;
  readonly #uid: number | undefined;

  constructor(options: ProcessReaderOptions = {}) {
    this.#procDir = options.procDir ?? '/proc';
    this.#uid = options.uid ?? process.getuid?.();
  }

  async readProcesses(): Promise<ProcessFacts[]> {
    const [entries, bootTime] = await Promise.all([readdir(this.#procDir), this.#bootTime()]);
    const packageNames = new Map<string, Promise<string | undefined>>();
    const packageNameOf = (cwd: string) => {
      let name = packageNames.get(cwd);
      if (!name) {
        name = readFile(path.join(cwd, 'package.json'), 'utf8')
          .then((text) => {
            const value = (JSON.parse(text) as { name?: unknown } | null)?.name;
            return typeof value === 'string' ? value : undefined;
          })
          .catch(() => undefined);
        packageNames.set(cwd, name);
      }
      return name;
    };
    const facts = await Promise.all(
      entries.filter((entry) => /^\d+$/.test(entry)).map((entry) => this.#readProcess(Number(entry), bootTime, packageNameOf)),
    );
    return facts.filter((fact): fact is ProcessFacts => fact !== undefined);
  }

  async readListeningPorts(pids: Iterable<number>): Promise<Map<number, number[]>> {
    const tables = await Promise.all(
      ['tcp', 'tcp6'].map((name) => readFile(path.join(this.#procDir, 'net', name), 'utf8').catch(() => '')),
    );
    const inodes = new Map(tables.flatMap((table) => [...listeningInodes(table)]));
    const ports = new Map<number, number[]>();
    await Promise.all(
      [...pids].map(async (pid) => {
        const fdDir = path.join(this.#procDir, String(pid), 'fd');
        const fds = await readdir(fdDir).catch(() => [] as string[]);
        const targets = await Promise.all(fds.map((fd) => readlink(path.join(fdDir, fd)).catch(() => '')));
        const found = new Set<number>();
        for (const target of targets) {
          const port = inodes.get(/^socket:\[(\d+)\]$/.exec(target)?.[1] ?? '');
          if (port !== undefined) found.add(port);
        }
        if (found.size > 0) ports.set(pid, [...found].sort((a, b) => a - b));
      }),
    );
    return ports;
  }

  async #bootTime(): Promise<number> {
    const text = await readFile(path.join(this.#procDir, 'stat'), 'utf8').catch(() => '');
    return Number(/^btime (\d+)$/m.exec(text)?.[1] ?? 0);
  }

  async #readProcess(
    pid: number,
    bootTime: number,
    packageNameOf: (cwd: string) => Promise<string | undefined>,
  ): Promise<ProcessFacts | undefined> {
    const dir = path.join(this.#procDir, String(pid));
    try {
      const owner = await stat(dir);
      if (this.#uid !== undefined && owner.uid !== this.#uid) return undefined;
      const [statText, cmdline, cwd, environ] = await Promise.all([
        readFile(path.join(dir, 'stat'), 'utf8'),
        readFile(path.join(dir, 'cmdline'), 'utf8'),
        readlink(path.join(dir, 'cwd')).catch(() => undefined),
        readFile(path.join(dir, 'environ'), 'utf8').catch(() => undefined),
      ]);
      const parsed = parseStat(statText);
      if (!parsed) return undefined;
      const fact: ProcessFacts = {
        pid,
        ppid: parsed.ppid,
        startTicks: parsed.startTicks,
        startedAt: (bootTime + Number(parsed.startTicks) / CLOCK_TICKS_PER_SECOND) * 1000,
        argv: cmdline === '' ? [] : cmdline.replace(/\0$/, '').split('\0'),
        markers: parseMarkers(environ),
      };
      if (cwd !== undefined) {
        fact.cwd = cwd;
        const packageName = await packageNameOf(cwd);
        if (packageName !== undefined) fact.cwdPackageName = packageName;
      }
      return fact;
    } catch {
      return undefined;
    }
  }
}
