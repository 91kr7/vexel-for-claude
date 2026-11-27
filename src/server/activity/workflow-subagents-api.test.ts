// REQ tests of plan-session_activity (batch workflow-subagents) and plan-subagent_panel, at the level of the API: GET /api/sessions, the session events,
// the WebSocket GET /api/sessions/:id/turn and the WebSocket GET /api/sessions/:id/subagents/:agentId/conversation.
import { appendFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import fastifyWebsocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ExternalSessionChange, ExternalSessionSummary } from '../external/external-session-scanner.js';
import { type ConversationItem, TranscriptReader } from '../external/transcript-reader.js';
import { registerSessionEventsRoute } from '../sessions/session-events-route.js';
import { registerSessionListRoute } from '../sessions/session-list-route.js';
import { SessionStateTracker } from '../sessions/session-state-tracker.js';
import { type WsClient, connectWs, tempDir, waitFor } from '../test-support.js';
import { ActivityMonitor } from './activity-monitor.js';
import type { LiveActivity } from './live-activity.js';
import { registerSubagentConversationRoute } from './subagent-conversation-route.js';
import { registerTurnRoute } from './turn-route.js';
import type { TurnChange, TurnTree } from './turn-tree.js';

type Line = Record<string, unknown>;
type Entry = { id: string; state: string; liveActivity?: LiveActivity } & Record<string, unknown>;
type SessionFrame = { type: string; session?: Entry };
type ItemsFrame = { type: 'items'; items: ConversationItem[] };

// REQ-12, REQ-22, REQ-43 and REQ-51 ask for 2 s from the line to the change.
const TWO_SECONDS = 2000;
const MIN = 60_000;

let claudeDir: string;
let app: FastifyInstance;
let tracker: SessionStateTracker;
let monitor: ActivityMonitor;
let wsBase: string;
let nextId = 0;
const clients: WsClient[] = [];
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
  claudeDir = await tempDir('ai-client-workflow-subagents-api-');
  tracker = new SessionStateTracker();
  const reader = new TranscriptReader({ claudeDir });
  monitor = new ActivityMonitor({ tracker, scanner, reader });
  app = Fastify();
  await app.register(fastifyWebsocket);
  registerSessionListRoute(app, tracker, scanner, undefined, undefined, monitor);
  registerSessionEventsRoute(app, tracker, scanner, undefined, undefined, monitor);
  registerTurnRoute(app, { monitor, tracker, scanner });
  registerSubagentConversationRoute(app, { tracker, scanner, reader });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  wsBase = `ws://127.0.0.1:${address.port}`;
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
const now = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();

async function append(file: string, ...lines: Line[]): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, lines.map((line) => `${JSON.stringify(line)}\n`).join(''));
}

const userSays = (text: string, timestamp: string, sidechain = false): Line => ({ type: 'user', isSidechain: sidechain, timestamp, origin: { kind: 'human' }, message: { role: 'user', content: text } });
const claudeSays = (text: string, timestamp: string, sidechain = false, model?: string): Line => ({
  type: 'assistant',
  isSidechain: sidechain,
  timestamp,
  message: { role: 'assistant', content: [{ type: 'text', text }], ...(model && { model }) },
});
const toolCall = (id: string, name: string, input: object, timestamp: string, sidechain = false): Line => ({
  type: 'assistant',
  isSidechain: sidechain,
  timestamp,
  message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] },
});
const toolResult = (id: string, content: string, timestamp: string, sidechain = false): Line => ({
  type: 'user',
  isSidechain: sidechain,
  timestamp,
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content }] },
});
const launched = (callId: string, runId: string, taskId: string, timestamp: string): Line => ({
  ...toolResult(callId, `Task ID: ${taskId}\nThe workflow runs in the background.\nRun ID: ${runId}`, timestamp),
  toolUseResult: { status: 'async_launched', taskId, runId },
});
const inMessage = (id: string, line: Line): Line => ({ ...line, message: { ...(line.message as object), id } });
const notification = (taskId: string, status: string, timestamp: string): Line => ({
  type: 'user',
  isSidechain: false,
  timestamp,
  origin: { kind: 'task-notification' },
  promptSource: 'system',
  message: { role: 'user', content: `<task-notification>\n<task-id>${taskId}</task-id>\n<tool-use-id>wf</tool-use-id>\n<status>${status}</status>\n</task-notification>` },
});

