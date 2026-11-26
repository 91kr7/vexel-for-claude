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
const claudeSays = (blocks: object[] | string, timestamp?: string, sidechain = false): Line => ({
  type: 'assistant',
  isSidechain: sidechain,
  ...(timestamp !== undefined && { timestamp }),
  message: { role: 'assistant', content: typeof blocks === 'string' ? [{ type: 'text', text: blocks }] : blocks },
});
const subSays = (text: string, timestamp?: string) => claudeSays(text, timestamp, true);
const subToolCall = (timestamp?: string) => claudeSays([{ type: 'tool_use', id: 'x', name: 'Bash', input: { command: 'ls' } }], timestamp, true);
const subUser = (text: string, timestamp?: string) => userSays(text, timestamp, true);
const stopNotice = (taskId: string, status: string, timestamp?: string): Line => ({
  type: 'user',
  isSidechain: false,
  origin: { kind: 'task-notification' },
  promptSource: 'system',
  ...(timestamp !== undefined && { timestamp }),
  message: { role: 'user', content: `<task-notification>\n<task-id>${taskId}</task-id>\n<status>${status}</status>\n</task-notification>` },
});

const viewOf = (model: TurnModel, id: string, sessionEnded = false) => model.subagents(sessionEnded).find((view) => view.id === id);

describe('TurnModel, main conversation', () => {
  // turn-model spec: a new model has no text and no subagent
  it('starts with no text and no subagent', () => {
    const model = new TurnModel();
    expect(model.mainText()).toBeUndefined();
    expect(model.subagents(false)).toEqual([]);
  });

  // plan-session_activity/REQ-2: the latest text of the main conversation, trimmed, markdown kept, with the time of its line
  it('keeps the latest assistant text, trimmed with its markdown, and the timestamp of its line', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Read the config', at(0)), claudeSays('  I am **reading** the `config` files\n', at(1))]);
    expect(model.mainText()).toMatchObject({ text: 'I am **reading** the `config` files', at: at(1) });
  });

  // plan-session_activity/REQ-2: a later text replaces the earlier one, with a higher order
  it('replaces the text with each later one, and the order grows', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Go', at(0)), claudeSays('First', at(1))]);
    const first = model.mainText();
    model.addMainEntries([claudeSays([{ type: 'text', text: 'Second' }, { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } }], at(2))]);
    model.addMainEntries([claudeSays([{ type: 'text', text: 'Third' }, { type: 'text', text: 'Fourth' }], at(3))]);
    const last = model.mainText();
    expect(last?.text).toBe('Fourth');
    expect(last!.order).toBeGreaterThan(first!.order);
  });

  // turn-model spec: "at" only when the timestamp is a string with a valid date
  it('has no time when the line has no timestamp or an invalid one', () => {
    const model = new TurnModel();
    model.addMainEntries([claudeSays('No time')]);
    expect(model.mainText()?.text).toBe('No time');
    expect(model.mainText()?.at).toBeUndefined();
    model.addMainEntries([{ ...claudeSays('Bad time'), timestamp: 'yesterday at noon' }]);
    expect(model.mainText()?.text).toBe('Bad time');
    expect(model.mainText()?.at).toBeUndefined();
    model.addMainEntries([{ ...claudeSays('Number time'), timestamp: 1_764_150_000_000 }]);
    expect(model.mainText()?.at).toBeUndefined();
  });

  // turn-model spec: before the first turn start every text counts
  it('takes a text written before any user message', () => {
    const model = new TurnModel();
    model.addMainEntries([claudeSays('Resumed work', at(0))]);
    expect(model.mainText()?.text).toBe('Resumed work');
  });

  // plan-session_activity/REQ-10: a new turn drops the text of the earlier turn
  it('drops the main text when a new turn starts', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('First task', at(0)), claudeSays('Done with the first task', at(1))]);
    model.addMainEntries([userSays('Second task', at(2))]);
    expect(model.mainText()).toBeUndefined();
    model.addMainEntries([claudeSays('Working on the second task', at(3))]);
    expect(model.mainText()?.text).toBe('Working on the second task');
  });

  // plan-session_activity/REQ-5: thinking is never a text
  it('takes no text from thinking', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Plan it', at(0)), claudeSays([{ type: 'thinking', thinking: 'Let me think about the plan', signature: 's' }], at(1))]);
    expect(model.mainText()).toBeUndefined();
    model.addMainEntries([claudeSays([{ type: 'thinking', thinking: 'More thoughts' }, { type: 'text', text: 'Here is the plan' }], at(2))]);
    expect(model.mainText()?.text).toBe('Here is the plan');
  });

  // plan-session_activity/REQ-10: an interrupt marker and a message added by Claude Code start no turn
  it('keeps the text across an interrupt marker, a task notification and a compaction summary', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Go', at(0)), claudeSays('Still here', at(1))]);
    model.addMainEntries([userSays('[Request interrupted by user]', at(2))]);
    model.addMainEntries([stopNotice('zz', 'completed', at(3))]);
    model.addMainEntries([{ ...userSays('Summary of the earlier conversation', at(4)), isCompactSummary: true }]);
    expect(model.mainText()?.text).toBe('Still here');
  });

  // turn-model spec: entries given in several calls behave as one stream
  it('reads the lines of several calls as one stream', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Go', at(0))]);
    model.addMainEntries([]);
    model.addMainEntries([claudeSays('One', at(1))]);
    expect(model.mainText()?.text).toBe('One');
  });
});

