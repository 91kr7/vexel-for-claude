import type { ReactNode } from 'react';
import { folderNameOf } from './Avatar';
import type { ContextOccupancy, SessionSummary } from './live-session-store';
import { StateBadge } from './StateBadge';
import { percentOf, shortTokens, usageLevelOf } from './usage-format';

export type SessionHeaderSummary = Pick<SessionSummary, 'folder' | 'label' | 'state' | 'usage'>;

function ContextChip({ context }: { context: ContextOccupancy }) {
  const percent = percentOf(context);
  return (
    <span className="mono-chip vx-surface-2 session-header-context">
      <span className="session-header-context-label">Context</span>
      <span className={`usage-${usageLevelOf(percent)}`}>
        {`${shortTokens(context.used)} / ${shortTokens(context.window)} · ${percent}%`}
      </span>
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
        {session?.usage?.context && <ContextChip context={session.usage.context} />}
        {session && <StateBadge state={session.state} variant="chip" />}
        {notice}
        {actions}
      </div>
    </header>
  );
}
