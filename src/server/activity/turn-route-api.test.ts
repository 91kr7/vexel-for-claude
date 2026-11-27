// REQ tests of plan-session_activity (batch turn-panel) and plan-subagent_panel, at the level of the API: the WebSocket GET /api/sessions/:id/turn.
import { appendFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import fastifyWebsocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ExternalSessionChange, ExternalSessionSummary } from '../external/external-session-scanner.js';
import { TranscriptReader } from '../external/transcript-reader.js';
import { SessionStateTracker } from '../sessions/session-state-tracker.js';
import { type WsClient, connectWs, tempDir, waitFor } from '../test-support.js';
import { ActivityMonitor } from './activity-monitor.js';
import { registerTurnRoute } from './turn-route.js';
import type { TurnChange, TurnSubagent, TurnTree } from './turn-tree.js';

type Line = Record<string, unknown>;

// REQ-43 asks for 2 s from the line to the frame. The monitor reads every 500 ms.
const REQ_43_MS = 2000;
const NO_TURN: TurnTree = { number: 0, status: 'none', groups: [], earlier: [], subagents: [] };

let claudeDir: string;
let app: FastifyInstance;
let tracker: SessionStateTracker;
let monitor: ActivityMonitor;
let baseUrl: string;
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

beforeAll(async () => {
  claudeDir = await tempDir('ai-client-turn-route-api-');
  tracker = new SessionStateTracker();
  monitor = new ActivityMonitor({ tracker, scanner, reader: new TranscriptReader({ claudeDir }) });
  app = Fastify();
  await app.register(fastifyWebsocket);
  registerTurnRoute(app, { monitor, tracker, scanner });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  baseUrl = `ws://127.0.0.1:${address.port}`;
  monitor.start();
});

