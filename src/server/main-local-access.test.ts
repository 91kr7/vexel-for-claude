// REQ tests of plan-claude_sessions_client, batch local-access, against the real server process.
import { type ChildProcess, spawn } from 'node:child_process';
import http from 'node:http';
import { mkdir } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FAKE_CLI, type WsClient, connectWs, delay, hex, tempDir, waitFor } from './test-support.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const VITE_PORT = 5173;

interface Server {
  process: ChildProcess;
  port: number;
  own: string[];
}

interface Reply {
  status: number;
  body: string;
}

const servers: Server[] = [];
const clients: WsClient[] = [];
let project: string;
let claudeDir: string;

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

/** Starts the server with a clean environment: no development signal and no NODE_ENV unless `env` sets them. */
async function startServer(env: Record<string, string>): Promise<Server> {
  const port = await freePort();
  const base: NodeJS.ProcessEnv = { ...process.env };
  delete base.AI_CLIENT_VITE_DEV_PORT;
  delete base.NODE_ENV;
  const child = spawn(path.join(repoRoot, 'node_modules/.bin/tsx'), ['src/server/main.ts'], {
    cwd: repoRoot,
    env: { ...base, ...env, PORT: String(port), AI_CLIENT_CLAUDE_CLI: FAKE_CLI, CLAUDE_CONFIG_DIR: claudeDir },
    stdio: 'ignore',
  });
  const server = { process: child, port, own: [`http://localhost:${port}`, `http://127.0.0.1:${port}`] };
  servers.push(server);
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await fetch(`http://127.0.0.1:${port}/api/health`).then((r) => r.ok, () => false)) return server;
    await delay(200);
  }
  throw new Error('server did not start');
}

/** One HTTP request with full control of the Origin header: `undefined` sends none. */
function send(server: Server, method: string, url: string, origin?: string, body?: unknown): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const headers: Record<string, string> = { host: `127.0.0.1:${server.port}` };
    if (origin !== undefined) headers.origin = origin;
    if (payload !== undefined) headers['content-type'] = 'application/json';
    const request = http.request({ host: '127.0.0.1', port: server.port, method, path: url, headers }, (response) => {
      let text = '';
      response.on('data', (chunk) => (text += chunk.toString()));
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body: text }));
    });
    request.on('error', reject);
    request.end(payload);
  });
}

const startSession = (server: Server, origin?: string) => send(server, 'POST', '/api/sessions', origin, { path: project });

async function startedId(server: Server, origin?: string): Promise<string> {
  const reply = await startSession(server, origin);
  expect(reply.status).toBe(201);
  return (JSON.parse(reply.body) as { id: string }).id;
}

async function sessionIds(server: Server): Promise<string[]> {
  const reply = await send(server, 'GET', '/api/sessions');
  expect(reply.status).toBe(200);
  return (JSON.parse(reply.body) as { id: string }[]).map((session) => session.id);
}

async function stateOf(server: Server, id: string): Promise<string | undefined> {
  const reply = await send(server, 'GET', '/api/sessions');
  return (JSON.parse(reply.body) as { id: string; state: string }[]).find((session) => session.id === id)?.state;
}

function attach(server: Server, id: string, origin?: string): WsClient {
  const client = connectWs(`ws://127.0.0.1:${server.port}/api/sessions/${id}/attach`, origin === undefined ? {} : { Origin: origin });
  clients.push(client);
  return client;
}

/** Opens a WebSocket on `route`: `opened` with the first frames received, or the HTTP status of the refusal. */
function webSocket(server: Server, route: string, origin?: string): Promise<{ opened: true } | { opened: false; status: number }> {
  return new Promise((resolve) => {
    const socket = new WebSocket(`ws://127.0.0.1:${server.port}${route}`, { headers: origin === undefined ? {} : { Origin: origin } });
    socket.on('open', () => {
      socket.terminate();
      resolve({ opened: true });
    });
    socket.on('unexpected-response', (request, response) => {
      resolve({ opened: false, status: response.statusCode ?? 0 });
      response.destroy();
      request.destroy();
    });
    socket.on('error', () => {});
  });
}

/** A masked WebSocket text frame, as a browser sends it. */
function clientTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf8');
  if (payload.length > 125) throw new Error('frame too long');
  const mask = Buffer.from([0x12, 0x34, 0x56, 0x78]);
  const masked = Buffer.from(payload.map((byte, i) => byte ^ (mask[i % 4] ?? 0)));
  return Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, masked]);
}

