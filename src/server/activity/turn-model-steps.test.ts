import { describe, expect, it } from 'vitest';
import { TurnModel } from './turn-model.js';

type Line = Record<string, unknown>;

const at = (minute: number, second = 0) => `2026-11-26T10:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.000Z`;

const userSays = (text: string, timestamp?: string, sidechain = false): Line => ({
  type: 'user',
  isSidechain: sidechain,
  ...(timestamp !== undefined && { timestamp }),
  message: { role: 'user', content: text },
});
const claudeSays = (blocks: object[] | string, timestamp?: string, sidechain = false, model?: string): Line => ({
  type: 'assistant',
  isSidechain: sidechain,
  ...(timestamp !== undefined && { timestamp }),
  message: { role: 'assistant', ...(model !== undefined && { model }), content: typeof blocks === 'string' ? [{ type: 'text', text: blocks }] : blocks },
});
const toolUse = (id: string | undefined, name: string, input?: unknown) => ({ type: 'tool_use', ...(id !== undefined && { id }), name, ...(input !== undefined && { input }) });
const toolCall = (id: string | undefined, name: string, input?: unknown, timestamp?: string, sidechain = false) => claudeSays([toolUse(id, name, input)], timestamp, sidechain);
const toolResult = (id: string, timestamp?: string, sidechain = false, isError = false): Line => ({
  type: 'user',
  isSidechain: sidechain,
  ...(timestamp !== undefined && { timestamp }),
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok', ...(isError && { is_error: true }) }] },
});
const taskNotification = (timestamp?: string): Line => ({
  type: 'user',
  isSidechain: false,
  origin: { kind: 'task-notification' },
  promptSource: 'system',
  ...(timestamp !== undefined && { timestamp }),
  message: { role: 'user', content: '<task-notification>\n<task-id>bash-1</task-id>\n<status>completed</status>\n</task-notification>' },
});
const subSays = (text: string, timestamp?: string, model?: string) => claudeSays(text, timestamp, true, model);
const subCall = (id: string, name: string, input?: unknown, timestamp?: string) => toolCall(id, name, input, timestamp, true);
const agentInput = (description: string) => ({ description, prompt: 'Do it', subagent_type: 'sdd-developer' });

const viewOf = (model: TurnModel, id: string, sessionEnded = false) => model.subagents(sessionEnded).find((view) => view.id === id);
const long = (length: number) => Array.from({ length }, (_, i) => String.fromCharCode(97 + (i % 26))).join('');

