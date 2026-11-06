import { type ReactNode, useId, useState } from 'react';
import { folderNameOf } from './Avatar';
import type { SessionSummary } from './live-session-store';
import { StateBadge } from './StateBadge';

export type SessionHeaderSummary = Pick<SessionSummary, 'folder' | 'label' | 'state' | 'usage'>;

function LineChip({ text }: { text: string }) {
  const tooltipId = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = hovered || focused;
  return (
    <span
      className="mono-chip vx-surface-2 session-header-subtitle"
      tabIndex={0}
      aria-describedby={open ? tooltipId : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <span className="session-header-subtitle-text">{text}</span>
      {open && (
        <span className="session-header-subtitle-tooltip" id={tooltipId} role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}

interface SessionHeaderProps {
  session?: SessionHeaderSummary;
  actions: ReactNode;
  notice?: ReactNode;
  line?: string;
}

export function SessionHeader({ session, actions, notice, line }: SessionHeaderProps) {
  const name = session && folderNameOf(session.folder);
  const subtitle = session && (line ?? session.label);
  return (
    <header className="session-header">
      <div className="session-header-info">
        {session && (
          <>
            <h2 className="session-header-name" title={name}>
              {name}
            </h2>
            {subtitle && <LineChip text={subtitle} />}
          </>
        )}
      </div>
      <div className="session-header-actions">
        {session && <StateBadge state={session.state} variant="chip" />}
        {notice}
        {actions}
      </div>
    </header>
  );
}