/** Raw upgrade from `origin` that also pushes `frame` right away; returns every byte the server sent until it closed. */
function rawUpgrade(server: Server, route: string, origin: string, frame?: Buffer): Promise<{ raw: string; closedByServer: boolean }> {
  return new Promise((resolve) => {
    const socket = net.connect(server.port, '127.0.0.1', () => {
      socket.write(
        `GET ${route} HTTP/1.1\r\nHost: 127.0.0.1:${server.port}\r\nOrigin: ${origin}\r\n` +
          'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
          'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n',
      );
      if (frame !== undefined) socket.write(frame);
    });
    let raw = '';
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ raw, closedByServer: false });
    }, 3000);
    socket.on('data', (chunk) => (raw += chunk.toString('latin1')));
    socket.on('close', () => {
      clearTimeout(timer);
      resolve({ raw, closedByServer: true });
    });
    socket.on('error', () => {});
  });
}

const forbidden = (reply: Reply) => ({ status: reply.status, body: JSON.parse(reply.body) as unknown });

let production: Server;
let development: Server;
let maxPortSignal: Server;
let outOfRangeSignal: Server;
let notANumberSignal: Server;

beforeAll(async () => {
  const projectsRoot = await tempDir('ai-client-projects-');
  project = path.join(projectsRoot, 'project-a');
  await mkdir(project);
  claudeDir = await tempDir('ai-client-claude-');
  [production, development, maxPortSignal, outOfRangeSignal, notANumberSignal] = await Promise.all([
    // NODE_ENV plays no part: development without the signal is still production.
    startServer({ NODE_ENV: 'development' }),
    startServer({ NODE_ENV: 'production', AI_CLIENT_VITE_DEV_PORT: String(VITE_PORT) }),
    startServer({ AI_CLIENT_VITE_DEV_PORT: '65535' }),
    startServer({ AI_CLIENT_VITE_DEV_PORT: '65536' }),
    startServer({ AI_CLIENT_VITE_DEV_PORT: `${VITE_PORT}abc` }),
  ]);
}, 40_000);

afterAll(async () => {
  for (const client of clients) client.socket.terminate();
  for (const server of servers) server.process.kill('SIGTERM');
  await delay(300);
});

describe('plan-claude_sessions_client/REQ-37 the client accepts its own origin', () => {
  it('starts a session and lists the sessions from both own origins', async () => {
    for (const origin of production.own) {
      const id = await startedId(production, origin);
      const list = await send(production, 'GET', '/api/sessions', origin);
      expect(list.status, origin).toBe(200);
      expect(list.body, origin).toContain(id);
    }
  });

  it('opens the terminal of a session and the session list socket from both own origins', async () => {
    const id = await startedId(production);
    for (const origin of production.own) {
      const client = attach(production, id, origin);
      await waitFor(() => client.text().includes('READY'), `terminal from ${origin}`);
      expect(await webSocket(production, '/api/sessions/events', origin)).toEqual({ opened: true });
    }
  });

  it('a page on the own origin types into the terminal', async () => {
    const id = await startedId(production);
    const client = attach(production, id, production.own[0]);
    await waitFor(() => client.text().includes('READY'), 'fake CLI banner');
    client.send({ type: 'input', data: 'own' });
    await waitFor(() => client.text().includes(`IN:${hex('own')}`), 'input echoed by the CLI');
  });

  it('rejects https on the client port: its own origin is plain http', async () => {
    for (const origin of [`https://localhost:${production.port}`, `https://127.0.0.1:${production.port}`]) {
      expect(forbidden(await startSession(production, origin)), origin).toEqual({ status: 403, body: { error: 'forbidden' } });
    }
  });
});

