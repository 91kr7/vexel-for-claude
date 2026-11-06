// Tests of plan-desktop_app, batch desktop-window: BackendLauncher spec and REQ-4, REQ-5, REQ-7, REQ-8, REQ-9, REQ-10.
import { execFile, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { backendOrigin, backendPort, isBackendRunning, launchBackend } from './backend-launcher.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const node = process.execPath;
let tmp: string;
const servers: http.Server[] = [];
const pids: number[] = [];

beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'ai-client-launcher-test-'));
});

afterEach(async () => {
  for (const server of servers.splice(0)) await new Promise((resolve) => server.close(resolve));
  for (const pid of pids.splice(0)) await stopPid(pid);
});

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function serve(handler: http.RequestListener, port = 0): Promise<number> {
  const server = http.createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  return address.port;
}

const healthy: http.RequestListener = (request, response) => {
  if (request.url !== '/api/health') return void response.writeHead(404).end();
  response.writeHead(200, { 'content-type': 'application/json' }).end('{"status":"ok"}');
};

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(condition: () => boolean | Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await condition()) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return condition();
}

async function stopPid(pid: number): Promise<void> {
  if (!isAlive(pid)) return;
  process.kill(pid, 'SIGTERM');
  if (!(await waitFor(() => !isAlive(pid), 5000))) process.kill(pid, 'SIGKILL');
}

/** PIDs of the processes listening on a TCP port of this user. */
function listenerPids(port: number): number[] {
  const out = execFileSync('ss', ['-Hltnp', `sport = :${port}`], { encoding: 'utf8' });
  return [...out.matchAll(/pid=(\d+)/g)].map((match) => Number(match[1]));
}

async function healthStatus(origin: string): Promise<number | undefined> {
  try {
    return (await fetch(`${origin}/api/health`)).status;
  } catch {
    return undefined;
  }
}

/** A fake server: it prints its pid and environment, then answers the health check on PORT after a short delay. */
const fakeServer = [
  node,
  '-e',
  `const http = require('node:http');
   console.log('pid ' + process.pid);
   console.log('env ' + process.env.NODE_ENV + ' ' + process.env.PORT);
   setTimeout(() => http.createServer((q, s) => {
     if (q.url !== '/api/health') return s.writeHead(404).end();
     s.writeHead(200, { 'content-type': 'application/json' }).end('{"status":"ok"}');
   }).listen(Number(process.env.PORT), '127.0.0.1'), 300);`,
];

function pidInLog(text: string): number {
  const match = /^pid (\d+)$/m.exec(text);
  if (!match) throw new Error(`no pid in log: ${text}`);
  return Number(match[1]);
}

describe('backendPort', () => {
  it('defaults to 4001 when PORT is missing', () => {
    expect(backendPort({})).toBe(4001);
  });

  it('defaults to 4001 when PORT is empty', () => {
    expect(backendPort({ PORT: '' })).toBe(4001);
  });

  it('uses the number in PORT', () => {
    expect(backendPort({ PORT: '5123' })).toBe(5123);
  });
});

describe('backendOrigin', () => {
  it('is the loopback address with the port', () => {
    expect(backendOrigin(5123)).toBe('http://127.0.0.1:5123');
  });
});

