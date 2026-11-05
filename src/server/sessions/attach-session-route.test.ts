import fastifyWebsocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FAKE_CLI, type WsClient, connectWs, delay, hex, tempDir, waitFor } from '../test-support.js';
import { registerAttachSessionRoute } from './attach-session-route.js';
import { type Session, SessionRegistry } from './session-registry.js';
import { SessionStateTracker } from './session-state-tracker.js';

let app: FastifyInstance;
let registry: SessionRegistry;
let baseUrl: string;
let workDir: string;
const started: Session[] = [];
const clients: WsClient[] = [];

beforeAll(async () => {
  workDir = await tempDir();
  registry = new SessionRegistry({ command: FAKE_CLI });
  app = Fastify();
  await app.register(fastifyWebsocket);
  registerAttachSessionRoute(app, registry);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  baseUrl = `ws://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  for (const client of clients) client.socket.terminate();
  for (const session of started) session.write('/exit\r');
  await delay(200);
  await app.close();
});

function startSession(): Session {
  const session = registry.start(workDir);
  started.push(session);
  return session;
}

async function attach(session: Session): Promise<WsClient> {
  const client = connectWs(`${baseUrl}/api/sessions/${session.id}/attach`);
  clients.push(client);
  await waitFor(() => client.text().includes('READY'), 'fake CLI banner');
  return client;
}

const receivedInput = (client: WsClient) => [...client.text().matchAll(/IN:([0-9a-f]+)/g)].map((m) => m[1]).join('');

describe('GET /api/sessions/:id/attach', () => {
  it('closes with 4404 for an unknown session id', async () => {
    const client = connectWs(`${baseUrl}/api/sessions/unknown-id/attach`);
    clients.push(client);
    expect(await client.closed).toBe(4404);
  });

  it('sends the snapshot first, then the live output', async () => {
    const session = startSession();
    await attach(session);
    const late = await attach(session);
    expect(late.frames[0]).toContain('FAKE-CLI');
    expect(late.frames[0]).toContain(`CWD:${workDir}`);
    late.send({ type: 'input', data: 'live\r' });
    await waitFor(() => late.text().includes('LINE:live'), 'live output');
  });

  it('forwards input to the pty unchanged, Esc and control characters included', async () => {
    const client = await attach(startSession());
    const data = '/help\r\x1b\x03\x1b[A';
    client.send({ type: 'input', data });
    await waitFor(() => receivedInput(client).length >= hex(data).length, 'input echo');
    await delay(200);
    expect(receivedInput(client)).toBe(hex(data));
  });

  it('writes nothing to the pty except the client input', async () => {
    const client = await attach(startSession());
    client.send({ type: 'resize', cols: 100, rows: 40 });
    await waitFor(() => client.text().includes('WINCH:100x40'), 'resize');
    await delay(500);
    expect(receivedInput(client)).toBe('');
  });

  it('a valid resize resizes the pty', async () => {
    const client = await attach(startSession());
    client.send({ type: 'resize', cols: 1, rows: 1000 });
    await waitFor(() => client.text().includes('WINCH:1x1000'), 'resize');
  });

  it('ignores resize values that are not integers from 1 to 1000, and unknown frames', async () => {
    const client = await attach(startSession());
    const ignored: unknown[] = [
      { type: 'resize', cols: 0, rows: 30 },
      { type: 'resize', cols: 80, rows: 1001 },
      { type: 'resize', cols: 80.5, rows: 30 },
      { type: 'resize', cols: '80', rows: 30 },
      { type: 'resize', cols: 80 },
      { type: 'other', data: 'x' },
      'not json',
      { data: 'no type' },
    ];
    for (const frame of ignored) client.send(frame);
    client.send({ type: 'resize', cols: 77, rows: 22 });
    await waitFor(() => client.text().includes('WINCH:77x22'), 'valid resize after ignored frames');
    await delay(200);
    const winches = [...client.text().matchAll(/WINCH:(\d+x\d+)/g)].map((m) => m[1]);
    expect(winches).toEqual(['77x22']);
    expect(receivedInput(client)).toBe('');
    expect(client.closeCode).toBeUndefined();
  });

  it('closes with 1000 when the session process ends', async () => {
    const client = await attach(startSession());
    client.send({ type: 'input', data: '/exit\r' });
    expect(await client.closed).toBe(1000);
  });

  it('closing the socket never stops the session', async () => {
    const session = startSession();
    const first = await attach(session);
    first.socket.close();
    await first.closed;
    await delay(300);
    expect(session.exited).toBe(false);
    const second = await attach(session);
    second.send({ type: 'input', data: 'again\r' });
    await waitFor(() => second.text().includes('LINE:again'), 'session still answers');
  });
});

describe('GET /api/sessions/:id/attach with a state tracker', () => {
  let trackedApp: FastifyInstance;
  let tracker: SessionStateTracker;
  let trackedUrl: string;

  beforeAll(async () => {
    tracker = new SessionStateTracker();
    registry.onSessionStart((session) => tracker.track(session));
    trackedApp = Fastify();
    await trackedApp.register(fastifyWebsocket);
    registerAttachSessionRoute(trackedApp, registry, tracker);
    await trackedApp.listen({ host: '127.0.0.1', port: 0 });
    const address = trackedApp.server.address();
    if (address === null || typeof address === 'string') throw new Error('no port');
    trackedUrl = `ws://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await trackedApp.close();
  });

  async function attachTracked(session: Session): Promise<WsClient> {
    const client = connectWs(`${trackedUrl}/api/sessions/${session.id}/attach`);
    clients.push(client);
    await waitFor(() => client.text().includes('READY'), 'fake CLI banner');
    return client;
  }

  for (const [key, data] of [
    ['Esc', '\x1b'],
    ['Ctrl+C', '\x03'],
  ] as const) {
    // plan-claude_sessions_client/REQ-14: a lone interrupt key sets a working session idle and still reaches the pty
    it(`${key} alone sets a working session idle and reaches the pty unchanged`, async () => {
      const session = startSession();
      const client = await attachTracked(session);
      tracker.applyHookEvent(session.id, { hook_event_name: 'UserPromptSubmit', prompt: 'x' });
      expect(tracker.get(session.id)?.state).toBe('working');
      client.send({ type: 'input', data });
      await waitFor(() => receivedInput(client) === hex(data), 'input echo');
      expect(tracker.get(session.id)?.state).toBe('idle');
    });
  }

  // plan-claude_sessions_client/REQ-14, REQ-12: other input only sets last activity
  it('an arrow key keeps the state and updates last activity', async () => {
    const session = startSession();
    const client = await attachTracked(session);
    tracker.applyHookEvent(session.id, { hook_event_name: 'PermissionRequest' });
    const before = tracker.get(session.id)?.lastActivity ?? '';
    await delay(20);
    client.send({ type: 'input', data: '\x1b[A' });
    await waitFor(() => receivedInput(client) === hex('\x1b[A'), 'input echo');
    expect(tracker.get(session.id)?.state).toBe('needs_input');
    expect(Date.parse(tracker.get(session.id)?.lastActivity ?? '')).toBeGreaterThan(Date.parse(before));
  });
});
