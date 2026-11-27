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
const idsOf = (tree: TurnTree) => tree.subagents.map((subagent) => subagent.id);

describe('turnTreeOf, shape', () => {
  // turn-tree spec: turn number 0 gives noTurn(), in any state
  it.each<SessionState>(['working', 'idle', 'ended'])('gives noTurn() for turn number 0 when the state is %s', (state) => {
    expect(turnTreeOf(modelOf(0, [view('agent-a', at(0))]), state)).toEqual(noTurn());
    expect(noTurn()).toEqual({ number: 0, groups: [], subagents: [] });
  });

  // plan-subagent_panel/REQ-15: the tree carries the turn number and no turn state, whatever the session state
  it.each<SessionState>(['working', 'needs_input', 'idle', 'ended'])('gives only number, groups and subagents when the state is %s', (state) => {
    expect(turnTreeOf(modelOf(3, []), state)).toEqual({ number: 3, groups: [], subagents: [] });
  });

  // plan-subagent_panel/REQ-1, REQ-15: no step of the main conversation and no turn field, even when the model has steps
  it('carries no step of the main conversation and no turn state', () => {
    const model = { ...modelOf(2, [view('a', at(1))]), steps: () => [{ kind: 'text' as const, text: 'Hello' }] };
    const tree = turnTreeOf(model, 'working');
    expect(Object.keys(tree).sort()).toEqual(['groups', 'number', 'subagents']);
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
    const views = [
      view('a', { ...at(1), ...startedAt(5), meta: { agentType: 'Explore' } }),
      view('b', { ...at(4), ...startedAt(1) }),
      view('c', { state: 'finished' }),
      view('d', { ...under('c', 2), ...startedAt(9) }),
    ];
    const before = JSON.stringify(views);
    treeOf(views);
    expect(JSON.stringify(views)).toBe(before);
  });
});

describe('turnTreeOf, running subagents only', () => {
  // plan-subagent_panel/REQ-14: the running subagents of earlier turns and of the current turn are all at level 0, in start order
  it('lists the running subagents of any turn at level 0, in start order', () => {
    const tree = treeOf([
      view('dev-1', { earlierMessage: 'msg_developers', ...startedAt(1) }),
      view('dev-2', { earlierMessage: 'msg_developers', ...startedAt(2) }),
      view('analyst', { ...at(1, 'msg_analyst'), ...startedAt(10), state: 'finished' }),
      view('tester', { ...at(4, 'msg_tester'), ...startedAt(12) }),
    ]);
    expect(tree.groups).toEqual([group('dev-1', 'dev-2'), group('tester')]);
    expect(idsOf(tree)).toEqual(['dev-1', 'dev-2', 'tester']);
  });

  // plan-subagent_panel/REQ-16: finished and stopped subagents are in no group and not in subagents, at any level
  it('leaves out the finished and stopped subagents, nested ones included', () => {
    const tree = treeOf([
      view('p', { ...at(1, 'm1'), ...startedAt(1) }),
      view('done', { ...under('p', 1, 's1'), ...startedAt(2), state: 'finished' }),
      view('cut', { ...under('p', 2, 's2'), ...startedAt(3), state: 'stopped' }),
      view('alive', { ...under('p', 3, 's3'), ...startedAt(4) }),
      view('old-done', { earlierMessage: 'm0', state: 'finished' }),
      view('main-done', { ...at(5, 'm5'), state: 'stopped' }),
    ]);
    expect(tree.groups).toEqual([group('p')]);
    expect(subagentOf(tree, 'p')?.groups).toEqual([group('alive')]);
    expect(idsOf(tree)).toEqual(['p', 'alive']);
  });

  // plan-subagent_panel/REQ-16, plan-subagent_panel/REQ-20: a tree whose subagents all ended has no group and no subagent
  it('gives no group and no subagent when every subagent ended', () => {
    const tree = treeOf([view('done', { ...at(1), state: 'finished' }), view('cut', { earlierMessage: 'm', state: 'stopped' })]);
    expect(tree).toEqual({ number: 1, groups: [], subagents: [] });
  });

  // plan-subagent_panel/REQ-16: a subagent that ends leaves the next tree, and the update does not name it
  it('drops a subagent that ended from the next tree and from the update', () => {
    const before = treeOf([view('dev-1', { ...at(1, 'm'), ...startedAt(1) }), view('dev-2', { ...at(2, 'm'), ...startedAt(1) })]);
    const after = treeOf([view('dev-1', { ...at(1, 'm'), ...startedAt(1) }), view('dev-2', { ...at(2, 'm'), ...startedAt(1), state: 'finished' })]);
    expect(after.groups).toEqual([group('dev-1')]);
    expect(idsOf(after)).toEqual(['dev-1']);
    expect(turnChangeOf(before, after)).toEqual({ type: 'update', groups: [group('dev-1')] });
  });
});

