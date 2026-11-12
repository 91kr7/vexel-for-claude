// REQ tests of plan-project_list_actions, batches favorite-project and remove-project, against the real server process.
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { FAKE_CLI, type WsClient, connectWs, delay, snapshotTree, tempDir, userEntry, waitFor, writeHistorySession } from './test-support.js';

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
    expect(JSON.parse(second.frames[1]!)).toEqual({ type: 'project-marks', favorites: ['/work/web-dashboard'], removed: {} });

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
    expect(saved).toEqual({ favorites: ['/work/a'], removed: {} });
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

const postRemove = (server: Server, folder: unknown) =>
  fetch(`${server.base}/api/projects/remove`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ folder }) });

const removedOf = (frame: string | undefined) => (JSON.parse(frame ?? '{}') as { removed?: Record<string, string> }).removed;

/** A project folder on disk with one past Claude Code session. */
async function projectWithSession(dir: string, name: string): Promise<{ folder: string; sessionId: string }> {
  const folder = path.join(dir, name);
  await mkdir(folder, { recursive: true });
  const sessionId = `00000000-0000-4000-8000-${name.padStart(12, '0').slice(-12)}`;
  await writeHistorySession(path.join(dir, 'claude'), folder.replaceAll('/', '-'), sessionId, [userEntry(`Work in ${name}`, folder, { sessionId })], new Date('2026-11-01T10:00:00.000Z'));
  return { folder, sessionId };
}

async function stopSession(server: Server, id: string): Promise<void> {
  await fetch(`${server.base}/api/sessions/${id}/stop`, { method: 'POST' }).catch(() => undefined);
}

describe('plan-project_list_actions/REQ-13, REQ-20 a remove reaches every open page at once', () => {
  it('POST /api/projects/remove answers 204 and every marks socket gets the folder with its removal time', async () => {
    const server = await startServer(await newDir());
    const first = marksSocket(server);
    const second = marksSocket(server);
    await waitFor(() => first.frames.length === 1 && second.frames.length === 1, 'initial frames');
    expect(removedOf(first.frames[0])).toEqual({});

    const before = Date.now();
    const response = await postRemove(server, '/work/web-dashboard');
    expect(response.status).toBe(204);
    await waitFor(() => first.frames.length === 2 && second.frames.length === 2, 'frames after the removal');
    const removed = removedOf(second.frames[1])!;
    expect(Object.keys(removed)).toEqual(['/work/web-dashboard']);
    expect(Date.parse(removed['/work/web-dashboard']!)).toBeGreaterThanOrEqual(before - 1000);
    expect(removedOf(first.frames[1])).toEqual(removed);
  }, 30_000);
});

describe('plan-project_list_actions/REQ-14, REQ-17 a remove deletes nothing and leaves the past sessions as they are', () => {
  it('the project folder, the Claude Code folder and GET /api/past-sessions do not change', async () => {
    const dir = await newDir();
    const { folder, sessionId } = await projectWithSession(dir, 'shop-api');
    await writeFile(path.join(folder, 'README.md'), 'kept');
    const server = await startServer(dir);
    const pastBefore = await (await fetch(`${server.base}/api/past-sessions`)).json() as { folder: string; sessions: { id: string }[] }[];
    expect(pastBefore.map((group) => group.folder)).toContain(folder);
    const claudeBefore = await snapshotTree(path.join(dir, 'claude'));
    const projectBefore = await snapshotTree(folder);

    expect((await postRemove(server, folder)).status).toBe(204);

    expect(await snapshotTree(path.join(dir, 'claude'))).toEqual(claudeBefore);
    expect(await snapshotTree(folder)).toEqual(projectBefore);
    const pastAfter = await (await fetch(`${server.base}/api/past-sessions`)).json() as { folder: string; sessions: { id: string }[] }[];
    expect(pastAfter).toEqual(pastBefore);
    expect(pastAfter.find((group) => group.folder === folder)!.sessions.map((s) => s.id)).toContain(sessionId);
    expect(await readdir(path.join(dir, 'data'))).toContain('project-marks.json');
  }, 30_000);
});

describe('plan-project_list_actions/REQ-15 a removal survives a client restart', () => {
  it('a restarted server sends the saved removal on connect', async () => {
    const dir = await newDir();
    const before = await startServer(dir);
    expect((await postRemove(before, '/work/a')).status).toBe(204);
    const kept = marksSocket(before);
    await waitFor(() => kept.frames.length === 1, 'frame before the restart');
    const removedAt = removedOf(kept.frames[0])!['/work/a'];
    await stopServer(before);

    const after = await startServer(dir);
    const client = marksSocket(after);
    await waitFor(() => client.frames.length === 1, 'initial frame after the restart');
    expect(removedOf(client.frames[0])).toEqual({ '/work/a': removedAt });
  }, 30_000);
});

