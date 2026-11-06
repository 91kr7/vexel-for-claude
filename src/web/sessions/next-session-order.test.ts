import { describe, expect, it } from 'vitest';
import type { SessionState, SessionSummary } from './live-session-store';
import { nextSessionOrder } from './next-session-order';
import { type SessionOrder, groupSessions } from './session-order';

const at = (minute: number) => `2026-11-06T10:${String(minute).padStart(2, '0')}:00.000Z`;

const session = (id: string, state: SessionState, minute: number): SessionSummary => ({
  id,
  folder: `/projects/${id}`,
  label: id,
  state,
  lastActivity: at(minute),
});

const external = (id: string, state: SessionState, minute: number): SessionSummary => ({ ...session(id, state, minute), external: true });

const listed = (sessions: readonly SessionSummary[], order: SessionOrder) => groupSessions(sessions, order).map((g) => [g.id, g.sessions.map((s) => s.id)]);

describe('nextSessionOrder', () => {
  // next-session-order spec: an empty previous order gives each group in latest-activity order
  it('lists each group latest activity first when there is no previous order', () => {
    const sessions = [
      session('run-old', 'idle', 1),
      session('ask-old', 'needs_input', 2),
      session('run-new', 'working', 5),
      external('ext', 'working', 3),
      session('ask-new', 'needs_input', 6),
      session('gone', 'ended', 4),
    ];
    expect(nextSessionOrder({}, sessions)).toEqual({
      'needs-input': ['ask-new', 'ask-old'],
      running: ['run-new', 'run-old'],
      external: ['ext'],
      ended: ['gone'],
    });
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-1
  it('keeps every session in its place when one of them has the latest activity or changes state inside its group', () => {
    const previous: SessionOrder = { running: ['a', 'b', 'c'] };
    const sessions = [session('a', 'idle', 1), session('b', 'idle', 2), session('c', 'working', 59)];
    expect(nextSessionOrder(previous, sessions)).toEqual({ running: ['a', 'b', 'c'] });
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-2
  it('puts a new session at the end of its group, after older ones with less recent activity', () => {
    const previous: SessionOrder = { running: ['a', 'b'] };
    const sessions = [session('new', 'idle', 59), session('a', 'idle', 1), session('b', 'idle', 2)];
    expect(nextSessionOrder(previous, sessions).running).toEqual(['a', 'b', 'new']);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-2: several new sessions, the most recent first
  it('appends several new sessions the most recent activity first', () => {
    const previous: SessionOrder = { running: ['a'] };
    const sessions = [session('a', 'idle', 1), session('older', 'idle', 10), session('newer', 'idle', 20)];
    expect(nextSessionOrder(previous, sessions).running).toEqual(['a', 'newer', 'older']);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-3, REQ-4
  it('moves a session that changed group to the end of the target group and keeps the others of the source group in order', () => {
    const previous: SessionOrder = { 'needs-input': ['e'], running: ['a', 'b', 'c'] };
    const sessions = [session('a', 'idle', 1), session('b', 'needs_input', 59), session('c', 'idle', 3), session('e', 'needs_input', 2)];
    expect(nextSessionOrder(previous, sessions)).toEqual({ 'needs-input': ['e', 'b'], running: ['a', 'c'] });
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-3: a session that comes back to a group goes at the end
  it('puts a session that comes back to a group at the end, not at its old place', () => {
    const left = nextSessionOrder({ running: ['a', 'b', 'c'] }, [session('a', 'idle', 1), session('b', 'needs_input', 5), session('c', 'idle', 3)]);
    const back = nextSessionOrder(left, [session('a', 'idle', 1), session('b', 'idle', 6), session('c', 'idle', 3)]);
    expect(back).toEqual({ running: ['a', 'c', 'b'] });
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-3: an ended session moves to "Ended", hosted or external
  it('moves an ended session to the end of the ended group', () => {
    const previous: SessionOrder = { running: ['a', 'b'], external: ['x'], ended: ['old'] };
    const sessions = [session('a', 'ended', 9), session('b', 'idle', 2), external('x', 'ended', 8), session('old', 'ended', 1)];
    expect(nextSessionOrder(previous, sessions)).toEqual({ running: ['b'], ended: ['old', 'a', 'x'] });
  });

  // next-session-order spec: a missing session drops out, and a group with no session has no list
  it('drops a missing session and leaves out the list of a group with no session', () => {
    const previous: SessionOrder = { running: ['a', 'gone', 'b'], ended: ['gone-too'] };
    const next = nextSessionOrder(previous, [session('a', 'idle', 1), session('b', 'idle', 2)]);
    expect(next.running).toEqual(['a', 'b']);
    expect(next.ended).toBeUndefined();
    expect(next['needs-input']).toBeUndefined();
  });

  // next-session-order spec: the inputs are not changed
  it('does not change its inputs', () => {
    const previous: SessionOrder = Object.freeze({ running: Object.freeze(['a', 'b']) });
    const sessions = Object.freeze([session('b', 'needs_input', 2), session('a', 'idle', 1), session('c', 'idle', 3)]);
    const next = nextSessionOrder(previous, sessions);
    expect(next).not.toBe(previous);
    expect(previous).toEqual({ running: ['a', 'b'] });
    expect(sessions.map((s) => s.id)).toEqual(['b', 'a', 'c']);
  });

  // next-session-order invariant: every session id is in exactly one list, and no list has an unknown id
  it('lists every current session exactly once and nothing else', () => {
    const states: SessionState[] = ['working', 'needs_input', 'idle', 'ended'];
    const sessions = states.flatMap((state, i) => [session(`h-${state}`, state, i), external(`e-${state}`, state, i + 10)]);
    const previous: SessionOrder = { running: ['h-idle', 'unknown'], 'needs-input': ['h-working', 'h-working'], ended: ['e-ended'] };
    const ids = Object.values(nextSessionOrder(previous, sessions)).flat();
    expect([...ids].sort()).toEqual(sessions.map((s) => s.id).sort());
  });

  // next-session-order invariant: groupSessions lists the same order with the new order as with the previous one
  it('gives groupSessions the same lists as the previous order did', () => {
    const cases: [SessionOrder, SessionSummary[]][] = [
      [{}, [session('a', 'idle', 1), session('b', 'working', 2), external('x', 'idle', 3)]],
      [{ running: ['a', 'b', 'c'] }, [session('a', 'idle', 1), session('b', 'needs_input', 9), session('c', 'working', 3), session('d', 'idle', 7)]],
      [{ 'needs-input': ['e'], running: ['a', 'gone'], ended: ['z'] }, [session('e', 'idle', 1), session('a', 'ended', 2), session('z', 'ended', 3), session('n', 'needs_input', 4)]],
    ];
    for (const [previous, sessions] of cases) {
      expect(listed(sessions, nextSessionOrder(previous, sessions))).toEqual(listed(sessions, previous));
    }
  });
});
