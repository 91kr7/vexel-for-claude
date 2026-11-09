// Tests of plan-claude_sessions_client, batch backend-reconnection (INT-7): the Server listens only after the first scan of the ExternalSessionScanner.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { FAKE_CLI, type WsClient, connectWs, delay, tempDir, waitFor } from './test-support.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const children: ChildProcess[] = [];
const clients: WsClient[] = [];
const dirs: string[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) client.socket.terminate();
  for (const child of children.splice(0)) child.kill('SIGKILL');
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

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

/** Simulates Claude Code running in another terminal: a live process, its sessions/<pid>.json and the <pid>.<hash>.key FIFO next to it. */
async function externalTerminal(claudeDir: string, sessionId: string, folder: string): Promise<void> {
  const terminal = spawn('sleep', ['120'], { stdio: 'ignore' });
  children.push(terminal);
  const pid = terminal.pid ?? 0;
  const sessionsDir = path.join(claudeDir, 'sessions');
  await mkdir(sessionsDir, { recursive: true });
  execFileSync('mkfifo', [path.join(sessionsDir, `${pid}.9f8e7d6c.key`)]);
  await writeFile(
    path.join(sessionsDir, `${pid}.json`),
    JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status: 'idle', updatedAt: Date.now() }),
  );
}

function startServer(port: number, claudeDir: string, dataDir: string): void {
  children.push(
    spawn(path.join(repoRoot, 'node_modules/.bin/tsx'), ['src/server/main.ts'], {
      cwd: repoRoot,
      env: { ...process.env, PORT: String(port), AI_CLIENT_CLAUDE_CLI: FAKE_CLI, CLAUDE_CONFIG_DIR: claudeDir, AI_CLIENT_DATA_DIR: dataDir },
      stdio: 'ignore',
    }),
  );
}

/** Polls `url` every 10 ms and returns the first answer the server gives. */
async function firstAnswer(url: string, timeoutMs = 20_000): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(url).catch(() => undefined);
    if (response) return response;
    await delay(10);
  }
  throw new Error(`no answer from ${url}`);
}

describe('Server: first scan before listen', { timeout: 30_000 }, () => {
  // plan-claude_sessions_client/REQ-48, Server: a fresh backend lists the running external sessions from its first answer
  it('lists a running external session in the very first answer of GET /api/sessions', async () => {
    const root = await tempDir('ai-client-first-scan-');
    dirs.push(root);
    const claudeDir = path.join(root, 'claude');
    const folder = path.join(root, 'project-ext');
    await mkdir(folder, { recursive: true });
    await externalTerminal(claudeDir, 'first-scan-ext', folder);
    const port = await freePort();
    startServer(port, claudeDir, path.join(root, 'data'));

    const response = await firstAnswer(`http://127.0.0.1:${port}/api/sessions`);

    expect(response.status).toBe(200);
    const sessions = (await response.json()) as { id: string; external?: true }[];
    expect(sessions.find((session) => session.id === 'first-scan-ext')?.external).toBe(true);
  });

  // plan-claude_sessions_client/REQ-50, Server: a fresh backend streams the conversation of a running external session from its first answer
  it('answers the conversation stream of a running external session with its items, not 4404, as soon as it listens', async () => {
    const root = await tempDir('ai-client-first-scan-');
    dirs.push(root);
    const claudeDir = path.join(root, 'claude');
    const folder = path.join(root, 'project-ext');
    await mkdir(folder, { recursive: true });
    await externalTerminal(claudeDir, 'first-scan-stream', folder);
    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    startServer(port, claudeDir, path.join(root, 'data'));

    await firstAnswer(`${base}/api/health`);
    const client = connectWs(`ws://127.0.0.1:${port}/api/external-sessions/first-scan-stream/conversation`, { Origin: base });
    clients.push(client);

    await waitFor(() => client.frames.length > 0 || client.closeCode !== undefined, 'first frame or close');
    expect(client.closeCode).toBeUndefined();
    expect(JSON.parse(client.frames[0]!)).toMatchObject({ type: 'items' });
  });

  // Server: a scan that fails does not stop the listen
  it('listens even when the first scan cannot read the sessions folder', async () => {
    const root = await tempDir('ai-client-first-scan-');
    dirs.push(root);
    const claudeDir = path.join(root, 'claude');
    await mkdir(claudeDir, { recursive: true });
    // A file where the scanner expects the sessions folder.
    await writeFile(path.join(claudeDir, 'sessions'), 'not a folder');
    const port = await freePort();
    startServer(port, claudeDir, path.join(root, 'data'));

    const health = await firstAnswer(`http://127.0.0.1:${port}/api/health`);

    expect(health.status).toBe(200);
    const sessions = await fetch(`http://127.0.0.1:${port}/api/sessions`);
    expect(sessions.status).toBe(200);
  });
});
