import { describe, expect, it } from 'vitest';
import type { SessionState } from '../sessions/session-state-tracker.js';
import type { SubagentView, TurnStep } from './turn-model.js';
import { noTurn, type TurnSubagent, type TurnTree, turnChangeOf, turnTreeOf } from './turn-tree.js';

const text = (value: string): TurnStep => ({ kind: 'text', text: value });
const tool = (name: string, outcome: 'running' | 'completed' | 'error' = 'completed'): TurnStep => ({ kind: 'tool', name, outcome });

const view = (id: string, fields: Partial<SubagentView> = {}): SubagentView => ({ id, meta: {}, state: 'running', openCalls: [], ...fields });
const at = (main: number) => ({ startedBy: { step: main } });
const under = (parent: string, step: number) => ({ startedBy: { parent, step } });

/** A model with the given turn number, steps and views; it records the sessionEnded argument it gets. */
function modelOf(number: number, steps: TurnStep[], views: SubagentView[]) {
  const calls: boolean[] = [];
  return {
    calls,
    turnNumber: () => number,
    steps: () => steps,
    subagents: (sessionEnded: boolean) => {
      calls.push(sessionEnded);
      return views;
    },
  };
}

const treeOf = (views: SubagentView[], state: SessionState = 'working', steps: TurnStep[] = Array.from({ length: 10 }, (_, i) => tool(`T${i}`))) =>
  turnTreeOf(modelOf(1, steps, views), state);
const subagentOf = (tree: TurnTree, id: string) => tree.subagents.find((subagent) => subagent.id === id);

describe('turnTreeOf, status and steps', () => {
  // plan-session_activity/REQ-41: before the first turn the tree is noTurn(), in any state
  it.each<SessionState>(['working', 'idle', 'ended'])('gives noTurn() for turn number 0 when the state is %s', (state) => {
    expect(turnTreeOf(modelOf(0, [text('ignored')], [view('agent-a', at(0))]), state)).toEqual(noTurn());
    expect(noTurn()).toEqual({ number: 0, status: 'none', steps: [], groups: [], earlier: [], subagents: [] });
  });

  // plan-session_activity/REQ-40: a turn runs in working or needs_input, else it is ended
  it.each<[SessionState, string]>([
    ['working', 'running'],
    ['needs_input', 'running'],
    ['idle', 'ended'],
    ['ended', 'ended'],
  ])('gives status %s → %s', (state, status) => {
    const steps = [text('Hello'), tool('Bash')];
    const tree = turnTreeOf(modelOf(3, steps, []), state);
    expect(tree).toMatchObject({ number: 3, status, steps });
  });

  // turn-tree spec: the subagents are read with sessionEnded only for an ended session
  it('reads the subagents as of an ended session only when the state is ended', () => {
    for (const [state, ended] of [
      ['working', false],
      ['idle', false],
      ['needs_input', false],
      ['ended', true],
    ] as const) {
      const model = modelOf(1, [], []);
      turnTreeOf(model, state);
      expect(model.calls, state).toEqual([ended]);
    }
  });

  // turn-tree spec: the input is not changed
  it('does not change the steps or the views it reads', () => {
    const steps = [text('A'), tool('Agent')];
    const views = [view('agent-a', { ...at(1), meta: { agentType: 'Explore' } }), view('agent-b', { state: 'finished' })];
    const before = JSON.stringify({ steps, views });
    turnTreeOf(modelOf(1, steps, views), 'working');
    expect(JSON.stringify({ steps, views })).toBe(before);
  });
});