interface Session {
  id: string;
  transcript: string;
  /** The files of workflow agent `agent-<agentId>` of run `runId`. */
  agent(runId: string, agentId: string): { file: string; meta: (meta: object) => Promise<void> };
  journal(runId: string, ...lines: Line[]): Promise<void>;
}

function sessionFiles(id: string, cwd: string, claudeSessionId: string): Session {
  const runDir = (runId: string) => path.join(projectDir(cwd), claudeSessionId, 'subagents', 'workflows', runId);
  return {
    id,
    transcript: path.join(projectDir(cwd), `${claudeSessionId}.jsonl`),
    agent: (runId, agentId) => {
      const file = path.join(runDir(runId), `agent-${agentId}.jsonl`);
      return {
        file,
        meta: async (meta) => {
          await mkdir(path.dirname(file), { recursive: true });
          await writeFile(file.replace(/\.jsonl$/, '.meta.json'), JSON.stringify(meta));
        },
      };
    },
    journal: (runId, ...lines) => append(path.join(runDir(runId), 'journal.jsonl'), ...lines),
  };
}

function workingHosted(): Session & { claudeSessionId: string } {
  const id = unique('hosted');
  const cwd = `/work/${id}`;
  const claudeSessionId = unique('sid');
  tracker.track({ id, cwd, onExit: () => {} });
  tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Review the batch', session_id: claudeSessionId });
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

const AGENTS = ['a1', 'a2', 'a3', 'a4'] as const;
const LABELS = { a1: 'review:git', a2: 'review:docs', a3: 'review:build', a4: 'review:tests' } as const;
const MODELS = { a1: 'claude-sonnet-5', a2: 'claude-haiku-5', a3: 'claude-sonnet-5', a4: 'claude-opus-5-5' } as const;

/** The current turn launched run `runId` as task `task-<runId>` at its step 1, then 4 agents started, each with a text and a running Bash call. */
async function workflowOfFour(session: Session, runId: string, startedMs: number): Promise<void> {
  await append(
    session.transcript,
    userSays('Review the batch', now(startedMs - 4000)),
    claudeSays('I launch the review workflow', now(startedMs - 3000)),
    toolCall('wf', 'Workflow', { workflow: 'review' }, now(startedMs - 2000)),
    launched('wf', runId, `task-${runId}`, now(startedMs - 1000)),
  );
  await session.journal(runId, { type: 'launched' }, ...AGENTS.map((agentId) => ({ type: 'started', agentId, label: LABELS[agentId], phase: 'review' })));
  for (const agentId of AGENTS) {
    const agent = session.agent(runId, agentId);
    await agent.meta({ agentType: 'workflow-subagent', description: LABELS[agentId], workflowPhase: 'review', pickedEffortModel: MODELS[agentId] });
    await append(
      agent.file,
      userSays(`Review ${LABELS[agentId]}`, now(startedMs), true),
      claudeSays(`Reading ${LABELS[agentId]}`, now(startedMs + 100), true, MODELS[agentId]),
      toolCall(`bash-${agentId}`, 'Bash', { command: `check ${agentId}` }, now(startedMs + 200), true),
    );
  }
}

async function listEntry(id: string): Promise<Entry | undefined> {
  const response = await app.inject({ method: 'GET', url: '/api/sessions' });
  expect(response.statusCode).toBe(200);
  return (response.json() as Entry[]).find((entry) => entry.id === id);
}

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

async function open(url: string): Promise<WsClient> {
  const client = connectWs(`${wsBase}${url}`);
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    client.socket.once('open', () => resolve());
    client.socket.once('error', reject);
  });
  return client;
}

const sessionFramesOf = (client: WsClient, id: string) => client.frames.map((frame) => JSON.parse(frame) as SessionFrame).filter((frame) => frame.session?.id === id);

/** The ids that the groups reach, from level 0 down through the groups of the subagents. */
function reachedIds(tree: TurnTree): Set<string> {
  const reached = new Set<string>();
  const visit = (groups: TurnTree['groups']) => {
    for (const id of groups.flatMap((each) => each.subagents)) {
      if (reached.has(id)) continue;
      reached.add(id);
      visit(tree.subagents.find((subagent) => subagent.id === id)?.groups ?? []);
    }
  };
  visit(tree.groups);
  return reached;
}

