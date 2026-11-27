import { describe, expect, it } from 'vitest';
import type { SessionState } from '../sessions/session-state-tracker.js';
import type { SubagentView } from './turn-model.js';
import { noTurn, type TurnSubagent, type TurnTree, turnChangeOf, turnTreeOf } from './turn-tree.js';

const view = (id: string, fields: Partial<SubagentView> = {}): SubagentView => ({ id, meta: {}, state: 'running', openCalls: [], ...fields });
const at = (main: number, message?: string) => ({ startedBy: { step: main, ...(message !== undefined && { message }) } });
const under = (parent: string, step: number, message?: string) => ({ startedBy: { parent, step, ...(message !== undefined && { message }) } });
const startedAt = (minute: number) => ({ startedAt: `2026-11-27T10:${String(minute).padStart(2, '0')}:00.000Z` });
const group = (...ids: string[]) => ({ subagents: ids });

/** A model with the given turn number and views; it records the sessionEnded argument it gets. */
function modelOf(number: number, views: SubagentView[]) {
  const calls: boolean[] = [];
  return {
    calls,
    turnNumber: () => number,
    subagents: (sessionEnded: boolean) => {
      calls.push(sessionEnded);
      return views;
    },
  };
}

const treeOf = (views: SubagentView[], state: SessionState = 'working') => turnTreeOf(modelOf(1, views), state);
const subagentOf = (tree: TurnTree, id: string) => tree.subagents.find((subagent) => subagent.id === id);

describe('turnTreeOf, status', () => {
  // plan-session_activity/REQ-41, plan-subagent_panel/REQ-7: before the first turn the tree is noTurn(), in any state
  it.each<SessionState>(['working', 'idle', 'ended'])('gives noTurn() for turn number 0 when the state is %s', (state) => {
    expect(turnTreeOf(modelOf(0, [view('agent-a', at(0))]), state)).toEqual(noTurn());
    expect(noTurn()).toEqual({ number: 0, status: 'none', groups: [], earlier: [], subagents: [] });
  });

  // plan-session_activity/REQ-40, plan-subagent_panel/REQ-6: a turn runs in working or needs_input, else it is ended
  it.each<[SessionState, string]>([
    ['working', 'running'],
    ['needs_input', 'running'],
    ['idle', 'ended'],
    ['ended', 'ended'],
  ])('gives status %s → %s', (state, status) => {
    expect(turnTreeOf(modelOf(3, []), state)).toEqual({ number: 3, status, groups: [], earlier: [], subagents: [] });
  });

  // plan-subagent_panel/REQ-1: the tree carries no step of the main conversation, even when the model has steps
  it('carries no step of the main conversation', () => {
    const model = { ...modelOf(2, [view('a', at(1))]), steps: () => [{ kind: 'text' as const, text: 'Hello' }] };
    const tree = turnTreeOf(model, 'working');
    expect(Object.keys(tree).sort()).toEqual(['earlier', 'groups', 'number', 'status', 'subagents']);
    expect(Object.keys(tree.groups[0]!)).toEqual(['subagents']);
  });

  // turn-tree spec: the subagents are read with sessionEnded only for an ended session
  it('reads the subagents as of an ended session only when the state is ended', () => {
    for (const [state, ended] of [
      ['working', false],
      ['idle', false],
      ['needs_input', false],
      ['ended', true],
    ] as const) {
      const model = modelOf(1, []);
      turnTreeOf(model, state);
      expect(model.calls, state).toEqual([ended]);
    }
  });

  // turn-tree spec: the input is not changed
  it('does not change the views it reads', () => {
    const views = [view('a', { ...at(1), ...startedAt(5), meta: { agentType: 'Explore' } }), view('b', { ...at(4), ...startedAt(1) }), view('c', { state: 'finished' })];
    const before = JSON.stringify(views);
    treeOf(views);
    expect(JSON.stringify(views)).toBe(before);
  });
});

