// REQ tests of plan-app_processes, batch processes-list, against real server processes.
// Every process here is started by this file and stopped by its own PID (knowledge base no-kill-by-pattern).
import { type ChildProcess, spawn } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pty from 'node-pty';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FAKE_CLI, delay, tempDir, waitFor } from './test-support.js';

interface Row {
  kind: string;
  pid: number;
  startedAt: number;
  port?: number;
  folder?: string;
  label?: string;
  thisInstance: boolean;
  hosted: boolean;
  hanging: boolean;
}

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const children: ChildProcess[] = [];
const terminals: pty.IPty[] = [];
/** Inner node processes of the servers: SIGKILL on the tsx wrapper would leave them running. */
const serverPids: number[] = [];
let dir: string;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address() as net.AddressInfo;
      probe.close(() => resolve(address.port));
    });
  });
}

const startTicks = (pid: number) => {
  const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
  return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19] as string;
};

function track(child: ChildProcess): ChildProcess {
  children.push(child);
  return child;
}

/** Starts a server with the fake CLI and its own folders; `env` adds or removes variables. */
async function startServer(name: string, env: Record<string, string | undefined> = {}): Promise<{ base: string; port: number }> {
  const port = await freePort();
  const own = path.join(dir, name);
  const variables: Record<string, string | undefined> = {
    ...process.env,
    PORT: String(port),
    AI_CLIENT_CLAUDE_CLI: FAKE_CLI,
    CLAUDE_CONFIG_DIR: path.join(own, 'claude'),
    AI_CLIENT_DATA_DIR: path.join(own, 'data'),
    AI_CLIENT_LAUNCHER: undefined,
    AI_CLIENT_TEST_SERVER: undefined,
    ...env,
  };
  for (const key of Object.keys(variables)) if (variables[key] === undefined) delete variables[key];
  track(spawn(path.join(repoRoot, 'node_modules/.bin/tsx'), ['src/server/main.ts'], { cwd: repoRoot, env: variables, stdio: 'ignore' }));
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${base}/api/health`).catch(() => undefined);
    if (response?.ok) {
      const rows = (await (await fetch(`${base}/api/processes`)).json()) as { processes: Row[] };
      const self = rows.processes.find((row) => row.thisInstance);
      if (self) serverPids.push(self.pid);
      return { base, port };
    }
    await delay(50);
  }
  throw new Error(`the server ${name} did not answer`);
}

async function processes(base: string): Promise<Row[]> {
  const response = await fetch(`${base}/api/processes`);
  expect(response.status).toBe(200);
  return ((await response.json()) as { processes: Row[] }).processes;
}

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** Server A: no launcher; it hosts one session. B: launched by a process that still runs. C: its launcher is gone. */
let a: { base: string; port: number };
let b: { base: string; port: number };
let c: { base: string; port: number };
let session: { id: string; folder: string };
let liveLauncher: ChildProcess;

beforeAll(async () => {
  dir = await tempDir('ai-client-processes-');
  liveLauncher = track(spawn(process.execPath, ['-e', 'setTimeout(() => {}, 600000)'], { stdio: 'ignore' }));
  const goneLauncher = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 600000)'], { stdio: 'ignore' });
  await waitFor(() => goneLauncher.pid !== undefined && liveLauncher.pid !== undefined, 'the launchers start');
  const goneMarker = `${goneLauncher.pid}:${startTicks(goneLauncher.pid as number)}`;
  const exited = new Promise((resolve) => goneLauncher.once('exit', resolve));
  goneLauncher.kill('SIGKILL');
  await exited;
  [a, b, c] = await Promise.all([
    startServer('a', { AI_CLIENT_CLAUDE_CLI: '/usr/bin/false-claude-not-used' }),
    startServer('b', { AI_CLIENT_LAUNCHER: `${liveLauncher.pid}:${startTicks(liveLauncher.pid as number)}`, AI_CLIENT_TEST_SERVER: '1' }),
    startServer('c', { AI_CLIENT_LAUNCHER: goneMarker, AI_CLIENT_TEST_SERVER: '1' }),
  ]);
  const folder = path.join(dir, 'project-one');
  await mkdir(folder, { recursive: true });
  const started = await fetch(`${b.base}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: folder }),
  });
  expect(started.status).toBe(201);
  session = { id: ((await started.json()) as { id: string }).id, folder };
}, 90_000);

