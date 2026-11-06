import fastifyWebsocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ExternalSessionChange, ExternalSessionSummary } from '../external/external-session-scanner.js';
import { type WsClient, connectWs, delay, waitFor } from '../test-support.js';
import type { RunningTool } from './running-tool.js';
import { registerSessionEventsRoute } from './session-events-route.js';
import { SessionStateTracker } from './session-state-tracker.js';
import type { SessionUsage } from './usage-monitor.js';

type Frame = { type: string; id?: string; session?: { id: string; usage?: SessionUsage; runningTool?: RunningTool } & Record<string, unknown> };

let app: FastifyInstance;
let bare: FastifyInstance;
let tracker: SessionStateTracker;
let eventsUrl: string;
let bareUrl: string;
let nextId = 0;
const clients: WsClient[] = [];
const externalSessions = new Map<string, ExternalSessionSummary>();
const externalListeners: ((change: ExternalSessionChange) => void)[] = [];
const tools = new Map<string, RunningTool>();
const usages = new Map<string, SessionUsage>();
const usageListeners: ((id: string, usage: SessionUsage | undefined) => void)[] = [];

const usageChange = (id: string, usage: SessionUsage | undefined) => {
  if (usage) usages.set(id, usage);
  else usages.delete(id);
  for (const listener of usageListeners) listener(id, usage);
};

const urlOf = (server: FastifyInstance) => {
  const address = server.server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  return `ws://127.0.0.1:${address.port}/api/sessions/events`;
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
    { get: (id) => tools.get(id), onChange: () => () => {} },
    {
      get: (id) => usages.get(id),
      onChange: (listener) => {
        usageListeners.push(listener);
        return () => {};
      },
    },
  );
  await app.listen({ host: '127.0.0.1', port: 0 });
  eventsUrl = urlOf(app);

  bare = Fastify();
  await bare.register(fastifyWebsocket);
  registerSessionEventsRoute(bare, tracker);
  await bare.listen({ host: '127.0.0.1', port: 0 });
  bareUrl = urlOf(bare);
});

afterAll(async () => {
  for (const client of clients) client.socket.terminate();
  await app.close();
  await bare.close();
});

async function connect(url = eventsUrl): Promise<WsClient> {
  const client = connectWs(url);
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

function putExternal(id: string): ExternalSessionSummary {
  const session: ExternalSessionSummary = { id, folder: `/projects/${id}`, label: id, state: 'idle', lastActivity: '2026-11-06T09:00:00.000Z', external: true };
  externalSessions.set(id, session);
  for (const listener of externalListeners) listener({ type: 'session', session });
  return session;
}

const framesOf = (client: WsClient, id: string) =>
  client.frames.map((frame) => JSON.parse(frame) as Frame).filter((frame) => frame.session?.id === id || frame.id === id);

describe('GET /api/sessions/events, usage', () => {
  const quarter: SessionUsage = { context: { used: 50_000, window: 200_000 } };

  // plan-session_usage/REQ-12: a monitor change sends the current hosted summary with its usage and its running tool
  it('sends a session frame with the hosted summary, its runningTool and its usage on a usage change', async () => {
    const id = workingHosted();
    const bash: RunningTool = { name: 'Bash', argument: 'npm test', others: 0 };
    tools.set(id, bash);
    const client = await connect();
    usageChange(id, quarter);
    await waitFor(() => framesOf(client, id).length >= 1, 'usage frame');
    expect(framesOf(client, id)).toEqual([{ type: 'session', session: { ...tracker.get(id), runningTool: bash, usage: quarter } }]);
  });

  // plan-session_usage/REQ-12: an external session too
  it('sends a session frame with the external summary on a usage change', async () => {
    const session = putExternal('ext-usage');
    const client = await connect();
    usageChange(session.id, quarter);
    await waitFor(() => framesOf(client, session.id).length >= 1, 'usage frame');
    expect(framesOf(client, session.id)).toEqual([{ type: 'session', session: { ...session, usage: quarter } }]);
  });

  // plan-session_usage/REQ-7, REQ-9: a usage that goes away sends the summary with no usage
  it('sends the summary without usage when the monitor clears it', async () => {
    const id = workingHosted();
    usageChange(id, quarter);
    const client = await connect();
    usageChange(id, undefined);
    await waitFor(() => framesOf(client, id).length >= 1, 'clear frame');
    const [frame] = framesOf(client, id);
    expect(frame).toEqual({ type: 'session', session: tracker.get(id) });
    expect(frame?.session).not.toHaveProperty('usage');
  });

  // plan-session_usage/REQ-1: every session frame of a tracker change carries the current usage
  it('adds the current usage to the session frames of tracker changes', async () => {
    const id = workingHosted();
    usageChange(id, quarter);
    const client = await connect();
    tracker.applyHookEvent(id, { hook_event_name: 'Stop' });
    await waitFor(() => framesOf(client, id).length >= 1, 'tracker frame');
    expect(framesOf(client, id)[0]?.session).toMatchObject({ state: 'idle', usage: quarter });
  });

  // plan-session_usage/REQ-1: external scanner frames carry it too
  it('adds the current usage to the session frames of scanner changes', async () => {
    usages.set('ext-scan', quarter);
    const client = await connect();
    putExternal('ext-scan');
    await waitFor(() => framesOf(client, 'ext-scan').length >= 1, 'scanner frame');
    expect(framesOf(client, 'ext-scan')[0]?.session?.usage).toEqual(quarter);
  });

  // SessionEventsRoute spec: no frame when neither the tracker nor the scanner knows the id
  it('sends no frame for a usage change of an unknown id', async () => {
    const client = await connect();
    usageChange('nobody', quarter);
    await delay(150);
    expect(framesOf(client, 'nobody')).toEqual([]);
  });

  // SessionEventsRoute spec: without the monitor no frame has usage
  it('sends no usage without the monitor', async () => {
    const id = workingHosted();
    usages.set(id, quarter);
    const client = await connect(bareUrl);
    tracker.applyHookEvent(id, { hook_event_name: 'Stop' });
    await waitFor(() => framesOf(client, id).length >= 1, 'tracker frame');
    expect(framesOf(client, id)[0]?.session).not.toHaveProperty('usage');
  });
});