describe('turnTreeOf, groups', () => {
  // plan-session_activity/REQ-31, REQ-37: calls with no other step between them form one group at the highest step; a gap starts a new group
  it('groups the subagents started at the same or the next step, and starts a new group after a gap', () => {
    const tree = treeOf([view('a', at(2)), view('b', at(3)), view('c', at(3)), view('d', at(5)), view('e', at(6))]);
    expect(tree.groups).toEqual([
      { step: 3, subagents: ['a', 'b', 'c'] },
      { step: 6, subagents: ['d', 'e'] },
    ]);
  });

  // plan-session_activity/REQ-31: children are sorted by step; equal steps keep the order they became known
  it('sorts the children by step and keeps the known order for equal steps', () => {
    const tree = treeOf([view('late', at(7)), view('second', at(1)), view('first', at(1)), view('middle', at(4))]);
    expect(tree.groups).toEqual([
      { step: 1, subagents: ['second', 'first'] },
      { step: 4, subagents: ['middle'] },
      { step: 7, subagents: ['late'] },
    ]);
  });

  // plan-session_activity/REQ-38: a subagent started by a subagent of the tree is in the groups of its parent, not of the main conversation
  it('puts nested subagents in the groups of their parent, at any depth', () => {
    const tree = treeOf([view('p', at(1)), view('c1', under('p', 4)), view('c2', under('p', 5)), view('g', under('c1', 0)), view('c3', under('p', 9))]);
    expect(tree.groups).toEqual([{ step: 1, subagents: ['p'] }]);
    expect(subagentOf(tree, 'p')?.groups).toEqual([
      { step: 5, subagents: ['c1', 'c2'] },
      { step: 9, subagents: ['c3'] },
    ]);
    expect(subagentOf(tree, 'c1')?.groups).toEqual([{ step: 0, subagents: ['g'] }]);
    expect(subagentOf(tree, 'g')?.groups).toEqual([]);
    expect(tree.subagents.map((subagent) => subagent.id)).toEqual(['p', 'c1', 'c2', 'g', 'c3']);
    expect(tree.earlier).toEqual([]);
  });

  // plan-session_activity/REQ-46: 20 subagents started at once form one group
  it('puts 20 subagents started in one message in one group', () => {
    const views = Array.from({ length: 20 }, (_, i) => view(`s${i}`, at(2 + i)));
    const tree = treeOf(views, 'working', Array.from({ length: 30 }, (_, i) => tool(`T${i}`)));
    expect(tree.groups).toEqual([{ step: 21, subagents: views.map((v) => v.id) }]);
  });
});

describe('turnTreeOf, subagents of earlier turns', () => {
  // plan-session_activity/REQ-39: a running subagent with no step in the current turn is in "earlier"
  it('lists the running subagents that are not in the tree in earlier, in the order they became known', () => {
    const tree = treeOf([view('old-1'), view('in-tree', at(0)), view('old-2', under('gone', 3)), view('done', { state: 'finished' }), view('stopped', { state: 'stopped' })]);
    expect(tree.earlier).toEqual(['old-1', 'old-2']);
    expect(tree.groups).toEqual([{ step: 0, subagents: ['in-tree'] }]);
    expect(tree.subagents.map((subagent) => subagent.id)).toEqual(['old-1', 'in-tree', 'old-2']);
  });

  // plan-session_activity/REQ-38, REQ-39: the children of an earlier subagent show under it, not in earlier
  it('nests the children of an earlier subagent under it, finished ones included', () => {
    const tree = treeOf([view('old'), view('child', under('old', 2)), view('done-child', { ...under('old', 3), state: 'finished' })]);
    expect(tree.earlier).toEqual(['old']);
    expect(subagentOf(tree, 'old')?.groups).toEqual([{ step: 3, subagents: ['child', 'done-child'] }]);
    expect(tree.subagents.map((subagent) => subagent.id)).toEqual(['old', 'child', 'done-child']);
  });

  // turn-tree spec: a loop of parents with no other root counts its first view as an earlier one; each view shows once
  it('breaks a loop of parents at its first view, and shows each view once', () => {
    const tree = treeOf([view('x', under('y', 1)), view('y', under('x', 2))]);
    expect(tree.earlier).toEqual(['x']);
    expect(subagentOf(tree, 'x')?.groups).toEqual([{ step: 2, subagents: ['y'] }]);
    expect(subagentOf(tree, 'y')?.groups).toEqual([]);
    expect(tree.subagents.map((subagent) => subagent.id)).toEqual(['x', 'y']);
  });

  // plan-session_activity/REQ-33: a finished or stopped subagent outside the tree is absent
  it('leaves out finished and stopped subagents that are neither in the tree nor under a shown subagent', () => {
    const tree = treeOf([view('done', { state: 'finished' }), view('cut', { state: 'stopped' }), view('done-child', { ...under('done', 1), state: 'finished' })]);
    expect(tree.earlier).toEqual([]);
    expect(tree.subagents).toEqual([]);
  });
});

