// REQ tests of plan-session_activity, batches latest-text and stall-signal, at the level of the REST API: GET /api/sessions and the session events.
import { appendFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import fastifyWebsocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ExternalSessionChange, ExternalSessionSummary } from '../external/external-session-scanner.js';
import { TranscriptReader } from '../external/transcript-reader.js';
import { registerSessionEventsRoute } from '../sessions/session-events-route.js';
import { registerSessionListRoute } from '../sessions/session-list-route.js';
import { SessionStateTracker } from '../sessions/session-state-tracker.js';
import { type WsClient, connectWs, tempDir, waitFor } from '../test-support.js';
import { ActivityMonitor } from './activity-monitor.js';
import type { LiveActivity } from './live-activity.js';

type Line = Record<string, unknown>;
type Entry = { id: string; state: string; liveActivity?: LiveActivity } & Record<string, unknown>;
type Frame = { type: string; id?: string; session?: Entry };

// REQ-12 asks for 2 s from the line to the change. The monitor reads every 500 ms; the margin covers a loaded machine.
const REQ_12_MS = 2000;
const REQ_22_MS = REQ_12_MS;

let claudeDir: string;
let app: FastifyInstance;
let bare: FastifyInstance;
let tracker: SessionStateTracker;
let monitor: ActivityMonitor;
let eventsUrl: string;
let nextId = 0;
const clients: WsClient[] = [];
const exits = new Map<string, () => void>();
const externalSessions = new Map<string, ExternalSessionSummary>();
const externalListeners = new Set<(change: ExternalSessionChange) => void>();

const scanner = {
  list: () => [...externalSessions.values()],
  get: (id: string) => externalSessions.get(id),
  onChange: (listener: (change: ExternalSessionChange) => void) => {
    externalListeners.add(listener);
    return () => externalListeners.delete(listener);
  },
};

function putExternal(session: ExternalSessionSummary): void {
  externalSessions.set(session.id, session);
  for (const listener of externalListeners) listener({ type: 'session', session });
}

beforeAll(async () => {
  claudeDir = await tempDir('ai-client-live-activity-api-');
  tracker = new SessionStateTracker();
  monitor = new ActivityMonitor({ tracker, scanner, reader: new TranscriptReader({ claudeDir }) });
  app = Fastify();
  await app.register(fastifyWebsocket);
  registerSessionListRoute(app, tracker, scanner, undefined, undefined, monitor);
  registerSessionEventsRoute(app, tracker, scanner, undefined, undefined, monitor);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  eventsUrl = `ws://127.0.0.1:${address.port}/api/sessions/events`;
  bare = Fastify();
  registerSessionListRoute(bare, tracker, scanner);
  monitor.start();
});

afterAll(async () => {
  monitor.stop();
  for (const client of clients) client.socket.terminate();
  await app.close();
  await bare.close();
  await rm(claudeDir, { recursive: true, force: true });
});

const unique = (prefix: string) => {
  nextId += 1;
  return `${prefix}-${nextId}-${Math.random().toString(36).slice(2, 8)}`;
};
const projectDir = (cwd: string) => path.join(claudeDir, 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));

async function append(file: string, ...lines: Line[]): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, lines.map((line) => `${JSON.stringify(line)}\n`).join(''));
}

const now = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();
const userSays = (text: string, timestamp = now()): Line => ({ type: 'user', isSidechain: false, timestamp, origin: { kind: 'human' }, message: { role: 'user', content: text } });
/** `timestamp` null → a line with no timestamp. */
const claudeSays = (content: string | object[], timestamp: string | null = now(), sidechain = false): Line => ({
  type: 'assistant',
  isSidechain: sidechain,
  ...(timestamp !== null && { timestamp }),
  message: { role: 'assistant', content: typeof content === 'string' ? [{ type: 'text', text: content }] : content },
});

const toolCall = (id: string, name: string, input: object | undefined, timestamp: string, sidechain = false): Line => ({
  type: 'assistant',
  isSidechain: sidechain,
  timestamp,
  message: { role: 'assistant', content: [{ type: 'tool_use', id, name, ...(input !== undefined && { input }) }] },
});
const toolResult = (id: string, timestamp: string, sidechain = false): Line => ({
  type: 'user',
  isSidechain: sidechain,
  timestamp,
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'done' }] },
});
const MIN = 60_000;

