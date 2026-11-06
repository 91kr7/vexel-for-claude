import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { snapshotTree, tempDir } from '../test-support.js';
import { subagentFilesOf } from './transcript-reader.js';

let dir: string;
let main: string;
let subagents: string;

beforeEach(async () => {
  dir = await tempDir('ai-client-subagents-');
  main = path.join(dir, 'f00dcafe-0000-4000-8000-000000000001.jsonl');
  subagents = path.join(dir, 'f00dcafe-0000-4000-8000-000000000001', 'subagents');
  await writeFile(main, '');
});

afterEach(async () => {
  await chmod(subagents, 0o755).catch(() => {});
  await rm(dir, { recursive: true, force: true });
});

describe('subagentFilesOf', () => {
  // plan-session_usage/REQ-14: the .jsonl files of <session>/subagents/, sorted by name, without other files and folders
  it('gives the .jsonl files of the subagents folder, sorted by name', async () => {
    await mkdir(path.join(subagents, 'nested.jsonl'), { recursive: true });
    await writeFile(path.join(subagents, 'agent-b2.jsonl'), '');
    await writeFile(path.join(subagents, 'agent-a1.jsonl'), '');
    await writeFile(path.join(subagents, 'agent-a1.meta.json'), '{}');
    await writeFile(path.join(subagents, 'notes.txt'), '');
    expect(await subagentFilesOf(main)).toEqual([path.join(subagents, 'agent-a1.jsonl'), path.join(subagents, 'agent-b2.jsonl')]);
  });

  // TranscriptReader spec: no folder → []
  it('gives no file when the session has no subagents folder', async () => {
    expect(await subagentFilesOf(main)).toEqual([]);
    await mkdir(path.dirname(subagents));
    expect(await subagentFilesOf(main)).toEqual([]);
  });

  // TranscriptReader spec: a folder that cannot be read → []
  it.skipIf(process.getuid?.() === 0)('gives no file when the subagents folder cannot be read', async () => {
    await mkdir(subagents, { recursive: true });
    await writeFile(path.join(subagents, 'agent-a1.jsonl'), '');
    await chmod(subagents, 0o000);
    expect(await subagentFilesOf(main)).toEqual([]);
  });

  // TranscriptReader spec: read-only
  it('writes nothing', async () => {
    await mkdir(subagents, { recursive: true });
    await writeFile(path.join(subagents, 'agent-a1.jsonl'), '{}\n');
    const before = await snapshotTree(dir);
    await subagentFilesOf(main);
    expect(await snapshotTree(dir)).toEqual(before);
  });
});