describe('turnTreeOf, subagent fields', () => {
  // plan-session_activity/REQ-32, REQ-33, REQ-34, REQ-35: type, description, model of the metadata, state, start, plain latest text
  it('gives type, description, metadata model, state, start and the plain latest text', () => {
    const tree = treeOf([
      view('a', {
        ...at(1),
        meta: { agentType: 'sdd-developer', description: 'Implement batch', model: 'claude-opus-5-5' },
        responseModel: 'claude-sonnet-5',
        startedAt: '2026-11-26T10:00:00.000Z',
        lastLineAt: '2026-11-26T10:05:00.000Z',
        lastText: { text: 'Overwriting the **whole** `CommonServiceImpl` class', order: 1 },
      }),
    ]);
    expect(subagentOf(tree, 'a')).toEqual<TurnSubagent>({
      id: 'a',
      type: 'sdd-developer',
      description: 'Implement batch',
      model: 'claude-opus-5-5',
      state: 'running',
      startedAt: '2026-11-26T10:00:00.000Z',
      latestText: 'Overwriting the whole CommonServiceImpl class',
      groups: [],
    });
  });

  // plan-session_activity/REQ-32: no metadata model → the model of the latest response
  it('takes the response model when the metadata has none', () => {
    expect(subagentOf(treeOf([view('a', { ...at(1), responseModel: 'claude-haiku-5' })]), 'a')?.model).toBe('claude-haiku-5');
    expect(subagentOf(treeOf([view('a', { ...at(1), meta: { model: '' }, responseModel: 'claude-haiku-5' })]), 'a')?.model).toBe('claude-haiku-5');
  });

  // plan-session_activity/REQ-44: missing or empty fields are absent, the others stay
  it('leaves out each missing or empty field and keeps the others', () => {
    const subagent = subagentOf(treeOf([view('a', { ...at(1), meta: { agentType: '', description: '', model: '' }, lastText: { text: '  ', order: 1 } })]), 'a');
    expect(subagent).toEqual({ id: 'a', state: 'running', groups: [] });
  });

  // plan-session_activity/REQ-34: the end time shows only once the subagent is not running
  it.each(['finished', 'stopped'] as const)('gives the last line time as end time to a %s subagent, and none while it runs', (state) => {
    const times = { startedAt: '2026-11-26T10:00:00.000Z', lastLineAt: '2026-11-26T10:07:00.000Z' };
    expect(subagentOf(treeOf([view('a', { ...at(1), ...times, state })]), 'a')).toMatchObject({ state, endedAt: times.lastLineAt });
    expect(subagentOf(treeOf([view('a', { ...at(1), ...times })]), 'a')?.endedAt).toBeUndefined();
  });

  // plan-session_activity/REQ-35, REQ-45: the latest text is cut at 400 characters
  it('cuts the latest text at 400 characters', () => {
    const long = 'word '.repeat(200).trim();
    const latest = subagentOf(treeOf([view('a', { ...at(1), lastText: { text: long, order: 1 } })]), 'a')?.latestText;
    expect(latest).toHaveLength(400);
    expect(latest).toBe(`${long.slice(0, 399)}…`);
  });

  // plan-session_activity/REQ-36: the current tool as the running-tool line: last open call, first line of its argument, count of the others
  it('gives the current tool of a running subagent from its open calls', () => {
    const openCalls = [
      { id: 'c1', name: 'Read', input: { file_path: '/a' }, order: 1 },
      { id: 'c2', name: 'Grep', input: { pattern: 'x' }, order: 2 },
      { id: 'c3', name: 'Bash', input: { command: 'npm test\n--watch' }, order: 3 },
    ];
    expect(subagentOf(treeOf([view('a', { ...at(1), openCalls })]), 'a')?.currentTool).toEqual({ name: 'Bash', argument: 'npm test', others: 2 });
    expect(subagentOf(treeOf([view('a', { ...at(1), openCalls: [{ id: 'c', name: 'TodoWrite', order: 1 }] })]), 'a')?.currentTool).toEqual({ name: 'TodoWrite', others: 0 });
  });

  // plan-session_activity/REQ-36: no open call, or a subagent that is not running → no current tool
  it('gives no current tool with no open call or when the subagent is not running', () => {
    const openCalls = [{ id: 'c1', name: 'Bash', input: { command: 'ls' }, order: 1 }];
    expect(subagentOf(treeOf([view('a', at(1))]), 'a')?.currentTool).toBeUndefined();
    expect(subagentOf(treeOf([view('a', { ...at(1), openCalls, state: 'stopped' })]), 'a')?.currentTool).toBeUndefined();
  });
});

