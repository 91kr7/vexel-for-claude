import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type WsClient, connectWs, delay, snapshotTree, tempDir, userEntry, waitFor } from '../test-support.js';
import { registerConversationStreamRoute } from './conversation-stream-route.js';
import type { ExternalSessionSummary } from './external-session-scanner.js';
import { TranscriptReader } from './transcript-reader.js';

const POLL_MS = 50;
const CWD = '/home/dev/app';

let app: FastifyInstance;
let claudeDir: string;
let reader: TranscriptReader;
let entries: Map<string, ExternalSessionSummary>;
let base: string;
const clients: WsClient[] = [];

const external = (id: string): ExternalSessionSummary => ({
  id,
  folder: CWD,
  label: id,
  state: 'idle',
  lastActivity: '2026-11-05T10:00:00.000Z',
  external: true,
});

const transcriptPath = (id: string) => path.join(claudeDir, 'projects', '-home-dev-app', `${id}.jsonl`);
const line = (entry: object) => `${JSON.stringify(entry)}\n`;
const assistant = (text: string) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } });
const frames = (client: WsClient) => client.frames.map((frame) => JSON.parse(frame) as { type: string; items: unknown[] });
const allItems = (client: WsClient) => frames(client).flatMap((frame) => frame.items);

async function writeTranscript(id: string, content: string): Promise<void> {
  await mkdir(path.dirname(transcriptPath(id)), { recursive: true });
  await writeFile(transcriptPath(id), content);
}

function connect(id: string): WsClient {
  const client = connectWs(`${base}/api/external-sessions/${id}/conversation`);
  clients.push(client);
  return client;
}