describe('turnTreeOf, groups', () => {
  // plan-session_activity/REQ-37, plan-subagent_panel/REQ-3: links with no message, at the same or the next step, form one group; a gap starts a new group
  it('groups the subagents started at the same or the next step, and starts a new group after a gap', () => {
    const tree = treeOf([view('a', at(2)), view('b', at(3)), view('c', at(3)), view('d', at(5)), view('e', at(6))]);
    expect(tree.groups).toEqual([group('a', 'b', 'c'), group('d', 'e')]);
  });

  // turn-tree spec: with no start, children keep the step order; equal steps keep the order they became known
  it('keeps the step order, and the known order for equal steps, when no subagent has a start', () => {
    const tree = treeOf([view('late', at(7)), view('second', at(1)), view('first', at(1)), view('middle', at(4))]);
    expect(tree.groups).toEqual([group('second', 'first'), group('middle'), group('late')]);
  });

  // turn-tree spec: the step rule compares the running siblings only
  it('applies the step rule among the running siblings only', () => {
    const tree = treeOf([view('a', { ...at(2), ...startedAt(1) }), view('b', { ...at(3), ...startedAt(2), state: 'finished' }), view('c', { ...at(4), ...startedAt(3) })]);
    expect(tree.groups).toEqual([group('a'), group('c')]);
  });

  // plan-session_activity/REQ-38: a subagent started by a running subagent is in the groups of its parent, at any depth
  it('puts nested subagents in the groups of their parent, at any depth', () => {
    const tree = treeOf([view('p', at(1)), view('c1', under('p', 4)), view('c2', under('p', 5)), view('g', under('c1', 0)), view('c3', under('p', 9))]);
    expect(tree.groups).toEqual([group('p')]);
    expect(subagentOf(tree, 'p')?.groups).toEqual([group('c1', 'c2'), group('c3')]);
    expect(subagentOf(tree, 'c1')?.groups).toEqual([group('g')]);
    expect(subagentOf(tree, 'g')?.groups).toEqual([]);
    expect(idsOf(tree)).toEqual(['p', 'c1', 'c2', 'g', 'c3']);
  });

  // plan-session_activity/REQ-46: 20 subagents started at once form one group
  it('puts 20 subagents started in one message in one group', () => {
    const views = Array.from({ length: 20 }, (_, i) => view(`s${i}`, at(2 + i)));
    expect(treeOf(views).groups).toEqual([{ subagents: views.map((v) => v.id) }]);
  });

  // plan-session_activity/REQ-45: a long turn keeps every running subagent, with no limit of steps
  it('keeps every group of a turn with many steps', () => {
    const views = Array.from({ length: 300 }, (_, i) => view(`s${i}`, { ...at(i * 3), startedAt: new Date(Date.UTC(2026, 10, 27, 10, 0, i)).toISOString() }));
    const tree = treeOf(views);
    expect(tree.groups).toHaveLength(300);
    expect(tree.groups.map((each) => each.subagents[0])).toEqual(views.map((v) => v.id));
  });

  // plan-subagent_panel/REQ-18, "Place of a group": a group holds only its running members
  it('keeps only the running members in a group, so one left is a group of one', () => {
    const tree = treeOf([view('done', { ...at(1, 'm'), ...startedAt(1), state: 'finished' }), view('cut', { ...at(2, 'm'), ...startedAt(1), state: 'stopped' }), view('left', { ...at(3, 'm'), ...startedAt(1) })]);
    expect(tree.groups).toEqual([group('left')]);
  });

  // "Place of a group" (plan-subagent_panel/REQ-3, REQ-14): a group takes the place of its first running member, not of an ended one
  it('places a group at the earliest start of its running members', () => {
    const tree = treeOf([
      view('first-done', { ...at(1, 'm1'), ...startedAt(1), state: 'finished' }),
      view('second', { ...at(2, 'm1'), ...startedAt(8) }),
      view('other', { ...at(5, 'm2'), ...startedAt(5) }),
    ]);
    expect(tree.groups).toEqual([group('other'), group('second')]);
  });
});

