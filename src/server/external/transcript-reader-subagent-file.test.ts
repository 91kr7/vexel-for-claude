// Unit tests of TranscriptReader for plan-session_activity, batch subagent-conversation: `subagentFileOf`, and the sidechain option of `readFrom` and `readItem`.
import { appendFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tempDir } from '../test-support.js';
import { TranscriptReader, subagentFileOf } from './transcript-reader.js';

type Line = Record<string, unknown>;

let root: string;
let nextId = 0;

beforeAll(async () => {
  root = await tempDir('ai-client-reader-subagent-file-');
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

/** A main transcript path in its own folder; the file itself is not needed by `subagentFileOf`. */
function mainTranscript(): string {
  nextId += 1;
  return path.join(root, `p${nextId}`, `session-${nextId}.jsonl`);
}

const subagentsDir = (main: string) => path.join(main.replace(/\.jsonl$/, ''), 'subagents');

/** Appends the lines and gives the byte offset where each one starts. */
async function writeLines(file: string, lines: Line[]): Promise<number[]> {
  await mkdir(path.dirname(file), { recursive: true });
  const texts = lines.map((line) => `${JSON.stringify(line)}\n`);
  const offsets: number[] = [];
  let at = 0;
  for (const text of texts) {
    offsets.push(at);
    at += Buffer.byteLength(text);
  }
  await appendFile(file, texts.join(''));
  return offsets;
}

const seven = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7'].join('\n');
const task: Line = { type: 'user', isSidechain: true, timestamp: '2026-11-26T10:00:00.000Z', message: { role: 'user', content: 'Run the tests' } };
const call: Line = {
  type: 'assistant',
  isSidechain: true,
  message: { role: 'assistant', content: [{ type: 'text', text: 'Running them' }, { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'npm test', timeout: 60 } }] },
};
const result: Line = { type: 'user', isSidechain: true, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: seven }] } };

describe('subagentFileOf', () => {
  // transcript-reader spec: the file <main without .jsonl>/subagents/<agentId>.jsonl, when it exists
  it('gives the subagent file of an agent id made of letters, digits, "-" and "_"', async () => {
    const main = mainTranscript();
    const file = path.join(subagentsDir(main), 'agent-A1_b2.jsonl');
    await writeLines(file, [task]);
    expect(await subagentFileOf(main, 'agent-A1_b2')).toBe(file);
  });

  // transcript-reader spec: no such file → undefined
  it('gives none when the subagent file does not exist', async () => {
    const main = mainTranscript();
    await writeLines(path.join(subagentsDir(main), 'agent-other.jsonl'), [task]);
    expect(await subagentFileOf(main, 'agent-missing')).toBeUndefined();
  });

  // transcript-reader spec: "when it exists and is a file"
  it('gives none when the name is a folder', async () => {
    const main = mainTranscript();
    await mkdir(path.join(subagentsDir(main), 'agent-dir.jsonl'), { recursive: true });
    expect(await subagentFileOf(main, 'agent-dir')).toBeUndefined();
  });

  // transcript-reader spec: an id with other characters → undefined, so a request stays inside subagents/
  it('gives none for an id with other characters, also when the file it names exists', async () => {
    const main = mainTranscript();
    const sessionFolder = main.replace(/\.jsonl$/, '');
    await writeLines(path.join(sessionFolder, 'outside.jsonl'), [task]);
    await writeLines(path.join(subagentsDir(main), 'agent.dot.jsonl'), [task]);
    await writeLines(path.join(subagentsDir(main), 'agent space.jsonl'), [task]);
    for (const id of ['../outside', 'agent.dot', 'agent space', 'a/b', '..', 'agent%2e']) {
      expect(await subagentFileOf(main, id), id).toBeUndefined();
    }
  });
});

describe('readFrom and readItem with the sidechain option', () => {
  // transcript-reader spec: readFrom passes the options to itemsOf; a sidechain line gives its items, the task included, with refs
  it('readFrom gives the items of a subagent file with the option, and none without it', async () => {
    const main = mainTranscript();
    const file = path.join(subagentsDir(main), 'agent-r.jsonl');
    const [, callAt, resultAt] = await writeLines(file, [task, call, result]);
    const reader = new TranscriptReader({ claudeDir: root });

    const withOption = await reader.readFrom(file, 0, { sidechain: true });
    expect(withOption.items).toEqual([
      { kind: 'user', text: 'Run the tests', timestamp: '2026-11-26T10:00:00.000Z' },
      { kind: 'assistant', text: 'Running them' },
      { kind: 'tool_call', name: 'Bash', summary: 'npm test', moreInput: true, id: 't1', ref: { offset: callAt, block: 1 } },
      { kind: 'tool_result', text: 'l1\nl2\nl3\nl4\nl5', truncated: true, toolUseId: 't1', ref: { offset: resultAt, block: 0 } },
    ]);

    const without = await reader.readFrom(file, 0);
    expect(without.items).toEqual([]);
    expect(without.offset, 'the same complete lines are read').toBe(withOption.offset);
  });

  // transcript-reader spec: readItem of a sidechain line only with options.sidechain
  it('readItem gives the full output and the full input of a subagent tool with the option, and none without it', async () => {
    const main = mainTranscript();
    const file = path.join(subagentsDir(main), 'agent-i.jsonl');
    const [, callAt, resultAt] = await writeLines(file, [task, call, result]);
    const reader = new TranscriptReader({ claudeDir: root });

    expect(await reader.readItem(file, { offset: resultAt!, block: 0 }, { sidechain: true })).toBe(seven);
    expect(await reader.readItem(file, { offset: callAt!, block: 1 }, { sidechain: true })).toBe(JSON.stringify({ command: 'npm test', timeout: 60 }, null, 2));
    expect(await reader.readItem(file, { offset: resultAt!, block: 0 })).toBeUndefined();
    expect(await reader.readItem(file, { offset: callAt!, block: 1 })).toBeUndefined();
  });
});
