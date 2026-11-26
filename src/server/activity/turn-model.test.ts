import { afterEach, describe, expect, it, vi } from 'vitest';
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
const toolCall = (id: string | undefined, name: string, input: unknown, timestamp?: string, sidechain = false) =>
  claudeSays([{ type: 'tool_use', ...(id !== undefined && { id }), name, ...(input !== undefined && { input }) }], timestamp, sidechain);
const toolResult = (id: string, timestamp?: string, sidechain = false): Line => ({
  type: 'user',
  isSidechain: sidechain,
  ...(timestamp !== undefined && { timestamp }),
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] },
});
const callIds = (model: TurnModel, sessionEnded = false) => model.openCalls(sessionEnded).map((call) => call.id);

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

describe('TurnModel, last activity', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // turn-model spec: a new model has no activity and no open call
  it('starts with no activity time and no open call', () => {
    const model = new TurnModel();
    expect(model.lastEventAt()).toBeUndefined();
    expect(model.openCalls(false)).toEqual([]);
  });

  // plan-session_activity/REQ-17: a message, a tool call or a tool result, of the main conversation or of a subagent, is activity
  it('takes the time of each user and assistant line, main and subagent', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Go', at(0))]);
    expect(model.lastEventAt()).toBe(at(0));
    model.addMainEntries([toolCall('t1', 'Agent', { description: 'Run the tests' }, at(1))]);
    expect(model.lastEventAt(), 'main tool call').toBe(at(1));
    model.addSubagentEntries('agent-a1', [subSays('Starting', at(2))]);
    expect(model.lastEventAt(), 'subagent message').toBe(at(2));
    model.addSubagentEntries('agent-a1', [toolCall('s1', 'Bash', { command: 'mvn test' }, at(3), true)]);
    expect(model.lastEventAt(), 'subagent tool call').toBe(at(3));
    model.addSubagentEntries('agent-a1', [toolResult('s1', at(4), true)]);
    expect(model.lastEventAt(), 'subagent tool result').toBe(at(4));
    model.addMainEntries([toolResult('t1', at(5))]);
    expect(model.lastEventAt(), 'main tool result').toBe(at(5));
  });

  // batch-stall-signal decision "What counts as activity": a thinking block is an assistant line
  it('counts a thinking line as activity', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Plan it', at(0)), claudeSays([{ type: 'thinking', thinking: 'Hmm', signature: 's' }], at(1))]);
    expect(model.lastEventAt()).toBe(at(1));
    model.addSubagentEntries('agent-a1', [claudeSays([{ type: 'thinking', thinking: 'Hmm' }], at(2), true)]);
    expect(model.lastEventAt()).toBe(at(2));
  });

  // batch-stall-signal decision "What counts as activity": lines of other types are no activity
  it('takes no time from lines of other types', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Go', at(1))]);
    const others: Line[] = [
      { type: 'summary', summary: 'Earlier work', timestamp: at(5) },
      { type: 'file-history-snapshot', timestamp: at(6), snapshot: {} },
      { type: 'system', subtype: 'informational', timestamp: at(7), content: 'Note' },
      { type: 'attachment', timestamp: at(8), attachment: {} },
    ];
    model.addMainEntries(others);
    model.addSubagentEntries('agent-a1', others.map((line) => ({ ...line, isSidechain: true })));
    expect(model.lastEventAt()).toBe(at(1));
  });

  // turn-model spec: the timestamp as written on the line
  it('gives the timestamp as written on the line', () => {
    const model = new TurnModel();
    model.addMainEntries([claudeSays('Text', '2026-11-26T10:05:00Z')]);
    expect(model.lastEventAt()).toBe('2026-11-26T10:05:00Z');
  });

  // turn-model spec: a line with no valid timestamp counts at the moment the model takes it
  it('uses the moment it takes a line with no valid timestamp', () => {
    const now = Date.parse('2026-11-26T12:00:00.000Z');
    vi.useFakeTimers({ now, toFake: ['Date'] });
    const model = new TurnModel();
    model.addMainEntries([claudeSays('No time')]);
    expect(model.lastEventAt()).toBe('2026-11-26T12:00:00.000Z');
    vi.setSystemTime(now + 90_000);
    model.addSubagentEntries('agent-a1', [{ ...subSays('Bad time'), timestamp: 'yesterday at noon' }]);
    expect(model.lastEventAt()).toBe('2026-11-26T12:01:30.000Z');
  });

  // plan-session_activity/REQ-16, REQ-17: the latest activity wins, also when an older line is read after it
  it('keeps the latest time when a line read later is older', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Go', at(0)), claudeSays('Main text', at(5))]);
    model.addSubagentEntries('agent-a1', [subSays('Older subagent line', at(3))]);
    model.addSubagentEntries('agent-b1', [subSays('Another older line', at(4))]);
    expect(model.lastEventAt()).toBe(at(5));
    model.addSubagentEntries('agent-a1', [subSays('Newer subagent line', at(6))]);
    expect(model.lastEventAt()).toBe(at(6));
  });
});

