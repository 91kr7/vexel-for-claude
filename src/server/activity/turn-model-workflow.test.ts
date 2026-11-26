// Unit tests of the workflow subagents of TurnModel (spec activity/turn-model.md), plan-session_activity batch workflow-subagents.
import { describe, expect, it } from 'vitest';
import { TurnModel } from './turn-model.js';

type Line = Record<string, unknown>;

const time = (seconds: number) => new Date(Date.parse('2026-11-26T10:00:00.000Z') + seconds * 1000).toISOString();
const userSays = (text: string, timestamp: string, sidechain = false): Line => ({
  type: 'user',
  isSidechain: sidechain,
  timestamp,
  origin: { kind: 'human' },
  message: { role: 'user', content: text },
});
const claudeSays = (text: string, timestamp: string, sidechain = false): Line => ({
  type: 'assistant',
  isSidechain: sidechain,
  timestamp,
  message: { role: 'assistant', content: [{ type: 'text', text }] },
});
const toolCall = (id: string, name: string, input: object, timestamp: string, sidechain = false): Line => ({
  type: 'assistant',
  isSidechain: sidechain,
  timestamp,
  message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] },
});
const toolResult = (id: string, content: unknown, timestamp: string, options: { sidechain?: boolean; isError?: boolean; extra?: Line } = {}): Line => ({
  type: 'user',
  isSidechain: options.sidechain ?? false,
  timestamp,
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content, ...(options.isError && { is_error: true }) }] },
  ...options.extra,
});

const workflowCall = (id: string, timestamp: string, sidechain = false) => toolCall(id, 'Workflow', { workflow: 'review', input: 'the batch' }, timestamp, sidechain);
const launchText = (taskId: string, runId: string) =>
  [`Task ID: ${taskId}`, 'The workflow runs in the background.', 'A notification comes when it ends.', 'Do not poll it.', 'TaskStop stops it.', `Run ID: ${runId}`].join('\n');
/** The result line of a Workflow call, as Claude Code writes it: `toolUseResult` and the same ids in the text. */
const launched = (callId: string, runId: string, taskId: string, timestamp: string, sidechain = false) =>
  toolResult(callId, launchText(taskId, runId), timestamp, { sidechain, extra: { toolUseResult: { status: 'async_launched', taskId, runId } } });
const notification = (taskId: string, status: string, timestamp: string, sidechain = false): Line => ({
  type: 'user',
  isSidechain: sidechain,
  timestamp,
  origin: { kind: 'task-notification' },
  promptSource: 'system',
  message: {
    role: 'user',
    content: `<task-notification>\n<task-id>${taskId}</task-id>\n<tool-use-id>wf-call</tool-use-id>\n<status>${status}</status>\n<summary>Workflow ${status}</summary>\n</task-notification>`,
  },
});
const started = (agentId: string) => ({ type: 'started', agentId, label: `review:${agentId}`, phase: 'review' });
const finished = (agentId: string) => ({ type: 'result', agentId, label: `review:${agentId}`, phase: 'review' });
const META = { agentType: 'workflow-subagent', description: 'review:git', model: 'claude-sonnet-5' };

const viewOf = (model: TurnModel, id: string, sessionEnded = false) => model.subagents(sessionEnded).find((view) => view.id === id);
const stateOf = (model: TurnModel, id: string, sessionEnded = false) => viewOf(model, id, sessionEnded)?.state;

/** A turn whose step 1 is the Workflow call `wf-call` that launched run `wf_r1` as task `task-1`. */
function launchedTurn(): TurnModel {
  const model = new TurnModel();
  model.addMainEntries([
    userSays('Review the batch', time(0)),
    claudeSays('I launch the review workflow', time(1)),
    workflowCall('wf-call', time(2)),
    launched('wf-call', 'wf_r1', 'task-1', time(4)),
  ]);
  return model;
}