describe('turnTreeOf, groups by message', () => {
  // plan-subagent_panel/REQ-3: the calls of two messages are two groups, also with no step between them
  it('makes two groups for the calls of two messages that follow each other', () => {
    const tree = treeOf([view('analyst', { ...at(2, 'm1'), ...startedAt(1) }), view('dev-1', { ...at(3, 'm2'), ...startedAt(5) }), view('dev-2', { ...at(4, 'm2'), ...startedAt(5) })]);
    expect(tree.groups).toEqual([group('analyst'), group('dev-1', 'dev-2')]);
  });

  // turn-tree spec: when both links have a message, the same message joins the group whatever the steps between
  it('keeps the calls of one message in one group, also with a step between them', () => {
    const tree = treeOf([view('a', { ...at(1, 'm1'), ...startedAt(1) }), view('b', { ...at(5, 'm1'), ...startedAt(1) })]);
    expect(tree.groups).toEqual([group('a', 'b')]);
  });

  // turn-tree spec: a link with no message falls back to the step rule
  it('uses the step rule when one of the two links has no message', () => {
    expect(treeOf([view('a', at(2, 'm1')), view('b', at(3))]).groups).toEqual([group('a', 'b')]);
    expect(treeOf([view('a', at(2)), view('b', at(3, 'm2'))]).groups).toEqual([group('a', 'b')]);
    expect(treeOf([view('a', at(2)), view('b', at(5, 'm2'))]).groups).toEqual([group('a'), group('b')]);
  });

  // plan-subagent_panel/REQ-3, plan-session_activity/REQ-38: the same rule for the children of a subagent
  it('makes two nested groups for the calls of two messages of a parent', () => {
    const tree = treeOf([view('p', at(0, 'm0')), view('c1', under('p', 1, 's1')), view('c2', under('p', 2, 's2')), view('c3', under('p', 3, 's2'))]);
    expect(subagentOf(tree, 'p')?.groups).toEqual([group('c1'), group('c2', 'c3')]);
  });

  // plan-session_activity/REQ-58: the agents of one workflow launch share one link, so they form one group
  it('keeps the agents of one workflow launch in one group', () => {
    const tree = treeOf([view('w1', { ...at(1, 'mw'), ...startedAt(9) }), view('w2', { ...at(1, 'mw'), ...startedAt(4) }), view('t', { ...at(2, 'mt'), ...startedAt(6) })]);
    expect(tree.groups).toEqual([group('w2', 'w1'), group('t')]);
  });

  // plan-subagent_panel/REQ-3, REQ-14: the running subagents of one message of an earlier turn form one group, another message another group
  it('groups the subagents of earlier turns by the message of their call', () => {
    const tree = treeOf([
      view('dev-1', { earlierMessage: 'msg_developers', ...startedAt(1) }),
      view('tester', { earlierMessage: 'msg_tester', ...startedAt(2) }),
      view('dev-2', { earlierMessage: 'msg_developers', ...startedAt(1) }),
    ]);
    expect(tree.groups).toEqual([group('dev-1', 'dev-2'), group('tester')]);
  });

  // turn-tree spec: a subagent with no startedBy and no earlierMessage is a group of its own
  it('makes a group of its own of each subagent with no link and no earlier message', () => {
    expect(treeOf([view('x', startedAt(1)), view('y', startedAt(1))]).groups).toEqual([group('x'), group('y')]);
  });
});