describe('TurnModel, open calls', () => {
  // plan-session_activity/REQ-18: a main tool call with no result is open, with its raw input and time, and no subagent type
  it('keeps an open main call with its id, name, raw input and time', () => {
    const model = new TurnModel();
    const input = { command: 'mvn test', description: 'Run the tests' };
    model.addMainEntries([userSays('Test it', at(0)), claudeSays([{ type: 'text', text: 'Running' }, { type: 'tool_use', id: 't1', name: 'Bash', input }], at(1))]);
    const calls = model.openCalls(false);
    expect(calls).toEqual([{ id: 't1', name: 'Bash', input, at: at(1), order: expect.any(Number) }]);
    expect(calls[0]).not.toHaveProperty('subagentType');
  });

  // turn-model spec: a result closes its call, and only that one
  it('closes a call when its result arrives, and only that call', () => {
    const model = new TurnModel();
    model.addMainEntries([
      userSays('Go', at(0)),
      claudeSays([{ type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/a' } }, { type: 'tool_use', id: 't2', name: 'Grep', input: { pattern: 'x' } }], at(1)),
    ]);
    expect(callIds(model)).toEqual(['t1', 't2']);
    model.addMainEntries([toolResult('t1', at(2))]);
    expect(callIds(model)).toEqual(['t2']);
    model.addMainEntries([toolResult('unknown', at(3))]);
    expect(callIds(model)).toEqual(['t2']);
  });

  // turn-model spec: a user message closes every call of its own conversation, and of no other
  it('closes every call of a conversation at a user message of that conversation', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Go', at(0)), toolCall('m1', 'Bash', { command: 'npm run build' }, at(1)), toolCall('m2', 'Agent', { description: 'Explore' }, at(1))]);
    model.addSubagentEntries('agent-a1', [toolCall('s1', 'Grep', { pattern: 'TODO' }, at(2), true)]);
    model.addMainEntries([userSays('Stop the build', at(3))]);
    expect(callIds(model), 'the main calls close, the subagent call stays').toEqual(['s1']);
    model.addMainEntries([toolCall('m3', 'Read', { file_path: '/b' }, at(4))]);
    model.addSubagentEntries('agent-a1', [subUser('Look at the tests too', at(5))]);
    expect(callIds(model), 'the subagent calls close, the main call stays').toEqual(['m3']);
  });

  // plan-session_activity/REQ-19, REQ-26: a subagent call carries its subagent type, when the metadata has a non-empty one
  it('gives a subagent call the type of its subagent, and none when the type is missing or empty', () => {
    const model = new TurnModel();
    model.setSubagentMeta('agent-a', { agentType: 'sdd-tester', toolUseId: 'ta' });
    model.setSubagentMeta('agent-c', { agentType: '' });
    model.addSubagentEntries('agent-a', [toolCall('sa', 'Bash', { command: 'mvn test' }, at(1), true)]);
    model.addSubagentEntries('agent-b', [toolCall('sb', 'WebSearch', undefined, at(2), true)]);
    model.addSubagentEntries('agent-c', [toolCall('sc', 'Read', { file_path: '/c' }, at(3), true)]);
    const calls = model.openCalls(false);
    expect(calls.map((call) => [call.id, call.subagentType])).toEqual([
      ['sa', 'sdd-tester'],
      ['sb', undefined],
      ['sc', undefined],
    ]);
    expect(calls[1]).not.toHaveProperty('subagentType');
    expect(calls[2]).not.toHaveProperty('subagentType');
  });

  // turn-model spec: a subagent that is not running gives no open call
  it('gives no call of a finished, interrupted or stopped subagent', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Go', at(0)), toolCall('m1', 'Bash', { command: 'ls' }, at(1))]);
    model.addSubagentEntries('agent-f', [toolCall('sf', 'Bash', { command: 'ls' }, at(2), true)]);
    model.addSubagentEntries('agent-i', [toolCall('si', 'Bash', { command: 'ls' }, at(2), true)]);
    model.addSubagentEntries('agent-r', [toolCall('sr', 'Bash', { command: 'ls' }, at(2), true)]);
    expect(callIds(model)).toEqual(['m1', 'sf', 'si', 'sr']);
    model.setSubagentMeta('agent-f', { agentType: 'Explore', finished: true });
    model.addSubagentEntries('agent-i', [subUser('[Request interrupted by user for tool use]', at(3))]);
    expect(callIds(model)).toEqual(['m1', 'sr']);
    expect(callIds(model, true), 'the subagents of an ended session are stopped').toEqual(['m1']);
  });

  // plan-session_activity/REQ-20: start order, by time when both are known and different, else in the order taken
  it('lists the calls in start order', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Go', at(0)), toolCall('m1', 'Bash', { command: 'npm run build' }, at(5))]);
    model.addSubagentEntries('agent-a', [toolCall('s1', 'Grep', { pattern: 'x' }, at(3), true)]);
    model.addSubagentEntries('agent-b', [toolCall('s2', 'Read', { file_path: '/x' }, undefined, true)]);
    model.addSubagentEntries('agent-c', [toolCall('s3', 'Glob', { pattern: '*.ts' }, at(5), true)]);
    expect(callIds(model)).toEqual(['s1', 'm1', 's2', 's3']);
    const calls = model.openCalls(false);
    expect(calls[2]).not.toHaveProperty('at');
  });

  // turn-model spec: a tool call with no id is never open; a call with no input has no input
  it('keeps no call with no id, and gives no input to a call with none', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Go', at(0)), toolCall(undefined, 'Bash', { command: 'ls' }, at(1)), toolCall('w1', 'WebSearch', undefined, at(2))]);
    const calls = model.openCalls(false);
    expect(calls).toEqual([{ id: 'w1', name: 'WebSearch', at: at(2), order: expect.any(Number) }]);
    expect(calls[0]).not.toHaveProperty('input');
  });

  // plan-session_activity/REQ-14: thousands of closed calls leave no open call behind
  it('keeps no closed call after thousands of steps', () => {
    const model = new TurnModel();
    model.addMainEntries([userSays('Long run', at(0))]);
    for (let step = 0; step < 5_000; step += 1) {
      model.addSubagentEntries('agent-big', [toolCall(`c${step}`, 'Bash', { command: 'mvn test' }, at(1), true), toolResult(`c${step}`, at(1), true)]);
    }
    expect(model.openCalls(false)).toEqual([]);
  });
});