describe('turnTreeOf, groups', () => {
  // plan-session_activity/REQ-37, plan-subagent_panel/REQ-3: calls with no other step between them form one group; a gap starts a new group
  it('groups the subagents started at the same or the next step, and starts a new group after a gap', () => {
    const tree = treeOf([view('a', at(2)), view('b', at(3)), view('c', at(3)), view('d', at(5)), view('e', at(6))]);
    expect(tree.groups).toEqual([{ subagents: ['a', 'b', 'c'] }, { subagents: ['d', 'e'] }]);
  });

  // turn-tree spec: with no start, children keep the step order; equal steps keep the order they became known
  it('keeps the step order, and the known order for equal steps, when no subagent has a start', () => {
    const tree = treeOf([view('late', at(7)), view('second', at(1)), view('first', at(1)), view('middle', at(4))]);
    expect(tree.groups).toEqual([{ subagents: ['second', 'first'] }, { subagents: ['middle'] }, { subagents: ['late'] }]);
  });

  // plan-session_activity/REQ-38: a subagent started by a subagent of the tree is in the groups of its parent, not of the main conversation
  it('puts nested subagents in the groups of their parent, at any depth', () => {
    const tree = treeOf([view('p', at(1)), view('c1', under('p', 4)), view('c2', under('p', 5)), view('g', under('c1', 0)), view('c3', under('p', 9))]);
    expect(tree.groups).toEqual([{ subagents: ['p'] }]);
    expect(subagentOf(tree, 'p')?.groups).toEqual([{ subagents: ['c1', 'c2'] }, { subagents: ['c3'] }]);
    expect(subagentOf(tree, 'c1')?.groups).toEqual([{ subagents: ['g'] }]);
    expect(subagentOf(tree, 'g')?.groups).toEqual([]);
    expect(tree.subagents.map((subagent) => subagent.id)).toEqual(['p', 'c1', 'c2', 'g', 'c3']);
    expect(tree.earlier).toEqual([]);
  });

  // plan-session_activity/REQ-46: 20 subagents started at once form one group
  it('puts 20 subagents started in one message in one group', () => {
    const views = Array.from({ length: 20 }, (_, i) => view(`s${i}`, at(2 + i)));
    expect(treeOf(views).groups).toEqual([{ subagents: views.map((v) => v.id) }]);
  });

  // plan-session_activity/REQ-45: a long turn keeps every subagent, with no limit of steps
  it('keeps every group of a turn with many steps', () => {
    const views = Array.from({ length: 300 }, (_, i) => view(`s${i}`, { ...at(i * 3), startedAt: new Date(Date.UTC(2026, 10, 27, 10, 0, i)).toISOString() }));
    const tree = treeOf(views);
    expect(tree.groups).toHaveLength(300);
    expect(tree.groups.map((group) => group.subagents[0])).toEqual(views.map((v) => v.id));
  });
});

describe('turnTreeOf, groups by message', () => {
  // plan-subagent_panel/REQ-3: the calls of two messages are two groups, also with no step between them
  it('makes two groups for the calls of two messages that follow each other', () => {
    const tree = treeOf([view('analyst', { ...at(2, 'm1'), ...startedAt(1) }), view('dev-1', { ...at(3, 'm2'), ...startedAt(5) }), view('dev-2', { ...at(4, 'm2'), ...startedAt(5) })]);
    expect(tree.groups).toEqual([{ subagents: ['analyst'] }, { subagents: ['dev-1', 'dev-2'] }]);
  });

  // turn-tree spec: when both links have a message, the same message joins the group whatever the steps between
  it('keeps the calls of one message in one group, also with a step between them', () => {
    const tree = treeOf([view('a', { ...at(1, 'm1'), ...startedAt(1) }), view('b', { ...at(5, 'm1'), ...startedAt(1) })]);
    expect(tree.groups).toEqual([{ subagents: ['a', 'b'] }]);
  });

  // turn-tree spec: a link with no message falls back to the step rule
  it('uses the step rule when one of the two links has no message', () => {
    expect(treeOf([view('a', at(2, 'm1')), view('b', at(3))]).groups).toEqual([{ subagents: ['a', 'b'] }]);
    expect(treeOf([view('a', at(2)), view('b', at(3, 'm2'))]).groups).toEqual([{ subagents: ['a', 'b'] }]);
    expect(treeOf([view('a', at(2)), view('b', at(5, 'm2'))]).groups).toEqual([{ subagents: ['a'] }, { subagents: ['b'] }]);
  });

  // plan-subagent_panel/REQ-3, plan-session_activity/REQ-38: the same rule for the children of a subagent
  it('makes two nested groups for the calls of two messages of a parent', () => {
    const tree = treeOf([view('p', at(0, 'm0')), view('c1', under('p', 1, 's1')), view('c2', under('p', 2, 's2')), view('c3', under('p', 3, 's2'))]);
    expect(subagentOf(tree, 'p')?.groups).toEqual([{ subagents: ['c1'] }, { subagents: ['c2', 'c3'] }]);
  });

  // plan-session_activity/REQ-58: the agents of one workflow launch share one link, so they form one group
  it('keeps the agents of one workflow launch in one group', () => {
    const tree = treeOf([view('w1', { ...at(1, 'mw'), ...startedAt(9) }), view('w2', { ...at(1, 'mw'), ...startedAt(4) }), view('t', { ...at(2, 'mt'), ...startedAt(6) })]);
    expect(tree.groups).toEqual([{ subagents: ['w2', 'w1'] }, { subagents: ['t'] }]);
  });
});