describe('TurnModel, steps of the main conversation', () => {
  // turn-model spec: a new model has no turn and no step
  it('starts with turn number 0 and no step', () => {
    const model = new TurnModel();
    expect(model.turnNumber()).toBe(0);
    expect(model.steps()).toEqual([]);
  });

  // plan-session_activity/REQ-29: texts and tool calls in file order; a text is plain, a tool call has its name and main argument
  it('lists the texts as plain text and the tool calls with name and first line of the main argument, in file order', () => {
    const model = new TurnModel();
    model.addMainEntries([
      userSays('Check the repo', at(0)),
      claudeSays('I am **reading** the `config` files', at(1)),
      claudeSays([toolUse('t1', 'Bash', { command: '  git status\ngit log' })], at(2)),
      claudeSays([{ type: 'text', text: 'Then' }, toolUse('t2', 'Read', { file_path: '/src/a.ts' })], at(3)),
    ]);
    expect(model.turnNumber()).toBe(1);
    expect(model.steps()).toEqual([
      { kind: 'text', text: 'I am reading the config files' },
      { kind: 'tool', name: 'Bash', argument: 'git status', outcome: 'running' },
      { kind: 'text', text: 'Then' },
      { kind: 'tool', name: 'Read', argument: '/src/a.ts', outcome: 'running' },
    ]);
  });

  // plan-session_activity/REQ-29, REQ-45: a text and an argument are cut at 400 characters with "…"
  it('cuts a text and a tool argument at 400 characters with an ellipsis', () => {
    const model = new TurnModel();
    const text = long(1_000);
    model.addMainEntries([userSays('Go', at(0)), claudeSays(text, at(1)), toolCall('t1', 'Bash', { command: text }, at(2))]);
    const [textStep, toolStep] = model.steps();
    expect(textStep).toEqual({ kind: 'text', text: `${text.slice(0, 399)}…` });
    expect(toolStep).toEqual({ kind: 'tool', name: 'Bash', argument: `${text.slice(0, 399)}…`, outcome: 'running' });
  });

  // plan-session_activity/REQ-5, REQ-44: an empty text, thinking and user lines give no step; a missing name or argument leaves only that field out
  it('gives no step for an empty text, thinking or a user line, and leaves out a missing name or argument', () => {
    const model = new TurnModel();
    model.addMainEntries([
      userSays('Go', at(0)),
      claudeSays([{ type: 'text', text: '   ' }], at(1)),
      claudeSays([{ type: 'thinking', thinking: 'Let me think', signature: 'sig' }], at(2)),
      taskNotification(at(3)),
      toolCall('t1', 'TodoWrite', undefined, at(4)),
      toolCall('t3', '', { command: 'pwd' }, at(6)),
    ]);
    expect(model.steps()).toEqual([
      { kind: 'tool', name: 'TodoWrite', outcome: 'running' },
      { kind: 'tool', argument: 'pwd', outcome: 'running' },
    ]);
  });

  // plan-session_activity/REQ-29, REQ-44: a call with no id has no outcome, and keeps its name and main argument
  it('keeps the name and the argument of a call with no id, with no outcome', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Go', at(0)), toolCall(undefined, 'Bash', { command: 'ls' }, at(1))]);
    expect(model.steps()).toEqual([{ kind: 'tool', name: 'Bash', argument: 'ls' }]);
  });

  // plan-session_activity/REQ-30: a call runs until its result; then it is completed, or an error when the result is one
  it('marks a call completed on its result, and error on an error result', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Go', at(0)), toolCall('ok', 'Bash', { command: 'git status' }, at(1)), toolCall('bad', 'Bash', { command: 'false' }, at(2))]);
    expect(model.steps().map((step) => step.kind === 'tool' && step.outcome)).toEqual(['running', 'running']);
    model.addMainEntries([toolResult('ok', at(3)), toolResult('bad', at(4), false, true)]);
    expect(model.steps().map((step) => step.kind === 'tool' && step.outcome)).toEqual(['completed', 'error']);
  });

  // plan-session_activity/REQ-28, REQ-30: a new turn drops the steps; a late result of an earlier call changes no step
  it('drops the steps at a new turn, and a result of a call of the earlier turn changes no step', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('First', at(0)), toolCall('old', 'Bash', { command: 'sleep 9' }, at(1))]);
    model.addMainEntries([userSays('Second', at(2)), toolCall('new', 'Bash', { command: 'ls' }, at(3))]);
    expect(model.turnNumber()).toBe(2);
    model.addMainEntries([toolResult('old', at(4))]);
    expect(model.steps()).toEqual([{ kind: 'tool', name: 'Bash', argument: 'ls', outcome: 'running' }]);
  });

  // plan-session_activity/REQ-28: an interrupt marker and a message added by Claude Code start no turn
  it('keeps the steps on an interrupt marker or a task notification', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Go', at(0)), claudeSays('Working', at(1))]);
    model.addMainEntries([userSays('[Request interrupted by user]', at(2)), taskNotification(at(3))]);
    expect(model.turnNumber()).toBe(1);
    expect(model.steps()).toEqual([{ kind: 'text', text: 'Working' }]);
  });

  // turn-model spec: a new array at each call; an unchanged step stays the same object, a changed one is a new object
  it('gives a new array each time, the same object for an unchanged step and a new one for a changed step', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Go', at(0)), claudeSays('Text', at(1)), toolCall('t1', 'Bash', { command: 'ls' }, at(2))]);
    const before = model.steps();
    model.addMainEntries([toolResult('t1', at(3)), claudeSays('More', at(4))]);
    const after = model.steps();
    expect(after).not.toBe(before);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    expect(after[1]).toMatchObject({ outcome: 'completed' });
    expect(before[1]).toMatchObject({ outcome: 'running' });
    expect(after).toHaveLength(3);
  });
});

