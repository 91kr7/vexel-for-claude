import { describe, expect, it } from 'vitest';
import { stoppedTaskIdOf, subagentStateOf } from './subagent-state.js';

const notification = (body: string, extra: Record<string, unknown> = {}) => ({
  type: 'user',
  isSidechain: false,
  origin: { kind: 'task-notification' },
  promptSource: 'system',
  message: { role: 'user', content: `<task-notification>\n${body}\n</task-notification>` },
  ...extra,
});

describe('subagentStateOf', () => {
  // plan-session_activity/REQ-1: finished in the metadata → finished, whatever else holds
  it('is "finished" when the metadata says finished', () => {
    expect(subagentStateOf({ finished: true, interrupted: false, sessionEnded: false })).toBe('finished');
    expect(subagentStateOf({ finished: true, interrupted: true, sessionEnded: true })).toBe('finished');
  });

  // plan-session_activity/REQ-11: a subagent of an ended session is stopped
  it('is "stopped" when the session ended', () => {
    expect(subagentStateOf({ interrupted: false, sessionEnded: true })).toBe('stopped');
    expect(subagentStateOf({ finished: false, interrupted: false, sessionEnded: true })).toBe('stopped');
  });

  // plan-session_activity/REQ-11: an interrupted subagent is stopped
  it('is "stopped" when an interrupt is recorded for it', () => {
    expect(subagentStateOf({ interrupted: true, sessionEnded: false })).toBe('stopped');
  });

  // plan-session_activity/REQ-1, REQ-3: otherwise the subagent runs
  it('is "running" with no finished, no interrupt and a live session', () => {
    expect(subagentStateOf({ interrupted: false, sessionEnded: false })).toBe('running');
    expect(subagentStateOf({ finished: false, interrupted: false, sessionEnded: false })).toBe('running');
  });
});

describe('stoppedTaskIdOf', () => {
  // subagent-state spec: status killed, stopped or failed gives the task id, trimmed
  it.each(['killed', 'stopped', 'failed'])('gives the task id for status "%s"', (status) => {
    const entry = notification(`<task-id> a1b2c3 </task-id>\n<status>${status}</status>\n<summary>Agent ended</summary>`);
    expect(stoppedTaskIdOf(entry)).toBe('a1b2c3');
  });

  // subagent-state spec: "completed" is no stop notice
  it('gives nothing for status "completed"', () => {
    expect(stoppedTaskIdOf(notification('<task-id>a1b2c3</task-id>\n<status>completed</status>'))).toBeUndefined();
  });

  // subagent-state spec: an empty task id gives nothing
  it('gives nothing for an empty task id', () => {
    expect(stoppedTaskIdOf(notification('<task-id>  </task-id>\n<status>killed</status>'))).toBeUndefined();
    expect(stoppedTaskIdOf(notification('<status>killed</status>'))).toBeUndefined();
  });

  // subagent-state spec: a text that is not a task notification gives nothing
  it('gives nothing for a user message that is not a task notification', () => {
    const entry = { type: 'user', isSidechain: false, message: { role: 'user', content: 'the <task-id>a1</task-id> was <status>killed</status>' } };
    expect(stoppedTaskIdOf(entry)).toBeUndefined();
  });

  // subagent-state spec: a line with no user message (null) gives nothing
  it('gives nothing for a line with no user message', () => {
    expect(stoppedTaskIdOf(notification('<task-id>a1</task-id>\n<status>killed</status>', { isMeta: true }))).toBeUndefined();
    expect(stoppedTaskIdOf({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: '<task-notification>' }] } })).toBeUndefined();
  });
});