describe('TurnModel, subagents', () => {
  // plan-session_activity/REQ-3: the latest text of a subagent, from the lines of its file (isSidechain)
  it('keeps the latest text of a subagent from its sidechain lines', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Implement it', at(0))]);
    model.addSubagentEntries('agent-a1', [subUser('Implement the batch', at(1)), subSays('Reading the specs', at(2)), subToolCall(at(3))]);
    model.addSubagentEntries('agent-a1', [subSays('Overwriting the whole CommonServiceImpl class', at(4))]);
    const view = viewOf(model, 'agent-a1');
    expect(view).toMatchObject({ id: 'agent-a1', state: 'running', latestText: { text: 'Overwriting the whole CommonServiceImpl class', at: at(4) } });
  });

  // turn-model spec: the user prompt of a subagent is not a text and not an interrupt
  it('takes no text from the prompt the subagent receives', () => {
    const model = new TurnModel();
    model.addSubagentEntries('agent-a1', [subUser('Explore the repository', at(1))]);
    const view = viewOf(model, 'agent-a1');
    expect(view?.latestText).toBeUndefined();
    expect(view?.state).toBe('running');
  });

  // plan-session_activity/REQ-5: thinking of a subagent is never a text
  it('takes no text from the thinking of a subagent', () => {
    const model = new TurnModel();
    model.addSubagentEntries('agent-a1', [claudeSays([{ type: 'thinking', thinking: 'Hmm' }], at(1), true)]);
    expect(viewOf(model, 'agent-a1')?.latestText).toBeUndefined();
  });

  // turn-model spec: the order of a text grows across conversations
  it('gives a subagent text taken after the main text a higher order', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Go', at(0)), claudeSays('Main text', at(1))]);
    model.addSubagentEntries('agent-a1', [subSays('Subagent text', at(1))]);
    expect(viewOf(model, 'agent-a1')!.latestText!.order).toBeGreaterThan(model.mainText()!.order);
    model.addMainEntries([claudeSays('Main again', at(1))]);
    expect(model.mainText()!.order).toBeGreaterThan(viewOf(model, 'agent-a1')!.latestText!.order);
  });

  // turn-model spec: subagents in the order they became known, by their lines or their metadata
  it('lists the subagents in the order they became known', () => {
    const model = new TurnModel();
    model.addSubagentEntries('agent-b', [subSays('B', at(1))]);
    model.setSubagentMeta('agent-a', { agentType: 'Explore' });
    model.addSubagentEntries('agent-c', [subSays('C', at(1))]);
    model.addSubagentEntries('agent-b', [subSays('B again', at(2))]);
    expect(model.subagents(false).map((view) => view.id)).toEqual(['agent-b', 'agent-a', 'agent-c']);
    expect(viewOf(model, 'agent-a')?.latestText).toBeUndefined();
  });

  // turn-model spec: setSubagentMeta replaces the previous metadata
  it('shows the last metadata given', () => {
    const model = new TurnModel();
    model.setSubagentMeta('agent-a1', { agentType: 'sdd-developer', description: 'Implement batch', model: 'claude-opus-5-5' });
    expect(viewOf(model, 'agent-a1')?.meta).toEqual({ agentType: 'sdd-developer', description: 'Implement batch', model: 'claude-opus-5-5' });
    model.setSubagentMeta('agent-a1', { agentType: 'sdd-tester' });
    expect(viewOf(model, 'agent-a1')?.meta).toEqual({ agentType: 'sdd-tester' });
  });

  // plan-session_activity/REQ-1: finished in the metadata → finished
  it('is finished when its metadata says finished', () => {
    const model = new TurnModel();
    model.addSubagentEntries('agent-a1', [subSays('Done', at(1))]);
    expect(viewOf(model, 'agent-a1')?.state).toBe('running');
    model.setSubagentMeta('agent-a1', { agentType: 'Explore', finished: true });
    expect(viewOf(model, 'agent-a1')?.state).toBe('finished');
    expect(viewOf(model, 'agent-a1', true)?.state).toBe('finished');
  });

  // plan-session_activity/REQ-11: the subagents of an ended session are stopped
  it('is stopped when the session ended', () => {
    const model = new TurnModel();
    model.addSubagentEntries('agent-a1', [subSays('Working', at(1))]);
    expect(viewOf(model, 'agent-a1', true)?.state).toBe('stopped');
    expect(viewOf(model, 'agent-a1', false)?.state).toBe('running');
  });

  // plan-session_activity/REQ-11: an interrupt marker in the subagent file stops it; a later assistant line clears it
  it('is stopped by an interrupt marker in its file, and runs again after a later assistant line', () => {
    const model = new TurnModel();
    model.addSubagentEntries('agent-a1', [subSays('Working', at(1)), subUser('[Request interrupted by user for tool use]', at(2))]);
    expect(viewOf(model, 'agent-a1')?.state).toBe('stopped');
    model.addSubagentEntries('agent-a1', [subToolCall(at(3))]);
    expect(viewOf(model, 'agent-a1')?.state).toBe('running');
  });

  // plan-session_activity/REQ-11: a stop notice of the main transcript stops the subagent "agent-<task id>"
  it('is stopped by a stop notice of the main transcript for its task id', () => {
    const model = new TurnModel();
    model.addSubagentEntries('agent-k1', [subSays('Working', at(1))]);
    model.addSubagentEntries('agent-k2', [subSays('Working too', at(1))]);
    model.addMainEntries([stopNotice('k1', 'killed', at(2))]);
    expect(viewOf(model, 'agent-k1')?.state).toBe('stopped');
    expect(viewOf(model, 'agent-k2')?.state).toBe('running');
  });

  // turn-model spec: "completed" is no stop notice
  it('keeps running after a "completed" notification', () => {
    const model = new TurnModel();
    model.addSubagentEntries('agent-k1', [subSays('Working', at(1))]);
    model.addMainEntries([stopNotice('k1', 'completed', at(2))]);
    expect(viewOf(model, 'agent-k1')?.state).toBe('running');
  });

  // turn-model spec: a stop notice does not stop a subagent whose last activity is known to be after it
  it('runs when its last activity is after the stop notice, and is stopped by a later notice', () => {
    const model = new TurnModel();
    model.addSubagentEntries('agent-k1', [subSays('Working', at(1))]);
    model.addMainEntries([stopNotice('k1', 'stopped', at(2))]);
    expect(viewOf(model, 'agent-k1')?.state).toBe('stopped');
    model.addSubagentEntries('agent-k1', [subToolCall(at(3))]);
    expect(viewOf(model, 'agent-k1')?.state, 'activity after the notice').toBe('running');
    model.addMainEntries([stopNotice('k1', 'killed', at(4))]);
    expect(viewOf(model, 'agent-k1')?.state, 'a later notice replaces the earlier one').toBe('stopped');
  });

  // turn-model spec: a last activity with no known time does not clear a stop notice
  it('stays stopped when the activity after the notice has no time', () => {
    const model = new TurnModel();
    model.addSubagentEntries('agent-k1', [subSays('Working', at(1))]);
    model.addMainEntries([stopNotice('k1', 'failed', at(2))]);
    model.addSubagentEntries('agent-k1', [subToolCall()]);
    expect(viewOf(model, 'agent-k1')?.state).toBe('stopped');
  });

  // turn-model spec: a stop notice can come before the subagent lines
  it('stops a subagent whose notice was read before its lines', () => {
    const model = new TurnModel();
    model.addMainEntries([stopNotice('k1', 'killed', at(5))]);
    model.addSubagentEntries('agent-k1', [subSays('Working', at(1))]);
    expect(viewOf(model, 'agent-k1')?.state).toBe('stopped');
  });
});