describe('TurnModel, subagent fields', () => {
  // plan-session_activity/REQ-34: start time = first valid timestamp, last line time = latest valid timestamp
  it('takes the start from the first line with a valid timestamp and the end from the latest one', () => {
    const model = new TurnModel();
    model.addSubagentEntries('agent-a', [subSays('No time'), { ...subSays('Bad time'), timestamp: 'noon' }, userSays('Task', at(1), true), subSays('Work', at(5))]);
    model.addSubagentEntries('agent-a', [subSays('Earlier line', at(3)), subSays('Untimed')]);
    expect(viewOf(model, 'agent-a')).toMatchObject({ startedAt: at(1), lastLineAt: at(5) });
  });

  // plan-session_activity/REQ-32: the response model is that of the latest assistant line with a valid model
  it('takes the response model from the latest assistant line with a valid model', () => {
    const model = new TurnModel();
    model.addSubagentEntries('agent-a', [subSays('One', at(1), 'claude-sonnet-5'), subSays('Two', at(2), 'claude-opus-5-5')]);
    expect(viewOf(model, 'agent-a')?.responseModel).toBe('claude-opus-5-5');
    model.addSubagentEntries('agent-a', [subSays('Three', at(3), '<synthetic>'), subSays('Four', at(4), ''), subSays('Five', at(5))]);
    expect(viewOf(model, 'agent-a')?.responseModel).toBe('claude-opus-5-5');
  });

  // plan-session_activity/REQ-44: no assistant line with a model → no response model
  it('has no response model when no line has one', () => {
    const model = new TurnModel();
    model.addSubagentEntries('agent-a', [subSays('One', at(1)), subSays('Two', at(2), '<synthetic>')]);
    expect(viewOf(model, 'agent-a')?.responseModel).toBeUndefined();
  });

  // plan-session_activity/REQ-35, REQ-39: the last text of the whole run stays after a new turn, the turn text does not
  it('keeps the last text of the run across turns, apart from the text of the current turn', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('First', at(0))]);
    model.addSubagentEntries('agent-a', [subSays('Old **work**', at(1))]);
    model.addMainEntries([userSays('Second', at(2))]);
    const view = viewOf(model, 'agent-a');
    expect(view?.lastText?.text).toBe('Old **work**');
    expect(view?.latestText).toBeUndefined();
  });

  // plan-session_activity/REQ-36: a running subagent has its open calls; a finished one has none
  it('gives the open calls of a running subagent in start order, and none once it finished', () => {
    const model = new TurnModel();
    model.addSubagentEntries('agent-a', [subCall('c1', 'Bash', { command: 'npm test' }, at(1)), subCall('c2', 'Read', { file_path: '/a' }, at(2))]);
    expect(viewOf(model, 'agent-a')?.openCalls.map((call) => call.id)).toEqual(['c1', 'c2']);
    model.addSubagentEntries('agent-a', [toolResult('c1', at(3), true)]);
    expect(viewOf(model, 'agent-a')?.openCalls.map((call) => call.id)).toEqual(['c2']);
    model.setSubagentMeta('agent-a', { finished: true });
    expect(viewOf(model, 'agent-a')?.openCalls).toEqual([]);
  });

  // plan-session_activity/REQ-39: a new turn keeps the subagents known before it
  it('keeps the subagents of earlier turns', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('First', at(0))]);
    model.addSubagentEntries('agent-a', [subSays('Working', at(1))]);
    model.setSubagentMeta('agent-b', { agentType: 'Explore' });
    model.addMainEntries([userSays('Second', at(2))]);
    expect(model.subagents(false).map((view) => view.id)).toEqual(['agent-a', 'agent-b']);
  });
});

