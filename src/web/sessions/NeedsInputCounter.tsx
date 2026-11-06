import type { SessionSummary } from './live-session-store';
import { StateDot } from './StateBadge';

export function countNeedsInput(sessions: readonly SessionSummary[]): number {
  return sessions.filter((session) => session.state === 'needs_input').length;
}

interface NeedsInputCounterProps {
  sessions: readonly SessionSummary[];
}

export function NeedsInputCounter({ sessions }: NeedsInputCounterProps) {
  const count = countNeedsInput(sessions);
  return (
    <span className="needs-input-counter" role="status">
      {count > 0 && (
        <span className="status-pill state-needs_input needs-input-chip">
          <StateDot state="needs_input" />
          {count} richiede input
        </span>
      )}
    </span>
  );
}
