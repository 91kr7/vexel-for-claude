import type { SessionSummary } from './live-session-store';

export function orderSessions(sessions: readonly SessionSummary[]): SessionSummary[] {
  return [...sessions].sort((a, b) => {
    const needsInput = Number(b.state === 'needs_input') - Number(a.state === 'needs_input');
    return needsInput || Date.parse(b.lastActivity) - Date.parse(a.lastActivity);
  });
}