async function startApp(pollIntervalMs: number | undefined = POLL_MS): Promise<void> {
  app = Fastify();
  await app.register(fastifyWebsocket);
  registerConversationStreamRoute(app, {
    scanner: { get: (id: string) => entries.get(id) },
    reader,
    ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
  });
  await app.listen({ host: '127.0.0.1', port: 0 });
  base = `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
}

beforeEach(async () => {
  claudeDir = await tempDir('ai-client-claude-');
  reader = new TranscriptReader({ claudeDir });
  entries = new Map([['live', external('live')]]);
});

afterEach(async () => {
  for (const client of clients.splice(0)) client.socket.terminate();
  await app.close();
});

describe('ConversationStreamRoute', () => {
  // plan-claude_sessions_client/REQ-33
  it('closes with 4404 and sends nothing for an id that is not a current external entry', async () => {
    await startApp();
    const client = connect('unknown');
    expect(await client.closed).toBe(4404);
    expect(client.frames).toEqual([]);
  });

  // plan-claude_sessions_client/REQ-33
  it('sends every item of the transcript in the first frame', async () => {
    await writeTranscript('live', line(userEntry('Ciao')) + line({ type: 'system' }) + line(assistant('Salve')));
    await startApp();
    const client = connect('live');
    await waitFor(() => client.frames.length > 0, 'first frame');
    expect(frames(client)[0]).toEqual({
      type: 'items',
      items: [
        { kind: 'user', text: 'Ciao' },
        { kind: 'assistant', text: 'Salve' },
      ],
    });
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-36, REQ-39, REQ-40: the data of the bubbles and of the tool cards
  it('sends the user time, the tool-use ids that join a call to its result, and the outcome of each result', async () => {
    const at = '2026-11-05T20:45:00.000Z';
    const toolUse = (id: string, command: string) => ({ type: 'tool_use', id, name: 'Bash', input: { command } });
    await writeTranscript(
      'live',
      line(userEntry('Lancia i test', undefined, { timestamp: at })) +
        line({ type: 'assistant', message: { role: 'assistant', content: [toolUse('toolu_a', 'npm test'), toolUse('toolu_b', 'npm run lint')] } }) +
        line(userEntry([
          { type: 'tool_result', tool_use_id: 'toolu_a', content: 'FAIL', is_error: true },
          { type: 'tool_result', tool_use_id: 'toolu_b', content: 'ok' },
        ])),
    );
    await startApp();
    const client = connect('live');
    await waitFor(() => client.frames.length > 0, 'first frame');
    const items = frames(client)[0]!.items.map((item) => {
      const { ref, ...rest } = item as { ref?: unknown };
      return rest;
    });
    expect(items).toEqual([
      { kind: 'user', text: 'Lancia i test', timestamp: at },
      { kind: 'tool_call', name: 'Bash', summary: 'npm test', id: 'toolu_a' },
      { kind: 'tool_call', name: 'Bash', summary: 'npm run lint', id: 'toolu_b' },
      { kind: 'tool_result', text: 'FAIL', truncated: false, isError: true, toolUseId: 'toolu_a' },
      { kind: 'tool_result', text: 'ok', truncated: false, toolUseId: 'toolu_b' },
    ]);
  });

  // plan-claude_sessions_client/REQ-33
  it('sends an empty first frame when there is no transcript yet, then the items once the session writes it', async () => {
    await startApp();
    const client = connect('live');
    await waitFor(() => client.frames.length > 0, 'first frame');
    expect(frames(client)[0]).toEqual({ type: 'items', items: [] });
    await writeTranscript('live', line(userEntry('Primo messaggio')));
    await waitFor(() => client.frames.length > 1, 'items of the new transcript');
    expect(frames(client)[1]).toEqual({ type: 'items', items: [{ kind: 'user', text: 'Primo messaggio' }] });
  });

  // plan-claude_sessions_client/REQ-34
  it('sends only the items of the new complete lines, each item once and in order', async () => {
    await writeTranscript('live', line(userEntry('Uno')));
    await startApp();
    const client = connect('live');
    await waitFor(() => client.frames.length > 0, 'first frame');

    const next = line(assistant('Due'));
    await appendFile(transcriptPath('live'), next.slice(0, 15));
    await delay(POLL_MS * 4);
    expect(client.frames).toHaveLength(1);

    await appendFile(transcriptPath('live'), next.slice(15) + line(userEntry('Tre')));
    await waitFor(() => allItems(client).length >= 3, 'new items');
    await delay(POLL_MS * 4);
    expect(allItems(client)).toEqual([
      { kind: 'user', text: 'Uno' },
      { kind: 'assistant', text: 'Due' },
      { kind: 'user', text: 'Tre' },
    ]);
    expect(frames(client).every((frame) => frame.type === 'items')).toBe(true);
  });

  it('sends no frame when the new lines have no items', async () => {
    await writeTranscript('live', line(userEntry('Uno')));
    await startApp();
    const client = connect('live');
    await waitFor(() => client.frames.length > 0, 'first frame');
    await appendFile(transcriptPath('live'), line({ type: 'system' }) + line(userEntry('meta', undefined, { isMeta: true })));
    await delay(POLL_MS * 5);
    expect(client.frames).toHaveLength(1);
  });

  // plan-claude_sessions_client/REQ-34
  it('keeps sending new items after the external session leaves the scanner', async () => {
    await writeTranscript('live', line(userEntry('Uno')));
    await startApp();
    const client = connect('live');
    await waitFor(() => client.frames.length > 0, 'first frame');
    entries.delete('live');
    await appendFile(transcriptPath('live'), line(assistant('Ultima risposta')));
    await waitFor(() => client.frames.length > 1, 'item after the end of the session');
    expect(frames(client)[1]?.items).toEqual([{ kind: 'assistant', text: 'Ultima risposta' }]);
  });

  it('closing the socket stops the checks', async () => {
    await writeTranscript('live', line(userEntry('Uno')));
    const readFrom = vi.spyOn(reader, 'readFrom');
    await startApp();
    const client = connect('live');
    await waitFor(() => client.frames.length > 0, 'first frame');
    await delay(POLL_MS * 3);
    client.socket.close();
    await client.closed;
    await delay(POLL_MS * 2);
    const calls = readFrom.mock.calls.length;
    await delay(POLL_MS * 6);
    expect(readFrom.mock.calls.length).toBe(calls);
  });

  // plan-claude_sessions_client/REQ-36
  it('ignores the frames of the client and writes nothing under the Claude Code folder', async () => {
    await writeTranscript('live', line(userEntry('Uno')));
    const before = await snapshotTree(claudeDir);
    await startApp();
    const client = connect('live');
    await waitFor(() => client.frames.length > 0, 'first frame');
    client.send({ type: 'input', data: 'rm -rf /\r' });
    client.send('not json');
    await delay(POLL_MS * 4);
    expect(client.closeCode).toBeUndefined();
    expect(client.frames).toHaveLength(1);
    expect(await snapshotTree(claudeDir)).toEqual(before);
  });

  it('checks the transcript every second by default', async () => {
    await writeTranscript('live', line(userEntry('Uno')));
    await startApp(undefined);
    const client = connect('live');
    await waitFor(() => client.frames.length > 0, 'first frame');
    await appendFile(transcriptPath('live'), line(assistant('Due')));
    const appendedAt = Date.now();
    await waitFor(() => client.frames.length > 1, 'new item', 3000);
    expect(Date.now() - appendedAt).toBeLessThan(1500);
  });
});