describe('plan-claude_sessions_client/REQ-38 the Vite origin only in development', () => {
  it('with the development signal, accepts both Vite origins on HTTP and on the WebSocket', async () => {
    for (const origin of [`http://localhost:${VITE_PORT}`, `http://127.0.0.1:${VITE_PORT}`]) {
      const id = await startedId(development, origin);
      const client = attach(development, id, origin);
      await waitFor(() => client.text().includes('READY'), `terminal from ${origin}`);
      expect(await webSocket(development, '/api/sessions/events', origin)).toEqual({ opened: true });
    }
  });

  it('with the development signal, still accepts the own origin and rejects other ports', async () => {
    expect((await startSession(development, development.own[0])).status).toBe(201);
    expect(forbidden(await startSession(development, 'http://localhost:8080'))).toEqual({ status: 403, body: { error: 'forbidden' } });
  });

  it('without the development signal, rejects the Vite origin even with NODE_ENV=development', async () => {
    for (const origin of [`http://localhost:${VITE_PORT}`, `http://127.0.0.1:${VITE_PORT}`]) {
      expect(forbidden(await startSession(production, origin)), origin).toEqual({ status: 403, body: { error: 'forbidden' } });
      expect(await webSocket(production, '/api/sessions/events', origin), origin).toEqual({ opened: false, status: 403 });
    }
  });

  it('a signal holding the highest valid port allows that port', async () => {
    expect((await startSession(maxPortSignal, 'http://localhost:65535')).status).toBe(201);
  });

  it.each([
    ['out of range', () => outOfRangeSignal, 'http://localhost:65536'],
    ['not a number', () => notANumberSignal, `http://localhost:${VITE_PORT}`],
  ])('an invalid signal (%s) allows no other origin', async (_label, server, origin) => {
    expect(forbidden(await startSession(server(), origin))).toEqual({ status: 403, body: { error: 'forbidden' } });
    expect((await startSession(server(), server().own[0])).status).toBe(201);
  });
});

describe('plan-claude_sessions_client/REQ-39 a loopback origin on another port is rejected', () => {
  const others = () => ['http://localhost:8080', 'http://127.0.0.1:8080', `http://localhost:${production.port + 1}`, 'http://localhost'];

  it('rejects HTTP requests', async () => {
    for (const origin of others()) {
      expect(forbidden(await send(production, 'GET', '/api/sessions', origin)), origin).toEqual({ status: 403, body: { error: 'forbidden' } });
      expect(forbidden(await startSession(production, origin)), origin).toEqual({ status: 403, body: { error: 'forbidden' } });
    }
  });

  it('refuses the WebSockets', async () => {
    const id = await startedId(production);
    for (const origin of others()) {
      expect(await webSocket(production, '/api/sessions/events', origin), origin).toEqual({ opened: false, status: 403 });
      expect(await webSocket(production, `/api/sessions/${id}/attach`, origin), origin).toEqual({ opened: false, status: 403 });
      expect(await webSocket(production, '/api/attention', origin), origin).toEqual({ opened: false, status: 403 });
    }
  });
});

describe('plan-claude_sessions_client/REQ-40 a host that is not loopback is rejected, also on the client port', () => {
  it('rejects HTTP requests and WebSockets', async () => {
    const port = production.port;
    for (const origin of [`http://example.com:${port}`, `http://192.168.1.10:${port}`, `http://localhost.example.com:${port}`, `http://[::1]:${port}`]) {
      expect(forbidden(await startSession(production, origin)), origin).toEqual({ status: 403, body: { error: 'forbidden' } });
      expect(await webSocket(production, '/api/sessions/events', origin), origin).toEqual({ opened: false, status: 403 });
    }
  });
});

describe('plan-claude_sessions_client/REQ-41 the Origin null and a malformed Origin are rejected', () => {
  it('rejects HTTP requests and WebSockets', async () => {
    const port = production.port;
    for (const origin of ['null', 'not-an-origin', '', `http://localhost:${port}/`, `http://localhost:${port}/api`, `localhost:${port}`]) {
      expect(forbidden(await startSession(production, origin)), origin).toEqual({ status: 403, body: { error: 'forbidden' } });
      if (origin !== '') expect(await webSocket(production, '/api/sessions/events', origin), origin).toEqual({ opened: false, status: 403 });
    }
  });
});

describe('plan-claude_sessions_client/REQ-42 a request without Origin is accepted', () => {
  it('starts and lists sessions, and opens the terminal, the list socket and the attention socket', async () => {
    const id = await startedId(production);
    expect(await sessionIds(production)).toContain(id);
    const client = attach(production, id);
    await waitFor(() => client.text().includes('READY'), 'fake CLI banner');
    expect(await webSocket(production, '/api/sessions/events')).toEqual({ opened: true });
    expect(await webSocket(production, '/api/attention')).toEqual({ opened: true });
  });

  it('the hook forwarder still reaches the client: a permission request marks the session as needing input', async () => {
    const id = await startedId(production);
    const client = attach(production, id, production.own[1]);
    await waitFor(() => client.text().includes('READY'), 'fake CLI banner');
    client.send({ type: 'input', data: 'PERM\r' });
    const deadline = Date.now() + 8000;
    while ((await stateOf(production, id)) !== 'needs_input' && Date.now() < deadline) await delay(50);
    expect(await stateOf(production, id)).toBe('needs_input');
  });
});

