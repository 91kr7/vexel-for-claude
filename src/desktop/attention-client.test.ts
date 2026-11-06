import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import http from 'node:http';
import type { Duplex } from 'node:stream';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import { type AttentionConnection, type AttentionEvent, type AttentionSession, connectAttention } from './attention-client.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const fakeCli = fileURLToPath(new URL('../../test-support/fake-claude.mjs', import.meta.url));

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check: () => boolean, label: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for: ${label}`);
    await delay(10);
  }
}

/** A stand-in for the backend: records each connection with its path and time, and how many are open at once. */
class FakeBackend {
  readonly http = http.createServer();
  readonly wss = new WebSocketServer({ noServer: true });
  readonly connections: { path: string; at: number; socket: WebSocket }[] = [];
  open = 0;
  maxOpen = 0;
  /** When true, upgrade requests are refused: the backend does not answer. */
  refusing = false;
  refusedAt: number[] = [];

  constructor() {
    this.http.on('upgrade', (request, socket: Duplex, head) => {
      if (this.refusing) {
        this.refusedAt.push(Date.now());
        socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
        return;
      }
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.open += 1;
        this.maxOpen = Math.max(this.maxOpen, this.open);
        ws.on('close', () => {
          this.open -= 1;
        });
        this.connections.push({ path: request.url ?? '', at: Date.now(), socket: ws });
      });
    });
  }

  async listen(port = 0): Promise<string> {
    await new Promise<void>((resolve) => this.http.listen(port, '127.0.0.1', resolve));
    const address = this.http.address() as net.AddressInfo;
    return `http://127.0.0.1:${address.port}`;
  }

  latest(): WebSocket {
    const last = this.connections.at(-1);
    if (!last) throw new Error('no connection');
    return last.socket;
  }

  send(frame: unknown): void {
    this.latest().send(typeof frame === 'string' ? frame : JSON.stringify(frame));
  }

  async close(): Promise<void> {
    for (const client of this.wss.clients) client.terminate();
    this.wss.close();
    this.http.closeAllConnections();
    await new Promise((resolve) => this.http.close(resolve));
  }
}

const backends: FakeBackend[] = [];
const connections: AttentionConnection[] = [];

afterEach(async () => {
  for (const connection of connections.splice(0)) connection.stop();
  for (const backend of backends.splice(0)) await backend.close();
});

function recorder() {
  const calls: (['list', AttentionSession[]] | ['event', AttentionEvent])[] = [];
  return {
    calls,
    handlers: {
      onNeedsInput: (sessions: AttentionSession[]) => calls.push(['list', sessions]),
      onEvent: (event: AttentionEvent) => calls.push(['event', event]),
    },
  };
}

async function backend(): Promise<{ server: FakeBackend; origin: string }> {
  const server = new FakeBackend();
  backends.push(server);
  return { server, origin: await server.listen() };
}

function connect(origin: string, handlers: ReturnType<typeof recorder>['handlers'], options?: { retryMs?: number }): AttentionConnection {
  const connection = connectAttention(origin, handlers, options);
  connections.push(connection);
  return connection;
}

const session: AttentionSession = { sessionId: 's1', folder: '/projects/ai-client', label: 'Fix the login form' };
const event: AttentionEvent = { id: 'ev-1', sessionId: 's1', kind: 'needs_input', folder: '/projects/ai-client', label: 'Fix the login form', waitingTool: 'Bash' };

