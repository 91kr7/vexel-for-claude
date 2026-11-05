import { CircleAlertIcon } from '../icons/Icons';
import type { SessionSummary } from './live-session-store';

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
        <span className="chip label-l needs-input-chip">
          <CircleAlertIcon />
          {count} richiede input
        </span>
      )}
    </span>
  );
}
