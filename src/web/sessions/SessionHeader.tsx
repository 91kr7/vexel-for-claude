import type { ReactNode } from 'react';
import { Avatar, folderNameOf } from './Avatar';
import type { SessionSummary } from './live-session-store';
import { StateBadge } from './StateBadge';

export type SessionHeaderSummary = Pick<SessionSummary, 'folder' | 'label' | 'state'>;

interface SessionHeaderProps {
  session?: SessionHeaderSummary;
  actions: ReactNode;
  notice?: ReactNode;
  external?: boolean;
  line?: string;
}

export function SessionHeader({ session, actions, notice, external, line }: SessionHeaderProps) {
  const name = session && folderNameOf(session.folder);
  const subtitle = session && (line ?? `${session.label} · ${session.folder}`);
  return (
    <header className="session-header">
      {session && <Avatar folder={session.folder} state={session.state} external={external} size="header" />}
      <div className="session-header-info">
        <div className="session-header-line">
          {session && (
            <>
              <h2 className="session-header-name title-l" title={name}>
                {name}
              </h2>
              <StateBadge state={session.state} variant="chip" />
            </>
          )}
          {notice}
        </div>
        {session && (
          <p className="session-header-subtitle body-m" title={subtitle}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="session-header-actions">{actions}</div>
    </header>
  );
}