/** The tree the page would hold after the frames of the turn socket (useTurn spec: an update drops the subagents no group reaches). */
function treeOf(client: WsClient): TurnTree | undefined {
  let tree: TurnTree | undefined;
  for (const frame of client.frames.map((text) => JSON.parse(text) as TurnChange)) {
    if (frame.type === 'turn') tree = structuredClone(frame.turn);
    else if (tree) {
      if (frame.groups) tree.groups = frame.groups;
      for (const subagent of frame.subagents ?? []) {
        const at = tree.subagents.findIndex((known) => known.id === subagent.id);
        if (at >= 0) tree.subagents[at] = subagent;
        else tree.subagents.push(subagent);
      }
      const reached = reachedIds(tree);
      tree.subagents = tree.subagents.filter((subagent) => reached.has(subagent.id));
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

const statesOf = (tree: TurnTree) => Object.fromEntries(tree.subagents.map(({ id, state }) => [id, state]));
const itemsOf = (client: WsClient) => client.frames.flatMap((frame) => (JSON.parse(frame) as ItemsFrame).items);

describe('Workflow subagents, GET /api/sessions and session events', { timeout: 30_000 }, () => {
  // plan-session_activity/REQ-56 — scenario "A running workflow keeps the session at work"
  it('keeps an idle session at work while a workflow agent runs, with its text and type, within 2 s of its line', async () => {
    const session = workingHosted();
    await workflowOfFour(session, 'wf_keep', -60_000);
    tracker.applyHookEvent(session.id, { hook_event_name: 'Stop', session_id: session.claudeSessionId });
    await entryWhen(session.id, (e) => e?.liveActivity?.latestText?.text.startsWith('Reading') === true, 'the text of an agent');

    const client = await open('/api/sessions/events');
    const at = now();
    await append(session.agent('wf_keep', 'a3').file, claudeSays('Checking the Maven resolution', at, true));
    await waitFor(() => sessionFramesOf(client, session.id).some((f) => f.session?.liveActivity?.latestText?.text === 'Checking the Maven resolution'), 'frame of the new text', TWO_SECONDS);

    const entry = await listEntry(session.id);
    expect(entry?.state).toBe('idle');
    expect(entry?.liveActivity).toMatchObject({ atWork: true, latestText: { text: 'Checking the Maven resolution', subagentType: 'workflow-subagent', at } });
  });

  // plan-session_activity/REQ-57 — scenario "A silent workflow agent shows in the stall signal"
  it('gives the time of the last workflow agent line and its running tool with the type, and a new line within 2 s', async () => {
    const session = external('working');
    const last = now(-6 * MIN);
    await append(
      session.transcript,
      userSays('Review the batch', now(-8 * MIN)),
      toolCall('wf', 'Workflow', { workflow: 'review' }, now(-7.5 * MIN)),
      launched('wf', 'wf_silent', 'task-silent', now(-7.4 * MIN)),
    );
    await session.journal('wf_silent', { type: 'launched' }, { type: 'started', agentId: 'mvn' });
    const agent = session.agent('wf_silent', 'mvn');
    await agent.meta({ agentType: 'workflow-subagent', description: 'test:maven' });
    await append(agent.file, userSays('Run the tests', now(-7 * MIN), true), toolCall('mvn-1', 'Bash', { command: 'mvn test' }, last, true));
    const entry = await entryWhen(session.id, (e) => e?.liveActivity?.lastEventAt === last, 'the last activity of the agent');
    expect(entry?.liveActivity).toEqual({ atWork: true, lastEventAt: last, waitingFor: { subagentType: 'workflow-subagent', name: 'Bash', argument: 'mvn test', others: 0 } });

    const client = await open('/api/sessions/events');
    const at = now();
    await append(agent.file, toolResult('mvn-1', 'BUILD SUCCESS', at, true));
    await waitFor(() => sessionFramesOf(client, session.id).some((f) => f.session?.liveActivity?.lastEventAt === at), 'frame of the new activity', TWO_SECONDS);
    expect((await listEntry(session.id))?.liveActivity).toEqual({ atWork: true, lastEventAt: at, waitingFor: 'response' });
  });

  // plan-session_activity/REQ-60 — scenario "An ended workflow stops keeping the session at work": end by a task notification
  it('ends the work of an idle session once its workflow ends with 2 agents finished and 2 cut by a notification', async () => {
    const session = workingHosted();
    await workflowOfFour(session, 'wf_end', -30_000);
    tracker.applyHookEvent(session.id, { hook_event_name: 'Stop', session_id: session.claudeSessionId });
    await entryWhen(session.id, (e) => e?.liveActivity?.atWork === true, 'at work');

    await session.journal('wf_end', { type: 'result', agentId: 'a1' }, { type: 'result', agentId: 'a2' });
    await append(session.transcript, notification('task-wf_end', 'killed', now()));
    const entry = await entryWhen(session.id, (e) => e?.liveActivity?.atWork === false, 'not at work', TWO_SECONDS * 2);
    expect(entry?.state).toBe('idle');
    expect(entry?.liveActivity).toEqual({ atWork: false });
  });

  // plan-session_activity/REQ-60: end by a successful TaskStop, with no notification
  it('ends the work of an idle session once Claude stops its workflow with TaskStop', async () => {
    const session = workingHosted();
    await workflowOfFour(session, 'wf_stop', -30_000);
    tracker.applyHookEvent(session.id, { hook_event_name: 'Stop', session_id: session.claudeSessionId });
    await entryWhen(session.id, (e) => e?.liveActivity?.atWork === true, 'at work');

    await append(
      session.transcript,
      toolCall('stop', 'TaskStop', { task_id: 'task-wf_stop' }, now(-1000)),
      toolResult('stop', 'Successfully stopped task: task-wf_stop (Workflow)', now(-900)),
    );
    const entry = await entryWhen(session.id, (e) => e?.liveActivity?.atWork === false, 'not at work', TWO_SECONDS * 2);
    expect(entry?.liveActivity).toEqual({ atWork: false });
  });
});

describe('Workflow subagents, turn route', { timeout: 30_000 }, () => {
  // plan-session_activity/REQ-58 — scenario "The turn panel shows the agents of a workflow"
  it('sends the 4 agents of a workflow as one group, each with its fields', async () => {
    const session = external('working');
    await workflowOfFour(session, 'wf_tree', -30_000);
    const client = await open(`/api/sessions/${encodeURIComponent(session.id)}/turn`);
    const tree = await treeWhen(client, (t) => t.subagents.length === 4 && t.subagents.every((s) => s.currentTool !== undefined), 'the 4 agents');

    expect(tree.groups).toEqual([{ subagents: AGENTS.map((agentId) => `agent-${agentId}`) }]);
    for (const agentId of AGENTS) {
      expect(tree.subagents.find((s) => s.id === `agent-${agentId}`), agentId).toEqual({
        id: `agent-${agentId}`,
        type: 'workflow-subagent',
        description: LABELS[agentId],
        model: MODELS[agentId],
        state: 'running',
        startedAt: expect.any(String),
        latestText: `Reading ${LABELS[agentId]}`,
        currentTool: { name: 'Bash', argument: `check ${agentId}`, others: 0 },
        groups: [],
      });
    }
  });

  // plan-session_activity/REQ-58, plan-subagent_panel/REQ-16: after a resume, the stopped agent of the earlier launch leaves, the agent of the new launch stays
  it('keeps only the agent of the new launch of a resumed run, as the agent of the earlier launch is stopped', async () => {
    const session = external('working');
    await append(
      session.transcript,
      userSays('Review the batch', now(-60_000)),
      toolCall('wf-1', 'Workflow', { workflow: 'review' }, now(-50_000)),
      launched('wf-1', 'wf_resumed', 'task-1', now(-49_000)),
    );
    const first = session.agent('wf_resumed', 'first');
    await first.meta({ agentType: 'workflow-subagent', description: 'review:first' });
    await append(first.file, userSays('Review first', now(-45_000), true));
    await append(
      session.transcript,
      claudeSays('I resume the workflow', now(-30_000)),
      toolCall('wf-2', 'Workflow', { workflow: 'review', resume: 'wf_resumed' }, now(-20_000)),
      launched('wf-2', 'wf_resumed', 'task-2', now(-19_000)),
    );
    const second = session.agent('wf_resumed', 'second');
    await second.meta({ agentType: 'workflow-subagent', description: 'review:second' });
    await append(second.file, userSays('Review second', now(-15_000), true));
    const client = await open(`/api/sessions/${encodeURIComponent(session.id)}/turn`);
    const tree = await treeWhen(client, (t) => t.subagents.length === 1 && t.subagents[0]!.id === 'agent-second', 'only the agent of the new launch');

    expect(tree.groups).toEqual([{ subagents: ['agent-second'] }]);
    expect(statesOf(tree)).toEqual({ 'agent-second': 'running' });
  });

  // plan-subagent_panel/REQ-16, plan-session_activity/REQ-43 — scenario "An ended workflow stops keeping the session at work"
  it('drops the 2 finished and the 2 stopped agents from the tree within 2 s once the workflow ends', async () => {
    const session = workingHosted();
    await workflowOfFour(session, 'wf_ends', -30_000);
    tracker.applyHookEvent(session.id, { hook_event_name: 'Stop', session_id: session.claudeSessionId });
    const client = await open(`/api/sessions/${encodeURIComponent(session.id)}/turn`);
    await treeWhen(client, (t) => t.subagents.length === 4 && t.subagents.every((s) => s.state === 'running'), 'the 4 running agents');

    await session.journal('wf_ends', { type: 'result', agentId: 'a1' }, { type: 'result', agentId: 'a2' });
    await append(session.transcript, notification('task-wf_ends', 'stopped', now()));
    const tree = await treeWhen(client, (t) => t.subagents.length === 0, 'the ended agents left', TWO_SECONDS);

    expect(tree).toEqual({ number: 1, groups: [], subagents: [] });
  });

  // plan-subagent_panel/REQ-3, REQ-14, plan-session_activity/REQ-58 — scenario "A workflow sits at the start of its first agent"
  it('places the group of a workflow at the start of its first agent, after a subagent that started before it', async () => {
    const session = external('working');
    await append(
      session.transcript,
      userSays('Review and test the batch', now(-90_000)),
      inMessage('msg_workflow', toolCall('wf', 'Workflow', { workflow: 'review' }, now(-80_000))),
      launched('wf', 'wf_late', 'task-late', now(-79_000)),
      inMessage('msg_text', claudeSays('The review runs, now the tests', now(-70_000))),
      inMessage('msg_tester', toolCall('tester', 'Agent', { description: 'Run the tests', prompt: 'Test', subagent_type: 'sdd-tester' }, now(-60_000))),
    );
    const testerFile = path.join(session.transcript.replace(/\.jsonl$/, ''), 'subagents', 'agent-tester.jsonl');
    await append(testerFile, userSays('Run the tests', now(-50_000), true));
    await writeFile(testerFile.replace(/\.jsonl$/, '.meta.json'), JSON.stringify({ agentType: 'sdd-tester', description: 'Run the tests', toolUseId: 'tester' }));
    await session.journal('wf_late', { type: 'launched' }, { type: 'started', agentId: 'r1' }, { type: 'started', agentId: 'r2' });
    for (const [agentId, startMs] of [
      ['r1', -30_000],
      ['r2', -40_000],
    ] as const) {
      const agent = session.agent('wf_late', agentId);
      await agent.meta({ agentType: 'workflow-subagent', description: `review:${agentId}` });
      await append(agent.file, userSays(`Review ${agentId}`, now(startMs), true));
    }
    const client = await open(`/api/sessions/${encodeURIComponent(session.id)}/turn`);
    const tree = await treeWhen(client, (t) => t.subagents.length === 3, 'the tester and the 2 agents');

    expect(tree.groups).toEqual([{ subagents: ['agent-tester'] }, { subagents: ['agent-r2', 'agent-r1'] }]);
  });
});

describe('Workflow subagents, conversation route', { timeout: 30_000 }, () => {
  // plan-session_activity/REQ-59 — scenario "The conversation of a workflow agent"
  it('sends the conversation of a workflow agent from its task, then a new line within 2 s', async () => {
    const session = workingHosted();
    await workflowOfFour(session, 'wf_talk', -30_000);
    const client = await open(`/api/sessions/${encodeURIComponent(session.id)}/subagents/agent-a2/conversation`);
    await waitFor(() => client.frames.length > 0, 'first frame');
    const items = itemsOf(client);
    expect(items[0]).toMatchObject({ kind: 'user', text: 'Review review:docs' });
    expect(items.at(-1)).toMatchObject({ kind: 'tool_call', name: 'Bash', summary: 'check a2' });

    await append(session.agent('wf_talk', 'a2').file, claudeSays('The docs are consistent', now(), true));
    await waitFor(() => itemsOf(client).some((item) => item.kind === 'assistant' && item.text === 'The docs are consistent'), 'the new line', TWO_SECONDS);
  });

  // plan-session_activity/REQ-59: only agent files open, never the run journal
  it('closes with 4404 for the journal of a run and for an unknown agent', async () => {
    const session = external('working');
    await workflowOfFour(session, 'wf_closed', -30_000);
    for (const agentId of ['journal', 'agent-none']) {
      const client = await open(`/api/sessions/${encodeURIComponent(session.id)}/subagents/${agentId}/conversation`);
      expect(await client.closed, agentId).toBe(4404);
      expect(client.frames, agentId).toEqual([]);
    }
  });
});