interface Session {
  id: string;
  transcript: string;
  subagent(agentId: string): { file: string; meta: (meta: object) => Promise<void> };
}

function sessionFiles(id: string, cwd: string, claudeSessionId: string): Session {
  const transcript = path.join(projectDir(cwd), `${claudeSessionId}.jsonl`);
  return {
    id,
    transcript,
    subagent: (agentId) => {
      const file = path.join(projectDir(cwd), claudeSessionId, 'subagents', `${agentId}.jsonl`);
      return {
        file,
        meta: async (meta) => {
          await mkdir(path.dirname(file), { recursive: true });
          await writeFile(file.replace(/\.jsonl$/, '.meta.json'), JSON.stringify(meta));
        },
      };
    },
  };
}

function workingHosted(): Session {
  const id = unique('hosted');
  const cwd = `/work/${id}`;
  const claudeSessionId = unique('sid');
  tracker.track({ id, cwd, onExit: (listener) => exits.set(id, listener) });
  tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Do the work', session_id: claudeSessionId });
  return sessionFiles(id, cwd, claudeSessionId);
}

function external(state: ExternalSessionSummary['state']): Session {
  const id = unique('ext');
  const cwd = `/work/${id}`;
  putExternal({ id, folder: cwd, label: id, state, lastActivity: now(), external: true });
  return sessionFiles(id, cwd, id);
}

async function listEntry(id: string, server = app): Promise<Entry | undefined> {
  const response = await server.inject({ method: 'GET', url: '/api/sessions' });
  expect(response.statusCode).toBe(200);
  return (response.json() as Entry[]).find((entry) => entry.id === id);
}

/** Waits until the entry of `id` in GET /api/sessions satisfies `check`, and gives it. */
async function entryWhen(id: string, check: (entry: Entry | undefined) => boolean, label: string, timeoutMs = 8000): Promise<Entry | undefined> {
  let last: Entry | undefined;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    last = await listEntry(id);
    if (check(last)) return last;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for: ${label}; last entry: ${JSON.stringify(last)}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function connect(): Promise<WsClient> {
  const client = connectWs(eventsUrl);
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    client.socket.once('open', () => resolve());
    client.socket.once('error', reject);
  });
  return client;
}

const framesOf = (client: WsClient, id: string) => client.frames.map((frame) => JSON.parse(frame) as Frame).filter((frame) => frame.session?.id === id);