describe('connectAttention', () => {
  // plan-session_notifications/REQ-1
  it('opens a WebSocket to /api/attention of the origin at once', async () => {
    const { server, origin } = await backend();
    const startedAt = Date.now();
    connect(origin, recorder().handlers);
    await waitFor(() => server.connections.length === 1, 'connection', 1000);
    expect(server.connections[0]?.path).toBe('/api/attention');
    expect(server.connections[0]!.at - startedAt).toBeLessThan(1000);
  });

  // plan-session_notifications/REQ-1, REQ-11
  it('passes on each needs-input list and each event, in order', async () => {
    const { server, origin } = await backend();
    const { calls, handlers } = recorder();
    connect(origin, handlers);
    await waitFor(() => server.connections.length === 1, 'connection');

    const { waitingTool: _tool, ...eventWithNoTool } = event;
    server.send({ type: 'needs-input', sessions: [session] });
    server.send({ type: 'event', event });
    server.send({ type: 'event', event: { ...eventWithNoTool, id: 'ev-2' } });
    server.send({ type: 'needs-input', sessions: [] });
    await waitFor(() => calls.length >= 4, 'four handler calls');

    expect(calls).toEqual([
      ['list', [session]],
      ['event', event],
      ['event', { ...eventWithNoTool, id: 'ev-2' }],
      ['list', []],
    ]);
  });

  it('ignores frames that are not JSON or that do not have one of the frame shapes', async () => {
    const { server, origin } = await backend();
    const { calls, handlers } = recorder();
    connect(origin, handlers);
    await waitFor(() => server.connections.length === 1, 'connection');

    for (const frame of [
      'not json',
      '42',
      'null',
      { type: 'other', sessions: [session] },
      { type: 'needs-input' },
      { type: 'needs-input', sessions: 'none' },
      { type: 'needs-input', sessions: [{ sessionId: 's1', folder: '/projects/ai-client' }] },
      { type: 'needs-input', sessions: [{ ...session, label: 7 }] },
      { type: 'event' },
      { type: 'event', event: { ...event, id: 1 } },
      { type: 'event', event: { ...event, sessionId: undefined } },
      { type: 'event', event: { ...event, waitingTool: 3 } },
    ]) {
      server.send(frame);
    }
    server.send({ type: 'needs-input', sessions: [session] });
    await waitFor(() => calls.length >= 1, 'the valid frame');
    await delay(100);

    expect(calls).toEqual([['list', [session]]]);
  });

  // plan-session_notifications/REQ-2, REQ-4: back after a drop
  it('connects again after a drop, after retryMs, and the new list replaces the old one', async () => {
    const { server, origin } = await backend();
    const { calls, handlers } = recorder();
    connect(origin, handlers, { retryMs: 300 });
    await waitFor(() => server.connections.length === 1, 'first connection');
    server.send({ type: 'needs-input', sessions: [session] });
    await waitFor(() => calls.length === 1, 'first list');

    const droppedAt = Date.now();
    server.latest().terminate();
    await waitFor(() => server.connections.length === 2, 'second connection', 3000);
    expect(server.connections[1]!.at - droppedAt).toBeGreaterThanOrEqual(250);
    expect(server.connections[1]?.path).toBe('/api/attention');

    server.send({ type: 'needs-input', sessions: [] });
    await waitFor(() => calls.length === 2, 'second list');
    expect(calls.at(-1)).toEqual(['list', []]);
  });

  it('tries again every retryMs while the backend does not answer, then connects', async () => {
    const { server, origin } = await backend();
    server.refusing = true;
    connect(origin, recorder().handlers, { retryMs: 200 });
    await delay(1100);
    const tries = server.refusedAt.length;
    expect(tries).toBeGreaterThanOrEqual(4);
    expect(tries).toBeLessThanOrEqual(7);
    for (let i = 1; i < server.refusedAt.length; i += 1) expect(server.refusedAt[i]! - server.refusedAt[i - 1]!).toBeGreaterThanOrEqual(150);

    server.refusing = false;
    await waitFor(() => server.connections.length === 1, 'connection once the backend answers', 1000);
  });

  it('tries again when nothing listens on the origin yet', async () => {
    const reserved = net.createServer();
    await new Promise<void>((resolve) => reserved.listen(0, '127.0.0.1', resolve));
    const port = (reserved.address() as net.AddressInfo).port;
    await new Promise((resolve) => reserved.close(resolve));

    connect(`http://127.0.0.1:${port}`, recorder().handlers, { retryMs: 200 });
    await delay(500);
    const server = new FakeBackend();
    backends.push(server);
    await server.listen(port);
    await waitFor(() => server.connections.length === 1, 'connection once the backend listens', 2000);
  });

  // plan-session_notifications/REQ-1, REQ-4: a backend restart that takes longer than one wait
  it('after a drop, keeps trying while the backend is down, and connects when it is back', async () => {
    const { server, origin } = await backend();
    const { calls, handlers } = recorder();
    connect(origin, handlers, { retryMs: 200 });
    await waitFor(() => server.connections.length === 1, 'first connection');
    const port = Number(new URL(origin).port);

    await server.close();
    backends.splice(backends.indexOf(server), 1);
    await delay(700);
    const restarted = new FakeBackend();
    backends.push(restarted);
    await restarted.listen(port);

    await waitFor(() => restarted.connections.length === 1, 'connection to the restarted backend', 2000);
    restarted.send({ type: 'needs-input', sessions: [session] });
    await waitFor(() => calls.length === 1, 'list from the restarted backend');
  });

  // plan-session_notifications/REQ-4: default wait of 2 seconds
  it('waits 2 seconds by default before a new try', async () => {
    const { server, origin } = await backend();
    connect(origin, recorder().handlers);
    await waitFor(() => server.connections.length === 1, 'first connection');
    const droppedAt = Date.now();
    server.latest().terminate();
    await waitFor(() => server.connections.length === 2, 'second connection', 4000);
    const waited = server.connections[1]!.at - droppedAt;
    expect(waited).toBeGreaterThanOrEqual(1900);
    expect(waited).toBeLessThan(3000);
  });

  it('keeps at most one socket open at a time', async () => {
    const { server, origin } = await backend();
    connect(origin, recorder().handlers, { retryMs: 50 });
    for (let i = 1; i <= 4; i += 1) {
      await waitFor(() => server.connections.length === i, `connection ${i}`, 2000);
      server.latest().close();
    }
    await waitFor(() => server.connections.length === 5, 'connection 5', 2000);
    await delay(200);
    expect(server.maxOpen).toBe(1);
    expect(server.open).toBe(1);
  });

  it('stop() closes the socket: no more tries and no more handler calls', async () => {
    const { server, origin } = await backend();
    const { calls, handlers } = recorder();
    const connection = connect(origin, handlers, { retryMs: 100 });
    await waitFor(() => server.connections.length === 1, 'connection');
    const socket = server.latest();
    const closed = new Promise((resolve) => socket.once('close', resolve));

    connection.stop();
    await closed;
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify({ type: 'event', event }));
    await delay(500);

    expect(server.connections).toHaveLength(1);
    expect(calls).toEqual([]);
  });

  it('stop() during the wait after a drop cancels the next try', async () => {
    const { server, origin } = await backend();
    const connection = connect(origin, recorder().handlers, { retryMs: 300 });
    await waitFor(() => server.connections.length === 1, 'connection');
    server.latest().terminate();
    await delay(100);

    connection.stop();
    await delay(600);
    expect(server.connections).toHaveLength(1);
  });
});