describe('TurnModel, turns and subagent texts', () => {
  // plan-session_activity/REQ-10: a new turn drops a subagent text written before it
  it('drops a subagent text written before the new turn', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('First', at(0))]);
    model.addSubagentEntries('agent-a1', [subSays('Old subagent text', at(1))]);
    model.addMainEntries([userSays('Second', at(2))]);
    expect(viewOf(model, 'agent-a1')?.latestText).toBeUndefined();
  });

  // turn-model spec: a subagent of an earlier turn that still runs gives the text of the current turn
  it('keeps a subagent text written after the turn start, also when the turn start is read later', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('First', at(0))]);
    model.addSubagentEntries('agent-a1', [subSays('Written after the second turn started', at(5))]);
    model.addMainEntries([userSays('Second', at(4))]);
    expect(viewOf(model, 'agent-a1')?.latestText?.text).toBe('Written after the second turn started');
    model.addSubagentEntries('agent-a1', [subSays('Still running in the second turn', at(6))]);
    expect(viewOf(model, 'agent-a1')?.latestText?.text).toBe('Still running in the second turn');
  });

  // turn-model spec: a subagent line not after the turn start gives no text
  it('takes no subagent text whose line is not after the turn start', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Second', at(4))]);
    model.addSubagentEntries('agent-a1', [subSays('Before the turn', at(3)), subSays('At the turn start', at(4))]);
    expect(viewOf(model, 'agent-a1')?.latestText).toBeUndefined();
    model.addSubagentEntries('agent-a1', [subSays('After the turn', at(4, 1))]);
    expect(viewOf(model, 'agent-a1')?.latestText?.text).toBe('After the turn');
  });

  // turn-model spec: a subagent text with no timestamp counts when read after the turn start, and the next turn drops it
  it('takes a subagent text with no time read after the turn start, and drops it at the next turn', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('First', at(0))]);
    model.addSubagentEntries('agent-a1', [subSays('No time here')]);
    expect(viewOf(model, 'agent-a1')?.latestText).toMatchObject({ text: 'No time here' });
    expect(viewOf(model, 'agent-a1')?.latestText?.at).toBeUndefined();
    model.addMainEntries([userSays('Second', at(9))]);
    expect(viewOf(model, 'agent-a1')?.latestText).toBeUndefined();
  });

  // turn-model spec: a turn start with no known time drops every subagent text
  it('drops the subagent texts at a turn start with no time', () => {
    const model = new TurnModel();
    model.addSubagentEntries('agent-a1', [subSays('Timed text', at(5))]);
    model.addMainEntries([userSays('Second')]);
    expect(viewOf(model, 'agent-a1')?.latestText).toBeUndefined();
    model.addSubagentEntries('agent-a1', [subSays('Next text', at(6))]);
    expect(viewOf(model, 'agent-a1')?.latestText?.text, 'with no turn time, a later line counts').toBe('Next text');
  });

  // plan-session_activity/REQ-14: thousands of steps keep the model working on the latest one
  it('keeps only the latest text after thousands of steps', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Long run', '2026-11-26T00:00:00.000Z')]);
    const start = Date.parse('2026-11-26T00:00:01.000Z');
    for (let step = 0; step < 5_000; step += 1) {
      const time = new Date(start + step * 11_000).toISOString();
      model.addSubagentEntries('agent-big', [subSays(`Step ${step}`, time), subToolCall(time)]);
    }
    expect(viewOf(model, 'agent-big')?.latestText?.text).toBe('Step 4999');
    expect(model.subagents(false)).toHaveLength(1);
  });
});
