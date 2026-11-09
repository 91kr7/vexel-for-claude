import type { SessionSummary } from './live-session-store';
import { groupSessions, type SessionOrder } from './session-order';

export type NavigationTarget =
  | { kind: 'previous' }
  | { kind: 'next' }
  | { kind: 'position'; position: number }
  | { kind: 'next-needs-input' };

export function sessionToOpen(
  sessions: readonly SessionSummary[],
  order: SessionOrder,
  openSessionId: string | null,
  target: NavigationTarget,
): string | null {
  const list = groupSessions(sessions, order).flatMap((group) => group.sessions);
  const openIndex = list.findIndex((session) => session.id === openSessionId);
  const found = openIndex >= 0;
  switch (target.kind) {
    case 'previous':
      return (found ? list[openIndex - 1] : list.at(-1))?.id ?? null;
    case 'next':
      return (found ? list[openIndex + 1] : list[0])?.id ?? null;
    case 'position':
      return Number.isInteger(target.position) && target.position >= 1 ? (list[target.position - 1]?.id ?? null) : null;
    case 'next-needs-input': {
      const start = found ? openIndex + 1 : 0;
      for (let step = 0; step < list.length; step++) {
        const session = list[(start + step) % list.length];
        if (session?.state === 'needs_input') return session.id;
      }
      return null;
    }
  }
}
