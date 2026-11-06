import type { SessionSummary } from './live-session-store';
import { groupSessions, type SessionOrder } from './session-order';

export function nextSessionOrder(previous: SessionOrder, sessions: readonly SessionSummary[]): SessionOrder {
  const next: SessionOrder = {};
  for (const group of groupSessions(sessions, previous)) next[group.id] = group.sessions.map((session) => session.id);
  return next;
}
