// Unit tests of ActivityMonitor on workflow subagent files (spec activity/activity-monitor.md), plan-session_activity batch workflow-subagents.
import { appendFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ExternalSessionChange, ExternalSessionSummary } from '../external/external-session-scanner.js';
import { TranscriptReader } from '../external/transcript-reader.js';
import { SessionStateTracker } from '../sessions/session-state-tracker.js';
import { tempDir } from '../test-support.js';
import { ActivityMonitor } from './activity-monitor.js';

type Line = Record<string, unknown>;

let claudeDir: string;
let tracker: SessionStateTracker;
let nextId = 0;
const monitors: ActivityMonitor[] = [];
const scanner = {
  list: (): ExternalSessionSummary[] => [],
  onChange: (_listener: (change: ExternalSessionChange) => void) => () => {},
};

beforeAll(async () => {
  claudeDir = await tempDir('ai-client-activity-monitor-workflow-');
  tracker = new SessionStateTracker();
});

afterAll(async () => {
  await rm(claudeDir, { recursive: true, force: true });
});

afterEach(() => {
  for (const monitor of monitors.splice(0)) monitor.stop();
});

function monitorOf(maxBytesPerPoll?: number): ActivityMonitor {
  const monitor = new ActivityMonitor({ tracker, scanner, reader: new TranscriptReader({ claudeDir }), ...(maxBytesPerPoll !== undefined && { maxBytesPerPoll }) });
  monitors.push(monitor);
  return monitor;
}

const time = (seconds: number) => new Date(Date.parse('2026-11-26T10:00:00.000Z') + seconds * 1000).toISOString();
const userSays = (text: string, timestamp: string, sidechain = false): Line => ({ type: 'user', isSidechain: sidechain, timestamp, origin: { kind: 'human' }, message: { role: 'user', content: text } });
const claudeSays = (text: string, timestamp: string, sidechain = false): Line => ({ type: 'assistant', isSidechain: sidechain, timestamp, message: { role: 'assistant', content: [{ type: 'text', text }] } });
const workflowCall = (id: string, timestamp: string): Line => ({
  type: 'assistant',
  isSidechain: false,
  timestamp,
  message: { role: 'assistant', content: [{ type: 'tool_use', id, name: 'Workflow', input: { workflow: 'review' } }] },
});
const launched = (callId: string, runId: string, taskId: string, timestamp: string): Line => ({
  type: 'user',
  isSidechain: false,
  timestamp,
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: callId, content: `Task ID: ${taskId}\nRun ID: ${runId}` }] },
  toolUseResult: { status: 'async_launched', taskId, runId },
});

async function append(file: string, ...lines: Line[]): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, lines.map((line) => `${JSON.stringify(line)}\n`).join(''));
}

/** A hosted session whose turn launched one workflow run per id of `runIds`, then ended: the session is idle. */
async function idleAfterWorkflows(...runIds: string[]) {
  nextId += 1;
  const id = `hosted-${nextId}`;
  const cwd = `/work/${id}`;
  const claudeSessionId = `sid-${nextId}-${Math.random().toString(36).slice(2, 8)}`;
  const projectDir = path.join(claudeDir, 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));
  const transcript = path.join(projectDir, `${claudeSessionId}.jsonl`);
  const runDir = (runId: string) => path.join(projectDir, claudeSessionId, 'subagents', 'workflows', runId);
  tracker.track({ id, cwd, onExit: () => {} });
  tracker.applyHookEvent(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Review', session_id: claudeSessionId });
  await append(transcript, userSays('Review the batch', time(0)), ...runIds.flatMap((runId, i) => [workflowCall(`wf-${i}`, time(1 + i * 2)), launched(`wf-${i}`, runId, `task-${i}`, time(2 + i * 2))]));
  tracker.applyHookEvent(id, { hook_event_name: 'Stop', session_id: claudeSessionId });
  return {
    id,
    agent: (runId: string, agentId: string) => {
      const file = path.join(runDir(runId), `agent-${agentId}.jsonl`);
      return {
        write: (...lines: Line[]) => append(file, ...lines),
        meta: async (meta: object) => {
          await mkdir(path.dirname(file), { recursive: true });
          await writeFile(file.replace(/\.jsonl$/, '.meta.json'), JSON.stringify(meta));
        },
      };
    },
    journal: (runId: string, ...lines: Line[]) => append(path.join(runDir(runId), 'journal.jsonl'), ...lines),
  };
}

const subagentOf = (monitor: ActivityMonitor, id: string, agentId: string) => monitor.turnOf(id)?.subagents.find((subagent) => subagent.id === agentId);

