import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { snapshotTree, tempDir, userEntry } from '../test-support.js';
import type { ExternalSessionSummary } from './external-session-scanner.js';
import { registerItemContentRoute } from './item-content-route.js';
import { TranscriptReader } from './transcript-reader.js';

const CWD = '/home/dev/app';
const input = { command: 'npm test', description: 'Esegue i test' };
const longResult = Array.from({ length: 9 }, (_, i) => `riga ${i + 1}`).join('\n');
const line = (entry: object) => `${JSON.stringify(entry)}\n`;
const firstLine = line(userEntry('Avvia i test'));
const callLine = line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Avvio.' }, { type: 'tool_use', id: 't1', name: 'Bash', input }] } });
const resultLine = line(userEntry([{ type: 'tool_result', tool_use_id: 't1', content: longResult }]));
const callOffset = Buffer.byteLength(firstLine);
const resultOffset = Buffer.byteLength(firstLine + callLine);

let app: FastifyInstance;
let claudeDir: string;
let entries: Map<string, ExternalSessionSummary>;

const external = (id: string, folder = CWD): ExternalSessionSummary => ({
  id,
  folder,
  label: id,
  state: 'idle',
  lastActivity: '2026-11-05T10:00:00.000Z',
  external: true,
});

async function writeTranscript(project: string, id: string, content: string): Promise<void> {
  const dir = path.join(claudeDir, 'projects', project);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${id}.jsonl`), content);
}

const get = (id: string, query: string) => app.inject({ method: 'GET', url: `/api/external-sessions/${id}/items${query}` });

beforeEach(async () => {
  claudeDir = await tempDir('ai-client-claude-');
  entries = new Map([['live', external('live')]]);
  app = Fastify();
  registerItemContentRoute(app, { scanner: { get: (id: string) => entries.get(id) }, reader: new TranscriptReader({ claudeDir }) });
  await app.ready();
  await writeTranscript('-home-dev-app', 'live', firstLine + callLine + resultLine);
});

afterEach(async () => {
  await app.close();
});

describe('ItemContentRoute', () => {
  // plan-claude_sessions_client-ui_redesign/REQ-21
  it('gives the full input of a tool call and the full text of a tool result', async () => {
    const call = await get('live', `?offset=${callOffset}&block=1`);
    expect(call.statusCode).toBe(200);
    expect(call.json()).toEqual({ text: JSON.stringify(input, null, 2) });
    const result = await get('live', `?offset=${resultOffset}&block=0`);
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual({ text: longResult });
  });

  it.each([
    ['offset missing', '?block=0'],
    ['block missing', `?offset=${callOffset}`],
    ['nothing', ''],
    ['offset repeated', `?offset=${callOffset}&offset=${callOffset}&block=1`],
    ['block repeated', `?offset=${callOffset}&block=1&block=1`],
    ['negative offset', '?offset=-1&block=0'],
    ['negative block', `?offset=${callOffset}&block=-1`],
    ['decimal block', `?offset=${callOffset}&block=1.5`],
    ['non numeric offset', '?offset=abc&block=0'],
    ['empty offset', '?offset=&block=0'],
  ])('answers 400 invalid_reference with %s', async (_case, query) => {
    const response = await get('live', query);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_reference' });
  });

  it('answers 404 session_not_found when no transcript exists for the id', async () => {
    entries.set('no-file', external('no-file'));
    for (const id of ['no-file', 'unknown']) {
      const response = await get(id, '?offset=0&block=0');
      expect(response.statusCode, id).toBe(404);
      expect(response.json(), id).toEqual({ error: 'session_not_found' });
    }
  });

  it('answers 404 item_not_found when the reference does not point to a tool call or a tool result', async () => {
    for (const query of ['?offset=0&block=0', `?offset=${callOffset}&block=0`, `?offset=${callOffset + 1}&block=1`, `?offset=${resultOffset}&block=5`, '?offset=999999&block=0']) {
      const response = await get('live', query);
      expect(response.statusCode, query).toBe(404);
      expect(response.json(), query).toEqual({ error: 'item_not_found' });
    }
  });

  it('searches the transcript in the folder of the scanner entry first', async () => {
    entries.set('twin', external('twin', '/home/dev/other'));
    await writeTranscript('-home-dev-app', 'twin', line(userEntry([{ type: 'tool_result', tool_use_id: 't', content: 'sbagliato' }])));
    await writeTranscript('-home-dev-other', 'twin', line(userEntry([{ type: 'tool_result', tool_use_id: 't', content: 'giusto' }])));
    expect((await get('twin', '?offset=0&block=0')).json()).toEqual({ text: 'giusto' });
  });

  // plan-claude_sessions_client-ui_redesign/REQ-21: the content stays readable after the session ended
  it('finds the transcript in any project folder when the scanner entry is gone', async () => {
    entries.delete('live');
    const response = await get('live', `?offset=${resultOffset}&block=0`);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ text: longResult });
  });

  // plan-claude_sessions_client/REQ-36
  it('writes nothing under the Claude Code folder', async () => {
    const before = await snapshotTree(claudeDir);
    await get('live', `?offset=${callOffset}&block=1`);
    await get('live', '?offset=0&block=0');
    await get('live', '?offset=x&block=0');
    await get('gone', '?offset=0&block=0');
    expect(await snapshotTree(claudeDir)).toEqual(before);
  });
});
