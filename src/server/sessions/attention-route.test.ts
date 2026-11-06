import fastifyWebsocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type WsClient, connectWs, delay, waitFor } from '../test-support.js';
import type { AttentionEvent, AttentionSession } from './attention-monitor.js';
import { registerAttentionRoute } from './attention-route.js';

class FakeMonitor {
  sessions: AttentionSession[] = [];
  private readonly eventListeners = new Set<(event: AttentionEvent) => void>();
  private readonly listListeners = new Set<(sessions: AttentionSession[]) => void>();

  needsInput(): AttentionSession[] {
    return [...this.sessions];
  }

  onEvent(listener: (event: AttentionEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  onNeedsInputChange(listener: (sessions: AttentionSession[]) => void): () => void {
    this.listListeners.add(listener);
    return () => {
      this.listListeners.delete(listener);
    };
  }

  changeList(sessions: AttentionSession[]): void {
    this.sessions = sessions;
    for (const listener of this.listListeners) listener([...sessions]);
  }

  emit(event: AttentionEvent): void {
    for (const listener of this.eventListeners) listener(event);
  }
}

let app: FastifyInstance;
let monitor: FakeMonitor;
let attentionUrl: string;
const clients: WsClient[] = [];

beforeAll(async () => {
  monitor = new FakeMonitor();
  app = Fastify();
  await app.register(fastifyWebsocket);
  registerAttentionRoute(app, monitor);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  attentionUrl = `ws://127.0.0.1:${address.port}/api/attention`;
});

beforeEach(() => {
  monitor.sessions = [];
});

afterAll(async () => {
  for (const client of clients) client.socket.terminate();
  await app.close();
});

/** Connects and waits for the list frame that every connection gets first. */
async function connect(): Promise<WsClient> {
  const client = connectWs(attentionUrl);
  clients.push(client);
  await waitFor(() => client.frames.length >= 1, 'list frame on connect');
  return client;
}

const parsed = (client: WsClient) => client.frames.map((frame) => JSON.parse(frame) as unknown);
const session = (sessionId: string): AttentionSession => ({ sessionId, folder: `/projects/${sessionId}`, label: `Label ${sessionId}` });
const event = (id: string, sessionId: string): AttentionEvent => ({
  id,
  sessionId,
  kind: 'needs_input',
  folder: `/projects/${sessionId}`,
  label: `Label ${sessionId}`,
  waitingTool: 'Bash',
});

describe('GET /api/attention', () => {
  // plan-session_notifications/REQ-11: the list of the moment on connect
  it('sends the current needs-input list on connect', async () => {
    monitor.sessions = [session('a'), session('b')];
    const client = await connect();
    await delay(100);
    expect(parsed(client)).toEqual([{ type: 'needs-input', sessions: [session('a'), session('b')] }]);
  });

  it('sends an empty list on connect when no session needs input', async () => {
    const client = await connect();
    expect(parsed(client)).toEqual([{ type: 'needs-input', sessions: [] }]);
  });

  // plan-session_notifications/REQ-1, REQ-11
  it('sends each list change and each event once, in the order the monitor gives them', async () => {
    const client = await connect();
    monitor.changeList([session('a')]);
    monitor.emit(event('ev-1', 'a'));
    monitor.changeList([]);
    await waitFor(() => client.frames.length >= 4, 'three more frames');
    await delay(100);
    expect(parsed(client)).toEqual([
      { type: 'needs-input', sessions: [] },
      { type: 'needs-input', sessions: [session('a')] },
      { type: 'event', event: event('ev-1', 'a') },
      { type: 'needs-input', sessions: [] },
    ]);
  });

  // plan-session_notifications/REQ-5: no history
  it('sends no older event to a client that connects later', async () => {
    monitor.changeList([session('a')]);
    monitor.emit(event('ev-old', 'a'));
    const client = await connect();
    await delay(200);
    expect(parsed(client)).toEqual([{ type: 'needs-input', sessions: [session('a')] }]);
  });

  // plan-session_notifications/REQ-6: each event once per client
  it('sends each change and each event once to every connected client, and ignores client frames', async () => {
    const first = await connect();
    const second = await connect();
    first.send({ type: 'event', event: event('fake', 'x') });
    first.send('not json');
    monitor.emit(event('ev-2', 'b'));
    monitor.changeList([session('b')]);
    await waitFor(() => first.frames.length >= 3 && second.frames.length >= 3, 'frames on both clients');
    await delay(100);
    const expected = [
      { type: 'needs-input', sessions: [] },
      { type: 'event', event: event('ev-2', 'b') },
      { type: 'needs-input', sessions: [session('b')] },
    ];
    expect(parsed(first)).toEqual(expected);
    expect(parsed(second)).toEqual(expected);
    expect(first.closeCode).toBeUndefined();
  });

  it('stops the frames of a closed socket and nothing else', async () => {
    const leaving = await connect();
    const staying = await connect();
    leaving.socket.close();
    await leaving.closed;
    const framesBefore = leaving.frames.length;

    expect(() => {
      monitor.emit(event('ev-3', 'c'));
      monitor.changeList([session('c')]);
    }).not.toThrow();

    await waitFor(() => staying.frames.length >= 3, 'frames on the open client');
    await delay(100);
    expect(leaving.frames.length).toBe(framesBefore);
    expect(parsed(staying).slice(1)).toEqual([
      { type: 'event', event: event('ev-3', 'c') },
      { type: 'needs-input', sessions: [session('c')] },
    ]);
  });
});
