import type { SessionSummary } from './live-session-store';

export type SessionGroupId = 'needs-input' | 'running' | 'external' | 'ended';

export interface SessionGroup {
  id: SessionGroupId;
  title: string;
  sessions: SessionSummary[];
}

export type SessionOrder = Partial<Record<SessionGroupId, readonly string[]>>;

const GROUPS: readonly { id: SessionGroupId; title: string }[] = [
  { id: 'needs-input', title: 'Needs Input' },
  { id: 'running', title: 'Running' },
  { id: 'external', title: 'In Other Terminals' },
  { id: 'ended', title: 'Ended' },
];

function groupOf(session: SessionSummary): SessionGroupId {
  if (session.state === 'needs_input') return 'needs-input';
  if (session.state === 'ended') return 'ended';
  return session.external ? 'external' : 'running';
}

export function orderSessions(sessions: readonly SessionSummary[]): SessionSummary[] {
  return [...sessions].sort((a, b) => {
    const needsInput = Number(b.state === 'needs_input') - Number(a.state === 'needs_input');
    return needsInput || Date.parse(b.lastActivity) - Date.parse(a.lastActivity);
  });
}

export function groupSessions(sessions: readonly SessionSummary[], order: SessionOrder = {}): SessionGroup[] {
  const latestFirst = [...sessions].sort((a, b) => Date.parse(b.lastActivity) - Date.parse(a.lastActivity));
  return GROUPS.map(({ id, title }) => {
    const position = new Map<string, number>();
    (order[id] ?? []).forEach((sessionId, index) => {
      if (!position.has(sessionId)) position.set(sessionId, index);
    });
    const rank = (session: SessionSummary) => position.get(session.id) ?? Number.MAX_SAFE_INTEGER;
    const members = latestFirst.filter((session) => groupOf(session) === id).sort((a, b) => rank(a) - rank(b));
    return { id, title, sessions: members };
  }).filter((group) => group.sessions.length > 0);
}
