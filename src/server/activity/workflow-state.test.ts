// Unit tests of the workflow run rule (spec activity/workflow-state.md), plan-session_activity batch workflow-subagents.
import { describe, expect, it } from 'vitest';
import { notifiedTaskIdOf, taskStopSucceeded, workflowLaunchOf, workflowSubagentStateOf } from './workflow-state.js';

type Line = Record<string, unknown>;

const facts = (overrides: Partial<Parameters<typeof workflowSubagentStateOf>[0]> = {}) => ({
  result: false,
  launchOver: false,
  startedBeforeLatestLaunch: false,
  sessionEnded: false,
  ...overrides,
});

const resultLine = (toolUseId: string, content: unknown, extra: Line = {}, isError = false): Line => ({
  type: 'user',
  isSidechain: false,
  timestamp: '2026-11-26T10:00:00.000Z',
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseId, content, ...(isError && { is_error: true }) }] },
  ...extra,
});

const LAUNCH_TEXT = [
  'Task ID: task-77',
  'The workflow runs in the background.',
  'You will get a notification when it ends.',
  'Do not poll it.',
  'Use TaskStop to stop it.',
  'Run ID: wf_run-9',
].join('\n');

describe('workflowSubagentStateOf', () => {
  // workflow-state spec: result → "finished" (plan-session_activity/REQ-60)
  it('gives "finished" when the journal has a result, whatever the other facts', () => {
    expect(workflowSubagentStateOf(facts({ result: true }))).toBe('finished');
    expect(workflowSubagentStateOf(facts({ result: true, launchOver: true, startedBeforeLatestLaunch: true, sessionEnded: true }))).toBe('finished');
  });

  // workflow-state spec: launchOver, startedBeforeLatestLaunch or sessionEnded → "stopped" (plan-session_activity/REQ-60)
  it('gives "stopped" with no result when the launch is over, the run was launched again, or the session ended', () => {
    expect(workflowSubagentStateOf(facts({ launchOver: true }))).toBe('stopped');
    expect(workflowSubagentStateOf(facts({ startedBeforeLatestLaunch: true }))).toBe('stopped');
    expect(workflowSubagentStateOf(facts({ sessionEnded: true }))).toBe('stopped');
  });

  // workflow-state spec: anything else → "running" (plan-session_activity/REQ-56)
  it('gives "running" with no result and no end', () => {
    expect(workflowSubagentStateOf(facts())).toBe('running');
  });
});

