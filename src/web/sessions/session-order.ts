import type { SessionSummary } from './live-session-store';

export type SessionGroupId = 'needs-input' | 'running' | 'external' | 'ended';

export interface SessionGroup {
  id: SessionGroupId;
  title: string;
  sessions: SessionSummary[];
}

const GROUPS: readonly { id: SessionGroupId; title: string }[] = [
  { id: 'needs-input', title: 'Richiedono input' },
  { id: 'running', title: 'In corso' },
  { id: 'external', title: 'In altri terminali' },
  { id: 'ended', title: 'Terminate' },
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

export function groupSessions(sessions: readonly SessionSummary[]): SessionGroup[] {
  const ordered = orderSessions(sessions);
  return GROUPS.map(({ id, title }) => ({ id, title, sessions: ordered.filter((session) => groupOf(session) === id) })).filter(
    (group) => group.sessions.length > 0,
  );
}
