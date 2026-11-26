// REQ tests of plan-session_activity, batch subagent-conversation, at the level of the API:
// the WebSocket GET /api/sessions/:id/subagents/:agentId/conversation and GET /api/sessions/:id/subagents/:agentId/items.
import { appendFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import fastifyWebsocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerConversationStreamRoute } from '../external/conversation-stream-route.js';
import type { ExternalSessionSummary } from '../external/external-session-scanner.js';
import { type ConversationItem, TranscriptReader } from '../external/transcript-reader.js';
import { SessionStateTracker } from '../sessions/session-state-tracker.js';
import { type WsClient, connectWs, delay, snapshotTree, tempDir, waitFor } from '../test-support.js';
import { registerSubagentConversationRoute } from './subagent-conversation-route.js';
import { registerSubagentItemContentRoute } from './subagent-item-content-route.js';

type Line = Record<string, unknown>;
type ItemsFrame = { type: 'items'; items: ConversationItem[] };

// REQ-51 asks for 2 s from the line to the page. The route checks the file every 1000 ms (its default).
const REQ_51_MS = 2000;

let claudeDir: string;
let app: FastifyInstance;
let tracker: SessionStateTracker;
let wsBase: string;
let httpBase: string;
let nextId = 0;
const clients: WsClient[] = [];
const externalSessions = new Map<string, ExternalSessionSummary>();
const scanner = { get: (id: string) => externalSessions.get(id) };

beforeAll(async () => {
  claudeDir = await tempDir('ai-client-subagent-conversation-api-');
  tracker = new SessionStateTracker();
  const reader = new TranscriptReader({ claudeDir });
  app = Fastify();
  await app.register(fastifyWebsocket);
  registerSubagentConversationRoute(app, { tracker, scanner, reader });
  registerSubagentItemContentRoute(app, { tracker, scanner, reader });
  registerConversationStreamRoute(app, { scanner, reader });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  wsBase = `ws://127.0.0.1:${address.port}`;
  httpBase = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
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

/** A file of Claude Code lines that remembers the byte offset where each appended line starts. */
function lineFile(file: string) {
  let size = 0;
  return {
    file,
    /** Appends the lines and gives their start offsets. */
    append: async (...lines: Line[]): Promise<number[]> => {
      await mkdir(path.dirname(file), { recursive: true });
      const offsets: number[] = [];
      const texts = lines.map((line) => `${JSON.stringify(line)}\n`);
      for (const text of texts) {
        offsets.push(size);
        size += Buffer.byteLength(text);
      }
      await appendFile(file, texts.join(''));
      return offsets;
    },
    appendRaw: async (text: string) => {
      await mkdir(path.dirname(file), { recursive: true });
      size += Buffer.byteLength(text);
      await appendFile(file, text);
    },
  };
}

const task = (text: string, sidechain = true, timestamp = now(-60_000)): Line => ({ type: 'user', isSidechain: sidechain, timestamp, message: { role: 'user', content: text } });
const says = (text: string, sidechain = true): Line => ({ type: 'assistant', isSidechain: sidechain, timestamp: now(), message: { role: 'assistant', content: [{ type: 'text', text }] } });
const uses = (id: string, name: string, input: object, sidechain = true): Line => ({
  type: 'assistant',
  isSidechain: sidechain,
  timestamp: now(),
  message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] },
});
const result = (id: string, content: string, sidechain = true, isError = false): Line => ({
  type: 'user',
  isSidechain: sidechain,
  timestamp: now(),
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content, ...(isError && { is_error: true }) }] },
});
const thinking = (sidechain = true): Line => ({ type: 'assistant', isSidechain: sidechain, timestamp: now(), message: { role: 'assistant', content: [{ type: 'thinking', thinking: 'Hmm' }] } });

interface Session {
  id: string;
  main: ReturnType<typeof lineFile>;
  sessionFolder: string;
  subagent(agentId: string): ReturnType<typeof lineFile> & { meta(meta: object): Promise<void> };
}

