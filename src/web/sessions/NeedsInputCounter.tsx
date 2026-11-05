import type { SessionSummary } from './live-session-store';
import { StateIcon } from './StateBadge';

interface NeedsInputCounterProps {
  sessions: readonly SessionSummary[];
}

export function NeedsInputCounter({ sessions }: NeedsInputCounterProps) {
  const count = sessions.filter((session) => session.state === 'needs_input').length;
  return (
    <p className={count > 0 ? 'needs-input-counter active' : 'needs-input-counter'} role="status">
      {count > 0 && <StateIcon state="needs_input" />}
      Richiede input: {count}
    </p>
  );
}
