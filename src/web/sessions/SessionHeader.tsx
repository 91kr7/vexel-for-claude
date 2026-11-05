import type { ReactNode } from 'react';
import type { SessionSummary } from './live-session-store';
import { StateBadge } from './StateBadge';

export type SessionHeaderSummary = Pick<SessionSummary, 'folder' | 'label' | 'state'>;

interface SessionHeaderProps {
  session?: SessionHeaderSummary;
  actions: ReactNode;
  notice?: ReactNode;
}

export function SessionHeader({ session, actions, notice }: SessionHeaderProps) {
  return (
    <header className="session-header">
      <div className="session-header-info">
        <div className="session-header-line">
          {session && (
            <>
              <h2 className="session-header-label" title={session.label}>
                {session.label}
              </h2>
              <StateBadge state={session.state} />
            </>
          )}
          {notice}
        </div>
        {session && (
          <p className="session-header-folder" title={session.folder}>
            {session.folder}
          </p>
        )}
      </div>
      <div className="session-header-actions">{actions}</div>
    </header>
  );
}