function sessionFiles(id: string, cwd: string, claudeSessionId: string): Session {
  const main = lineFile(path.join(projectDir(cwd), `${claudeSessionId}.jsonl`));
  const sessionFolder = path.join(projectDir(cwd), claudeSessionId);
  return {
    id,
    main,
    sessionFolder,
    subagent: (agentId) => {
      const sub = lineFile(path.join(sessionFolder, 'subagents', `${agentId}.jsonl`));
      return {
        ...sub,
        meta: async (meta) => {
          await mkdir(path.dirname(sub.file), { recursive: true });
          await writeFile(sub.file.replace(/\.jsonl$/, '.meta.json'), JSON.stringify(meta));
        },
      };
    },
  };
}

function hosted(): Session {
  const id = unique('hosted');
  const cwd = `/work/${id}`;
  const claudeSessionId = unique('sid');
  tracker.track({ id, cwd, onExit: () => {} });
  tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Start', session_id: claudeSessionId });
  return sessionFiles(id, cwd, claudeSessionId);
}

function external(state: ExternalSessionSummary['state'] = 'working'): Session {
  const id = unique('ext');
  const cwd = `/work/${id}`;
  externalSessions.set(id, { id, folder: cwd, label: id, state, lastActivity: now(), external: true });
  return sessionFiles(id, cwd, id);
}

/** A session whose main transcript holds the Agent call, with one subagent file. */
async function withSubagent(session: Session, agentId: string, ...lines: Line[]) {
  await session.main.append(task('Start', false), uses('call', 'Agent', { description: 'Run the tests', prompt: 'Run the tests', subagent_type: 'sdd-tester' }, false));
  const sub = session.subagent(agentId);
  const offsets = await sub.append(...lines);
  return { sub, offsets };
}

function connect(sessionId: string, agentId: string): WsClient {
  const client = connectWs(`${wsBase}/api/sessions/${encodeURIComponent(sessionId)}/subagents/${encodeURIComponent(agentId)}/conversation`);
  clients.push(client);
  return client;
}

const framesOf = (client: WsClient) => client.frames.map((frame) => JSON.parse(frame) as ItemsFrame);
const itemsOf = (client: WsClient) => framesOf(client).flatMap((frame) => frame.items);

async function firstFrame(client: WsClient): Promise<ItemsFrame> {
  await waitFor(() => client.frames.length > 0, 'first frame');
  return framesOf(client)[0]!;
}

const itemUrl = (sessionId: string, agentId: string, query: string) =>
  `${httpBase}/api/sessions/${encodeURIComponent(sessionId)}/subagents/${encodeURIComponent(agentId)}/items${query}`;

async function getItem(sessionId: string, agentId: string, query: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(itemUrl(sessionId, agentId, query));
  return { status: response.status, body: await response.json() };
}

const SEVEN = 'r1\nr2\nr3\nr4\nr5\nr6\nr7';