/** Adds the lines of workflow subagent `agent-<agentId>` of run `runId`, first at `firstSecond`, with its metadata. */
function addAgent(model: TurnModel, agentId: string, firstSecond: number, runId = 'wf_r1', ...more: Line[]): void {
  model.addSubagentEntries(`agent-${agentId}`, [userSays(`Task of ${agentId}`, time(firstSecond), true), claudeSays(`Working on ${agentId}`, time(firstSecond + 1), true), ...more], runId);
  model.setSubagentMeta(`agent-${agentId}`, { ...META, description: `review:${agentId}` });
}

describe('TurnModel, workflow subagent state', () => {
  // plan-session_activity/REQ-56: a workflow subagent under a launch that is not over runs
  it('runs while its launch is not over and it has no result, and keeps its metadata and text', () => {
    const model = launchedTurn();
    model.addWorkflowEntries('wf_r1', [{ type: 'launched' }, started('w1')]);
    addAgent(model, 'w1', 5);

    const view = viewOf(model, 'agent-w1');
    expect(view?.state).toBe('running');
    expect(view?.meta).toEqual({ ...META, description: 'review:w1' });
    expect(view?.latestText?.text).toBe('Working on w1');
    expect(view?.startedAt).toBe(time(5));
  });

  // plan-session_activity/REQ-60: a result event → finished
  it('is finished once the run journal has its result, also after its launch ended and when the session ended', () => {
    const model = launchedTurn();
    addAgent(model, 'w1', 5);
    model.addWorkflowEntries('wf_r1', [{ type: 'launched' }, started('w1'), finished('w1')]);
    model.addMainEntries([notification('task-1', 'completed', time(30))]);

    expect(stateOf(model, 'agent-w1')).toBe('finished');
    expect(stateOf(model, 'agent-w1', true)).toBe('finished');
  });

  // plan-session_activity/REQ-60: a task notification of its task id ends the launch
  it('is stopped with no result once a task notification of its task id comes, whatever its status', () => {
    for (const status of ['completed', 'stopped', 'killed']) {
      const model = launchedTurn();
      addAgent(model, 'w1', 5);
      addAgent(model, 'w2', 5);
      model.addWorkflowEntries('wf_r1', [started('w1'), started('w2'), finished('w2')]);
      model.addMainEntries([notification('task-other', status, time(20))]);
      expect(stateOf(model, 'agent-w1'), `${status}, another task`).toBe('running');

      model.addMainEntries([notification('task-1', status, time(30))]);
      expect(stateOf(model, 'agent-w1'), status).toBe('stopped');
      expect(stateOf(model, 'agent-w2'), status).toBe('finished');
    }
  });

  // plan-session_activity/REQ-60: a successful TaskStop of its task id ends the launch
  it('is stopped once a TaskStop call of its task id succeeds, and keeps running after a failed one or a stop of another task', () => {
    const model = launchedTurn();
    addAgent(model, 'w1', 5);
    model.addMainEntries([
      toolCall('stop-other', 'TaskStop', { task_id: 'task-other' }, time(10)),
      toolResult('stop-other', 'Successfully stopped task: task-other', time(11)),
      toolCall('stop-failed', 'TaskStop', { task_id: 'task-1' }, time(12)),
      toolResult('stop-failed', 'Successfully stopped task: task-1', time(13), { isError: true }),
      toolCall('stop-refused', 'TaskStop', { task_id: 'task-1' }, time(14)),
      toolResult('stop-refused', 'Task task-1 is not running', time(15)),
    ]);
    expect(stateOf(model, 'agent-w1')).toBe('running');

    model.addMainEntries([toolCall('stop-1', 'TaskStop', { task_id: 'task-1' }, time(20))]);
    expect(stateOf(model, 'agent-w1'), 'the stop has no result yet').toBe('running');
    model.addMainEntries([toolResult('stop-1', [{ type: 'text', text: 'Successfully stopped task: task-1 (Workflow)' }], time(21))]);
    expect(stateOf(model, 'agent-w1')).toBe('stopped');
  });

  // plan-session_activity/REQ-60: session ended → stopped
  it('is stopped with no result when its session has ended', () => {
    const model = launchedTurn();
    addAgent(model, 'w1', 5);
    expect(stateOf(model, 'agent-w1', true)).toBe('stopped');
  });

  // turn-model spec: the interrupt mark and meta.finished do not change a workflow subagent's state
  it('keeps its state whatever its interrupt marker or a finished mark in its metadata say', () => {
    const model = launchedTurn();
    addAgent(model, 'w1', 5, 'wf_r1', userSays('[Request interrupted by user]', time(8), true));
    model.setSubagentMeta('agent-w1', { ...META, finished: true });
    expect(stateOf(model, 'agent-w1')).toBe('running');
  });

  // plan-session_activity/REQ-58, REQ-60: after a resume each agent keeps its own launch
  it('after a resume of its run, an agent of the earlier launch is stopped and one of the new launch runs, each at its own Workflow step', () => {
    const model = launchedTurn();
    addAgent(model, 'old', 5);
    model.addMainEntries([claudeSays('I resume the workflow', time(19)), workflowCall('wf-again', time(20)), launched('wf-again', 'wf_r1', 'task-2', time(22))]);
    addAgent(model, 'new', 21);

    const steps = model.steps();
    const firstCall = steps.findIndex((step) => step.kind === 'tool' && step.name === 'Workflow');
    const secondCall = steps.findLastIndex((step) => step.kind === 'tool' && step.name === 'Workflow');
    expect(secondCall).toBeGreaterThan(firstCall);
    expect(viewOf(model, 'agent-old')).toMatchObject({ state: 'stopped', startedBy: { step: firstCall } });
    expect(viewOf(model, 'agent-new')).toMatchObject({ state: 'running', startedBy: { step: secondCall } });
    expect(viewOf(model, 'agent-new')?.startedBy?.parent).toBeUndefined();
  });
});