describe('turnTreeOf, a running subagent whose parent ended', () => {
  // plan-subagent_panel/REQ-17: the child of an ended level-0 parent takes its level and its place
  it('puts the child of an ended parent at level 0, in the place of that parent', () => {
    const tree = treeOf([
      view('analyst', { ...at(1, 'm1'), ...startedAt(1), state: 'finished' }),
      view('developer', { ...at(3, 'm2'), ...startedAt(2) }),
      view('tester', { ...under('analyst', 4, 's1'), ...startedAt(5) }),
    ]);
    expect(tree.groups).toEqual([group('tester'), group('developer')]);
    expect(subagentOf(tree, 'tester')?.groups).toEqual([]);
    expect(idsOf(tree)).not.toContain('analyst');
  });

  // plan-subagent_panel/REQ-17, "Place of a subagent whose parent ended": the rule repeats over two ended levels, sorting by the highest ended ancestor
  it('climbs two ended ancestors up to level 0, and sorts by the start of the highest one', () => {
    const tree = treeOf([
      view('a', { ...at(1, 'm1'), ...startedAt(1), state: 'finished' }),
      view('b', { ...under('a', 2, 's1'), ...startedAt(4), state: 'stopped' }),
      view('d', { ...at(3, 'm2'), ...startedAt(3) }),
      view('t', { ...under('b', 3, 's2'), ...startedAt(6) }),
    ]);
    expect(tree.groups).toEqual([group('t'), group('d')]);
    expect(idsOf(tree).sort()).toEqual(['d', 't']);
  });

  // plan-subagent_panel/REQ-17: the child goes in the groups of the nearest running ancestor, at the place of its ended parent
  it('puts the child of an ended parent in the groups of the nearest running ancestor', () => {
    const tree = treeOf([
      view('r', { ...at(1, 'm1'), ...startedAt(0) }),
      view('e', { ...under('r', 1, 's1'), ...startedAt(1), state: 'stopped' }),
      view('c', { ...under('r', 5, 's3'), ...startedAt(3) }),
      view('t', { ...under('e', 2, 's2'), ...startedAt(6) }),
    ]);
    expect(tree.groups).toEqual([group('r')]);
    expect(subagentOf(tree, 'r')?.groups).toEqual([group('t'), group('c')]);
    expect(subagentOf(tree, 't')?.groups).toEqual([]);
  });

  // turn-tree spec: the subagents that one ended parent started by one message stay one group, and no group of the level splits it
  it('keeps the children of one message of an ended parent in one group', () => {
    const tree = treeOf([
      view('p', { ...at(1, 'm1'), ...startedAt(1), state: 'finished' }),
      view('c1', { ...under('p', 2, 's1'), ...startedAt(5) }),
      view('d', { ...at(4, 'm2'), ...startedAt(7) }),
      view('c2', { ...under('p', 3, 's1'), ...startedAt(9) }),
    ]);
    expect(tree.groups).toEqual([group('c1', 'c2'), group('d')]);
  });

  // batch running-subagents, "A subagent whose parent ended": equal sort starts keep the start order of the subagents
  it('orders two groups of one ended parent by the start of their subagents', () => {
    const tree = treeOf([
      view('p', { ...at(1, 'm1'), ...startedAt(1), state: 'finished' }),
      view('late', { ...under('p', 2, 's1'), ...startedAt(9) }),
      view('early', { ...under('p', 3, 's2'), ...startedAt(4) }),
    ]);
    expect(tree.groups).toEqual([group('early'), group('late')]);
  });

  // plan-subagent_panel/REQ-14, REQ-17: the running child of an ended subagent of an earlier turn takes its place at level 0
  it('places the child of an ended subagent of an earlier turn at the start of that subagent', () => {
    const tree = treeOf([
      view('old', { earlierMessage: 'm-old', ...startedAt(1), state: 'finished' }),
      view('now', { ...at(1, 'm1'), ...startedAt(10) }),
      view('child', { ...under('old', 2, 's1'), ...startedAt(20) }),
    ]);
    expect(tree.groups).toEqual([group('child'), group('now')]);
  });

  // turn-tree spec: a running child of an unknown parent is at level 0, sorted by its own start
  it('puts a child of an unknown parent at level 0, at its own start', () => {
    const tree = treeOf([view('orphan', { ...under('gone', 1), ...startedAt(5) }), view('main', { ...at(1, 'm1'), ...startedAt(3) })]);
    expect(tree.groups).toEqual([group('main'), group('orphan')]);
  });

  // turn-tree spec: the children of one unknown parent group by their links, as siblings of one parent
  it('groups the children of an unknown parent by the step rule', () => {
    const tree = treeOf([view('x', { ...under('gone', 1), ...startedAt(1) }), view('y', { ...under('gone', 2), ...startedAt(1) })]);
    expect(tree.groups).toEqual([group('x', 'y')]);
  });

  // turn-tree spec: a loop of running parents counts its first subagent at level 0; each subagent shows once
  it('breaks a loop of running parents at its first subagent, and shows each subagent once', () => {
    const tree = treeOf([view('x', under('y', 1)), view('y', under('x', 2))]);
    expect(tree.groups).toEqual([group('x')]);
    expect(subagentOf(tree, 'x')?.groups).toEqual([group('y')]);
    expect(subagentOf(tree, 'y')?.groups).toEqual([]);
    expect(idsOf(tree)).toEqual(['x', 'y']);
  });

  // turn-tree spec: a loop met while climbing ended ancestors puts the subagent at level 0
  it('puts a running subagent at level 0 when its ended ancestors loop', () => {
    const tree = treeOf([view('x', { ...under('y', 1), ...startedAt(2) }), view('y', { ...under('x', 1), ...startedAt(1), state: 'finished' })]);
    expect(tree.groups).toEqual([group('x')]);
    expect(idsOf(tree)).toEqual(['x']);
  });
});

