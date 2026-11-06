import type { ReactNode } from 'react';
import { folderNameOf } from './Avatar';
import type { SessionSummary } from './live-session-store';
import { StateBadge } from './StateBadge';

export type SessionHeaderSummary = Pick<SessionSummary, 'folder' | 'label' | 'state'>;

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
            <span className="session-header-separator" aria-hidden="true">
              /
            </span>
            <span className="session-header-path" title={session.folder}>
              {session.folder}
            </span>
            {subtitle && (
              <span className="mono-chip vx-surface-2 session-header-subtitle" title={subtitle}>
                {subtitle}
              </span>
            )}
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