describe('TurnModel, workflow launches', () => {
  // plan-session_activity/REQ-58: launch time = time of the Workflow call line
  it('places the agents of a launch at the step of its Workflow call, also an agent whose first line comes before the result line', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Review the batch', time(0)), claudeSays('I launch the review workflow', time(1)), workflowCall('wf-call', time(2))]);
    addAgent(model, 'early', 3);
    model.addMainEntries([launched('wf-call', 'wf_r1', 'task-1', time(6))]);
    addAgent(model, 'late', 7);

    for (const id of ['agent-early', 'agent-late']) expect(viewOf(model, id), id).toMatchObject({ state: 'running', startedBy: { step: 1 } });
    model.addMainEntries([notification('task-1', 'killed', time(30))]);
    expect(stateOf(model, 'agent-early'), 'the early agent belongs to the launch that ended').toBe('stopped');
  });

  // turn-model spec: workflowLaunchOf gives the launch of a Workflow call result
  it('reads the run id and the task id in the result text when the line has no toolUseResult', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Review', time(0)), workflowCall('wf-call', time(1)), toolResult('wf-call', [{ type: 'text', text: launchText('task-9', 'wf_text') }], time(2))]);
    addAgent(model, 'w1', 3, 'wf_text');
    expect(viewOf(model, 'agent-w1')).toMatchObject({ state: 'running', startedBy: { step: 0 } });

    model.addMainEntries([notification('task-9', 'completed', time(20))]);
    expect(stateOf(model, 'agent-w1')).toBe('stopped');
  });

  // turn-model spec: no run id from workflowLaunchOf → no launch
  it('launches nothing for a Workflow call whose result is an error', () => {
    const model = new TurnModel();
    model.addMainEntries([
      userSays('Review', time(0)),
      workflowCall('wf-call', time(1)),
      toolResult('wf-call', launchText('task-1', 'wf_r1'), time(2), { isError: true, extra: { toolUseResult: { runId: 'wf_r1', taskId: 'task-1' } } }),
      notification('task-1', 'killed', time(3)),
    ]);
    addAgent(model, 'w1', 4);
    expect(viewOf(model, 'agent-w1')?.startedBy).toBeUndefined();
    expect(stateOf(model, 'agent-w1')).toBe('running');
  });

  // turn-model spec: a launch in a subagent file has a position { parent, step }
  it('places the agents of a Workflow call of a subagent at the step of that subagent, and a notification in a subagent file ends the launch', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Review', time(0)), toolCall('agent-call', 'Agent', { description: 'Lead the review', subagent_type: 'lead' }, time(1))]);
    model.addSubagentEntries('agent-lead', [
      userSays('Lead the review', time(2), true),
      claudeSays('I start the workflow', time(3), true),
      workflowCall('wf-sub', time(4), true),
      launched('wf-sub', 'wf_sub', 'task-s', time(5), true),
    ]);
    model.setSubagentMeta('agent-lead', { agentType: 'lead', toolUseId: 'agent-call' });
    addAgent(model, 'child', 6, 'wf_sub');
    expect(viewOf(model, 'agent-child')).toMatchObject({ state: 'running', startedBy: { parent: 'agent-lead', step: 1 } });

    model.addSubagentEntries('agent-lead', [notification('task-s', 'completed', time(20), true)]);
    expect(stateOf(model, 'agent-child')).toBe('stopped');
  });

  // turn-model spec: launches are kept across turns; a call of an earlier turn → no startedBy
  it('keeps launches across turns: an agent of a launch of an earlier turn has no starting step, and the end of that launch stops it', () => {
    const model = launchedTurn();
    model.addMainEntries([userSays('Something else meanwhile', time(10))]);
    addAgent(model, 'w1', 11);
    expect(model.turnNumber()).toBe(2);
    expect(viewOf(model, 'agent-w1')?.startedBy).toBeUndefined();
    expect(stateOf(model, 'agent-w1')).toBe('running');

    model.addMainEntries([notification('task-1', 'completed', time(20))]);
    expect(model.turnNumber(), 'a notification starts no turn').toBe(2);
    expect(stateOf(model, 'agent-w1')).toBe('stopped');
  });
});