describe('Subagent conversation route, opening', { timeout: 30_000 }, () => {
  // plan-session_activity/REQ-49: a hosted session gets the whole subagent conversation, from its task to its latest step
  it('sends every item of the subagent of a hosted session first, the task as the first user item, the tool items with their refs', async () => {
    const session = hosted();
    const taskAt = now(-30_000);
    const { offsets } = await withSubagent(
      session,
      'agent-t1',
      task('Run the tests of batch X', true, taskAt),
      says('Reading the **spec**'),
      uses('b1', 'Bash', { command: 'npm test' }),
      result('b1', 'ok'),
      says('All tests pass'),
    );
    const frame = await firstFrame(connect(session.id, 'agent-t1'));
    expect(frame).toEqual<ItemsFrame>({
      type: 'items',
      items: [
        { kind: 'user', text: 'Run the tests of batch X', timestamp: taskAt },
        { kind: 'assistant', text: 'Reading the **spec**' },
        { kind: 'tool_call', name: 'Bash', summary: 'npm test', id: 'b1', ref: { offset: offsets[2]!, block: 0 } },
        { kind: 'tool_result', text: 'ok', truncated: false, toolUseId: 'b1', ref: { offset: offsets[3]!, block: 0 } },
        { kind: 'assistant', text: 'All tests pass' },
      ],
    });
  });

  // plan-session_activity/REQ-49: an external session too
  it('sends the subagent conversation of an external session', async () => {
    const session = external();
    await withSubagent(session, 'agent-e1', task('Explore the module'), says('The module has three parts'));
    const frame = await firstFrame(connect(session.id, 'agent-e1'));
    expect(frame.items).toEqual([
      { kind: 'user', text: 'Explore the module', timestamp: expect.any(String) },
      { kind: 'assistant', text: 'The module has three parts' },
    ]);
  });

  // plan-session_activity/REQ-50: the items have the shape that ConversationStreamRoute gives for an external session
  it('gives the same items as the conversation of an external session for the same lines', async () => {
    const lines = (sidechain: boolean) => [
      task('Same task', sidechain, '2026-11-26T09:00:00.000Z'),
      says('Same `text`', sidechain),
      uses('g1', 'Grep', { pattern: 'TODO', path: 'src' }, sidechain),
      result('g1', SEVEN, sidechain, true),
      thinking(sidechain),
    ];
    const session = external();
    await withSubagent(session, 'agent-same', ...lines(true));
    const other = external();
    await other.main.append(...lines(false));
    const subagentFrame = await firstFrame(connect(session.id, 'agent-same'));
    const externalClient = connectWs(`${wsBase}/api/external-sessions/${encodeURIComponent(other.id)}/conversation`);
    clients.push(externalClient);
    const externalFrame = await firstFrame(externalClient);
    const withoutRef = (items: ConversationItem[]) => items.map((item) => ({ ...item, ref: 'ref' in item && item.ref ? { block: item.ref.block } : undefined }));
    expect(withoutRef(subagentFrame.items)).toEqual(withoutRef(externalFrame.items));
    expect(subagentFrame.items).toHaveLength(4);
  });

  // plan-session_activity/REQ-52: the conversation opens for a finished and for a stopped subagent of an ended session, with its last step at the end
  it('opens the conversation of a finished and of a stopped subagent, with their last step last', async () => {
    const session = external('ended');
    const { sub: done } = await withSubagent(session, 'agent-done', task('Done task'), says('Working'), says('All done'));
    await done.meta({ agentType: 'Explore', toolUseId: 'call', finished: true });
    const cut = session.subagent('agent-cut');
    await cut.append(task('Cut task'), says('Halfway'), { ...task('[Request interrupted by user]'), timestamp: now() });
    await cut.meta({ agentType: 'Explore', toolUseId: 'call' });
    const doneItems = (await firstFrame(connect(session.id, 'agent-done'))).items;
    const cutItems = (await firstFrame(connect(session.id, 'agent-cut'))).items;
    expect(doneItems.map((item) => ('text' in item ? item.text : item.kind))).toEqual(['Done task', 'Working', 'All done']);
    expect(cutItems[0]).toMatchObject({ kind: 'user', text: 'Cut task' });
    expect(cutItems[1]).toMatchObject({ kind: 'assistant', text: 'Halfway' });
    expect(cutItems).toHaveLength(3);
    expect(cutItems.at(-1), 'the interrupt is the last step').toMatchObject({ kind: 'user', text: '[Request interrupted by user]' });
  });

  // subagent-conversation-route spec: the first frame holds every item at connect time, none for an empty file
  it('sends an empty first frame for a subagent file with no line yet', async () => {
    const session = external();
    await withSubagent(session, 'agent-new');
    const frame = await firstFrame(connect(session.id, 'agent-new'));
    expect(frame).toEqual({ type: 'items', items: [] });
  });
});

