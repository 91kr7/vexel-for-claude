// Tests of plan-desktop_app, batch window-tray: the Server stops its sessions on SIGTERM and SIGINT (REQ-15).
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { delay, tempDir } from './test-support.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
let root: string;
let slowCli: string;
const servers: ChildProcess[] = [];

beforeAll(async () => {
  root = await tempDir('ai-client-shutdown-');
  // CLI stand-in: it logs each SIGTERM, takes 1 s to exit after the first one, and ignores SIGHUP so that only the server's stop ends it.
  slowCli = path.join(root, 'slow-cli.mjs');
  await writeFile(
    slowCli,
    `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
const log = (line) => appendFileSync(process.env.SHUTDOWN_MARKS + '/' + process.pid, line + '\\n');
log('started');
process.on('SIGHUP', () => {});
let exiting = false;
process.on('SIGTERM', () => {
  log('SIGTERM');
  if (exiting) return;
  exiting = true;
  setTimeout(() => { log('exited'); process.exit(0); }, 1000);
});
process.stdout.write('READY\\r\\n');
setInterval(() => {}, 1000);
`,
  );
  await chmod(slowCli, 0o755);
});

afterEach(() => {
  for (const server of servers.splice(0)) if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

async function freePort(): Promise<number> {
  const probe = net.createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address() as net.AddressInfo;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

interface Running {
  server: ChildProcess;
  base: string;
  marks: string;
  project: string;
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null; cliLogsAtExit: string[] }>;
}

async function cliLogs(marks: string): Promise<string[]> {
  const files = await readdir(marks);
  return Promise.all(files.map((file) => readFile(path.join(marks, file), 'utf8')));
}

async function startServer(name: string): Promise<Running> {
  const dir = path.join(root, name);
  const marks = path.join(dir, 'marks');
  const project = path.join(dir, 'project');
  await mkdir(marks, { recursive: true });
  await mkdir(project);
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['--import', 'tsx', 'src/server/main.ts'], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(port), AI_CLIENT_CLAUDE_CLI: slowCli, SHUTDOWN_MARKS: marks, CLAUDE_CONFIG_DIR: path.join(dir, 'claude') },
    stdio: 'ignore',
  });
  servers.push(server);
  // The CLI logs are read in the exit handler itself, so they show what had happened when the server exited.
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null; cliLogsAtExit: string[] }>((resolve) =>
    server.once('exit', (code, signal) => {
      const files = existsSync(marks) ? cliLogs(marks) : Promise.resolve([]);
      void files.then((cliLogsAtExit) => resolve({ code, signal, cliLogsAtExit }));
    }),
  );
  const deadline = Date.now() + 20_000;
  while (!(await fetch(`${base}/api/health`).then((r) => r.ok, () => false))) {
    if (Date.now() > deadline) throw new Error('server did not start');
    await delay(100);
  }
  return { server, base, marks, project, exited };
}

async function startSession({ base, project }: Running): Promise<string> {
  const response = await fetch(`${base}/api/sessions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: project }) });
  expect(response.status).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

async function makeWorking({ base }: Running, id: string): Promise<void> {
  const response = await fetch(`${base}/api/sessions/${id}/hook-events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: 'work' }),
  });
  expect(response.ok).toBe(true);
  const sessions = (await (await fetch(`${base}/api/sessions`)).json()) as { id: string; state: string }[];
  expect(sessions.find((session) => session.id === id)?.state).toBe('working');
}

async function waitForClis(running: Running, count: number): Promise<void> {
  const deadline = Date.now() + 8000;
  while ((await cliLogs(running.marks)).length < count) {
    if (Date.now() > deadline) throw new Error('CLI did not start');
    await delay(50);
  }
}

const portAnswers = (base: string) => fetch(`${base}/api/health`).then(() => true, () => false);

describe('plan-desktop_app/REQ-15 the server ends its sessions when it is stopped', () => {
  it('on SIGTERM it stops every running session, waits for their exit, then exits with code 0', async () => {
    const running = await startServer('sigterm');
    const working = await startSession(running);
    await startSession(running);
    await waitForClis(running, 2);
    await makeWorking(running, working);

    running.server.kill('SIGTERM');
    const { code, signal, cliLogsAtExit } = await running.exited;

    expect([code, signal]).toEqual([0, null]);
    expect(cliLogsAtExit).toEqual(['started\nSIGTERM\nexited\n', 'started\nSIGTERM\nexited\n']);
    expect(await portAnswers(running.base)).toBe(false);
  }, 30_000);

  it('on SIGINT it does the same', async () => {
    const running = await startServer('sigint');
    await startSession(running);
    await waitForClis(running, 1);

    running.server.kill('SIGINT');
    const { code, signal, cliLogsAtExit } = await running.exited;

    expect([code, signal]).toEqual([0, null]);
    expect(cliLogsAtExit).toEqual(['started\nSIGTERM\nexited\n']);
  }, 30_000);

  it('a second signal during the stop changes nothing', async () => {
    const running = await startServer('second-signal');
    await startSession(running);
    await waitForClis(running, 1);

    running.server.kill('SIGTERM');
    await delay(300);
    running.server.kill('SIGINT');
    running.server.kill('SIGTERM');
    const { code, signal, cliLogsAtExit } = await running.exited;

    expect([code, signal]).toEqual([0, null]);
    expect(cliLogsAtExit).toEqual(['started\nSIGTERM\nexited\n']);
  }, 30_000);
});
