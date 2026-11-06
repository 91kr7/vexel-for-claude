import fastifyWebsocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type WsClient, connectWs, waitFor } from '../test-support.js';
import { registerSessionEventsRoute } from './session-events-route.js';
import { SessionStateTracker } from './session-state-tracker.js';

let app: FastifyInstance;
let tracker: SessionStateTracker;
let eventsUrl: string;
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

const parsed = (client: WsClient) => client.frames.map((frame) => JSON.parse(frame) as { type: string; id?: string; session?: { id: string } });

describe('GET /api/sessions/events, removals', () => {
  // plan-session_list_improvements/REQ-4: a tracker removal reaches every page as session-removed, after the earlier changes
  it('sends { type: "session-removed", id } to every page when the tracker dismisses a session', async () => {
    const first = await connect();
    const second = await connect();
    let exit: () => void = () => {};
    tracker.track({ id: 'gone', cwd: '/projects/gone', onExit: (listener) => (exit = listener) });
    exit();
    expect(tracker.dismiss('gone')).toBe(true);

    for (const client of [first, second]) {
      await waitFor(() => parsed(client).some((frame) => frame.type === 'session-removed'), 'removal frame');
      const frames = parsed(client);
      expect(frames.at(-1)).toEqual({ type: 'session-removed', id: 'gone' });
      expect(frames.slice(0, -1).map((frame) => frame.type)).toEqual(['session', 'session']);
    }
  });

  // SessionEventsRoute rule: closing the socket stops its frames
  it('sends no removal to a page that closed its socket', async () => {
    const closed = await connect();
    const open = await connect();
    closed.socket.close();
    await new Promise<void>((resolve) => closed.socket.once('close', () => resolve()));
    let exit: () => void = () => {};
    tracker.track({ id: 'later', cwd: '/projects/later', onExit: (listener) => (exit = listener) });
    exit();
    tracker.dismiss('later');

    await waitFor(() => parsed(open).some((frame) => frame.type === 'session-removed'), 'removal frame on the open page');
    expect(parsed(closed)).toEqual([]);
  });
});