describe('plan-project_list_actions/REQ-19 removing a favorite project clears its mark', () => {
  it('the frame after the removal and the frame after a restart have no favorite mark for the folder', async () => {
    const dir = await newDir();
    const server = await startServer(dir);
    expect((await putFavorite(server, '/work/a', true)).status).toBe(204);
    expect((await putFavorite(server, '/work/b', true)).status).toBe(204);
    const client = marksSocket(server);
    await waitFor(() => client.frames.length === 1, 'initial frame');
    expect((await postRemove(server, '/work/a')).status).toBe(204);
    await waitFor(() => client.frames.length === 2, 'frame after the removal');
    expect(favoritesOf(client.frames[1])).toEqual(['/work/b']);
    await stopServer(server);

    const after = await startServer(dir);
    const restarted = marksSocket(after);
    await waitFor(() => restarted.frames.length === 1, 'initial frame after the restart');
    expect(favoritesOf(restarted.frames[0])).toEqual(['/work/b']);
    expect(Object.keys(removedOf(restarted.frames[0])!)).toEqual(['/work/a']);
  }, 30_000);
});

describe('plan-project_list_actions/REQ-18 a remove works on a folder missing on disk', () => {
  it('a folder that does not exist is removed', async () => {
    const dir = await newDir();
    const server = await startServer(dir);
    const missing = path.join(dir, 'no-such-project');
    expect((await postRemove(server, missing)).status).toBe(204);
    const client = marksSocket(server);
    await waitFor(() => client.frames.length === 1, 'initial frame');
    expect(Object.keys(removedOf(client.frames[0])!)).toEqual([missing]);
  }, 30_000);

  it('a relative path is refused with invalid_path', async () => {
    const server = await startServer(await newDir());
    const response = await postRemove(server, 'relative/project');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_path' });
  }, 30_000);
});

describe('plan-project_list_actions/REQ-16 a hosted session in the folder clears its removal', () => {
  it('starting a new session in the removed folder clears the removal, and leaves the other removals', async () => {
    const dir = await newDir();
    const { folder } = await projectWithSession(dir, 'web-dashboard');
    const server = await startServer(dir);
    expect((await postRemove(server, folder)).status).toBe(204);
    expect((await postRemove(server, '/work/other')).status).toBe(204);
    const client = marksSocket(server);
    await waitFor(() => client.frames.length === 1, 'initial frame');
    expect(Object.keys(removedOf(client.frames[0])!).sort()).toEqual([folder, '/work/other'].sort());

    const started = await fetch(`${server.base}/api/sessions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: folder }) });
    expect(started.status).toBe(201);
    const { id } = (await started.json()) as { id: string };
    try {
      await waitFor(() => removedOf(client.frames.at(-1)) !== undefined && !(folder in removedOf(client.frames.at(-1))!), 'frame without the removal');
      expect(Object.keys(removedOf(client.frames.at(-1))!)).toEqual(['/work/other']);
    } finally {
      await stopSession(server, id);
    }
  }, 30_000);

  it('resuming a past session of the removed folder clears the removal, also after a restart', async () => {
    const dir = await newDir();
    const { folder, sessionId } = await projectWithSession(dir, 'shop-api');
    const server = await startServer(dir);
    expect((await postRemove(server, folder)).status).toBe(204);
    const client = marksSocket(server);
    await waitFor(() => client.frames.length === 1, 'initial frame');

    const resumed = await fetch(`${server.base}/api/past-sessions/${sessionId}/resume`, { method: 'POST' });
    expect(resumed.status).toBe(201);
    const { id } = (await resumed.json()) as { id: string };
    try {
      await waitFor(() => removedOf(client.frames.at(-1)) !== undefined && !(folder in removedOf(client.frames.at(-1))!), 'frame without the removal');
    } finally {
      await stopSession(server, id);
    }
    await delay(100);
    await stopServer(server);

    const after = await startServer(dir);
    const restarted = marksSocket(after);
    await waitFor(() => restarted.frames.length === 1, 'initial frame after the restart');
    expect(removedOf(restarted.frames[0])).toEqual({});
  }, 30_000);
});
