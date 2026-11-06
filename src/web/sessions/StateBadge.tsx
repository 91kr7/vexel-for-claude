import type { SessionState } from './live-session-store';

const STATE_NAMES: Record<SessionState, string> = {
  working: 'Lavora',
  needs_input: 'Richiede input',
  idle: 'In attesa',
  ended: 'Terminata',
};

export function StateDot({ state }: { state: SessionState }) {
  return <span className={`state-dot state-${state}`} aria-hidden="true" />;
}

export function StateBadge({ state, variant = 'inline' }: { state: SessionState; variant?: 'dot' | 'inline' | 'chip' }) {
  if (variant === 'dot') return <StateDot state={state} />;
  if (variant === 'chip') {
    return (
      <span className={`status-pill state-${state}`}>
        <StateDot state={state} />
        {STATE_NAMES[state]}
      </span>
    );
  }
  return <span className={`state-badge state-${state}`}>{STATE_NAMES[state]}</span>;
}