describe('turnTreeOf, start order', () => {
  // plan-subagent_panel/REQ-2: groups of the main conversation sort by start, not by step
  it('sorts the groups by start', () => {
    const tree = treeOf([view('first-step', { ...at(1), ...startedAt(9) }), view('second-step', { ...at(5), ...startedAt(2) }), view('third-step', { ...at(9), ...startedAt(5) })]);
    expect(tree.groups).toEqual([{ subagents: ['second-step'] }, { subagents: ['third-step'] }, { subagents: ['first-step'] }]);
  });

  // plan-subagent_panel/REQ-3: a group takes the place of its earliest started subagent
  it('places a group at the earliest start of its subagents', () => {
    const tree = treeOf([view('g1', { ...at(1), ...startedAt(4) }), view('g2', { ...at(2), ...startedAt(20) }), view('solo', { ...at(6), ...startedAt(5) })]);
    expect(tree.groups).toEqual([{ subagents: ['g1', 'g2'] }, { subagents: ['solo'] }]);
    const later = treeOf([view('g1', { ...at(1), ...startedAt(8) }), view('g2', { ...at(2), ...startedAt(20) }), view('solo', { ...at(6), ...startedAt(5) })]);
    expect(later.groups).toEqual([{ subagents: ['solo'] }, { subagents: ['g1', 'g2'] }]);
  });

  // plan-subagent_panel/REQ-2: inside a group the subagents sort by start
  it('sorts the subagents of a group by start', () => {
    const tree = treeOf([view('a', { ...at(3), ...startedAt(7) }), view('b', { ...at(3), ...startedAt(1) }), view('c', { ...at(4), ...startedAt(4) })]);
    expect(tree.groups).toEqual([{ subagents: ['b', 'c', 'a'] }]);
  });

  // turn-tree spec: a missing start sorts last, for the subagents of a group and for the groups
  it('puts a subagent or a group with no start last', () => {
    const tree = treeOf([
      view('no-start', at(1)),
      view('started', { ...at(1), ...startedAt(9) }),
      view('lone-no-start', at(5)),
      view('lone-started', { ...at(9), ...startedAt(12) }),
    ]);
    expect(tree.groups).toEqual([{ subagents: ['started', 'no-start'] }, { subagents: ['lone-started'] }, { subagents: ['lone-no-start'] }]);
  });

  // turn-tree spec: equal starts keep the step order
  it('keeps the step order for equal starts', () => {
    const tree = treeOf([view('later-step', { ...at(8), ...startedAt(3) }), view('earlier-step', { ...at(1), ...startedAt(3) }), view('b', { ...at(2), ...startedAt(3) })]);
    expect(tree.groups).toEqual([{ subagents: ['earlier-step', 'b'] }, { subagents: ['later-step'] }]);
  });

  // plan-subagent_panel/REQ-2: the start order also holds for the subagents nested under one parent
  it('sorts nested groups and the subagents inside them by start', () => {
    const tree = treeOf([
      view('p', { ...at(0), ...startedAt(0) }),
      view('c-early-step', { ...under('p', 1), ...startedAt(30) }),
      view('c-late-step', { ...under('p', 6), ...startedAt(10) }),
      view('d-1', { ...under('p', 9), ...startedAt(25) }),
      view('d-2', { ...under('p', 9), ...startedAt(20) }),
    ]);
    expect(subagentOf(tree, 'p')?.groups).toEqual([{ subagents: ['c-late-step'] }, { subagents: ['d-2', 'd-1'] }, { subagents: ['c-early-step'] }]);
  });

  // plan-subagent_panel/REQ-2: earlier groups sort by start; a missing start sorts last
  it('sorts the subagents of earlier turns by start, a missing start last', () => {
    const tree = treeOf([view('old-none'), view('old-late', startedAt(30)), view('old-early', startedAt(1)), view('in-tree', { ...at(0), ...startedAt(40) })]);
    expect(tree.earlier).toEqual([group('old-early'), group('old-late'), group('old-none')]);
  });

  // turn-tree spec: equal starts, or both missing, keep the known order for earlier
  it('keeps the known order of earlier subagents for equal or missing starts', () => {
    expect(treeOf([view('x', startedAt(3)), view('y', startedAt(3)), view('z', startedAt(3))]).earlier).toEqual([group('x'), group('y'), group('z')]);
    expect(treeOf([view('m'), view('n')]).earlier).toEqual([group('m'), group('n')]);
  });
});

