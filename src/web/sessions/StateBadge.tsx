import type { ComponentType } from 'react';
import { CircleAlertIcon, CircleOffIcon, CirclePauseIcon, LoaderCircleIcon } from '../icons/Icons';
import type { SessionState } from './live-session-store';

const STATE_NAMES: Record<SessionState, string> = {
  working: 'In lavorazione',
  needs_input: 'Richiede input',
  idle: 'In attesa',
  ended: 'Terminata',
};

const STATE_ICONS: Record<SessionState, ComponentType> = {
  working: LoaderCircleIcon,
  needs_input: CircleAlertIcon,
  idle: CirclePauseIcon,
  ended: CircleOffIcon,
};

export function StateIcon({ state }: { state: SessionState }) {
  const Icon = STATE_ICONS[state];
  return <Icon />;
}

export function StateBadge({ state }: { state: SessionState }) {
  return (
    <span className={`state-badge state-${state}`}>
      <StateIcon state={state} />
      {STATE_NAMES[state]}
    </span>
  );
}