describe('Subagent conversation route, live', { timeout: 30_000 }, () => {
  // plan-session_activity/REQ-51: a new step of a running subagent reaches the page within 2 s, alone
  it('sends only the items of the new complete lines within 2 s', async () => {
    const session = hosted();
    const { sub } = await withSubagent(session, 'agent-live', task('Live task'), says('First step'));
    const client = connect(session.id, 'agent-live');
    await firstFrame(client);
    client.send({ type: 'input', data: 'ignored' });

    const written = Date.now();
    const [callAt] = await sub.append(uses('b2', 'Bash', { command: 'npm run build' }));
    await waitFor(() => client.frames.length === 2, 'the new step', REQ_51_MS + 1000);
    expect(Date.now() - written, 'REQ-51: the new step within 2 s').toBeLessThanOrEqual(REQ_51_MS);
    expect(framesOf(client)[1]).toEqual({ type: 'items', items: [{ kind: 'tool_call', name: 'Bash', summary: 'npm run build', id: 'b2', ref: { offset: callAt!, block: 0 } }] });
  });

  // subagent-conversation-route spec: only complete lines; no frame when nothing new has items
  it('waits for a partial line to end, and sends no frame for new lines without items', async () => {
    const session = external();
    const { sub } = await withSubagent(session, 'agent-partial', task('Partial task'));
    const client = connect(session.id, 'agent-partial');
    await firstFrame(client);

    await sub.append(thinking(), { type: 'user', isSidechain: true, isMeta: true, message: { role: 'user', content: 'meta' } });
    const half = JSON.stringify(says('Written in two parts'));
    await sub.appendRaw(half.slice(0, 20));
    await delay(2_500);
    expect(client.frames, 'no frame for lines without items nor for a partial line').toHaveLength(1);

    await sub.appendRaw(`${half.slice(20)}\n`);
    await waitFor(() => client.frames.length === 2, 'the completed line');
    expect(framesOf(client)[1]!.items).toEqual([{ kind: 'assistant', text: 'Written in two parts' }]);
  });

  // subagent-conversation-route spec: each item once, in file order; the checks go on after the subagent and its session end
  it('keeps sending new lines after the subagent and its session ended, each item once and in order', async () => {
    const session = external();
    const { sub } = await withSubagent(session, 'agent-after', task('After task'));
    const client = connect(session.id, 'agent-after');
    await firstFrame(client);
    await sub.append(says('Step 1'));
    await waitFor(() => itemsOf(client).length === 2, 'step 1');
    await sub.meta({ agentType: 'Explore', toolUseId: 'call', finished: true });
    externalSessions.set(session.id, { ...externalSessions.get(session.id)!, state: 'ended' });
    await sub.append(says('Step 2'), says('Step 3'));
    await waitFor(() => itemsOf(client).length === 4, 'steps 2 and 3');
    await delay(1_500);
    expect(itemsOf(client).map((item) => ('text' in item ? item.text : item.kind))).toEqual(['After task', 'Step 1', 'Step 2', 'Step 3']);
  });
});

describe('Subagent conversation route, unknown session or agent', { timeout: 30_000 }, () => {
  // subagent-conversation-route spec: no subagent file → close 4404, nothing sent
  it('closes with 4404 and no frame for an unknown session, an unknown agent, and an agent id that leaves the subagents folder', async () => {
    const session = external();
    await withSubagent(session, 'agent-known', task('Known'));
    await writeFile(path.join(session.sessionFolder, 'outside.jsonl'), `${JSON.stringify(task('Outside'))}\n`);
    for (const [sessionId, agentId] of [
      ['no-such-session', 'agent-known'],
      [session.id, 'agent-unknown'],
      [session.id, '../outside'],
    ] as const) {
      const client = connect(sessionId, agentId);
      expect(await client.closed, `${sessionId} ${agentId}`).toBe(4404);
      expect(client.frames).toEqual([]);
    }
  });

  // subagent-file-locator spec: a hosted session with no Claude Code session id, and a session with no main transcript → none
  it('closes with 4404 for a hosted session with no Claude Code session id, and for a subagent file with no main transcript', async () => {
    const id = unique('hosted-no-sid');
    const cwd = `/work/${id}`;
    tracker.track({ id, cwd, onExit: () => {} });
    const noTranscript = external();
    await noTranscript.subagent('agent-orphan').append(task('Orphan'));
    for (const [sessionId, agentId] of [
      [id, 'agent-x'],
      [noTranscript.id, 'agent-orphan'],
    ] as const) {
      const client = connect(sessionId, agentId);
      expect(await client.closed, sessionId).toBe(4404);
      expect(client.frames).toEqual([]);
    }
  });
});