afterAll(async () => {
  for (const pid of serverPids.splice(0)) if (isAlive(pid)) process.kill(pid, 'SIGTERM');
  for (const terminal of terminals.splice(0)) if (isAlive(terminal.pid)) process.kill(terminal.pid, 'SIGKILL');
  for (const child of children.splice(0)) if (child.pid !== undefined && isAlive(child.pid)) process.kill(child.pid, 'SIGKILL');
  await delay(1000);
  if (dir) await rm(dir, { recursive: true, force: true });
});

const own = (rows: Row[]) => rows.filter((row) => row.thisInstance);
const serverOn = (rows: Row[], port: number) => rows.find((row) => (row.kind === 'app-server' || row.kind === 'test-server') && row.port === port);
const sessionRow = (rows: Row[]) => rows.find((row) => row.folder === session.folder);

describe('GET /api/processes on real servers', () => {
  // plan-app_processes/REQ-10, REQ-13, REQ-14, REQ-17
  it('gives the current instance first, once, marked "this instance", with its port, kind, pid and start time', async () => {
    const rows = await processes(b.base);
    expect(own(rows)).toHaveLength(1);
    expect(rows[0]?.thisInstance).toBe(true);
    expect(rows[0]).toMatchObject({ kind: 'test-server', port: b.port, hanging: false });
    expect(isAlive(rows[0]?.pid as number)).toBe(true);
    expect(rows[0]?.startedAt).toBeGreaterThan(Date.now() - 120_000);
    expect(rows[0]?.startedAt).toBeLessThanOrEqual(Date.now());
  });

  // plan-app_processes/REQ-2, REQ-3, REQ-6: the other servers, unknown to this one, each once with its port
  it('lists the other app and test servers with their ports, not as this instance', async () => {
    const rows = await processes(b.base);
    expect(serverOn(rows, a.port)).toMatchObject({ kind: 'app-server', thisInstance: false });
    expect(serverOn(rows, c.port)).toMatchObject({ kind: 'test-server', thisInstance: false });
    expect(rows.filter((row) => row.port === a.port)).toHaveLength(1);
  });

  // plan-app_processes/REQ-3: a server whose Claude CLI is the fake one is a test server
  it('gives test-server to a server started with the fake Claude CLI only', async () => {
    const plain = await startServer('d');
    const rows = await processes(plain.base);
    expect(own(rows)[0]).toMatchObject({ kind: 'test-server', port: plain.port });
  }, 60_000);

  // plan-app_processes/REQ-4, REQ-15, REQ-16, REQ-18
  it('lists the hosted fake Claude with its folder, its label and "hosted", not hanging', async () => {
    const rows = await processes(b.base);
    const sessions = (await (await fetch(`${b.base}/api/sessions`)).json()) as Array<{ id: string; label: string }>;
    const label = sessions.find((entry) => entry.id === session.id)?.label;
    expect(sessionRow(rows)).toMatchObject({ kind: 'fake-claude', folder: session.folder, label, hosted: true, hanging: false, thisInstance: false });
  });

  // plan-app_processes/REQ-18: a session of another server is listed, but not hosted here
  it('lists the session of another server as not hosted and not hanging', async () => {
    const rows = await processes(a.base);
    expect(sessionRow(rows)).toMatchObject({ kind: 'fake-claude', hosted: false, hanging: false });
    expect(sessionRow(rows)).not.toHaveProperty('label');
  });

  // plan-app_processes/REQ-19
  it('marks hanging the server whose launcher is gone, and neither the one whose launcher runs nor the one started by hand', async () => {
    const rows = await processes(a.base);
    expect(serverOn(rows, c.port)?.hanging).toBe(true);
    expect(serverOn(rows, b.port)?.hanging).toBe(false);
    expect(own(rows)[0]?.hanging).toBe(false);
  });

  // plan-app_processes/REQ-19: the current instance is never hanging
  it('does not mark the current instance hanging, even when its launcher is gone', async () => {
    const rows = await processes(c.base);
    expect(own(rows)[0]).toMatchObject({ port: c.port, hanging: false });
  });

  // spec server: the sessions do not inherit the launcher marker
  it('does not pass the launcher marker to the processes of its sessions', async () => {
    const pid = sessionRow(await processes(b.base))?.pid as number;
    const environ = await readFile(`/proc/${pid}/environ`, 'utf8');
    expect(environ.split('\0').some((entry) => entry.startsWith('AI_CLIENT_LAUNCHER='))).toBe(false);
    expect(environ.split('\0')).toContain(`AI_CLIENT_SESSION_ID=${session.id}`);
  });

  // plan-app_processes/REQ-4, REQ-5, REQ-6, REQ-19: leftovers whose parent is not a server
  it('lists a leftover fake Claude and a leftover Claude session as hanging', async () => {
    const leftoverFolder = path.join(dir, 'leftover');
    await mkdir(leftoverFolder, { recursive: true });
    // The fake CLI needs a terminal.
    const fake = pty.spawn(process.execPath, [FAKE_CLI], { cwd: leftoverFolder, cols: 80, rows: 24 });
    terminals.push(fake);
    let output = '';
    fake.onData((data) => (output += data));
    const claude = track(
      spawn(process.execPath, ['-e', 'setTimeout(() => {}, 600000)'], { cwd: leftoverFolder, env: { ...process.env, AI_CLIENT_SESSION_ID: 'orphan-1' }, stdio: 'ignore' }),
    );
    await waitFor(() => output.includes('READY') && claude.pid !== undefined, 'the leftovers start');
    const rows = await processes(a.base);
    expect(rows.find((row) => row.pid === fake.pid)).toMatchObject({ kind: 'fake-claude', folder: leftoverFolder, hanging: true, hosted: false });
    expect(rows.find((row) => row.pid === claude.pid)).toMatchObject({ kind: 'claude-session', folder: leftoverFolder, hanging: true, hosted: false });
  });

  // plan-app_processes/REQ-7: a Claude process without the app's session id is external
  it('does not list a process without the session id', async () => {
    const external = track(spawn(process.execPath, ['-e', 'setTimeout(() => {}, 600000)'], { stdio: 'ignore' }));
    await waitFor(() => external.pid !== undefined, 'the external process starts');
    const rows = await processes(a.base);
    expect(rows.some((row) => row.pid === external.pid)).toBe(false);
  });

  // plan-app_processes/REQ-8: only processes of the current user
  it('lists no process of another user', async () => {
    const uid = process.getuid?.();
    const rows = await processes(a.base);
    for (const row of rows) expect(statSync(`/proc/${row.pid}`).uid).toBe(uid);
  });

  // plan-app_processes/REQ-11: each call reads again
  it('shows a process started after a previous call', async () => {
    const before = await processes(a.base);
    const later = track(spawn(process.execPath, ['-e', 'setTimeout(() => {}, 600000)'], { env: { ...process.env, AI_CLIENT_SESSION_ID: 'later-1' }, stdio: 'ignore' }));
    await waitFor(() => later.pid !== undefined, 'the new process starts');
    expect(before.some((row) => row.pid === later.pid)).toBe(false);
    expect((await processes(a.base)).some((row) => row.pid === later.pid)).toBe(true);
  });

  // plan-app_processes/REQ-20: listing does not hold up the server
  it('keeps answering other requests while several lists run', async () => {
    const lists = Promise.all(Array.from({ length: 5 }, () => processes(b.base)));
    const started = Date.now();
    const health = await fetch(`${b.base}/api/health`);
    expect(health.ok).toBe(true);
    expect(Date.now() - started).toBeLessThan(1000);
    const answers = await lists;
    for (const rows of answers) expect(own(rows)).toHaveLength(1);
  });
});