describe('isBackendRunning', () => {
  it('is true when /api/health answers 200 with status ok', async () => {
    const port = await serve(healthy);
    expect(await isBackendRunning(backendOrigin(port))).toBe(true);
  });

  it.each([
    ['another status', 503, '{"status":"ok"}'],
    ['another body', 200, '{"status":"starting"}'],
    ['a body that is not JSON', 200, 'ok'],
  ])('is false on %s', async (_label, status, body) => {
    const port = await serve((_request, response) => response.writeHead(status, { 'content-type': 'application/json' }).end(body));
    expect(await isBackendRunning(backendOrigin(port))).toBe(false);
  });

  it('is false when nothing listens on the port', async () => {
    expect(await isBackendRunning(backendOrigin(await freePort()))).toBe(false);
  });

  it('is false when the answer takes more than 1 second', async () => {
    const port = await serve((request, response) => setTimeout(() => healthy(request, response), 2500));
    const start = Date.now();
    expect(await isBackendRunning(backendOrigin(port))).toBe(false);
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

describe('launchBackend with fake commands', () => {
  const logFile = () => path.join(tmp, `backend-${Math.random().toString(36).slice(2)}.log`);

  it('reuses a running backend: it starts nothing and leaves the log file untouched', async () => {
    const port = await serve(healthy);
    const log = logFile();
    const marker = path.join(tmp, 'started-marker');
    await writeFile(log, 'untouched\n');
    const result = await launchBackend({
      rootDir: tmp,
      logFile: log,
      port,
      command: [node, '-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'x')`],
    });
    expect(result).toEqual({ status: 'ready', origin: backendOrigin(port), startedByApp: false });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(existsSync(marker)).toBe(false);
    expect(await readFile(log, 'utf8')).toBe('untouched\n');
  });

  it('takes the default port from PORT in the environment', async () => {
    const port = await serve(healthy);
    const saved = process.env.PORT;
    process.env.PORT = String(port);
    try {
      const result = await launchBackend({ rootDir: tmp, logFile: logFile(), command: [node, '-e', 'process.exit(1)'] });
      expect(result).toEqual({ status: 'ready', origin: backendOrigin(port), startedByApp: false });
    } finally {
      if (saved === undefined) delete process.env.PORT;
      else process.env.PORT = saved;
    }
  });

  it('starts the command with NODE_ENV=production and PORT, and reports it ready', async () => {
    const port = await freePort();
    const log = logFile();
    const result = await launchBackend({ rootDir: tmp, logFile: log, port, command: fakeServer });
    const text = await readFile(log, 'utf8');
    pids.push(pidInLog(text));
    expect(result).toEqual({ status: 'ready', origin: backendOrigin(port), startedByApp: true });
    expect(text).toContain(`env production ${port}`);
  });

  it('starts a server on the port when the program there does not answer the health check', async () => {
    const port = await serve((_request, response) => response.writeHead(404).end());
    const result = await launchBackend({ rootDir: tmp, logFile: logFile(), port, command: [node, '-e', 'console.log("started"); process.exit(1)'] });
    expect(result).toEqual({ status: 'failed', outputLines: ['started', 'Backend exited with code 1.'] });
  });

  it('starts the server detached: it keeps running after the process that launched it exits', async () => {
    const port = await freePort();
    const log = logFile();
    const script = path.join(tmp, 'launch-and-exit.mts');
    const launcherUrl = new URL('./backend-launcher.ts', import.meta.url).href;
    await writeFile(
      script,
      `import { launchBackend } from ${JSON.stringify(launcherUrl)};
       const result = await launchBackend(${JSON.stringify({ rootDir: tmp, logFile: log, port, command: fakeServer })});
       console.log(JSON.stringify(result));
       process.exit(0);`,
    );
    const { stdout } = await promisify(execFile)(node, ['--import', 'tsx', script], { cwd: repoRoot, timeout: 30_000 });
    const pid = pidInLog(await readFile(log, 'utf8'));
    pids.push(pid);
    expect(JSON.parse(stdout.trim())).toEqual({ status: 'ready', origin: backendOrigin(port), startedByApp: true });
    expect(await healthStatus(backendOrigin(port))).toBe(200);
    expect(isAlive(pid)).toBe(true);
  });

  it('fails with the output and the exit code when the command exits first', async () => {
    const port = await freePort();
    const result = await launchBackend({
      rootDir: tmp,
      logFile: logFile(),
      port,
      command: [node, '-e', 'console.log("out line"); console.error("err line"); process.exit(3)'],
    });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.outputLines.at(-1)).toBe('Backend exited with code 3.');
    expect(result.outputLines.slice(0, -1).sort()).toEqual(['err line', 'out line']);
  });

  it('fails with the signal name when the command is killed by a signal', async () => {
    const result = await launchBackend({
      rootDir: tmp,
      logFile: logFile(),
      port: await freePort(),
      command: [node, '-e', 'process.kill(process.pid, "SIGTERM")'],
    });
    expect(result).toEqual({ status: 'failed', outputLines: ['Backend exited with signal SIGTERM.'] });
  });

  it('keeps only the last 20 non-empty output lines', async () => {
    const result = await launchBackend({
      rootDir: tmp,
      logFile: logFile(),
      port: await freePort(),
      command: [node, '-e', 'for (let i = 1; i <= 30; i++) { console.log("line " + i); console.log(""); } process.exit(1)'],
    });
    const expected = Array.from({ length: 20 }, (_, i) => `line ${i + 11}`);
    expect(result).toEqual({ status: 'failed', outputLines: [...expected, 'Backend exited with code 1.'] });
  });

  it('empties the log file at each start', async () => {
    const log = logFile();
    await writeFile(log, 'stale line\n');
    const result = await launchBackend({ rootDir: tmp, logFile: log, port: await freePort(), command: [node, '-e', 'console.log("fresh"); process.exit(2)'] });
    expect(result).toEqual({ status: 'failed', outputLines: ['fresh', 'Backend exited with code 2.'] });
  });

  it('fails with the system error when the command cannot start', async () => {
    const result = await launchBackend({ rootDir: tmp, logFile: logFile(), port: await freePort(), command: [path.join(tmp, 'missing-binary')] });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.outputLines.at(-1)).toMatch(/ENOENT/);
  });

  it('stops the command and fails when it is not ready within the timeout', async () => {
    const log = logFile();
    const result = await launchBackend({
      rootDir: tmp,
      logFile: log,
      port: await freePort(),
      readyTimeoutMs: 2000,
      command: [node, '-e', 'console.log("pid " + process.pid); setInterval(() => {}, 1000)'],
    });
    const pid = pidInLog(await readFile(log, 'utf8'));
    pids.push(pid);
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.outputLines.at(-1)).toBe('Backend not ready within 2 seconds.');
    expect(await waitFor(() => !isAlive(pid), 2000)).toBe(true);
  });

  describe('default command', () => {
    let fakeNode: string;

    beforeAll(async () => {
      fakeNode = path.join(tmp, 'fake node');
      await writeFile(fakeNode, '#!/bin/sh\necho "args: $*"\necho "cwd: $(pwd)"\nexit 4\n');
      await chmod(fakeNode, 0o755);
    });

    it('runs <nodePath> --import tsx src/server/main.ts in rootDir', async () => {
      const result = await launchBackend({ rootDir: tmp, logFile: logFile(), port: await freePort(), nodePath: fakeNode });
      expect(result).toEqual({
        status: 'failed',
        outputLines: ['args: --import tsx src/server/main.ts', `cwd: ${tmp}`, 'Backend exited with code 4.'],
      });
    });

    it('takes the Node path from AI_CLIENT_NODE when nodePath is missing', async () => {
      const saved = process.env.AI_CLIENT_NODE;
      process.env.AI_CLIENT_NODE = fakeNode;
      try {
        const result = await launchBackend({ rootDir: tmp, logFile: logFile(), port: await freePort() });
        expect(result.status === 'failed' && result.outputLines[0]).toBe('args: --import tsx src/server/main.ts');
      } finally {
        if (saved === undefined) delete process.env.AI_CLIENT_NODE;
        else process.env.AI_CLIENT_NODE = saved;
      }
    });
  });
});

// REQ tests: the launcher starts the real server of the repository on a free port.
describe('launchBackend with the real server', () => {
  let port: number;
  let origin: string;
  let claudeDir: string;
  const savedClaudeDir = process.env.CLAUDE_CONFIG_DIR;

  beforeAll(async () => {
    claudeDir = await mkdtemp(path.join(os.tmpdir(), 'ai-client-launcher-claude-'));
    process.env.CLAUDE_CONFIG_DIR = claudeDir;
    port = await freePort();
    origin = backendOrigin(port);
  });

  afterAll(async () => {
    for (const pid of listenerPids(port)) await stopPid(pid);
    if (savedClaudeDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = savedClaudeDir;
    await rm(claudeDir, { recursive: true, force: true });
  });

  it('REQ-4, REQ-9: starts the backend when none runs, ready within 5 seconds', async () => {
    const start = Date.now();
    const result = await launchBackend({ rootDir: repoRoot, logFile: path.join(tmp, 'real.log'), port });
    expect(result).toEqual({ status: 'ready', origin, startedByApp: true });
    expect(Date.now() - start).toBeLessThan(5000);
    const response = await fetch(`${origin}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  }, 20_000);

  it('REQ-8: the started backend listens on the loopback address only', async () => {
    const out = execFileSync('ss', ['-Hltn', `sport = :${port}`], { encoding: 'utf8' });
    const addresses = out
      .trim()
      .split('\n')
      .map((line) => line.trim().split(/\s+/)[3]);
    expect(addresses).toEqual([`127.0.0.1:${port}`]);
    const external = Object.values(os.networkInterfaces())
      .flat()
      .find((address) => address && address.family === 'IPv4' && !address.internal);
    if (external) {
      const refused = await new Promise<boolean>((resolve) => {
        const socket = net.connect(port, external.address);
        socket.once('connect', () => (socket.destroy(), resolve(false)));
        socket.once('error', () => resolve(true));
      });
      expect(refused).toBe(true);
    }
  });

  it('REQ-10: the browser client page is reachable from the local machine', async () => {
    expect(existsSync(path.join(repoRoot, 'dist/web/index.html'))).toBe(true);
    const response = await fetch(`${origin}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^text\/html/);
  });

  it('REQ-5: reuses the running backend and starts no second one', async () => {
    const before = listenerPids(port);
    const log = path.join(tmp, 'second.log');
    const result = await launchBackend({ rootDir: repoRoot, logFile: log, port });
    expect(result).toEqual({ status: 'ready', origin, startedByApp: false });
    expect(existsSync(log)).toBe(false);
    expect(listenerPids(port)).toEqual(before);
  });

  it('REQ-7: fails with the server output and the reason when another program holds the port', async () => {
    const heldPort = await serve((_request, response) => response.writeHead(404).end());
    const result = await launchBackend({ rootDir: repoRoot, logFile: path.join(tmp, 'held.log'), port: heldPort });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.outputLines.at(-1)).toMatch(/^Backend exited with (code \d+|signal \w+)\.$/);
    expect(result.outputLines.some((line) => line.includes('EADDRINUSE'))).toBe(true);
  }, 30_000);
});