describe('turnTreeOf, subagents of earlier turns', () => {
  // plan-session_activity/REQ-39: a running subagent with no step in the current turn is in "earlier"
  it('lists the running subagents that are not in the tree in earlier, in the order they became known', () => {
    const tree = treeOf([view('old-1'), view('in-tree', at(0)), view('old-2', under('gone', 3)), view('done', { state: 'finished' }), view('stopped', { state: 'stopped' })]);
    expect(tree.earlier).toEqual([group('old-1'), group('old-2')]);
    expect(tree.groups).toEqual([{ subagents: ['in-tree'] }]);
    expect(tree.subagents.map((subagent) => subagent.id)).toEqual(['old-1', 'in-tree', 'old-2']);
  });

  // plan-session_activity/REQ-38, REQ-39: the children of an earlier subagent show under it, not in earlier
  it('nests the children of an earlier subagent under it, finished ones included', () => {
    const tree = treeOf([view('old'), view('child', under('old', 2)), view('done-child', { ...under('old', 3), state: 'finished' })]);
    expect(tree.earlier).toEqual([group('old')]);
    expect(subagentOf(tree, 'old')?.groups).toEqual([{ subagents: ['child', 'done-child'] }]);
    expect(tree.subagents.map((subagent) => subagent.id)).toEqual(['old', 'child', 'done-child']);
  });

  // turn-tree spec: a loop of parents with no other root counts its first view as an earlier one; each view shows once
  it('breaks a loop of parents at its first view, and shows each view once', () => {
    const tree = treeOf([view('x', under('y', 1)), view('y', under('x', 2))]);
    expect(tree.earlier).toEqual([group('x')]);
    expect(subagentOf(tree, 'x')?.groups).toEqual([{ subagents: ['y'] }]);
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

describe('turnTreeOf, groups of earlier turns', () => {
  // plan-subagent_panel/REQ-10, REQ-12: the subagents of one message of an earlier turn form one group, another message another group
  it('groups the earlier subagents by the message of their call', () => {
    const tree = treeOf([
      view('dev-1', { earlierMessage: 'msg_developers', ...startedAt(1) }),
      view('tester', { earlierMessage: 'msg_tester', ...startedAt(2) }),
      view('dev-2', { earlierMessage: 'msg_developers', ...startedAt(1) }),
    ]);
    expect(tree.earlier).toEqual([group('dev-1', 'dev-2'), group('tester')]);
  });

  // turn-tree spec: the message of an earlier subagent is its startedBy.message, else its earlierMessage
  it('takes the message of the link of an earlier subagent whose parent does not show, before its earlier message', () => {
    const tree = treeOf([view('a', under('gone', 1, 'msg_sub')), view('b', { earlierMessage: 'msg_sub' }), view('c', { ...under('gone', 2, 'msg_c'), earlierMessage: 'msg_sub' })]);
    expect(tree.earlier).toEqual([group('a', 'b'), group('c')]);
  });

  // turn-tree spec: an earlier subagent with no message is a group of its own; the step rule does not apply to earlier
  it('makes a group of its own of each earlier subagent with no message', () => {
    const tree = treeOf([view('x', { ...under('gone', 1), ...startedAt(1) }), view('y', { ...under('gone', 2), ...startedAt(1) }), view('z', startedAt(1))]);
    expect(tree.earlier).toEqual([group('x'), group('y'), group('z')]);
  });

  // plan-subagent_panel/REQ-12, plan-session_activity/REQ-39: a group of earlier holds only running subagents, so one left is a group of one
  it('keeps only the running subagents in a group of earlier', () => {
    const tree = treeOf([view('done', { earlierMessage: 'm', state: 'finished' }), view('cut', { earlierMessage: 'm', state: 'stopped' }), view('left', { earlierMessage: 'm' })]);
    expect(tree.earlier).toEqual([group('left')]);
    expect(tree.subagents.map((subagent) => subagent.id)).toEqual(['left']);
  });

  // plan-subagent_panel/REQ-2: the groups of earlier sort by their earliest start, their subagents by start, a missing start last
  it('sorts the groups of earlier and their subagents by start', () => {
    const tree = treeOf([
      view('late-1', { earlierMessage: 'm-late', ...startedAt(20) }),
      view('no-start', { earlierMessage: 'm-early' }),
      view('early-2', { earlierMessage: 'm-early', ...startedAt(9) }),
      view('early-1', { earlierMessage: 'm-early', ...startedAt(3) }),
      view('solo-no-start'),
      view('late-0', { earlierMessage: 'm-late', ...startedAt(5) }),
    ]);
    expect(tree.earlier).toEqual([group('early-1', 'early-2', 'no-start'), group('late-0', 'late-1'), group('solo-no-start')]);
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

  // plan-session_activity/REQ-43: no previous tree or a new turn number → the whole tree
  it('gives the whole tree with no previous tree or a new number', () => {
    const previous = base();
    const renumbered = { ...previous, number: 3 };
    expect(turnChangeOf(undefined, previous)).toEqual({ type: 'turn', turn: previous });
    expect(turnChangeOf(previous, renumbered)).toEqual({ type: 'turn', turn: renumbered });
  });

  // plan-subagent_panel/REQ-1: with the same number, a smaller tree is an update, not the whole tree
  it('gives an update, not the whole tree, when the same turn loses its groups', () => {
    const previous = base();
    expect(turnChangeOf(previous, { ...previous, groups: [], subagents: [] })).toEqual({ type: 'update', groups: [] });
  });

  // turn-tree spec: nothing changed → undefined
  it('gives undefined when nothing changed', () => {
    const previous = base();
    expect(turnChangeOf(previous, { ...previous, groups: [{ subagents: ['a'] }], subagents: [{ ...previous.subagents[0]! }] })).toBeUndefined();
  });

  // plan-session_activity/REQ-40, REQ-43: only the status when only the status changed
  it('gives only the new status when the status changed', () => {
    const previous = base();
    expect(turnChangeOf(previous, { ...previous, status: 'ended' })).toEqual({ type: 'update', status: 'ended' });
  });

  // plan-subagent_panel/REQ-2: a new order of the groups is a change of the groups
  it('gives the whole groups when only their order changed', () => {
    const previous: TurnTree = { ...base(), groups: [{ subagents: ['a'] }, { subagents: ['b'] }] };
    const groups = [{ subagents: ['b'] }, { subagents: ['a'] }];
    expect(turnChangeOf(previous, { ...previous, groups })).toEqual({ type: 'update', groups });
  });

  // plan-session_activity/REQ-37, REQ-39: the whole groups and earlier values when they changed
  it('gives the whole groups and earlier when they changed', () => {
    const previous = base();
    const groups = [{ subagents: ['a', 'b'] }];
    const earlier = [{ subagents: ['z'] }];
    const update = turnChangeOf(previous, { ...previous, groups, earlier, subagents: previous.subagents });
    expect(update).toEqual({ type: 'update', groups, earlier });
  });

  // plan-subagent_panel/REQ-10: earlier compares as groups: equal groups are no change, a new grouping or order is
  it('compares earlier as groups', () => {
    const previous: TurnTree = { ...base(), earlier: [group('x'), group('y')] };
    expect(turnChangeOf(previous, { ...previous, earlier: [group('x'), group('y')] })).toBeUndefined();
    const joined = [group('x', 'y')];
    expect(turnChangeOf(previous, { ...previous, earlier: joined })).toEqual({ type: 'update', earlier: joined });
    const reordered = [group('y'), group('x')];
    expect(turnChangeOf(previous, { ...previous, earlier: reordered })).toEqual({ type: 'update', earlier: reordered });
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
