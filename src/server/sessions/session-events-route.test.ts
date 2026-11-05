import fastifyWebsocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type WsClient, connectWs, delay, waitFor } from '../test-support.js';
import { registerSessionEventsRoute } from './session-events-route.js';
import { type SessionSummary, SessionStateTracker } from './session-state-tracker.js';

let app: FastifyInstance;
let tracker: SessionStateTracker;
let eventsUrl: string;
let nextId = 0;
const clients: WsClient[] = [];

beforeAll(async () => {
  tracker = new SessionStateTracker();
  app = Fastify();
  await app.register(fastifyWebsocket);
  registerSessionEventsRoute(app, tracker);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  eventsUrl = `ws://127.0.0.1:${address.port}/api/sessions/events`;
});

afterAll(async () => {
  for (const client of clients) client.socket.terminate();
  await app.close();
});

async function connect(): Promise<WsClient> {
  const client = connectWs(eventsUrl);
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    client.socket.once('open', () => resolve());
    client.socket.once('error', reject);
  });
  return client;
}

function trackSession(cwd = '/projects/demo'): string {
  nextId += 1;
  const id = `session-${nextId}`;
  tracker.track({ id, cwd, onExit: () => {} });
  return id;
}

const parsed = (client: WsClient) => client.frames.map((frame) => JSON.parse(frame) as { type: string; session: SessionSummary });
const framesOf = (client: WsClient, id: string) => parsed(client).filter((frame) => frame.session.id === id);

describe('GET /api/sessions/events', () => {
  // plan-claude_sessions_client/REQ-15: nothing on connect
  it('sends nothing on connect', async () => {
    trackSession();
    const client = await connect();
    await delay(300);
    expect(client.frames).toEqual([]);
  });

  // plan-claude_sessions_client/REQ-15: one frame per change, new sessions included, in order
  it('sends one session frame per change, a new session included, in tracker order', async () => {
    const client = await connect();
    const id = trackSession('/projects/live');
    tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Scrivi i test' });
    tracker.applyHookEvent(id, { hook_event_name: 'PermissionRequest' });
    tracker.applyHookEvent(id, { hook_event_name: 'Stop' });
    await waitFor(() => framesOf(client, id).length >= 4, 'four frames');
    const frames = framesOf(client, id);
    expect(frames.every((frame) => frame.type === 'session')).toBe(true);
    expect(frames.map((frame) => frame.session.state)).toEqual(['idle', 'working', 'needs_input', 'idle']);
    expect(frames[1]?.session).toMatchObject({ id, folder: '/projects/live', label: 'Scrivi i test', state: 'working' });
    expect(frames[3]?.session).toEqual(tracker.get(id));
  });

  // plan-claude_sessions_client/REQ-15: every page gets every change; client frames are ignored
  it('sends every change to every connected page and ignores client frames', async () => {
    const first = await connect();
    const second = await connect();
    first.send({ type: 'session', session: { id: 'fake' } });
    first.send('not json');
    const id = trackSession();
    tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: 'x' });
    await waitFor(() => framesOf(first, id).length >= 2 && framesOf(second, id).length >= 2, 'frames on both pages');
    expect(framesOf(first, id).map((frame) => frame.session.state)).toEqual(['idle', 'working']);
    expect(framesOf(second, id).map((frame) => frame.session.state)).toEqual(['idle', 'working']);
    expect(first.closeCode).toBeUndefined();
  });

  // plan-claude_sessions_client/REQ-15: closing one socket stops only its frames
  it('a closed page gets nothing more and the others keep receiving', async () => {
    const leaving = await connect();
    const staying = await connect();
    leaving.socket.close();
    await leaving.closed;
    const framesBefore = leaving.frames.length;
    const id = trackSession();
    await waitFor(() => framesOf(staying, id).length >= 1, 'frame on the open page');
    await delay(100);
    expect(leaving.frames.length).toBe(framesBefore);
  });
});