describe('plan-claude_sessions_client/REQ-43 a rejected connection gets no session data and writes nothing', () => {
  const foreign = 'http://localhost:8080';

  it('a terminal connection from another local page gets only the 403 and its "hello" never reaches the terminal', async () => {
    const id = await startedId(production);
    const owner = attach(production, id, production.own[0]);
    await waitFor(() => owner.text().includes('READY'), 'fake CLI banner');

    const raw = await rawUpgrade(production, `/api/sessions/${id}/attach`, foreign, clientTextFrame(JSON.stringify({ type: 'input', data: 'hello' })));
    expect(raw.raw).toMatch(/^HTTP\/1\.1 403/);
    expect(raw.raw).not.toContain('FAKE-CLI');
    expect(raw.raw).not.toContain('READY');
    expect(raw.closedByServer).toBe(true);

    let received = 0;
    const socket = new WebSocket(`ws://127.0.0.1:${production.port}/api/sessions/${id}/attach`, { headers: { Origin: foreign } });
    socket.on('message', () => (received += 1));
    socket.on('open', () => socket.send(JSON.stringify({ type: 'input', data: 'hello' })));
    socket.on('error', () => {});
    await new Promise((resolve) => socket.on('close', resolve));
    expect(received).toBe(0);

    await delay(500);
    expect(owner.text()).not.toContain(`IN:${hex('hello')}`);
    // The terminal still echoes input, so the missing "hello" is not a dead pipe.
    owner.send({ type: 'input', data: 'probe' });
    await waitFor(() => owner.text().includes(`IN:${hex('probe')}`), 'probe echoed by the CLI');
    expect(owner.text()).not.toContain(`IN:${hex('hello')}`);
  });

  it('the session list socket from another local page gets only the 403, without the sessions', async () => {
    const id = await startedId(production);
    const raw = await rawUpgrade(production, '/api/sessions/events', foreign);
    expect(raw.raw).toMatch(/^HTTP\/1\.1 403/);
    expect(raw.raw).not.toContain(id);
    expect(raw.closedByServer).toBe(true);
  });

  it('the session list over HTTP from another local page gets only the 403, without the sessions', async () => {
    const id = await startedId(production);
    const reply = await send(production, 'GET', '/api/sessions', foreign);
    expect(forbidden(reply)).toEqual({ status: 403, body: { error: 'forbidden' } });
    expect(reply.body).not.toContain(id);
  });
});

describe('plan-claude_sessions_client/REQ-44 the Origin rule covers the HTTP requests', () => {
  it.each([
    [`http://example.com:PORT`],
    ['null'],
    ['not-an-origin'],
    [`http://localhost:${VITE_PORT}`],
    ['http://localhost:8080'],
  ])('a start-session POST with Origin %s is refused and no session appears', async (template) => {
    const origin = template.replace('PORT', String(production.port));
    const before = await sessionIds(production);
    expect(forbidden(await startSession(production, origin))).toEqual({ status: 403, body: { error: 'forbidden' } });
    await delay(200);
    expect(await sessionIds(production)).toEqual(before);
  });

  it('a stop POST and a hook event POST from another local page are refused and change nothing', async () => {
    const id = await startedId(production);
    const foreign = 'http://localhost:8080';
    expect(forbidden(await send(production, 'POST', `/api/sessions/${id}/stop`, foreign))).toEqual({ status: 403, body: { error: 'forbidden' } });
    expect(
      forbidden(await send(production, 'POST', `/api/sessions/${id}/hook-events`, foreign, { hook_event_name: 'PermissionRequest' })),
    ).toEqual({ status: 403, body: { error: 'forbidden' } });
    await delay(300);
    expect(await stateOf(production, id)).toBe('idle');
  });

  it('the folder listing from another local page is refused', async () => {
    const reply = await send(production, 'GET', `/api/folders?path=${encodeURIComponent(project)}`, 'http://localhost:8080');
    expect(forbidden(reply)).toEqual({ status: 403, body: { error: 'forbidden' } });
  });
});
