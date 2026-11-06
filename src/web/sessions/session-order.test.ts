import { describe, expect, it } from 'vitest';
import type { SessionState, SessionSummary } from './live-session-store';
import { groupSessions, orderSessions } from './session-order';

const session = (id: string, state: SessionState, lastActivity: string): SessionSummary => ({
  id,
  folder: `/projects/${id}`,
  label: id,
  state,
  lastActivity,
});

const external = (id: string, state: SessionState, lastActivity: string): SessionSummary => ({ ...session(id, state, lastActivity), external: true });

const shape = (groups: ReturnType<typeof groupSessions>) => groups.map((g) => [g.id, g.title, g.sessions.map((s) => s.id)]);

describe('orderSessions', () => {
  // plan-claude_sessions_client/REQ-16: needs input first, then most recent activity first
  it('puts needs_input first, each group by most recent activity', () => {
    const input = [
      session('old-idle', 'idle', '2026-11-05T08:00:00.000Z'),
      session('old-ask', 'needs_input', '2026-11-05T07:00:00.000Z'),
      session('new-working', 'working', '2026-11-05T10:00:00.000Z'),
      session('ended', 'ended', '2026-11-05T09:00:00.000Z'),
      session('new-ask', 'needs_input', '2026-11-05T09:30:00.000Z'),
    ];
    expect(orderSessions(input).map((s) => s.id)).toEqual(['new-ask', 'old-ask', 'new-working', 'ended', 'old-idle']);
  });

  // plan-claude_sessions_client/REQ-16: equal keys keep their input order
  it('keeps the input order for equal keys', () => {
    const at = '2026-11-05T10:00:00.000Z';
    const input = [session('b', 'idle', at), session('a', 'working', at), session('c', 'ended', at)];
    expect(orderSessions(input).map((s) => s.id)).toEqual(['b', 'a', 'c']);
  });

  // plan-claude_sessions_client/REQ-16: returns a new array and leaves the input unchanged
  it('returns a new array and does not change the input', () => {
    const input = Object.freeze([
      session('a', 'idle', '2026-11-05T08:00:00.000Z'),
      session('b', 'needs_input', '2026-11-05T07:00:00.000Z'),
    ]);
    const output = orderSessions(input);
    expect(output).not.toBe(input);
    expect(input.map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('groupSessions', () => {
  const at = (hour: number) => `2026-11-05T${String(hour).padStart(2, '0')}:00:00.000Z`;

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-16, REQ-17, REQ-18: the four groups in order, each with its sessions
  it('returns the four groups in order with the sessions of each', () => {
    const input = [
      session('ended', 'ended', at(1)),
      external('ext-working', 'working', at(2)),
      session('hosted-idle', 'idle', at(3)),
      external('ext-asking', 'needs_input', at(4)),
      session('hosted-working', 'working', at(5)),
      external('ext-idle', 'idle', at(6)),
      session('hosted-asking', 'needs_input', at(7)),
    ];
    expect(shape(groupSessions(input))).toEqual([
      ['needs-input', 'Needs Input', ['hosted-asking', 'ext-asking']],
      ['running', 'Running', ['hosted-working', 'hosted-idle']],
      ['external', 'In Other Terminals', ['ext-idle', 'ext-working']],
      ['ended', 'Ended', ['ended']],
    ]);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-16: an empty group is left out
  it('leaves out every group with no session', () => {
    expect(groupSessions([])).toEqual([]);
    expect(shape(groupSessions([session('a', 'working', at(1)), session('b', 'ended', at(2))]))).toEqual([
      ['running', 'Running', ['a']],
      ['ended', 'Ended', ['b']],
    ]);
    expect(shape(groupSessions([external('x', 'needs_input', at(1))]))).toEqual([['needs-input', 'Needs Input', ['x']]]);
  });

  // session-order spec: an ended session goes to "Ended", external or not
  it('puts an ended external session in "Ended"', () => {
    expect(shape(groupSessions([external('x', 'ended', at(1))]))).toEqual([['ended', 'Ended', ['x']]]);
  });

  // session-order spec: inside each group the most recent lastActivity comes first, equal times keep input order
  it('orders each group by most recent activity, keeping input order on equal times', () => {
    const input = [
      session('old', 'idle', at(1)),
      session('tie-b', 'working', at(5)),
      session('new', 'working', at(9)),
      session('tie-a', 'idle', at(5)),
    ];
    expect(groupSessions(input)[0]?.sessions.map((s) => s.id)).toEqual(['new', 'tie-b', 'tie-a', 'old']);
  });

  // session-order invariant: every session is in exactly one group
  it('places every session in exactly one group', () => {
    const states: SessionState[] = ['working', 'needs_input', 'idle', 'ended'];
    const input = states.flatMap((state, i) => [session(`h-${state}`, state, at(i)), external(`e-${state}`, state, at(i))]);
    const ids = groupSessions(input).flatMap((g) => g.sessions.map((s) => s.id));
    expect([...ids].sort()).toEqual(input.map((s) => s.id).sort());
  });

  // session-order spec: the input is not changed
  it('does not change the input', () => {
    const input = Object.freeze([session('a', 'idle', at(1)), session('b', 'idle', at(2))]);
    groupSessions(input);
    expect(input.map((s) => s.id)).toEqual(['a', 'b']);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-1: the ordered sessions first, in that order
  it('lists the sessions of the order first, in that order, whatever their activity', () => {
    const input = [session('a', 'idle', at(1)), session('b', 'working', at(9)), session('c', 'idle', at(5))];
    expect(shape(groupSessions(input, { running: ['a', 'c', 'b'] }))).toEqual([['running', 'Running', ['a', 'c', 'b']]]);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-2, REQ-3: sessions missing from the order go at the end, latest activity first
  it('puts the sessions missing from the order at the end, latest activity first, equal times in input order', () => {
    const input = [
      session('old', 'idle', at(1)),
      session('tie-b', 'idle', at(6)),
      session('kept', 'idle', at(2)),
      session('new', 'working', at(9)),
      session('tie-a', 'idle', at(6)),
    ];
    expect(groupSessions(input, { running: ['kept'] })[0]?.sessions.map((s) => s.id)).toEqual(['kept', 'new', 'tie-b', 'tie-a', 'old']);
  });

  // session-order spec: an id listed twice counts at its first place
  it('places an id listed twice at its first place', () => {
    const input = [session('a', 'idle', at(1)), session('b', 'idle', at(2))];
    expect(groupSessions(input, { running: ['a', 'b', 'a'] })[0]?.sessions.map((s) => s.id)).toEqual(['a', 'b']);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-3: an id with no session in that group changes nothing
  it('ignores ids of the order with no session in that group', () => {
    const input = [session('a', 'idle', at(1)), session('b', 'needs_input', at(2)), session('c', 'idle', at(3))];
    expect(shape(groupSessions(input, { running: ['gone', 'b', 'a'], 'needs-input': ['a'] }))).toEqual([
      ['needs-input', 'Needs Input', ['b']],
      ['running', 'Running', ['a', 'c']],
    ]);
  });

  // session-order spec: each group follows its own list of the order
  it('applies each group list to its own group only', () => {
    const input = [external('x', 'idle', at(1)), external('y', 'idle', at(2)), session('e', 'ended', at(3)), session('f', 'ended', at(4))];
    expect(shape(groupSessions(input, { external: ['x', 'y'], ended: ['e', 'f'] }))).toEqual([
      ['external', 'In Other Terminals', ['x', 'y']],
      ['ended', 'Ended', ['e', 'f']],
    ]);
  });

  // session-order spec: the order is not changed
  it('does not change the order it receives', () => {
    const order = Object.freeze({ running: Object.freeze(['b', 'a']) });
    groupSessions([session('a', 'idle', at(1)), session('b', 'idle', at(2)), session('c', 'idle', at(3))], order);
    expect(order).toEqual({ running: ['b', 'a'] });
  });
});