describe('workflowLaunchOf', () => {
  // workflow-state spec: runId and taskId from toolUseResult
  it('takes the run id and the task id from toolUseResult', () => {
    const line = resultLine('wf-1', 'Launched', { toolUseResult: { status: 'async_launched', runId: 'wf_abc', taskId: 'task-1' } });
    expect(workflowLaunchOf(line, 'wf-1')).toEqual({ runId: 'wf_abc', taskId: 'task-1' });
  });

  // workflow-state spec: else the word after "Run ID: " / "Task ID: " in the whole text
  it('reads "Run ID: " and "Task ID: " in a string result, also past its fifth line', () => {
    expect(workflowLaunchOf(resultLine('wf-1', LAUNCH_TEXT), 'wf-1')).toEqual({ runId: 'wf_run-9', taskId: 'task-77' });
  });

  // workflow-state spec: text = the "text" blocks joined by "\n"
  it('reads the text blocks of an array result, joined by a line break', () => {
    const content = [
      { type: 'text', text: 'Task ID: task-5' },
      { type: 'image', source: {} },
      { type: 'text', text: 'Run ID: wf_blocks' },
    ];
    expect(workflowLaunchOf(resultLine('wf-1', content), 'wf-1')).toEqual({ runId: 'wf_blocks', taskId: 'task-5' });
  });

  // workflow-state spec: toolUseResult ids only when non-empty strings
  it('falls back to the text when toolUseResult has empty or missing ids', () => {
    const line = resultLine('wf-1', LAUNCH_TEXT, { toolUseResult: { status: 'async_launched', runId: '', taskId: '' } });
    expect(workflowLaunchOf(line, 'wf-1')).toEqual({ runId: 'wf_run-9', taskId: 'task-77' });
  });

  // workflow-state spec: no task id → taskId absent
  it('gives the run id with no task id when neither toolUseResult nor the text has one', () => {
    const launch = workflowLaunchOf(resultLine('wf-1', 'Run ID: wf_only'), 'wf-1');
    expect(launch?.runId).toBe('wf_only');
    expect(launch?.taskId).toBeUndefined();
  });

  // workflow-state spec: no runId → undefined
  it('gives nothing with no run id', () => {
    const line = resultLine('wf-1', 'Task ID: task-1', { toolUseResult: { status: 'async_launched', taskId: 'task-1' } });
    expect(workflowLaunchOf(line, 'wf-1')).toBeUndefined();
  });

  // workflow-state spec: is_error true → undefined
  it('gives nothing for an error result', () => {
    const line = resultLine('wf-1', LAUNCH_TEXT, { toolUseResult: { runId: 'wf_abc', taskId: 'task-1' } }, true);
    expect(workflowLaunchOf(line, 'wf-1')).toBeUndefined();
  });

  // workflow-state spec: no tool_result block with that tool_use_id → undefined
  it('gives nothing when the line holds no result of that call', () => {
    expect(workflowLaunchOf(resultLine('other', LAUNCH_TEXT, { toolUseResult: { runId: 'wf_abc' } }), 'wf-1')).toBeUndefined();
    expect(workflowLaunchOf({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Run ID: wf_abc' }] } }, 'wf-1')).toBeUndefined();
    expect(workflowLaunchOf({ type: 'user', message: { role: 'user', content: 'Run ID: wf_abc' } }, 'wf-1')).toBeUndefined();
  });
});

describe('taskStopSucceeded', () => {
  // workflow-state spec: taskStopSucceeded on the result block of the call
  it('is true for the result of that TaskStop call that says "Successfully stopped task"', () => {
    expect(taskStopSucceeded(resultLine('stop-1', 'Successfully stopped task: task-1 (Workflow)'), 'stop-1')).toBe(true);
    expect(taskStopSucceeded(resultLine('stop-1', [{ type: 'text', text: 'Done.' }, { type: 'text', text: 'Successfully stopped task task-1' }]), 'stop-1')).toBe(true);
  });

  // workflow-state spec: taskStopSucceeded is false otherwise
  it('is false for an error result, another text, or the result of another call', () => {
    expect(taskStopSucceeded(resultLine('stop-1', 'Successfully stopped task: task-1', {}, true), 'stop-1')).toBe(false);
    expect(taskStopSucceeded(resultLine('stop-1', 'No task found with id task-1'), 'stop-1')).toBe(false);
    expect(taskStopSucceeded(resultLine('stop-2', 'Successfully stopped task: task-1'), 'stop-1')).toBe(false);
  });
});

describe('notifiedTaskIdOf', () => {
  // workflow-state spec: notifiedTaskIdOf gives the trimmed task id, whatever the status
  it('gives the trimmed task id of a notification, whatever its status', () => {
    for (const status of ['completed', 'stopped', 'killed']) {
      const text = `<task-notification>\n<task-id> task-42 </task-id>\n<tool-use-id>wf-1</tool-use-id>\n<status>${status}</status>\n</task-notification>`;
      expect(notifiedTaskIdOf(text), status).toBe('task-42');
    }
  });

  // workflow-state spec: notifiedTaskIdOf → undefined otherwise
  it('gives nothing for a text that does not start with the notification tag, or has no task id', () => {
    expect(notifiedTaskIdOf('Note: <task-notification><task-id>task-42</task-id></task-notification>')).toBeUndefined();
    expect(notifiedTaskIdOf('<task-notification>\n<status>completed</status>\n</task-notification>')).toBeUndefined();
    expect(notifiedTaskIdOf('<task-notification>\n<task-id></task-id>\n</task-notification>')).toBeUndefined();
  });
});