describe('connectAttention with the real backend', () => {
  let child: ChildProcess | undefined;
  let tempDirs: string[] = [];

  afterEach(async () => {
    child?.kill('SIGTERM');
    child = undefined;
    await delay(200);
    for (const dir of tempDirs) await rm(dir, { recursive: true, force: true });
    tempDirs = [];
  });

  // plan-session_notifications/REQ-1, REQ-2: the desktop client gets the backend's event within 5 seconds
  it('passes on the list and the event of a hosted session that enters needs input', async () => {
    const claudeDir = await mkdtemp(path.join(os.tmpdir(), 'ai-client-attention-client-claude-'));
    const projects = await mkdtemp(path.join(os.tmpdir(), 'ai-client-attention-client-projects-'));
    tempDirs.push(claudeDir, projects);
    const folder = path.join(projects, 'ai-client');
    await mkdir(folder);
    const reserved = net.createServer();
    await new Promise<void>((resolve) => reserved.listen(0, '127.0.0.1', resolve));
    const port = (reserved.address() as net.AddressInfo).port;
    await new Promise((resolve) => reserved.close(resolve));
    const origin = `http://127.0.0.1:${port}`;

    child = spawn(path.join(repoRoot, 'node_modules/.bin/tsx'), ['src/server/main.ts'], {
      cwd: repoRoot,
      env: { ...process.env, PORT: String(port), AI_CLIENT_CLAUDE_CLI: fakeCli, CLAUDE_CONFIG_DIR: claudeDir },
      stdio: 'ignore',
    });
    // As DesktopApp: the client starts once the backend is ready.
    const deadline = Date.now() + 20_000;
    while (!(await fetch(`${origin}/api/health`).then((r) => r.ok, () => false))) {
      if (Date.now() > deadline) throw new Error('backend did not start');
      await delay(200);
    }
    const { calls, handlers } = recorder();
    connect(origin, handlers);
    await waitFor(() => calls.length >= 1, 'list on connect', 5000);
    expect(calls[0]).toEqual(['list', []]);

    const started = await fetch(`${origin}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: folder }),
    });
    const { id } = (await started.json()) as { id: string };
    const post = (body: object) =>
      fetch(`${origin}/api/sessions/${id}/hook-events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    await post({ hook_event_name: 'UserPromptSubmit', prompt: 'Fix the login form' });
    const changedAt = Date.now();
    await post({ hook_event_name: 'PermissionRequest', tool_name: 'Bash' });

    await waitFor(() => calls.some(([kind]) => kind === 'event'), 'event', 5000);
    expect(Date.now() - changedAt).toBeLessThan(5000);
    expect(calls.find(([kind]) => kind === 'event')?.[1]).toMatchObject({
      sessionId: id,
      kind: 'needs_input',
      folder,
      label: 'Fix the login form',
      waitingTool: 'Bash',
    });
    expect(calls.filter(([kind]) => kind === 'list').at(-1)?.[1]).toEqual([{ sessionId: id, folder, label: 'Fix the login form' }]);
  }, 40_000);
});
