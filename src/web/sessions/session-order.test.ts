import { describe, expect, it } from 'vitest';
import type { SessionState, SessionSummary } from './live-session-store';
import { orderSessions } from './session-order';

const session = (id: string, state: SessionState, lastActivity: string): SessionSummary => ({
  id,
  folder: `/projects/${id}`,
  label: id,
  state,
  lastActivity,
});

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
