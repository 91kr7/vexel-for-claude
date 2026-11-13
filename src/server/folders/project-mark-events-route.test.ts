import fastifyWebsocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type WsClient, connectWs, delay, waitFor } from '../test-support.js';
import { registerProjectMarkEventsRoute } from './project-mark-events-route.js';
import { ProjectMarkStore } from './project-mark-store.js';

let app: FastifyInstance;
let marks: ProjectMarkStore;
let eventsUrl: string;
const clients: WsClient[] = [];

beforeAll(async () => {
  marks = new ProjectMarkStore();
  app = Fastify();
  await app.register(fastifyWebsocket);
  registerProjectMarkEventsRoute(app, marks);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  eventsUrl = `ws://127.0.0.1:${address.port}/api/projects/marks`;
});

afterAll(async () => {
  for (const client of clients) client.socket.terminate();
  await app.close();
});

beforeEach(async () => {
  for (const folder of marks.favorites()) await marks.setFavorite(folder, false);
  for (const folder of Object.keys(marks.removals())) await marks.clearRemoval(folder);
});

async function connect(): Promise<WsClient> {
  const client = connectWs(eventsUrl);
  clients.push(client);
  await waitFor(() => client.frames.length > 0, 'first project-marks frame');
  return client;
}

const frames = (client: WsClient) => client.frames.map((frame) => JSON.parse(frame) as { type: string; favorites: string[] });
const lastFavorites = (client: WsClient) => [...(frames(client).at(-1)?.favorites ?? [])].sort();

describe('GET /api/projects/marks', () => {
  it('sends the current marks on connect, as one project-marks frame', async () => {
    await marks.setFavorite('/work/a', true);
    await marks.setFavorite('/work/b', true);
    const client = await connect();
    await delay(50);
    expect(frames(client)).toHaveLength(1);
    expect(frames(client)[0]!.type).toBe('project-marks');
    expect(lastFavorites(client)).toEqual(['/work/a', '/work/b']);
  });

  it('sends an empty list on connect when no project is marked', async () => {
    const client = await connect();
    expect(frames(client)[0]).toEqual({ type: 'project-marks', favorites: [], removed: {} });
  });

  // plan-project_list_actions/REQ-29: every open page gets every change
  it('sends the marks after each change to every connected page', async () => {
    const first = await connect();
    const second = await connect();
    await marks.setFavorite('/work/a', true);
    await waitFor(() => first.frames.length === 2 && second.frames.length === 2, 'frame after the mark');
    expect(lastFavorites(first)).toEqual(['/work/a']);
    expect(lastFavorites(second)).toEqual(['/work/a']);

    await marks.setFavorite('/work/b', true);
    await marks.setFavorite('/work/a', false);
    await waitFor(() => first.frames.length === 4 && second.frames.length === 4, 'frames after two changes');
    expect(lastFavorites(first)).toEqual(['/work/b']);
    expect(lastFavorites(second)).toEqual(['/work/b']);
    expect(frames(first).every((frame) => frame.type === 'project-marks')).toBe(true);
  });

  it('ignores the frames of the client', async () => {
    const client = await connect();
    client.send({ type: 'project-marks', favorites: ['/work/injected'] });
    client.send('not json');
    await delay(100);
    expect(marks.favorites()).toEqual([]);
    expect(client.closeCode).toBeUndefined();
    await marks.setFavorite('/work/a', true);
    await waitFor(() => client.frames.length === 2, 'frame after the mark');
    expect(lastFavorites(client)).toEqual(['/work/a']);
  });

  it('a closed socket gets no more frames, and the other pages still get the changes', async () => {
    const leaving = await connect();
    const staying = await connect();
    leaving.socket.close();
    await leaving.closed;
    await marks.setFavorite('/work/a', true);
    await waitFor(() => staying.frames.length === 2, 'frame after the mark');
    expect(leaving.frames).toHaveLength(1);
    expect(lastFavorites(staying)).toEqual(['/work/a']);
  });
});

describe('GET /api/projects/marks removals', () => {
  const lastRemoved = (client: WsClient) => (JSON.parse(client.frames.at(-1)!) as { removed: Record<string, string> }).removed;

  it('sends the removed folders with their removal time on connect', async () => {
    await marks.remove('/work/a');
    const client = await connect();
    expect(frames(client)[0]).toEqual({ type: 'project-marks', favorites: [], removed: marks.removals() });
    expect(Object.keys(lastRemoved(client))).toEqual(['/work/a']);
  });

  // plan-project_list_actions/REQ-20: every open page gets the removal
  it('sends the marks after a removal and after its clearing to every connected page', async () => {
    await marks.setFavorite('/work/a', true);
    const first = await connect();
    const second = await connect();
    await marks.remove('/work/a');
    await waitFor(() => first.frames.length === 2 && second.frames.length === 2, 'frame after the removal');
    for (const client of [first, second]) {
      expect(lastFavorites(client)).toEqual([]);
      expect(lastRemoved(client)).toEqual({ '/work/a': marks.removals()['/work/a'] });
    }

    await marks.clearRemoval('/work/a');
    await waitFor(() => first.frames.length === 3 && second.frames.length === 3, 'frame after the clearing');
    expect(lastRemoved(first)).toEqual({});
    expect(lastRemoved(second)).toEqual({});
  });
});