describe('ActivityMonitor, workflow subagents', () => {
  // plan-session_activity/REQ-56, REQ-60, plan-subagent_panel/REQ-16: the monitor reads every run, its journal and its agent files
  it('reads the journal and the agent files of each run: a finished agent stops counting and leaves the tree, a running one keeps the idle session at work', async () => {
    const session = await idleAfterWorkflows('wf_a', 'wf_b');
    const running = session.agent('wf_a', 'a1');
    await running.meta({ agentType: 'workflow-subagent', description: 'review:git', pickedEffortModel: 'claude-sonnet-5' });
    await running.write(userSays('Review git', time(10), true), claudeSays('Checking the Maven resolution', time(20), true));
    const done = session.agent('wf_b', 'b1');
    await done.meta({ agentType: 'workflow-subagent', description: 'review:docs' });
    await done.write(userSays('Review docs', time(10), true), claudeSays('The docs are fine', time(30), true));
    await session.journal('wf_a', { type: 'launched' }, { type: 'started', agentId: 'a1' });
    await session.journal('wf_b', { type: 'launched' }, { type: 'started', agentId: 'b1' }, { type: 'result', agentId: 'b1' });

    const monitor = monitorOf();
    await monitor.poll();
    expect(monitor.get(session.id)).toMatchObject({ atWork: true, latestText: { text: 'Checking the Maven resolution', subagentType: 'workflow-subagent', at: time(20) } });
    expect(subagentOf(monitor, session.id, 'agent-a1')).toMatchObject({ state: 'running', description: 'review:git', model: 'claude-sonnet-5' });
    expect(subagentOf(monitor, session.id, 'agent-b1')).toBeUndefined();

    await session.journal('wf_a', { type: 'result', agentId: 'a1' });
    await monitor.poll();
    expect(monitor.get(session.id)?.atWork).toBe(false);
    expect(monitor.get(session.id)?.latestText).toBeUndefined();
    expect(subagentOf(monitor, session.id, 'agent-a1')).toBeUndefined();
  });

  // activity-monitor spec: a run is read through the files of workflowSubagentFilesOf
  it('reads the journal of a run only once the run has an agent file', async () => {
    const session = await idleAfterWorkflows('wf_j');
    await session.journal('wf_j', { type: 'launched' }, { type: 'started', agentId: 'j1' });
    const monitor = monitorOf();
    await monitor.poll();
    expect(monitor.turnOf(session.id)?.subagents).toEqual([]);
    expect(monitor.get(session.id)?.atWork).toBe(false);

    await session.agent('wf_j', 'j2').write(userSays('Review tests', time(10), true));
    await monitor.poll();
    expect(monitor.turnOf(session.id)?.subagents.map(({ id, state }) => ({ id, state }))).toEqual([
      { id: 'agent-j1', state: 'running' },
      { id: 'agent-j2', state: 'running' },
    ]);
    expect(monitor.get(session.id)?.atWork).toBe(true);
  });

  // activity-monitor spec: metadata of a workflow subagent read again only after new lines once it has a field
  it('reads the metadata of a workflow agent until it has a field, then again only after new lines of its file', async () => {
    const session = await idleAfterWorkflows('wf_m');
    const agent = session.agent('wf_m', 'm1');
    await agent.write(userSays('Review metadata', time(10), true));
    await session.journal('wf_m', { type: 'started', agentId: 'm1' });
    const monitor = monitorOf();
    await monitor.poll();
    expect(subagentOf(monitor, session.id, 'agent-m1')?.description).toBeUndefined();

    await agent.meta({ agentType: 'workflow-subagent', description: 'review:first' });
    await monitor.poll();
    expect(subagentOf(monitor, session.id, 'agent-m1')?.description, 'metadata with no field is read again').toBe('review:first');

    await agent.meta({ agentType: 'workflow-subagent', description: 'review:second' });
    await monitor.poll();
    expect(subagentOf(monitor, session.id, 'agent-m1')?.description, 'no new line, no new read').toBe('review:first');

    await agent.write(claudeSays('A new step', time(20), true));
    await monitor.poll();
    expect(subagentOf(monitor, session.id, 'agent-m1')?.description, 'read again after a new line').toBe('review:second');
  });

  // activity-monitor spec: maxBytesPerPoll covers the workflow files; a value once every file is read
  it('reads workflow agent files inside the byte limit of one poll, and gives a value only once every file is read to its end', async () => {
    const session = await idleAfterWorkflows('wf_big');
    const agent = session.agent('wf_big', 'big');
    await agent.meta({ agentType: 'workflow-subagent', description: 'review:big' });
    const filler = 'x'.repeat(300);
    await agent.write(userSays('Review the big one', time(10), true), ...Array.from({ length: 60 }, (_, i) => claudeSays(`Step ${i} ${filler}`, time(11 + i), true)), claudeSays('The last step', time(100), true));
    await session.journal('wf_big', { type: 'started', agentId: 'big' });

    const monitor = monitorOf(4096);
    await monitor.poll();
    expect(monitor.get(session.id), 'the first poll stops at the byte limit').toBeUndefined();
    let polls = 1;
    while (monitor.get(session.id) === undefined && polls < 50) {
      await monitor.poll();
      polls += 1;
    }
    expect(polls, 'several polls').toBeGreaterThan(2);
    expect(monitor.get(session.id)).toMatchObject({ atWork: true, latestText: { text: 'The last step', subagentType: 'workflow-subagent' } });
  });
});