describe('TurnModel, starting step of a subagent', () => {
  // plan-session_activity/REQ-31: a subagent links to the step of the main call that started it
  it('links a subagent to the index of its starting call among the steps of the turn', () => {
    const model = new TurnModel();
    model.addMainEntries([
      userSays('Go', at(0)),
      claudeSays('Starting two developers', at(1)),
      claudeSays([toolUse('a1', 'Agent', agentInput('First')), toolUse('a2', 'Agent', agentInput('Second'))], at(2)),
    ]);
    model.setSubagentMeta('agent-x', { toolUseId: 'a2' });
    model.setSubagentMeta('agent-y', { toolUseId: 'a1' });
    expect(viewOf(model, 'agent-x')?.startedBy).toEqual({ step: 2 });
    expect(viewOf(model, 'agent-y')?.startedBy).toEqual({ step: 1 });
  });

  // plan-session_activity/REQ-31: the link holds when the metadata is known before the call reaches the model
  it('links a subagent whose metadata came before its starting call', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Go', at(0)), claudeSays('First a text', at(1))]);
    model.setSubagentMeta('agent-x', { toolUseId: 'a1' });
    model.addMainEntries([toolCall('a1', 'Agent', agentInput('Task'), at(2))]);
    expect(viewOf(model, 'agent-x')?.startedBy).toEqual({ step: 1 });
  });

  // plan-session_activity/REQ-31, REQ-39, REQ-44: no tool use id, an unknown one, or a call of an earlier turn → no starting step
  it('has no starting step with no tool use id, an unknown one, or a call of an earlier turn', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('First', at(0)), toolCall('old', 'Agent', agentInput('Background'), at(1))]);
    model.setSubagentMeta('agent-old', { toolUseId: 'old' });
    model.setSubagentMeta('agent-none', { agentType: 'Explore' });
    model.setSubagentMeta('agent-unknown', { toolUseId: 'nowhere' });
    expect(viewOf(model, 'agent-old')?.startedBy).toEqual({ step: 0 });
    model.addMainEntries([userSays('Second', at(2)), toolCall('new', 'Bash', { command: 'ls' }, at(3))]);
    expect(viewOf(model, 'agent-old')?.startedBy).toBeUndefined();
    expect(viewOf(model, 'agent-none')?.startedBy).toBeUndefined();
    expect(viewOf(model, 'agent-unknown')?.startedBy).toBeUndefined();
  });

  // plan-session_activity/REQ-38: a subagent started by another one links to the position of the call among the parent's steps
  it('links a nested subagent to its parent and the position of the call among the parent steps', () => {
    const model = new TurnModel();
    model.addSubagentEntries('agent-p', [userSays('Task', at(1), true), subSays('Planning', at(2)), subCall('n1', 'Bash', { command: 'ls' }, at(3)), subCall('n2', 'Agent', agentInput('Child'), at(4))]);
    model.setSubagentMeta('agent-c', { toolUseId: 'n2' });
    expect(viewOf(model, 'agent-c')?.startedBy).toEqual({ parent: 'agent-p', step: 2 });
  });

  // plan-session_activity/REQ-38: the nested link is found when the metadata came before the parent's call, and it stays
  it('links a nested subagent whose metadata came before the call of its parent, and keeps the link', () => {
    const model = new TurnModel();
    model.setSubagentMeta('agent-c', { toolUseId: 'n1' });
    model.addSubagentEntries('agent-p', [subSays('Planning', at(1)), subCall('n1', 'Agent', agentInput('Child'), at(2))]);
    expect(viewOf(model, 'agent-c')?.startedBy).toEqual({ parent: 'agent-p', step: 1 });
    model.addSubagentEntries('agent-p', Array.from({ length: 2_100 }, (_, i) => subCall(`later-${i}`, 'Bash', { command: 'ls' }, at(3))));
    model.addMainEntries([userSays('Next turn', at(4))]);
    expect(viewOf(model, 'agent-c')?.startedBy).toEqual({ parent: 'agent-p', step: 1 });
  });

  // turn-model spec: a call of a subagent is remembered among the latest 2,000 such calls of the session
  it('remembers only the latest 2,000 calls of subagents for a child metadata that comes later', () => {
    const model = new TurnModel();
    model.addSubagentEntries('agent-p', [claudeSays(Array.from({ length: 2_001 }, (_, i) => toolUse(`c${i}`, 'Agent', agentInput(`Child ${i}`))), at(1), true)]);
    model.setSubagentMeta('agent-dropped', { toolUseId: 'c0' });
    model.setSubagentMeta('agent-kept', { toolUseId: 'c1' });
    expect(viewOf(model, 'agent-dropped')?.startedBy).toBeUndefined();
    expect(viewOf(model, 'agent-kept')?.startedBy).toEqual({ parent: 'agent-p', step: 1 });
  });
});
