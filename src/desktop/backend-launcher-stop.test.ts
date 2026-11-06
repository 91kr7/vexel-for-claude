// Tests of plan-desktop_app, batch window-tray: BackendLauncher.stopStartedBackend (REQ-15, REQ-16).
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type Launcher = typeof import('./backend-launcher.js');

const node = process.execPath;
let tmp: string;
let launcher: Launcher;
const pids: number[] = [];
const children: ChildProcess[] = [];

beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'ai-client-launcher-stop-test-'));
});

// A fresh module per test: the launcher remembers the server it started.
beforeEach(async () => {
  vi.resetModules();
  launcher = await import('./backend-launcher.js');
});

afterEach(() => {
  for (const pid of pids.splice(0)) if (isAlive(pid)) process.kill(pid, 'SIGKILL');
  for (const child of children.splice(0)) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
});

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitFor(condition: () => boolean | Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await condition()) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return condition();
}

const logFile = () => path.join(tmp, `backend-${Math.random().toString(36).slice(2)}.log`);

async function pidInLog(log: string): Promise<number> {
  let match: RegExpExecArray | null = null;
  await waitFor(async () => (match = /^pid (\d+)$/m.exec(await readFile(log, 'utf8').catch(() => ''))) !== null, 5000);
  if (!match) throw new Error('no pid in log');
  const pid = Number((match as RegExpExecArray)[1]);
  pids.push(pid);
  return pid;
}

/** A fake server that answers the health check on PORT. `onSigterm` is the code its SIGTERM handler runs. */
const fakeServer = (onSigterm: string, listenAfterMs = 100, extra = '') => [
  node,
  '-e',
  `const http = require('node:http');
   console.log('pid ' + process.pid);
   process.on('SIGTERM', () => { console.log('got SIGTERM'); ${onSigterm} });
   setTimeout(() => http.createServer((q, s) => {
     if (q.url !== '/api/health') return s.writeHead(404).end();
     s.writeHead(200, { 'content-type': 'application/json' }).end('{"status":"ok"}');
   }).listen(Number(process.env.PORT), '127.0.0.1'), ${listenAfterMs});
   ${extra}`,
];

describe('stopStartedBackend', () => {
  it('resolves at once when no server was started', async () => {
    const start = Date.now();
    await launcher.stopStartedBackend();
    expect(Date.now() - start).toBeLessThan(200);
  });

  it('sends SIGTERM to the started server and resolves only once it has exited', async () => {
    const log = logFile();
    const result = await launcher.launchBackend({ rootDir: tmp, logFile: log, port: await freePort(), command: fakeServer('setTimeout(() => process.exit(0), 700);') });
    expect(result).toMatchObject({ status: 'ready', startedByApp: true });
    const pid = await pidInLog(log);
    const start = Date.now();
    await launcher.stopStartedBackend();
    expect(isAlive(pid)).toBe(false);
    expect(Date.now() - start).toBeGreaterThanOrEqual(600);
    expect(await readFile(log, 'utf8')).toContain('got SIGTERM');
  });

  it('sends SIGKILL when the server still runs after the kill timeout', async () => {
    const log = logFile();
    await launcher.launchBackend({ rootDir: tmp, logFile: log, port: await freePort(), command: fakeServer('') });
    const pid = await pidInLog(log);
    const start = Date.now();
    await launcher.stopStartedBackend(1000);
    const elapsed = Date.now() - start;
    expect(isAlive(pid)).toBe(false);
    expect(elapsed).toBeGreaterThanOrEqual(900);
    expect(elapsed).toBeLessThan(5000);
    expect(await readFile(log, 'utf8')).toContain('got SIGTERM');
  });

  it('resolves at once when the started server has already exited', async () => {
    const log = logFile();
    await launcher.launchBackend({
      rootDir: tmp,
      logFile: log,
      port: await freePort(),
      command: fakeServer('process.exit(0);', 100, 'setTimeout(() => process.exit(0), 500);'),
    });
    const pid = await pidInLog(log);
    expect(await waitFor(() => !isAlive(pid), 5000)).toBe(true);
    const start = Date.now();
    await launcher.stopStartedBackend();
    expect(Date.now() - start).toBeLessThan(200);
    expect(await readFile(log, 'utf8')).not.toContain('got SIGTERM');
  });

  it('never stops a reused backend', async () => {
    const port = await freePort();
    const backend = spawn(node, fakeServer('process.exit(0);', 0).slice(1), { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
    children.push(backend);
    expect(await waitFor(() => launcher.isBackendRunning(`http://127.0.0.1:${port}`), 5000)).toBe(true);
    const result = await launcher.launchBackend({ rootDir: tmp, logFile: logFile(), port, command: [node, '-e', 'process.exit(1)'] });
    expect(result).toMatchObject({ status: 'ready', startedByApp: false });
    await launcher.stopStartedBackend(500);
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(backend.exitCode).toBeNull();
    expect(backend.signalCode).toBeNull();
    expect(await launcher.isBackendRunning(`http://127.0.0.1:${port}`)).toBe(true);
  });

  it('stops a server that is still starting', async () => {
    const log = logFile();
    const launch = launcher.launchBackend({ rootDir: tmp, logFile: log, port: await freePort(), readyTimeoutMs: 20_000, command: fakeServer('process.exit(0);', 60_000) });
    const pid = await pidInLog(log);
    await launcher.stopStartedBackend(1000);
    expect(isAlive(pid)).toBe(false);
    // The spec gives no result for this launch; it must only settle.
    await Promise.race([launch, new Promise((resolve) => setTimeout(resolve, 5000))]);
  });
});