afterAll(async () => {
  monitor.stop();
  for (const client of clients) client.socket.terminate();
  await app.close();
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
const userSays = (text: string, timestamp = now(), sidechain = false): Line => ({ type: 'user', isSidechain: sidechain, timestamp, origin: { kind: 'human' }, message: { role: 'user', content: text } });
const claudeSays = (content: string | object[], timestamp = now(), sidechain = false, model?: string): Line => ({
  type: 'assistant',
  isSidechain: sidechain,
  timestamp,
  message: { role: 'assistant', ...(model !== undefined && { model }), content: typeof content === 'string' ? [{ type: 'text', text: content }] : content },
});
const toolUse = (id: string, name: string, input: object) => ({ type: 'tool_use', id, name, input });
const agentUse = (id: string, description: string, type = 'sdd-developer') => toolUse(id, 'Agent', { description, prompt: 'Do the work', subagent_type: type });
const toolResult = (id: string, timestamp = now(), sidechain = false): Line => ({
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
  return {
    id,
    transcript: path.join(projectDir(cwd), `${claudeSessionId}.jsonl`),
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

function workingHosted(): Session & { claudeSessionId: string } {
  const id = unique('hosted');
  const cwd = `/work/${id}`;
  const claudeSessionId = unique('sid');
  tracker.track({ id, cwd, onExit: (listener) => exits.set(id, listener) });
  tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Do the work', session_id: claudeSessionId });
  return { ...sessionFiles(id, cwd, claudeSessionId), claudeSessionId };
}

function external(state: ExternalSessionSummary['state']): Session {
  const id = unique('ext');
  const cwd = `/work/${id}`;
  const session: ExternalSessionSummary = { id, folder: cwd, label: id, state, lastActivity: now(), external: true };
  externalSessions.set(id, session);
  for (const listener of externalListeners) listener({ type: 'session', session });
  return sessionFiles(id, cwd, id);
}

async function connect(id: string): Promise<WsClient> {
  const client = connectWs(`${baseUrl}/api/sessions/${encodeURIComponent(id)}/turn`);
  clients.push(client);
  return client;
}

const framesOf = (client: WsClient) => client.frames.map((frame) => JSON.parse(frame) as TurnChange);

/** The tree the page would hold after the frames of the socket. */
function treeOf(client: WsClient): TurnTree | undefined {
  let tree: TurnTree | undefined;
  for (const frame of framesOf(client)) {
    if (frame.type === 'turn') tree = structuredClone(frame.turn);
    else if (tree) {
      if (frame.status) tree.status = frame.status;
      if (frame.groups) tree.groups = frame.groups;
      if (frame.earlier) tree.earlier = frame.earlier;
      for (const subagent of frame.subagents ?? []) {
        const at = tree.subagents.findIndex((known) => known.id === subagent.id);
        if (at >= 0) tree.subagents[at] = subagent;
        else tree.subagents.push(subagent);
      }
    }
  }
  return tree;
}

async function treeWhen(client: WsClient, check: (tree: TurnTree) => boolean, label: string, timeoutMs = 8000): Promise<TurnTree> {
  await waitFor(() => {
    const tree = treeOf(client);
    return tree !== undefined && check(tree);
  }, `${label}; last tree: ${JSON.stringify(treeOf(client))}`, timeoutMs);
  return treeOf(client)!;
}

const subagentOf = (tree: TurnTree, id: string) => tree.subagents.find((subagent) => subagent.id === id);

describe('Turn route, opening', { timeout: 30_000 }, () => {
  // plan-session_activity/REQ-27, REQ-28, plan-subagent_panel/REQ-1: a hosted session gets the whole tree of its current turn first, with no step
  it('sends the whole tree of the current turn of a hosted session first', async () => {
    const session = workingHosted();
    await append(session.transcript, userSays('Old turn'), claudeSays('Old text'), userSays('Check the repo'), claudeSays('Looking at the **repository**'));
    await waitFor(() => monitor.turnOf(session.id)?.number === 2, 'monitor read the transcript');
    const client = await connect(session.id);
    await waitFor(() => client.frames.length > 0, 'first frame');
    expect(framesOf(client)[0]).toEqual({ type: 'turn', turn: { number: 2, status: 'running', groups: [], earlier: [], subagents: [] } });
  });

  // plan-session_activity/REQ-27: an external session too
  it('sends the tree of an external session', async () => {
    const session = external('working');
    await append(session.transcript, userSays('Explain'), claudeSays([agentUse('ext', 'Explain the module', 'Explore')]));
    const sub = session.subagent('agent-ext');
    await append(sub.file, userSays('Explain the module', now(), true));
    await sub.meta({ agentType: 'Explore', toolUseId: 'ext' });
    const client = await connect(session.id);
    const tree = await treeWhen(client, (t) => t.subagents.length === 1, 'the subagent of the external session');
    expect(tree).toMatchObject({ number: 1, status: 'running', groups: [{ subagents: ['agent-ext'] }] });
  });

  // turn-route spec: an unknown id closes the socket with 4404 and no frame
  it('closes with 4404 and no frame for an unknown id', async () => {
    const client = await connect('no-such-session');
    expect(await client.closed).toBe(4404);
    expect(client.frames).toEqual([]);
  });

  // plan-session_activity/REQ-41, plan-subagent_panel/REQ-7: a session with no turn yet gets the empty tree
  it('sends the empty tree for a hosted session where the user sent no message yet', async () => {
    const id = unique('hosted');
    tracker.track({ id, cwd: `/work/${id}`, onExit: () => {} });
    const client = await connect(id);
    await waitFor(() => client.frames.length > 0, 'first frame');
    expect(framesOf(client)).toEqual([{ type: 'turn', turn: NO_TURN }]);
  });
});

describe('Turn route, the tree of a turn', { timeout: 30_000 }, () => {
  // plan-subagent_panel/REQ-1, REQ-2, REQ-3, plan-session_activity/REQ-32, REQ-37: scenario "The panel shows only the subagents of the turn, in start order"
  it('gives only the subagents of the turn, a single one then two of one message as a group, in start order', async () => {
    const session = workingHosted();
    const turnStart = now(-5 * MIN);
    const analystStart = now(-4 * MIN);
    const developersStart = now(-2 * MIN);
    await append(
      session.transcript,
      userSays('Implement the batch', turnStart),
      claudeSays('I will check the repository first'),
      claudeSays([toolUse('git', 'Bash', { command: 'git status' })]),
      toolResult('git'),
      claudeSays([agentUse('analyst', 'Analyse the request', 'sdd-analyst')]),
      toolResult('analyst'),
      claudeSays('The analysis is ready'),
      claudeSays([agentUse('dev-1', 'Implement INT-1'), agentUse('dev-2', 'Implement INT-2')]),
    );
    const analyst = session.subagent('agent-an');
    const first = session.subagent('agent-d1');
    const second = session.subagent('agent-d2');
    await append(analyst.file, userSays('Analyse the request', analystStart, true), claudeSays('Reading the spec', now(), true));
    await append(first.file, userSays('Implement INT-1', developersStart, true), claudeSays('Reading the **spec**', now(), true, 'claude-opus-5-5'), claudeSays([toolUse('t1', 'Bash', { command: 'npm test' })], now(), true));
    await append(second.file, userSays('Implement INT-2', developersStart, true), claudeSays('Writing the route', now(), true));
    await analyst.meta({ agentType: 'sdd-analyst', description: 'Analyse the request', toolUseId: 'analyst' });
    await first.meta({ agentType: 'sdd-developer', description: 'Implement INT-1', toolUseId: 'dev-1', pickedEffortModel: 'claude-opus-5-5' });
    await second.meta({ agentType: 'sdd-developer', description: 'Implement INT-2', toolUseId: 'dev-2', pickedEffortModel: 'claude-sonnet-5' });
    const client = await connect(session.id);
    const tree = await treeWhen(client, (t) => t.subagents.length === 3, 'three subagents');
    expect(Object.keys(tree).sort(), 'REQ-1: no step of the main conversation').toEqual(['earlier', 'groups', 'number', 'status', 'subagents']);
    expect(tree.groups).toEqual([{ subagents: ['agent-an'] }, { subagents: ['agent-d1', 'agent-d2'] }]);
    expect(subagentOf(tree, 'agent-d1')).toEqual<TurnSubagent>({
      id: 'agent-d1',
      type: 'sdd-developer',
      description: 'Implement INT-1',
      model: 'claude-opus-5-5',
      state: 'running',
      startedAt: developersStart,
      latestText: 'Reading the spec',
      currentTool: { name: 'Bash', argument: 'npm test', others: 0 },
      groups: [],
    });
    expect(subagentOf(tree, 'agent-an')).toMatchObject({ type: 'sdd-analyst', startedAt: analystStart });
    expect(JSON.stringify(framesOf(client)), 'REQ-1: no text or tool call of the main conversation in any frame').not.toMatch(/check the repository|git status|Implement the batch|analysis is ready/);
  });

  // plan-subagent_panel/REQ-1, plan-session_activity/REQ-43: a text or tool call of the main conversation sends no frame; a subagent change still does within 2 s
  it('sends no frame for a text or a tool call of the main conversation', async () => {
    const session = workingHosted();
    await append(session.transcript, userSays('Go', now(-MIN)), claudeSays([agentUse('w', 'Work')]));
    const worker = session.subagent('agent-w');
    await append(worker.file, userSays('Work', now(), true));
    await worker.meta({ agentType: 'Explore', toolUseId: 'w' });
    const client = await connect(session.id);
    await treeWhen(client, (t) => t.subagents.length === 1, 'the subagent');
    const framesBefore = client.frames.length;
    await append(session.transcript, claudeSays('Both developers are at work'), claudeSays([toolUse('ls', 'Bash', { command: 'ls' })]), toolResult('ls'), claudeSays('Listed'));
    const written = Date.now();
    await append(worker.file, claudeSays('Found the module', now(), true));
    await treeWhen(client, (t) => subagentOf(t, 'agent-w')?.latestText === 'Found the module', 'the subagent text', REQ_43_MS);
    expect(Date.now() - written, 'REQ-43: the subagent change within 2 s').toBeLessThanOrEqual(REQ_43_MS);
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    const after = framesOf(client).slice(framesBefore);
    expect(after.every((frame) => frame.type === 'update' && Object.keys(frame).sort().join() === 'subagents,type'), JSON.stringify(after)).toBe(true);
  });

  // plan-subagent_panel/REQ-5, REQ-6: scenario "A turn with no subagents": the last turn shows as ended, with no group
  it('marks the last turn ended, with no group, when Claude answered with no subagent', async () => {
    const session = workingHosted();
    await append(session.transcript, userSays('What does this module do?', now(-MIN)), claudeSays('It parses the transcripts'));
    tracker.applyHookEvent(session.id, { hook_event_name: 'Stop' });
    const client = await connect(session.id);
    const tree = await treeWhen(client, (t) => t.number === 1 && t.status === 'ended', 'the ended turn');
    expect(tree).toEqual({ number: 1, status: 'ended', groups: [], earlier: [], subagents: [] });
  });

  // plan-session_activity/REQ-33, REQ-34: a finished subagent and an interrupted one, each with its full run time
  it('shows a finished subagent as finished and an interrupted one as stopped, both with the time of their last line', async () => {
    const session = external('working');
    await append(session.transcript, userSays('Go'), claudeSays([agentUse('a', 'Done task'), agentUse('b', 'Cut task')]));
    const done = session.subagent('agent-a');
    const cut = session.subagent('agent-b');
    const start = now(-10 * MIN);
    const doneEnd = now(-4 * MIN);
    const cutEnd = now(-3 * MIN);
    await append(done.file, userSays('Task', start, true), claudeSays('All done', doneEnd, true));
    await append(cut.file, userSays('Task', start, true), claudeSays('Halfway', now(-5 * MIN), true), userSays('[Request interrupted by user]', cutEnd, true));
    await done.meta({ agentType: 'Explore', toolUseId: 'a', finished: true });
    await cut.meta({ agentType: 'Explore', toolUseId: 'b' });
    const client = await connect(session.id);
    const tree = await treeWhen(client, (t) => t.subagents.length === 2, 'two subagents');
    expect(subagentOf(tree, 'agent-a')).toMatchObject({ state: 'finished', startedAt: start, endedAt: doneEnd });
    expect(subagentOf(tree, 'agent-b')).toMatchObject({ state: 'stopped', startedAt: start, endedAt: cutEnd });
  });

  // plan-session_activity/REQ-38: scenario "A nested subagent appears under its parent"
  it('puts a subagent started by a subagent inside the groups of its parent', async () => {
    const session = workingHosted();
    await append(session.transcript, userSays('Go'), claudeSays([agentUse('parent-call', 'Parent task')]));
    const parent = session.subagent('agent-p');
    await append(parent.file, userSays('Parent task', now(), true), claudeSays('Delegating', now(), true));
    await parent.meta({ agentType: 'sdd-developer', toolUseId: 'parent-call' });
    const client = await connect(session.id);
    await treeWhen(client, (t) => t.subagents.length === 1, 'the parent');
    const child = session.subagent('agent-c');
    await append(parent.file, claudeSays([agentUse('child-call', 'Child task', 'Explore')], now(), true));
    await append(child.file, userSays('Child task', now(), true));
    await child.meta({ agentType: 'Explore', description: 'Child task', toolUseId: 'child-call' });
    const tree = await treeWhen(client, (t) => subagentOf(t, 'agent-c') !== undefined, 'the nested subagent');
    expect(tree.groups).toEqual([{ subagents: ['agent-p'] }]);
    expect(subagentOf(tree, 'agent-p')?.groups).toEqual([{ subagents: ['agent-c'] }]);
    expect(subagentOf(tree, 'agent-c')).toMatchObject({ type: 'Explore', description: 'Child task', state: 'running' });
  });

  // plan-session_activity/REQ-39, REQ-40: scenario "A background subagent outlives its turn"
  it('keeps a running background subagent in earlier after a new turn, and marks the turn ended when the session is idle', async () => {
    const session = workingHosted();
    await append(session.transcript, userSays('Start the tests in the background'), claudeSays([agentUse('bg', 'Background tests', 'sdd-tester')]), toolResult('bg'), claudeSays('Started'));
    const background = session.subagent('agent-bg');
    await append(background.file, userSays('Run the tests', now(), true), claudeSays('Running the suite', now(), true));
    await background.meta({ agentType: 'sdd-tester', toolUseId: 'bg' });
    const client = await connect(session.id);
    await treeWhen(client, (t) => t.groups.length === 1, 'the background subagent in the turn');

    tracker.applyHookEvent(session.id, { hook_event_name: 'Stop' });
    await treeWhen(client, (t) => t.status === 'ended', 'turn ended', REQ_43_MS);

    tracker.applyHookEvent(session.id, { hook_event_name: 'UserPromptSubmit', prompt: 'And now?', session_id: session.claudeSessionId });
    await append(session.transcript, userSays('And now?'), claudeSays('The tests still run'));
    const next = await treeWhen(client, (t) => t.number === 2, 'the new turn');
    expect(next).toMatchObject({ status: 'running', groups: [], earlier: ['agent-bg'] });
    expect(subagentOf(next, 'agent-bg')).toMatchObject({ type: 'sdd-tester', state: 'running', latestText: 'Running the suite' });

    tracker.applyHookEvent(session.id, { hook_event_name: 'Stop' });
    const ended = await treeWhen(client, (t) => t.status === 'ended', 'the last turn ended', REQ_43_MS);
    expect(ended).toMatchObject({ number: 2, groups: [], earlier: ['agent-bg'] });
  });

  // plan-session_activity/REQ-44: scenario "Missing data hides only its field"
  it('leaves out only the missing description and model of a subagent', async () => {
    const session = external('working');
    await append(session.transcript, userSays('Go'), claudeSays([agentUse('x', 'Some task')]));
    const sub = session.subagent('agent-x');
    const start = now(-MIN);
    await append(sub.file, userSays('Task', start, true), claudeSays('Working without metadata', now(), true));
    await sub.meta({ agentType: 'Explore', toolUseId: 'x' });
    const client = await connect(session.id);
    const tree = await treeWhen(client, (t) => t.subagents.length === 1, 'the subagent');
    expect(subagentOf(tree, 'agent-x')).toEqual({ id: 'agent-x', type: 'Explore', state: 'running', startedAt: start, latestText: 'Working without metadata', groups: [] });
  });
});

describe('Turn route, size and isolation', { timeout: 60_000 }, () => {
  // plan-session_activity/REQ-45: a subagent with thousands of steps and a 16-hour run gives frames of a fixed small size
  it('sends small frames for a subagent with thousands of steps that started 16 hours ago', async () => {
    const session = external('working');
    await append(session.transcript, userSays('Go'), claudeSays([agentUse('big', 'Long run')]));
    const big = session.subagent('agent-big');
    const lines: Line[] = [userSays('Long task', now(-16 * 60 * MIN), true)];
    for (let i = 0; i < 3_000; i += 1) {
      lines.push(claudeSays([toolUse(`c${i}`, 'Bash', { command: `step ${i} ${'x'.repeat(200)}` })], now(-60 * MIN), true), toolResult(`c${i}`, now(-60 * MIN), true));
    }
    lines.push(claudeSays('Still going', now(), true));
    await append(big.file, ...lines);
    await big.meta({ agentType: 'sdd-developer', description: 'Long run', toolUseId: 'big' });
    const client = await connect(session.id);
    const tree = await treeWhen(client, (t) => subagentOf(t, 'agent-big')?.latestText === 'Still going', 'the subagent read to the end', 20_000);
    expect(subagentOf(tree, 'agent-big')).toMatchObject({ startedAt: lines[0]!.timestamp, state: 'running' });
    const largest = Math.max(...client.frames.map((frame) => frame.length));
    expect(largest, 'no frame carries the steps of the subagent').toBeLessThan(2_000);
  });

  // turn-route spec: a socket gets no frame of another session
  it('sends no frame of another session', async () => {
    const watched = external('working');
    const other = external('working');
    for (const session of [watched, other]) {
      await append(session.transcript, userSays('Go'), claudeSays([agentUse('w', 'Work', 'Explore')]));
      await append(session.subagent('agent-w').file, userSays('Work', now(), true));
      await session.subagent('agent-w').meta({ agentType: 'Explore', toolUseId: 'w' });
    }
    const watchedClient = await connect(watched.id);
    const otherClient = await connect(other.id);
    await treeWhen(watchedClient, (t) => t.subagents.length === 1, 'watched tree');
    await treeWhen(otherClient, (t) => t.subagents.length === 1, 'other tree');
    const before = watchedClient.frames.length;
    await append(other.subagent('agent-w').file, claudeSays('Only for the other session', now(), true));
    await treeWhen(otherClient, (t) => subagentOf(t, 'agent-w')?.latestText === 'Only for the other session', 'the other session changed');
    expect(watchedClient.frames.length).toBe(before);
  });
});

describe('Turn route, subscription', () => {
  // turn-route spec: noTurn() when the monitor has no tree; changes are sent as given; closing ends the subscription
  it('sends noTurn() first when the monitor has no tree, forwards the changes of its session as given, and unsubscribes on close', async () => {
    const listeners = new Set<(id: string, change: TurnChange) => void>();
    const fake = {
      turnOf: () => undefined,
      onTurnChange: (listener: (id: string, change: TurnChange) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const known = { get: (id: string) => (id === 's1' ? ({} as never) : undefined) };
    const bare = Fastify();
    await bare.register(fastifyWebsocket);
    registerTurnRoute(bare, { monitor: fake, tracker: known, scanner: { get: () => undefined } });
    await bare.listen({ host: '127.0.0.1', port: 0 });
    try {
      const address = bare.server.address();
      if (address === null || typeof address === 'string') throw new Error('no port');
      const client = connectWs(`ws://127.0.0.1:${address.port}/api/sessions/s1/turn`);
      clients.push(client);
      await waitFor(() => client.frames.length === 1 && listeners.size === 1, 'first frame and subscription');
      expect(framesOf(client)).toEqual([{ type: 'turn', turn: NO_TURN }]);
      const update: TurnChange = { type: 'update', status: 'ended' };
      for (const listener of listeners) {
        listener('s2', { type: 'update', status: 'running' });
        listener('s1', update);
      }
      await waitFor(() => client.frames.length === 2, 'forwarded change');
      expect(framesOf(client)[1]).toEqual(update);
      client.socket.close();
      await waitFor(() => listeners.size === 0, 'unsubscribed after close');
    } finally {
      await bare.close();
    }
  });
});
