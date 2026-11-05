import type { ReactNode } from 'react';
import { CircleXIcon, SquareTerminalIcon } from '../icons/Icons';
import { Spinner } from './ProgressIndicator';

interface AreaStateProps {
  kind: 'empty' | 'loading' | 'error';
  title: string;
  text?: string;
  icon?: ReactNode;
  size?: 'full' | 'compact';
  actions?: ReactNode;
  className?: string;
}

const ROLES = { empty: undefined, loading: 'status', error: 'alert' } as const;

function defaultIcon(kind: AreaStateProps['kind']): ReactNode {
  if (kind === 'loading') return <Spinner />;
  if (kind === 'error') return <CircleXIcon />;
  return <SquareTerminalIcon />;
}

export function AreaState({ kind, title, text, icon, size = 'full', actions, className }: AreaStateProps) {
  const classes = ['area-state', 'vx-surface-1', `area-state-${size}`, `area-state-${kind}`, className].filter(Boolean).join(' ');
  return (
    <div className={classes} role={ROLES[kind]}>
      <span className="area-state-tile vx-surface-2" aria-hidden="true">
        {icon ?? defaultIcon(kind)}
      </span>
      <p className="area-state-title">{title}</p>
      {text !== undefined && <p className="area-state-text">{text}</p>}
      {actions !== undefined && <div className="area-state-actions">{actions}</div>}
    </div>
  );
}
