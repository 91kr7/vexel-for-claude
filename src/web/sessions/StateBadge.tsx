import type { ComponentType } from 'react';
import { CircleAlertIcon, CircleMinusIcon, CirclePauseIcon, LoaderCircleIcon } from '../icons/Icons';
import type { SessionState } from './live-session-store';

const STATE_NAMES: Record<SessionState, string> = {
  working: 'Lavora',
  needs_input: 'Richiede input',
  idle: 'In attesa',
  ended: 'Terminata',
};

const STATE_ICONS: Record<SessionState, ComponentType> = {
  working: LoaderCircleIcon,
  needs_input: CircleAlertIcon,
  idle: CirclePauseIcon,
  ended: CircleMinusIcon,
};

export function StateIcon({ state }: { state: SessionState }) {
  const Icon = STATE_ICONS[state];
  return <Icon />;
}

export function StateBadge({ state, variant = 'inline' }: { state: SessionState; variant?: 'inline' | 'chip' }) {
  if (variant === 'chip') {
    return (
      <span className="chip label-l state-chip">
        <StateIcon state={state} />
        {STATE_NAMES[state]}
      </span>
    );
  }
  return (
    <span className={`state-badge label-m state-${state}`}>
      <StateIcon state={state} />
      {STATE_NAMES[state]}
    </span>
  );
}