describe('Latest text, GET /api/sessions', { timeout: 30_000 }, () => {
  // plan-session_activity/REQ-2, REQ-6: a hosted working entry carries the latest text of the turn, plain, with its time
  it('gives a hosted working entry its latest text as plain text with the time of its line', async () => {
    const session = workingHosted();
    const at = now();
    await append(session.transcript, userSays('Read the config'), claudeSays('I am **reading** the `config` files', at));
    const entry = await entryWhen(session.id, (e) => e?.liveActivity?.latestText?.text === 'I am reading the config files', 'latest text');
    expect(entry?.state).toBe('working');
    expect(entry?.liveActivity).toEqual({ atWork: true, latestText: { text: 'I am reading the config files', at }, lastEventAt: expect.any(String), waitingFor: 'response' });
  });

  // plan-session_activity/REQ-2: an external working entry too
  it('gives an external working entry its latest text', async () => {
    const session = external('working');
    await append(session.transcript, userSays('Explain the module'), claudeSays('The module has three parts'));
    const entry = await entryWhen(session.id, (e) => e?.liveActivity?.latestText?.text === 'The module has three parts', 'latest text');
    expect(entry).toMatchObject({ external: true, liveActivity: { atWork: true, latestText: { text: 'The module has three parts' } } });
  });

  // plan-session_activity/REQ-3, REQ-4: a running subagent that wrote last gives the text, with its type
  it('gives the text of a running subagent that wrote after the main conversation, with the subagent type', async () => {
    const session = external('working');
    await append(session.transcript, userSays('Implement the batch', now(-6000)), claudeSays('Starting the developer', now(-5000)));
    const sub = session.subagent('agent-dev1');
    await sub.meta({ agentType: 'sdd-developer', description: 'Implement batch', toolUseId: 'toolu_9' });
    const at = now();
    await append(sub.file, claudeSays('Overwriting the whole CommonServiceImpl class', at, true));
    const entry = await entryWhen(session.id, (e) => e?.liveActivity?.latestText?.subagentType !== undefined, 'subagent text');
    expect(entry?.liveActivity).toEqual({
      atWork: true,
      latestText: { text: 'Overwriting the whole CommonServiceImpl class', subagentType: 'sdd-developer', at },
      lastEventAt: at,
      waitingFor: 'response',
    });
  });

  // plan-session_activity/REQ-1, REQ-11: an idle entry with a running background subagent is at work, until the subagent finishes
  it('keeps an idle entry at work while a subagent runs, and ends it when the subagent finishes', async () => {
    const session = workingHosted();
    await append(session.transcript, userSays('Start a background agent', now(-4000)), claudeSays('The agent runs in the background', now(-3000)));
    const sub = session.subagent('agent-bg1');
    await sub.meta({ agentType: 'general-purpose' });
    await append(sub.file, claudeSays('Scanning the repository', now(), true));
    tracker.applyHookEvent(session.id, { hook_event_name: 'Stop' });
    const atWork = await entryWhen(session.id, (e) => e?.liveActivity?.latestText?.text === 'Scanning the repository', 'subagent text on the idle entry');
    expect(atWork?.state).toBe('idle');
    expect(atWork?.liveActivity).toMatchObject({ atWork: true, latestText: { text: 'Scanning the repository', subagentType: 'general-purpose' } });
    await sub.meta({ agentType: 'general-purpose', finished: true });
    const done = await entryWhen(session.id, (e) => e?.liveActivity?.atWork === false, 'not at work', REQ_12_MS * 4);
    expect(done?.liveActivity).toEqual({ atWork: false });
  });

  // plan-session_activity/REQ-11: needs input, ended, or idle with no running subagent → not at work, no text
  it('gives no latest text to an entry that needs input, has ended, or is idle with no running subagent', async () => {
    const asking = workingHosted();
    const ended = workingHosted();
    const idle = external('working');
    for (const session of [asking, ended, idle]) await append(session.transcript, userSays('Go'), claudeSays('Text of the last turn'));
    for (const session of [asking, ended, idle]) await entryWhen(session.id, (e) => e?.liveActivity?.latestText !== undefined, 'text while working');
    tracker.applyHookEvent(asking.id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    exits.get(ended.id)?.();
    putExternal({ ...externalSessions.get(idle.id)!, state: 'idle' });
    expect((await listEntry(asking.id))?.liveActivity).toEqual({ atWork: false });
    expect((await listEntry(ended.id))?.liveActivity).toEqual({ atWork: false });
    expect((await listEntry(idle.id))?.liveActivity).toEqual({ atWork: false });
  });

  // plan-session_activity/REQ-5, REQ-10: a new turn hides the text of the previous one; thinking gives no text
  it('shows no text of the previous turn, nor thinking, in a new turn', async () => {
    const session = workingHosted();
    await append(session.transcript, userSays('First task'), claudeSays('First task done'));
    await entryWhen(session.id, (e) => e?.liveActivity?.latestText?.text === 'First task done', 'first turn text');
    tracker.applyHookEvent(session.id, { hook_event_name: 'Stop' });
    tracker.applyHookEvent(session.id, { hook_event_name: 'UserPromptSubmit', prompt: 'Second task' });
    await append(session.transcript, userSays('Second task'), claudeSays([{ type: 'thinking', thinking: 'Let me plan the second task', signature: 'x' }]));
    const thinking = await entryWhen(session.id, (e) => e?.state === 'working' && e.liveActivity?.atWork === true && e.liveActivity.latestText === undefined, 'no text', REQ_12_MS * 4);
    expect(thinking?.liveActivity).toEqual({ atWork: true, lastEventAt: expect.any(String), waitingFor: 'response' });
    await append(session.transcript, claudeSays('Second task started'));
    const next = await entryWhen(session.id, (e) => e?.liveActivity?.latestText?.text === 'Second task started', 'second turn text');
    expect(next?.liveActivity?.latestText?.text).toBe('Second task started');
  });

  // plan-session_activity/REQ-13: no agent type and no timestamp hide only the type and the time
  it('gives a subagent text with no type and no time when the metadata has no type and the line no timestamp', async () => {
    const session = external('working');
    await append(session.transcript, userSays('Go'));
    const sub = session.subagent('agent-anon');
    await sub.meta({ description: 'No type here', agentType: 42 });
    await append(sub.file, claudeSays('Text without type and time', null, true));
    const entry = await entryWhen(session.id, (e) => e?.liveActivity?.latestText?.text === 'Text without type and time', 'latest text');
    expect(entry?.liveActivity).toEqual({ atWork: true, latestText: { text: 'Text without type and time' }, lastEventAt: expect.any(String), waitingFor: 'response' });
    expect(entry).toMatchObject({ id: session.id, state: 'working', label: session.id, external: true });
  });

  // plan-session_activity/REQ-14: a subagent of thousands of steps over 16 hours; the list keeps answering and gives its latest text
  it('keeps answering the list while it reads a subagent of thousands of steps, then gives its latest text', async () => {
    const session = external('working');
    const start = Date.now() - 16 * 3600_000;
    await append(session.transcript, userSays('Run the long job', new Date(start - 1000).toISOString()));
    const sub = session.subagent('agent-huge');
    await sub.meta({ agentType: 'sdd-tester' });
    const lines: Line[] = [];
    for (let step = 0; step < 6000; step += 1) {
      const at = new Date(start + step * 9_600).toISOString();
      lines.push(
        claudeSays([{ type: 'text', text: `Step ${step}: ${'checking the output of the test run '.repeat(4)}` }, { type: 'tool_use', id: `t${step}`, name: 'Bash', input: { command: 'mvn test' } }], at, true),
        { type: 'user', isSidechain: true, timestamp: at, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `t${step}`, content: 'x'.repeat(400) }] } },
      );
    }
    await append(sub.file, ...lines);
    const last = now();
    await append(sub.file, claudeSays('All 6000 steps checked', last, true));
    // entryWhen asks the list every 25 ms and expects 200 each time, while the monitor reads the file in chunks.
    const entry = await entryWhen(session.id, (e) => e?.liveActivity?.latestText?.text === 'All 6000 steps checked', 'latest text of the huge subagent', 60_000);
    expect(entry?.liveActivity).toEqual({ atWork: true, latestText: { text: 'All 6000 steps checked', subagentType: 'sdd-tester', at: last }, lastEventAt: last, waitingFor: 'response' });
  }, 90_000);

  // session-list-route spec: without the monitor no entry has liveActivity
  it('gives no liveActivity without the monitor', async () => {
    const session = external('working');
    await append(session.transcript, userSays('Go'), claudeSays('Text'));
    await entryWhen(session.id, (e) => e?.liveActivity !== undefined, 'value in the monitored app');
    const entry = await listEntry(session.id, bare);
    expect(entry).toBeDefined();
    expect(entry).not.toHaveProperty('liveActivity');
  });
});