describe('Subagent item content route', { timeout: 30_000 }, () => {
  // plan-session_activity/REQ-50: scenario "The full content of a tool card": the full output of a result cut to 5 lines
  it('gives the full output of a cut tool result and the full input of a call, from the refs of the stream', async () => {
    const session = hosted();
    const input = { file_path: 'src/a.ts', old_string: 'one', new_string: 'two' };
    await withSubagent(session, 'agent-full', task('Edit the file'), uses('e1', 'Edit', input), result('e1', SEVEN));
    const items = (await firstFrame(connect(session.id, 'agent-full'))).items;
    const call = items.find((item) => item.kind === 'tool_call');
    const cut = items.find((item) => item.kind === 'tool_result');
    expect(call).toMatchObject({ moreInput: true });
    expect(cut).toMatchObject({ truncated: true, text: 'r1\nr2\nr3\nr4\nr5' });
    const query = (item?: ConversationItem) => {
      const ref = item && 'ref' in item ? item.ref : undefined;
      return `?offset=${ref?.offset}&block=${ref?.block}`;
    };
    expect(await getItem(session.id, 'agent-full', query(cut))).toEqual({ status: 200, body: { text: SEVEN } });
    expect(await getItem(session.id, 'agent-full', query(call))).toEqual({ status: 200, body: { text: JSON.stringify(input, null, 2) } });
  });

  // plan-session_activity/REQ-50: an external session too
  it('gives the full output of a subagent of an external session', async () => {
    const session = external();
    const { offsets } = await withSubagent(session, 'agent-ext-full', task('List'), uses('l1', 'Bash', { command: 'ls' }), result('l1', SEVEN));
    expect(await getItem(session.id, 'agent-ext-full', `?offset=${offsets[2]}&block=0`)).toEqual({ status: 200, body: { text: SEVEN } });
  });

  // subagent-item-content-route spec: offset or block missing, repeated, or not a non-negative integer → 400 invalid_reference
  it('answers 400 invalid_reference for a missing, repeated or malformed reference', async () => {
    const session = external();
    const { offsets } = await withSubagent(session, 'agent-bad-ref', task('T'), uses('x', 'Bash', { command: 'ls' }));
    const at = offsets[1];
    for (const query of ['', `?offset=${at}`, '?block=0', `?offset=${at}&offset=${at}&block=0`, `?offset=${at}&block=0&block=0`, '?offset=-1&block=0', `?offset=${at}&block=1.5`, '?offset=abc&block=0', `?offset=${at}&block=`]) {
      expect(await getItem(session.id, 'agent-bad-ref', query), query).toEqual({ status: 400, body: { error: 'invalid_reference' } });
    }
  });

  // subagent-item-content-route spec: no subagent file → 404 session_not_found
  it('answers 404 session_not_found for an unknown session, an unknown agent and an agent id that leaves the subagents folder', async () => {
    const session = external();
    await withSubagent(session, 'agent-known', task('Known'), uses('x', 'Bash', { command: 'ls' }));
    await writeFile(path.join(session.sessionFolder, 'outside.jsonl'), `${JSON.stringify(uses('x', 'Bash', { command: 'ls' }))}\n`);
    for (const [sessionId, agentId] of [
      ['no-such-session', 'agent-known'],
      [session.id, 'agent-unknown'],
      [session.id, '../outside'],
    ] as const) {
      expect(await getItem(sessionId, agentId, '?offset=0&block=0'), `${sessionId} ${agentId}`).toEqual({ status: 404, body: { error: 'session_not_found' } });
    }
  });

  // subagent-item-content-route spec: a reference that is not a tool call or a tool result → 404 item_not_found
  it('answers 404 item_not_found for a text block, a block out of range and an offset inside a line', async () => {
    const session = external();
    const { offsets } = await withSubagent(session, 'agent-not-item', task('T'), says('Only text'), uses('x', 'Bash', { command: 'ls' }));
    for (const query of [`?offset=${offsets[1]}&block=0`, `?offset=${offsets[2]}&block=3`, `?offset=${offsets[2]! + 3}&block=0`]) {
      expect(await getItem(session.id, 'agent-not-item', query), query).toEqual({ status: 404, body: { error: 'item_not_found' } });
    }
  });
});

describe('Subagent routes, read-only', { timeout: 30_000 }, () => {
  // subagent-conversation-route and subagent-item-content-route specs: they write nothing
  it('changes no file of the Claude Code folder while streaming and giving full content', async () => {
    const session = external();
    const { offsets } = await withSubagent(session, 'agent-ro', task('Read only'), uses('r', 'Bash', { command: 'ls' }), result('r', SEVEN));
    await session.subagent('agent-ro').meta({ agentType: 'Explore', toolUseId: 'call' });
    const before = await snapshotTree(claudeDir);
    const client = connect(session.id, 'agent-ro');
    await firstFrame(client);
    expect((await getItem(session.id, 'agent-ro', `?offset=${offsets[2]}&block=0`)).status).toBe(200);
    await delay(1_200);
    expect(await snapshotTree(claudeDir)).toEqual(before);
  });
});
