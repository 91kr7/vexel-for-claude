// REQ tests of plan-project_list_actions, batch favorite-project, against the real server process.
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { FAKE_CLI, type WsClient, connectWs, delay, snapshotTree, tempDir, waitFor } from './test-support.js';

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

interface Server {
  base: string;
  port: number;
  child: ChildProcess;
}

async function startServer(dir: string): Promise<Server> {
  const port = await freePort();
  const child = spawn(path.join(repoRoot, 'node_modules/.bin/tsx'), ['src/server/main.ts'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(port),
      AI_CLIENT_CLAUDE_CLI: FAKE_CLI,
      CLAUDE_CONFIG_DIR: path.join(dir, 'claude'),
      AI_CLIENT_DATA_DIR: path.join(dir, 'data'),
    },
    stdio: 'ignore',
  });
  children.push(child);
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${base}/api/health`).catch(() => undefined);
    if (response?.ok) return { base, port, child };
    await delay(20);
  }
  throw new Error('the server did not answer');
}

async function stopServer(server: Server): Promise<void> {
  const exited = new Promise((resolve) => server.child.once('exit', resolve));
  server.child.kill('SIGKILL');
  await exited;
}

const putFavorite = (server: Server, folder: string, favorite: boolean) =>
  fetch(`${server.base}/api/projects/favorite`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ folder, favorite }),
  });

function marksSocket(server: Server): WsClient {
  const client = connectWs(`ws://127.0.0.1:${server.port}/api/projects/marks`, { Origin: server.base });
  clients.push(client);
  return client;
}

const favoritesOf = (frame: string | undefined) => [...((JSON.parse(frame ?? '{}') as { favorites?: string[] }).favorites ?? [])].sort();

async function newDir(): Promise<string> {
  const dir = await tempDir('ai-client-project-marks-main-');
  dirs.push(dir);
  await mkdir(path.join(dir, 'claude', 'projects'), { recursive: true });
  return dir;
}

describe('plan-project_list_actions/REQ-29 a mark change reaches every open page', () => {
  it('the marks socket of each page gets the change of another page, with no reload', async () => {
    const server = await startServer(await newDir());
    const first = marksSocket(server);
    const second = marksSocket(server);
    await waitFor(() => first.frames.length === 1 && second.frames.length === 1, 'initial frames');
    expect(favoritesOf(first.frames[0])).toEqual([]);

    expect((await putFavorite(server, '/work/web-dashboard', true)).status).toBe(204);
    await waitFor(() => first.frames.length === 2 && second.frames.length === 2, 'frames after the mark');
    expect(JSON.parse(second.frames[1]!)).toEqual({ type: 'project-marks', favorites: ['/work/web-dashboard'] });

    expect((await putFavorite(server, '/work/web-dashboard', false)).status).toBe(204);
    await waitFor(() => first.frames.length === 3, 'frame after the removal');
    expect(favoritesOf(first.frames[2])).toEqual([]);
  }, 30_000);
});

describe('plan-project_list_actions/REQ-28 the mark survives a client restart', () => {
  it('a restarted server sends the saved marks on connect', async () => {
    const dir = await newDir();
    const before = await startServer(dir);
    expect((await putFavorite(before, '/work/a', true)).status).toBe(204);
    expect((await putFavorite(before, '/work/gone', true)).status).toBe(204);
    expect((await putFavorite(before, '/work/b', true)).status).toBe(204);
    expect((await putFavorite(before, '/work/b', false)).status).toBe(204);
    await stopServer(before);

    const after = await startServer(dir);
    const client = marksSocket(after);
    await waitFor(() => client.frames.length === 1, 'initial frame after the restart');
    expect(favoritesOf(client.frames[0])).toEqual(['/work/a', '/work/gone']);
  }, 30_000);

  it('the marks are in the client data folder, and nothing changes under the Claude Code folder', async () => {
    const dir = await newDir();
    const server = await startServer(dir);
    const claudeBefore = await snapshotTree(path.join(dir, 'claude'));
    expect((await putFavorite(server, '/work/a', true)).status).toBe(204);
    const saved = JSON.parse(await readFile(path.join(dir, 'data', 'project-marks.json'), 'utf8')) as unknown;
    expect(saved).toEqual({ favorites: ['/work/a'] });
    expect(await snapshotTree(path.join(dir, 'claude'))).toEqual(claudeBefore);
  }, 30_000);
});

describe('plan-project_list_actions/REQ-27 the mark works on a folder missing on disk', () => {
  it('a folder that does not exist is marked', async () => {
    const dir = await newDir();
    const server = await startServer(dir);
    const missing = path.join(dir, 'no-such-project');
    expect((await putFavorite(server, missing, true)).status).toBe(204);
    const client = marksSocket(server);
    await waitFor(() => client.frames.length === 1, 'initial frame');
    expect(favoritesOf(client.frames[0])).toEqual([missing]);
  }, 30_000);

  it('a relative path is refused with invalid_path', async () => {
    const server = await startServer(await newDir());
    const response = await putFavorite(server, 'relative/project', true);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_path' });
  }, 30_000);
});