describe('turnChangeOf', () => {
  const base = (): TurnTree => ({
    number: 2,
    status: 'running',
    groups: [{ subagents: ['a'] }],
    earlier: [],
    subagents: [{ id: 'a', type: 'Explore', state: 'running', groups: [] }],
  });

  // plan-session_activity/REQ-43: no previous tree, a new turn number or fewer steps → the whole tree
  it('gives the whole tree with no previous tree, a new number or fewer steps', () => {
    const previous = base();
    const renumbered = { ...previous, number: 3 };
    const shorter = { ...previous, steps: previous.steps.slice(0, 1) };
    expect(turnChangeOf(undefined, previous)).toEqual({ type: 'turn', turn: previous });
    expect(turnChangeOf(previous, renumbered)).toEqual({ type: 'turn', turn: renumbered });
    expect(turnChangeOf(previous, shorter)).toEqual({ type: 'turn', turn: shorter });
  });

  // turn-tree spec: nothing changed → undefined
  it('gives undefined when nothing changed', () => {
    const previous = base();
    expect(turnChangeOf(previous, { ...previous, steps: [...previous.steps], groups: [{ step: 1, subagents: ['a'] }], subagents: [{ ...previous.subagents[0]! }] })).toBeUndefined();
  });

  // plan-session_activity/REQ-40, REQ-43: only the status when only the status changed
  it('gives only the new status when the status changed', () => {
    const previous = base();
    expect(turnChangeOf(previous, { ...previous, status: 'ended' })).toEqual({ type: 'update', status: 'ended' });
  });

  // plan-session_activity/REQ-43, REQ-45: only the new steps and the steps that are new objects, with their index
  it('gives the new steps and the replaced steps with their index, and not the unchanged ones', () => {
    const previous = base();
    const completed = tool('Bash', 'completed');
    const added = text('Done');
    const update = turnChangeOf(previous, { ...previous, steps: [previous.steps[0]!, completed, added] });
    expect(update).toEqual({
      type: 'update',
      steps: [
        { index: 1, step: completed },
        { index: 2, step: added },
      ],
    });
  });

  // plan-session_activity/REQ-37, REQ-39: the whole groups and earlier values when they changed
  it('gives the whole groups and earlier when they changed', () => {
    const previous = base();
    const groups = [{ step: 1, subagents: ['a', 'b'] }];
    const update = turnChangeOf(previous, { ...previous, groups, earlier: ['z'], subagents: previous.subagents });
    expect(update).toEqual({ type: 'update', groups, earlier: ['z'] });
  });

  // plan-session_activity/REQ-43: only the subagents that are new or have a changed field; one that left is not named
  it('gives the new and changed subagents only', () => {
    const previous: TurnTree = {
      ...base(),
      subagents: [
        { id: 'a', type: 'Explore', state: 'running', groups: [] },
        { id: 'gone', state: 'running', groups: [] },
        { id: 'same', state: 'running', groups: [] },
      ],
    };
    const changed: TurnSubagent = { id: 'a', type: 'Explore', state: 'finished', endedAt: '2026-11-26T10:00:00.000Z', groups: [] };
    const added: TurnSubagent = { id: 'b', state: 'running', groups: [] };
    const update = turnChangeOf(previous, { ...previous, subagents: [changed, { id: 'same', state: 'running', groups: [] }, added] });
    expect(update).toEqual({ type: 'update', subagents: [changed, added] });
  });

  // plan-session_activity/REQ-38: a change of the nested groups of a subagent is a changed field
  it('gives a subagent whose nested groups changed', () => {
    const previous = base();
    const nested: TurnSubagent = { ...previous.subagents[0]!, groups: [{ subagents: ['child'] }] };
    expect(turnChangeOf(previous, { ...previous, subagents: [nested] })).toEqual({ type: 'update', subagents: [nested] });
  });
});