describe('TurnModel, run journal', () => {
  // turn-model spec: run journal lines
  it('knows an agent from its started or result event, and from nothing else', () => {
    const model = launchedTurn();
    model.addWorkflowEntries('wf_r1', [
      { type: 'launched' },
      { type: 'started' },
      { type: 'started', agentId: '' },
      { type: 'progress', agentId: 'p1' },
      started('j1'),
      finished('j2'),
    ]);
    expect(model.subagents(false).map(({ id, state }) => ({ id, state }))).toEqual([
      { id: 'agent-j1', state: 'running' },
      { id: 'agent-j2', state: 'finished' },
    ]);
  });

  // plan-session_activity/REQ-58: an agent with no line yet sits at the latest launch of its run
  it('places an agent known only from its journal at the step of the latest launch of its run', () => {
    const model = launchedTurn();
    model.addWorkflowEntries('wf_r1', [started('j1')]);
    expect(viewOf(model, 'agent-j1')?.startedBy).toEqual({ step: 1 });
  });
});

describe('TurnModel, activity of a workflow subagent', () => {
  // plan-session_activity/REQ-57: activity and running tools of a workflow subagent
  it('counts its lines as activity and its open calls with its type, until it is stopped', () => {
    const model = launchedTurn();
    addAgent(model, 'w1', 5, 'wf_r1', toolCall('mvn', 'Bash', { command: 'mvn test' }, time(40), true));
    expect(model.lastEventAt()).toBe(time(40));
    expect(model.openCalls(false)).toMatchObject([{ id: 'mvn', name: 'Bash', input: { command: 'mvn test' }, subagentType: 'workflow-subagent' }]);

    model.addMainEntries([notification('task-1', 'killed', time(30))]);
    expect(model.openCalls(false)).toEqual([]);
  });
});
