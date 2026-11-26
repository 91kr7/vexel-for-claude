// Unit tests of the workflow subagent files of TranscriptReader (spec external/transcript-reader.md), plan-session_activity batch workflow-subagents.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tempDir } from '../test-support.js';
import { subagentFileOf, subagentFilesOf, subagentMetaOf, workflowSubagentFilesOf } from './transcript-reader.js';

let root: string;
let nextId = 0;

beforeAll(async () => {
  root = await tempDir('ai-client-transcript-reader-workflow-');
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

/** A main transcript `<root>/<name>.jsonl` and a writer of files under its `subagents/` folder. */
async function session() {
  nextId += 1;
  const transcript = path.join(root, `session-${nextId}.jsonl`);
  await writeFile(transcript, '');
  const subagents = path.join(root, `session-${nextId}`, 'subagents');
  const put = async (relative: string, content = '') => {
    const file = path.join(subagents, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
    return file;
  };
  return { transcript, subagents, put };
}

describe('workflowSubagentFilesOf', () => {
  // transcript-reader spec: workflowSubagentFilesOf, runs and agent files sorted, each with its run id and journal
  it('gives the agent files of each run with their run id and journal, runs and files sorted by name', async () => {
    const s = await session();
    await s.put('workflows/wf_b/agent-b2.jsonl');
    await s.put('workflows/wf_b/agent-b1.jsonl');
    await s.put('workflows/wf_b/journal.jsonl');
    await s.put('workflows/wf_a/agent-a1.jsonl');
    await s.put('workflows/wf_a/journal.jsonl');

    const run = (id: string) => path.join(s.subagents, 'workflows', id);
    expect(await workflowSubagentFilesOf(s.transcript)).toEqual([
      { file: path.join(run('wf_a'), 'agent-a1.jsonl'), runId: 'wf_a', journal: path.join(run('wf_a'), 'journal.jsonl') },
      { file: path.join(run('wf_b'), 'agent-b1.jsonl'), runId: 'wf_b', journal: path.join(run('wf_b'), 'journal.jsonl') },
      { file: path.join(run('wf_b'), 'agent-b2.jsonl'), runId: 'wf_b', journal: path.join(run('wf_b'), 'journal.jsonl') },
    ]);
  });

  // transcript-reader spec: only agent-*.jsonl files; journal given whether it exists or not
  it('leaves out metadata, the journal, other files and folders, and gives the journal path even when it does not exist', async () => {
    const s = await session();
    await s.put('workflows/wf_x/agent-x1.jsonl');
    await s.put('workflows/wf_x/agent-x1.meta.json', '{}');
    await s.put('workflows/wf_x/notes.jsonl');
    await s.put('workflows/wf_x/agent-nested/agent-deep.jsonl');
    await s.put('workflows/wf_file', '{}');

    const run = path.join(s.subagents, 'workflows', 'wf_x');
    expect(await workflowSubagentFilesOf(s.transcript)).toEqual([{ file: path.join(run, 'agent-x1.jsonl'), runId: 'wf_x', journal: path.join(run, 'journal.jsonl') }]);
  });

  // transcript-reader spec: run ids of letters, digits, "-" and "_" only
  it('skips a run folder whose name has characters other than letters, digits, "-" and "_"', async () => {
    const s = await session();
    await s.put('workflows/wf.dot/agent-d1.jsonl');
    await s.put('workflows/wf space/agent-s1.jsonl');
    await s.put('workflows/wf_ok-1/agent-o1.jsonl');

    expect((await workflowSubagentFilesOf(s.transcript)).map(({ runId }) => runId)).toEqual(['wf_ok-1']);
  });

  // transcript-reader spec: no folder → no file
  it('gives nothing when the session has no workflows folder, or no subagents folder', async () => {
    const withPlain = await session();
    await withPlain.put('agent-plain.jsonl');
    expect(await workflowSubagentFilesOf(withPlain.transcript)).toEqual([]);
    expect(await workflowSubagentFilesOf(path.join(root, 'no-such-session.jsonl'))).toEqual([]);
  });
});

describe('subagentFilesOf with workflow runs', () => {
  // transcript-reader spec: subagentFilesOf leaves out sub-folders (batch decision "Usage figures do not change")
  it('still lists only the files of the subagents folder itself, so usage figures leave out workflow subagents', async () => {
    const s = await session();
    const plain = await s.put('agent-plain.jsonl');
    await s.put('workflows/wf_a/agent-a1.jsonl');
    await s.put('workflows/wf_a/journal.jsonl');

    expect(await subagentFilesOf(s.transcript)).toEqual([plain]);
  });
});

describe('subagentFileOf for workflow subagents', () => {
  // plan-session_activity/REQ-59: subagentFileOf finds workflows/<run id>/<agentId>.jsonl
  it('finds the file of a workflow subagent in its run folder', async () => {
    const s = await session();
    const file = await s.put('workflows/wf_a/agent-w1.jsonl');
    expect(await subagentFileOf(s.transcript, 'agent-w1')).toBe(file);
  });

  // transcript-reader spec: subagentFileOf looks in subagents/ first, then in the runs in order
  it('prefers the file of the subagents folder itself, then the first run by name', async () => {
    const s = await session();
    const plain = await s.put('agent-both.jsonl');
    await s.put('workflows/wf_a/agent-both.jsonl');
    expect(await subagentFileOf(s.transcript, 'agent-both')).toBe(plain);

    const first = await s.put('workflows/wf_a/agent-twice.jsonl');
    await s.put('workflows/wf_b/agent-twice.jsonl');
    expect(await subagentFileOf(s.transcript, 'agent-twice')).toBe(first);
  });

  // transcript-reader spec: in run folders only ids starting with "agent-", run ids checked
  it('never gives the journal, a file whose id does not start with "agent-", or a file of a run folder with a bad name', async () => {
    const s = await session();
    await s.put('workflows/wf_a/journal.jsonl', '{"type":"launched"}\n');
    await s.put('workflows/wf_a/other-1.jsonl');
    await s.put('workflows/wf.dot/agent-dot.jsonl');

    expect(await subagentFileOf(s.transcript, 'journal')).toBeUndefined();
    expect(await subagentFileOf(s.transcript, 'other-1')).toBeUndefined();
    expect(await subagentFileOf(s.transcript, 'agent-dot')).toBeUndefined();
  });

  // transcript-reader spec: an agent id with other characters → undefined
  it('refuses an agent id with characters other than letters, digits, "-" and "_"', async () => {
    const s = await session();
    await s.put('workflows/wf_a/agent-w1.jsonl');
    expect(await subagentFileOf(s.transcript, 'workflows/wf_a/agent-w1')).toBeUndefined();
    expect(await subagentFileOf(s.transcript, '../subagents/workflows/wf_a/agent-w1')).toBeUndefined();
  });
});

describe('subagentMetaOf for a workflow subagent', () => {
  // plan-session_activity/REQ-58: subagentMetaOf of a workflow subagent (type, description, model)
  it('reads the metadata next to the file in its run folder: type, label as description, picked model', async () => {
    const s = await session();
    const file = await s.put('workflows/wf_a/agent-w1.jsonl');
    await s.put(
      'workflows/wf_a/agent-w1.meta.json',
      JSON.stringify({ agentType: 'workflow-subagent', description: 'review:git', workflowPhase: 'review', pickedEffortModel: 'claude-sonnet-5' }),
    );
    expect(await subagentMetaOf(file)).toEqual({ agentType: 'workflow-subagent', description: 'review:git', model: 'claude-sonnet-5' });
  });
});
