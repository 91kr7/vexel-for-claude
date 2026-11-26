import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tempDir } from '../test-support.js';
import { itemsOf, subagentMetaOf } from './transcript-reader.js';

const sidechainUser = (content: unknown, extra: object = {}) => ({
  type: 'user',
  isSidechain: true,
  timestamp: '2026-11-26T10:00:00.000Z',
  message: { role: 'user', content },
  ...extra,
});
const sidechainAssistant = (content: object[]) => ({ type: 'assistant', isSidechain: true, message: { role: 'assistant', content } });

describe('itemsOf with the sidechain option', () => {
  // transcript-reader spec: without the option a sidechain line gives no item
  it('gives no item for a sidechain line without the option', () => {
    expect(itemsOf(sidechainAssistant([{ type: 'text', text: 'Hello' }]))).toEqual([]);
    expect(itemsOf(sidechainAssistant([{ type: 'text', text: 'Hello' }]), 0, {})).toEqual([]);
    expect(itemsOf(sidechainUser('Explore the repository'), 0, { sidechain: false })).toEqual([]);
  });

  // plan-session_activity/REQ-3: with the option, the text of a subagent line is an assistant item
  it('gives the items of an assistant sidechain line, thinking left out', () => {
    const line = sidechainAssistant([
      { type: 'thinking', thinking: 'Let me look' },
      { type: 'text', text: '  Overwriting the class  ' },
      { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'npm test' } },
    ]);
    const items = itemsOf(line, undefined, { sidechain: true });
    expect(items.map((item) => item.kind)).toEqual(['assistant', 'tool_call']);
    expect(items[0]).toEqual({ kind: 'assistant', text: 'Overwriting the class' });
    expect(items[1]).toMatchObject({ kind: 'tool_call', name: 'Bash', id: 't1' });
    expect(items[1]).not.toHaveProperty('ref');
  });

  // transcript-reader spec: with the option, the user message of a sidechain line is a user item, tool results too
  it('gives the user message and the tool results of a user sidechain line', () => {
    expect(itemsOf(sidechainUser('Explore the repository'), undefined, { sidechain: true })).toEqual([
      { kind: 'user', text: 'Explore the repository', timestamp: '2026-11-26T10:00:00.000Z' },
    ]);
    const results = itemsOf(sidechainUser([{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }]), undefined, { sidechain: true });
    expect(results).toEqual([{ kind: 'tool_result', text: 'ok', truncated: false, toolUseId: 't1' }]);
    const marker = itemsOf(sidechainUser([{ type: 'text', text: '[Request interrupted by user for tool use]' }]), undefined, { sidechain: true });
    expect(marker).toEqual([{ kind: 'user', text: '[Request interrupted by user for tool use]', timestamp: '2026-11-26T10:00:00.000Z' }]);
  });

  // transcript-reader spec: lineOffset still gives the refs with the option
  it('gives the refs of the tool items with a line offset', () => {
    const items = itemsOf(sidechainAssistant([{ type: 'text', text: 'Hi' }, { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/a' } }]), 42, { sidechain: true });
    expect(items[1]).toMatchObject({ kind: 'tool_call', ref: { offset: 42, block: 1 } });
  });

  // transcript-reader spec: meta lines give nothing, with the option too
  it('gives no item for a meta sidechain line', () => {
    expect(itemsOf(sidechainUser('<system-reminder>x</system-reminder>', { isMeta: true }), undefined, { sidechain: true })).toEqual([]);
  });

  // transcript-reader spec: the option changes nothing for a line that is not a sidechain
  it('reads a main line the same with or without the option', () => {
    const line = { type: 'assistant', isSidechain: false, message: { role: 'assistant', content: [{ type: 'text', text: 'Main' }] } };
    expect(itemsOf(line, 7, { sidechain: true })).toEqual(itemsOf(line, 7));
    const user = { type: 'user', isSidechain: false, timestamp: '2026-11-26T10:00:00.000Z', message: { role: 'user', content: 'Go' } };
    expect(itemsOf(user, undefined, { sidechain: true })).toEqual(itemsOf(user));
  });
});

describe('subagentMetaOf', () => {
  let dir: string;
  let counter = 0;

  beforeAll(async () => {
    dir = path.join(await tempDir('ai-client-subagent-meta-'), 'subagents');
    await mkdir(dir, { recursive: true });
  });

  afterAll(async () => {
    await rm(path.dirname(dir), { recursive: true, force: true });
  });

  /** A subagent file with the given metadata text next to it; `undefined` writes no metadata file. */
  async function subagentWith(meta: string | undefined): Promise<string> {
    counter += 1;
    const file = path.join(dir, `agent-m${counter}.jsonl`);
    await writeFile(file, '');
    if (meta !== undefined) await writeFile(path.join(dir, `agent-m${counter}.meta.json`), meta);
    return file;
  }

  // plan-session_activity/REQ-1, REQ-4: the agent type, description, tool use id, model and finished of the metadata file
  it('reads the five fields of the metadata file', async () => {
    const file = await subagentWith(
      JSON.stringify({ agentType: 'sdd-developer', description: 'Implement batch', toolUseId: 'toolu_01', model: 'claude-opus-5-5', finished: true, spawnDepth: 1 }),
    );
    expect(await subagentMetaOf(file)).toEqual({ agentType: 'sdd-developer', description: 'Implement batch', toolUseId: 'toolu_01', model: 'claude-opus-5-5', finished: true });
  });

  // plan-session_activity/REQ-1: a running subagent has no finished; finished false stays false
  it('has no finished while the file has none, and keeps finished false', async () => {
    expect(await subagentMetaOf(await subagentWith(JSON.stringify({ agentType: 'Explore' })))).toEqual({ agentType: 'Explore' });
    expect(await subagentMetaOf(await subagentWith(JSON.stringify({ finished: false })))).toEqual({ finished: false });
  });

  // plan-session_activity/REQ-13: a field of an unexpected type is absent, the others stay
  it('leaves out a field of an unexpected type', async () => {
    const file = await subagentWith(JSON.stringify({ agentType: 7, description: null, toolUseId: ['x'], model: 'claude-haiku-5-5', finished: 'true' }));
    expect(await subagentMetaOf(file)).toEqual({ model: 'claude-haiku-5-5' });
  });

  // plan-session_activity/REQ-32: the model is read from pickedEffortModel, the key Claude Code writes
  it('reads the model from pickedEffortModel', async () => {
    const file = await subagentWith(JSON.stringify({ agentType: 'sdd-tester', toolUseId: 'toolu_02', pickedEffortModel: 'claude-sonnet-5' }));
    expect(await subagentMetaOf(file)).toEqual({ agentType: 'sdd-tester', toolUseId: 'toolu_02', model: 'claude-sonnet-5' });
  });

  // plan-session_activity/REQ-32: pickedEffortModel wins over model when both are strings
  it('prefers pickedEffortModel to model when both are present', async () => {
    const file = await subagentWith(JSON.stringify({ model: 'claude-haiku-5-5', pickedEffortModel: 'claude-opus-5-5' }));
    expect(await subagentMetaOf(file)).toEqual({ model: 'claude-opus-5-5' });
  });

  // plan-session_activity/REQ-44: a pickedEffortModel that is not a string falls back to model, else no model
  it('falls back to model when pickedEffortModel is not a string, and gives no model when neither is', async () => {
    expect(await subagentMetaOf(await subagentWith(JSON.stringify({ pickedEffortModel: 7, model: 'claude-haiku-5-5' })))).toEqual({ model: 'claude-haiku-5-5' });
    expect(await subagentMetaOf(await subagentWith(JSON.stringify({ pickedEffortModel: null, model: ['x'], agentType: 'Explore' })))).toEqual({ agentType: 'Explore' });
  });

  // plan-session_activity/REQ-13: no file, bad JSON, or JSON that is not an object → no field
  it.each([
    ['no metadata file', undefined],
    ['bad JSON', '{"agentType": "Explore"'],
    ['an array', '[{"agentType": "Explore"}]'],
    ['a string', '"Explore"'],
    ['null', 'null'],
    ['an empty file', ''],
  ])('gives no field for %s', async (_what, meta) => {
    expect(await subagentMetaOf(await subagentWith(meta))).toEqual({});
  });

  // plan-session_activity/REQ-13: a subagent file in a folder that does not exist gives no field
  it('gives no field when the folder does not exist', async () => {
    expect(await subagentMetaOf(path.join(dir, 'missing', 'agent-x.jsonl'))).toEqual({});
  });
});