describe('Latest text, session events', { timeout: 30_000 }, () => {
  // plan-session_activity/REQ-2, REQ-12: a new text sends a session frame with the current summary and its liveActivity within 2 s
  it('sends a session frame with the new latest text within 2 seconds of its line', async () => {
    const session = workingHosted();
    await append(session.transcript, userSays('Go'), claudeSays('First text'));
    await entryWhen(session.id, (e) => e?.liveActivity?.latestText?.text === 'First text', 'first text');
    const client = await connect();
    const at = now();
    await append(session.transcript, claudeSays('Second text', at));
    await waitFor(() => framesOf(client, session.id).some((f) => f.session?.liveActivity?.latestText?.text === 'Second text'), 'frame of the new text', REQ_12_MS);
    const frame = framesOf(client, session.id).find((f) => f.session?.liveActivity?.latestText?.text === 'Second text');
    expect(frame).toEqual({
      type: 'session',
      session: { ...tracker.get(session.id), liveActivity: { atWork: true, latestText: { text: 'Second text', at }, lastEventAt: at, waitingFor: 'response' } },
    });
  });

  // plan-session_activity/REQ-12: external sessions too, with the external summary
  it('sends a session frame for an external session with its summary', async () => {
    const session = external('working');
    await append(session.transcript, userSays('Go'));
    const client = await connect();
    const at = now();
    await append(session.transcript, claudeSays('External text', at));
    await waitFor(() => framesOf(client, session.id).some((f) => f.session?.liveActivity?.latestText !== undefined), 'frame of the external text', REQ_12_MS);
    const frame = framesOf(client, session.id).find((f) => f.session?.liveActivity?.latestText !== undefined);
    expect(frame).toEqual({
      type: 'session',
      session: { ...externalSessions.get(session.id), liveActivity: { atWork: true, latestText: { text: 'External text', at }, lastEventAt: at, waitingFor: 'response' } },
    });
  });

  // plan-session_activity/REQ-11, REQ-12, REQ-22: the change that hides the line and the stall signal reaches the page at once
  it('sends the session frame with atWork false when the session ends', async () => {
    const session = workingHosted();
    await append(session.transcript, userSays('Go'), claudeSays('Working'));
    await entryWhen(session.id, (e) => e?.liveActivity?.latestText !== undefined, 'latest text');
    const client = await connect();
    exits.get(session.id)?.();
    await waitFor(() => framesOf(client, session.id).some((f) => f.session?.state === 'ended' && f.session.liveActivity?.atWork === false), 'ended frame', REQ_12_MS);
    const last = framesOf(client, session.id).at(-1);
    expect(last?.session?.liveActivity).toEqual({ atWork: false });
  });

  // session-events-route spec: every session frame carries the current liveActivity, also a frame of a tracker change
  it('carries the current liveActivity in the frame of a tracker change', async () => {
    const session = workingHosted();
    await append(session.transcript, userSays('Go'), claudeSays('Current text'));
    await entryWhen(session.id, (e) => e?.liveActivity?.latestText !== undefined, 'latest text');
    const client = await connect();
    tracker.applyHookEvent(session.id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    await waitFor(() => framesOf(client, session.id).some((f) => f.session?.state === 'needs_input'), 'needs input frame', REQ_12_MS);
    const frame = framesOf(client, session.id).find((f) => f.session?.state === 'needs_input');
    expect(frame?.session?.liveActivity).toEqual({ atWork: false });
  });
});

describe('Stall signal, GET /api/sessions and session events', { timeout: 30_000 }, () => {
  // plan-session_activity/REQ-16, REQ-18, REQ-19: a silent hosted session gives the time of its last activity and the tool of its subagent
  it('gives the time of the last activity and the running tool of a subagent with its type', async () => {
    const session = workingHosted();
    const last = now(-8 * MIN);
    await append(session.transcript, userSays('Run the tests', now(-9 * MIN)), toolCall('toolu_t', 'Agent', { description: 'Run the tests', prompt: 'Run mvn test' }, now(-8.5 * MIN)));
    const tester = session.subagent('agent-tst1');
    await tester.meta({ agentType: 'sdd-tester', description: 'Run the tests', toolUseId: 'toolu_t' });
    await append(tester.file, { ...userSays('Run mvn test', now(-8.4 * MIN)), isSidechain: true }, toolCall('s1', 'Bash', { command: 'mvn test', description: 'Run the tests' }, last, true));
    const entry = await entryWhen(session.id, (e) => e?.liveActivity?.lastEventAt === last && typeof e.liveActivity.waitingFor === 'object', 'subagent tool');
    expect(entry?.state).toBe('working');
    expect(entry?.liveActivity).toEqual({ atWork: true, lastEventAt: last, waitingFor: { subagentType: 'sdd-tester', name: 'Bash', argument: 'mvn test', others: 0 } });
  });

  // plan-session_activity/REQ-18: with no running tool the session waits for Claude's response
  it("waits for Claude's response when no tool runs", async () => {
    const session = external('working');
    const last = now(-6 * MIN);
    await append(session.transcript, userSays('List the files', now(-7 * MIN)), toolCall('t1', 'Bash', { command: 'ls' }, now(-6.5 * MIN)), toolResult('t1', last));
    const entry = await entryWhen(session.id, (e) => e?.liveActivity?.lastEventAt === last, 'last activity');
    expect(entry?.liveActivity).toEqual({ atWork: true, lastEventAt: last, waitingFor: 'response' });
  });

  // plan-session_activity/REQ-20: several running tools → the first started and the count of the others
  it('names the tool that started first and counts the others, without the calls that started the subagents', async () => {
    const session = external('working');
    await append(
      session.transcript,
      userSays('Build and check', now(-10 * MIN)),
      toolCall('m1', 'Bash', { command: 'npm run build' }, now(-9 * MIN)),
      toolCall('toolu_a', 'Agent', { description: 'Explore' }, now(-8 * MIN)),
      toolCall('toolu_b', 'Agent', { description: 'Run the tests' }, now(-8 * MIN)),
    );
    const explorer = session.subagent('agent-exp1');
    await explorer.meta({ agentType: 'Explore', toolUseId: 'toolu_a' });
    await append(explorer.file, toolCall('s1', 'Grep', { pattern: 'TODO' }, now(-7 * MIN), true));
    const tester = session.subagent('agent-tst2');
    await tester.meta({ agentType: 'sdd-tester', toolUseId: 'toolu_b' });
    const last = now(-6 * MIN);
    await append(tester.file, toolCall('s2', 'Bash', { command: 'mvn test' }, last, true));
    const entry = await entryWhen(session.id, (e) => e?.liveActivity?.lastEventAt === last, 'every file read');
    expect(entry?.liveActivity).toEqual({ atWork: true, lastEventAt: last, waitingFor: { name: 'Bash', argument: 'npm run build', others: 2 } });
  });

  // plan-session_activity/REQ-26: no agent type and no tool input hide only the type and the argument
  it('gives the tool name alone for a subagent with no type and a tool with no input', async () => {
    const session = external('working');
    await append(session.transcript, userSays('Search the web', now(-7 * MIN)), toolCall('toolu_w', 'Agent', { description: 'Search' }, now(-6.5 * MIN)));
    const searcher = session.subagent('agent-web1');
    await searcher.meta({ description: 'Search', toolUseId: 'toolu_w' });
    const last = now(-6 * MIN);
    await append(searcher.file, toolCall('s1', 'WebSearch', undefined, last, true));
    const entry = await entryWhen(session.id, (e) => e?.liveActivity?.lastEventAt === last, 'subagent tool');
    expect(entry?.liveActivity).toEqual({ atWork: true, lastEventAt: last, waitingFor: { name: 'WebSearch', others: 0 } });
    expect(entry?.liveActivity?.waitingFor).not.toHaveProperty('subagentType');
    expect(entry?.liveActivity?.waitingFor).not.toHaveProperty('argument');
  });

  // plan-session_activity/REQ-17, REQ-22: a tool result of a subagent sends the new last activity within 2 seconds
  it('sends a session frame with the new last activity within 2 seconds of a subagent tool result', async () => {
    const session = external('working');
    await append(session.transcript, userSays('Run the tests', now(-7 * MIN)), toolCall('toolu_t', 'Agent', { description: 'Run the tests' }, now(-7 * MIN)));
    const tester = session.subagent('agent-tst3');
    await tester.meta({ agentType: 'sdd-tester', toolUseId: 'toolu_t' });
    await append(tester.file, toolCall('s1', 'Bash', { command: 'mvn test' }, now(-6 * MIN), true));
    await entryWhen(session.id, (e) => typeof e?.liveActivity?.waitingFor === 'object', 'subagent tool');
    const client = await connect();
    const at = now();
    await append(tester.file, toolResult('s1', at, true));
    await waitFor(() => framesOf(client, session.id).some((f) => f.session?.liveActivity?.lastEventAt === at), 'frame of the new activity', REQ_22_MS);
    const frame = framesOf(client, session.id).find((f) => f.session?.liveActivity?.lastEventAt === at);
    expect(frame?.session?.liveActivity).toEqual({ atWork: true, lastEventAt: at, waitingFor: 'response' });
  });

  // plan-session_activity/REQ-25: the last activity changes neither the state nor the last activity of the session summary
  it('leaves the state and the summary of the session as they are', async () => {
    const hosted = workingHosted();
    const ext = external('working');
    const scannerTime = now(-30 * MIN);
    putExternal({ ...externalSessions.get(ext.id)!, lastActivity: scannerTime });
    const last = now(-6 * MIN);
    for (const session of [hosted, ext]) await append(session.transcript, userSays('Go', now(-7 * MIN)), toolCall('t1', 'Bash', { command: 'sleep 600' }, last));
    const hostedEntry = await entryWhen(hosted.id, (e) => e?.liveActivity?.lastEventAt === last, 'hosted last activity');
    const extEntry = await entryWhen(ext.id, (e) => e?.liveActivity?.lastEventAt === last, 'external last activity');
    const { liveActivity: _hosted, ...hostedSummary } = hostedEntry!;
    const { liveActivity: _ext, ...extSummary } = extEntry!;
    expect(hostedSummary).toEqual(tracker.get(hosted.id));
    expect(hostedSummary.state).toBe('working');
    expect(extSummary).toEqual(externalSessions.get(ext.id));
    expect(extSummary.lastActivity, 'the summary keeps the time of the scanner').toBe(scannerTime);
    expect(extSummary.state).toBe('working');
  });
});
