import fastifyWebsocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ExternalSessionChange, ExternalSessionSummary } from '../external/external-session-scanner.js';
import { type WsClient, connectWs, delay, waitFor } from '../test-support.js';
import type { RunningTool } from './running-tool.js';
import { registerSessionEventsRoute } from './session-events-route.js';
import { SessionStateTracker } from './session-state-tracker.js';

type Frame = { type: string; id?: string; session?: { id: string; state: string; runningTool?: RunningTool } & Record<string, unknown> };

let app: FastifyInstance;
let tracker: SessionStateTracker;
let eventsUrl: string;
let nextId = 0;
const clients: WsClient[] = [];
const externalSessions = new Map<string, ExternalSessionSummary>();
const externalListeners: ((change: ExternalSessionChange) => void)[] = [];
const tools = new Map<string, RunningTool>();
const toolListeners: ((id: string, tool: RunningTool | undefined) => void)[] = [];

const monitorChange = (id: string, tool: RunningTool | undefined) => {
  if (tool) tools.set(id, tool);
  else tools.delete(id);
  for (const listener of toolListeners) listener(id, tool);
};

beforeAll(async () => {
  tracker = new SessionStateTracker();
  app = Fastify();
  await app.register(fastifyWebsocket);
  registerSessionEventsRoute(
    app,
    tracker,
    {
      get: (id) => externalSessions.get(id),
      onChange: (listener) => {
        externalListeners.push(listener);
        return () => {};
      },
    },
    {
      get: (id) => tools.get(id),
      onChange: (listener) => {
        toolListeners.push(listener);
        return () => {};
      },
    },
  );
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

function workingHosted(): string {
  nextId += 1;
  const id = `hosted-${nextId}`;
  tracker.track({ id, cwd: `/projects/${id}`, onExit: () => {} });
  tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Run the tests' });
  return id;
}

function putExternal(id: string, state: ExternalSessionSummary['state']): ExternalSessionSummary {
  const session: ExternalSessionSummary = { id, folder: `/projects/${id}`, label: id, state, lastActivity: '2026-11-06T09:00:00.000Z', external: true };
  externalSessions.set(id, session);
  for (const listener of externalListeners) listener({ type: 'session', session });
  return session;
}

const framesOf = (client: WsClient, id: string) =>
  client.frames.map((frame) => JSON.parse(frame) as Frame).filter((frame) => frame.session?.id === id || frame.id === id);

describe('GET /api/sessions/events, running tool', () => {
  const bash: RunningTool = { name: 'Bash', argument: 'npm test', others: 0 };

  // plan-session_list_improvements/REQ-24: a monitor change sends the hosted summary with its tool
  it('sends a session frame with the current hosted summary and its tool on a monitor change', async () => {
    const id = workingHosted();
    const client = await connect();
    monitorChange(id, bash);
    await waitFor(() => framesOf(client, id).length >= 1, 'monitor frame');
    expect(framesOf(client, id)).toEqual([{ type: 'session', session: { ...tracker.get(id), runningTool: bash } }]);
  });

  // plan-session_list_improvements/REQ-24: a monitor change sends the external summary with its tool
  it('sends a session frame with the current external summary on a monitor change', async () => {
    const session = putExternal('ext-change', 'working');
    const client = await connect();
    const read: RunningTool = { name: 'Read', argument: '/a.ts', others: 1 };
    monitorChange(session.id, read);
    await waitFor(() => framesOf(client, session.id).length >= 1, 'monitor frame');
    expect(framesOf(client, session.id)).toEqual([{ type: 'session', session: { ...session, runningTool: read } }]);
  });

  // plan-session_list_improvements/REQ-22: the end of a tool sends the summary with no runningTool
  it('sends the summary without runningTool when the monitor clears the tool', async () => {
    const id = workingHosted();
    monitorChange(id, bash);
    const client = await connect();
    monitorChange(id, undefined);
    await waitFor(() => framesOf(client, id).length >= 1, 'clear frame');
    const [frame] = framesOf(client, id);
    expect(frame).toEqual({ type: 'session', session: tracker.get(id) });
    expect(frame?.session).not.toHaveProperty('runningTool');
  });

  // SessionEventsRoute contract: no frame for an id that neither the tracker nor the scanner knows
  it('sends no frame for a monitor change of an unknown session', async () => {
    const client = await connect();
    monitorChange('nobody', bash);
    await delay(200);
    expect(client.frames).toEqual([]);
  });

  // plan-session_list_improvements/REQ-14: tracker and scanner frames carry the tool shown at send time
  it('adds the current runningTool to tracker and scanner frames', async () => {
    const id = workingHosted();
    putExternal('ext-frame', 'working');
    monitorChange(id, bash);
    monitorChange('ext-frame', { name: 'Grep', argument: 'TODO', others: 0 });
    const client = await connect();
    tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Again' });
    putExternal('ext-frame', 'working');
    externalSessions.set('ext-frame', { ...externalSessions.get('ext-frame')!, label: 'renamed' });
    for (const listener of externalListeners) listener({ type: 'session', session: externalSessions.get('ext-frame')! });
    await waitFor(() => framesOf(client, id).length >= 1 && framesOf(client, 'ext-frame').length >= 2, 'tracker and scanner frames');
    expect(framesOf(client, id)[0]?.session).toEqual({ ...tracker.get(id), runningTool: bash });
    expect(framesOf(client, 'ext-frame').at(-1)?.session).toMatchObject({ label: 'renamed', runningTool: { name: 'Grep', argument: 'TODO', others: 0 } });
  });

  // plan-session_list_improvements/REQ-22: frames of a session with no tool have no runningTool
  it('leaves runningTool out of the frames of a session with no tool', async () => {
    const client = await connect();
    const id = workingHosted();
    await waitFor(() => framesOf(client, id).length >= 2, 'tracker frames');
    for (const frame of framesOf(client, id)) expect(frame.session).not.toHaveProperty('runningTool');
  });
});