describe('turnTreeOf, start order', () => {
  // plan-subagent_panel/REQ-14: groups of the main conversation sort by start, not by step
  it('sorts the groups by start', () => {
    const tree = treeOf([view('first-step', { ...at(1), ...startedAt(9) }), view('second-step', { ...at(5), ...startedAt(2) }), view('third-step', { ...at(9), ...startedAt(5) })]);
    expect(tree.groups).toEqual([group('second-step'), group('third-step'), group('first-step')]);
  });

  // plan-subagent_panel/REQ-3: a group takes the place of its earliest started subagent
  it('places a group at the earliest start of its subagents', () => {
    const tree = treeOf([view('g1', { ...at(1), ...startedAt(4) }), view('g2', { ...at(2), ...startedAt(20) }), view('solo', { ...at(6), ...startedAt(5) })]);
    expect(tree.groups).toEqual([group('g1', 'g2'), group('solo')]);
    const later = treeOf([view('g1', { ...at(1), ...startedAt(8) }), view('g2', { ...at(2), ...startedAt(20) }), view('solo', { ...at(6), ...startedAt(5) })]);
    expect(later.groups).toEqual([group('solo'), group('g1', 'g2')]);
  });

  // plan-subagent_panel/REQ-14: inside a group the subagents sort by start
  it('sorts the subagents of a group by start', () => {
    const tree = treeOf([view('a', { ...at(3), ...startedAt(7) }), view('b', { ...at(3), ...startedAt(1) }), view('c', { ...at(4), ...startedAt(4) })]);
    expect(tree.groups).toEqual([group('b', 'c', 'a')]);
  });

  // turn-tree spec: a missing start sorts last, for the subagents of a group and for the groups
  it('puts a subagent or a group with no start last', () => {
    const tree = treeOf([
      view('no-start', at(1)),
      view('started', { ...at(1), ...startedAt(9) }),
      view('lone-no-start', at(5)),
      view('lone-started', { ...at(9), ...startedAt(12) }),
    ]);
    expect(tree.groups).toEqual([group('started', 'no-start'), group('lone-started'), group('lone-no-start')]);
  });

  // turn-tree spec: equal starts keep the step order
  it('keeps the step order for equal starts', () => {
    const tree = treeOf([view('later-step', { ...at(8), ...startedAt(3) }), view('earlier-step', { ...at(1), ...startedAt(3) }), view('b', { ...at(2), ...startedAt(3) })]);
    expect(tree.groups).toEqual([group('earlier-step', 'b'), group('later-step')]);
  });

  // plan-subagent_panel/REQ-14: the start order also holds for the subagents nested under one parent
  it('sorts nested groups and the subagents inside them by start', () => {
    const tree = treeOf([
      view('p', { ...at(0), ...startedAt(0) }),
      view('c-early-step', { ...under('p', 1), ...startedAt(30) }),
      view('c-late-step', { ...under('p', 6), ...startedAt(10) }),
      view('d-1', { ...under('p', 9), ...startedAt(25) }),
      view('d-2', { ...under('p', 9), ...startedAt(20) }),
    ]);
    expect(subagentOf(tree, 'p')?.groups).toEqual([group('c-late-step'), group('d-2', 'd-1'), group('c-early-step')]);
  });

  // plan-subagent_panel/REQ-14: subagents of earlier turns and of the current turn share one start order; a missing start sorts last
  it('sorts the subagents of earlier turns with those of the current turn, a missing start last', () => {
    const tree = treeOf([view('old-none'), view('old-late', startedAt(30)), view('old-early', startedAt(1)), view('now', { ...at(0), ...startedAt(20) })]);
    expect(tree.groups).toEqual([group('old-early'), group('now'), group('old-late'), group('old-none')]);
  });

  // turn-tree spec: equal starts, or both missing, keep the known order
  it('keeps the known order of subagents with no link for equal or missing starts', () => {
    expect(treeOf([view('x', startedAt(3)), view('y', startedAt(3)), view('z', startedAt(3))]).groups).toEqual([group('x'), group('y'), group('z')]);
    expect(treeOf([view('m'), view('n')]).groups).toEqual([group('m'), group('n')]);
  });

  // plan-subagent_panel/REQ-14: the groups of earlier turns and their subagents sort by start, a missing start last
  it('sorts the groups of earlier turns and their subagents by start', () => {
    const tree = treeOf([
      view('late-1', { earlierMessage: 'm-late', ...startedAt(20) }),
      view('no-start', { earlierMessage: 'm-early' }),
      view('early-2', { earlierMessage: 'm-early', ...startedAt(9) }),
      view('early-1', { earlierMessage: 'm-early', ...startedAt(3) }),
      view('solo-no-start'),
      view('late-0', { earlierMessage: 'm-late', ...startedAt(5) }),
    ]);
    expect(tree.groups).toEqual([group('early-1', 'early-2', 'no-start'), group('late-0', 'late-1'), group('solo-no-start')]);
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

  // turn-tree spec, plan-subagent_panel/REQ-16: only running subagents are in the tree, so no end time ever shows
  it('never gives an end time', () => {
    const times = { startedAt: '2026-11-26T10:00:00.000Z', lastLineAt: '2026-11-26T10:07:00.000Z' };
    const tree = treeOf([view('a', { ...at(1), ...times }), view('b', { ...at(2), ...times, state: 'finished' })]);
    expect(tree.subagents.map((subagent) => subagent.endedAt)).toEqual([undefined]);
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

  // plan-session_activity/REQ-36: no open call → no current tool
  it('gives no current tool with no open call', () => {
    expect(subagentOf(treeOf([view('a', at(1))]), 'a')?.currentTool).toBeUndefined();
  });
});

describe('turnChangeOf', () => {
  const base = (): TurnTree => ({
    number: 2,
    groups: [group('a')],
    subagents: [{ id: 'a', type: 'Explore', state: 'running', groups: [] }],
  });

  // plan-session_activity/REQ-43: no previous tree or a new turn number → the whole tree
  it('gives the whole tree with no previous tree or a new number', () => {
    const previous = base();
    const renumbered = { ...previous, number: 3 };
    expect(turnChangeOf(undefined, previous)).toEqual({ type: 'turn', turn: previous });
    expect(turnChangeOf(previous, renumbered)).toEqual({ type: 'turn', turn: renumbered });
  });

  // plan-subagent_panel/REQ-16: with the same number, a smaller tree is an update, not the whole tree
  it('gives an update, not the whole tree, when the same turn loses its groups', () => {
    const previous = base();
    expect(turnChangeOf(previous, { ...previous, groups: [], subagents: [] })).toEqual({ type: 'update', groups: [] });
  });

  // turn-tree spec: nothing changed → undefined
  it('gives undefined when nothing changed', () => {
    const previous = base();
    expect(turnChangeOf(previous, { ...previous, groups: [group('a')], subagents: [{ ...previous.subagents[0]! }] })).toBeUndefined();
  });

  // plan-subagent_panel/REQ-14: a new order of the groups is a change of the groups
  it('gives the whole groups when only their order changed', () => {
    const previous: TurnTree = { ...base(), groups: [group('a'), group('b')] };
    const groups = [group('b'), group('a')];
    expect(turnChangeOf(previous, { ...previous, groups })).toEqual({ type: 'update', groups });
  });

  // plan-subagent_panel/REQ-10: groups compare as groups: a new grouping is a change
  it('gives the whole groups when the grouping changed', () => {
    const previous: TurnTree = { ...base(), groups: [group('a'), group('b')] };
    const joined = [group('a', 'b')];
    expect(turnChangeOf(previous, { ...previous, groups: joined })).toEqual({ type: 'update', groups: joined });
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
    const changed: TurnSubagent = { id: 'a', type: 'Explore', state: 'running', latestText: 'Reading the specs', groups: [] };
    const added: TurnSubagent = { id: 'b', state: 'running', groups: [] };
    const update = turnChangeOf(previous, { ...previous, subagents: [changed, { id: 'same', state: 'running', groups: [] }, added] });
    expect(update).toEqual({ type: 'update', subagents: [changed, added] });
  });

  // plan-session_activity/REQ-38: a change of the nested groups of a subagent is a changed field
  it('gives a subagent whose nested groups changed', () => {
    const previous = base();
    const nested: TurnSubagent = { ...previous.subagents[0]!, groups: [group('child')] };
    expect(turnChangeOf(previous, { ...previous, subagents: [nested] })).toEqual({ type: 'update', subagents: [nested] });
  });
});
