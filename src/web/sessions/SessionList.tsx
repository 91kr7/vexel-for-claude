import { useId } from 'react';
import { AreaState } from '../feedback/AreaState';
import { folderNameOf } from './Avatar';
import type { LoadStatus, SessionSummary } from './live-session-store';
import { ProgressBar } from './ProgressBar';
import { RelativeTime } from './RelativeTime';
import { groupSessions, type SessionOrder } from './session-order';
import { StateBadge } from './StateBadge';

function entryClass(session: SessionSummary): string {
  const classes = ['session-entry'];
  if (session.state === 'needs_input') classes.push('needs-input');
  if (session.state === 'ended') classes.push('ended');
  if (session.external) classes.push('external');
  return classes.join(' ');
}

function PermissionText({ session }: { session: SessionSummary }) {
  if (session.waitingTool === undefined) return <>{session.label}</>;
  return (
    <>
      Permission for <b>{session.waitingTool}</b>
    </>
  );
}

function EntryTitle({ session }: { session: SessionSummary }) {
  return (
    <span className="session-entry-title" title={session.folder}>
      {folderNameOf(session.folder)}
    </span>
  );
}

interface EntryProps {
  session: SessionSummary;
  open: boolean;
  onOpen: (sessionId: string) => void;
}

function EntryRow({ session, open, onOpen }: EntryProps) {
  const externalNeedsInput = session.external === true && session.state === 'needs_input';
  return (
    <button type="button" className={entryClass(session)} aria-current={open ? 'true' : undefined} onClick={() => onOpen(session.id)}>
      <span className="session-entry-line">
        <StateBadge state={session.state} variant="dot" />
        <EntryTitle session={session} />
        {externalNeedsInput && <span className="mono-chip vx-surface-2 session-external">External</span>}
        <StateBadge state={session.state} />
      </span>
      <span className="session-entry-line session-entry-detail">
        <span className={externalNeedsInput ? 'session-entry-label session-entry-permission' : 'session-entry-label'} title={session.label}>
          {externalNeedsInput ? <PermissionText session={session} /> : session.label}
        </span>
        <RelativeTime className="session-entry-time" iso={session.lastActivity} />
      </span>
      {session.state === 'working' && !session.external && <ProgressBar />}
    </button>
  );
}

function NeedsInputCard({ session, open, onOpen }: EntryProps) {
  const lineId = useId();
  return (
    <div className={open ? 'session-card vx-surface-2 open' : 'session-card vx-surface-2'}>
      <button
        type="button"
        className={entryClass(session)}
        aria-current={open ? 'true' : undefined}
        aria-describedby={lineId}
        onClick={() => onOpen(session.id)}
      >
        <span className="session-entry-line">
          <span className="perm-tag">Needs Input</span>
          <EntryTitle session={session} />
        </span>
        <span className="session-entry-label" title={session.label}>
          {session.label}
        </span>
      </button>
      <span className="session-card-line" id={lineId}>
        <PermissionText session={session} /> · <RelativeTime iso={session.lastActivity} />
      </span>
      <div className="session-card-actions">
        <button type="button" className="button-primary session-card-reply" onClick={() => onOpen(session.id)}>
          Reply
        </button>
      </div>
    </div>
  );
}

interface SessionListProps {
  sessions: readonly SessionSummary[];
  openSessionId: string | null;
  onOpen: (sessionId: string) => void;
  status?: LoadStatus;
  order?: SessionOrder;
}

export function SessionList({ sessions, openSessionId, onOpen, status = 'ready', order }: SessionListProps) {
  return (
    <div className="session-list">
      {status === 'error' && <AreaState kind="error" size="compact" title="Connection to the server lost. Reload the page." />}
      {status === 'loading' ? (
        <AreaState kind="loading" size="compact" title="Loading…" />
      ) : sessions.length === 0 ? (
        status === 'ready' && <AreaState kind="empty" size="compact" title="No sessions." />
      ) : (
        groupSessions(sessions, order).map((group) => (
          <div key={group.id} className="session-group">
            <h2 className={`section-label session-group-heading session-group-${group.id}`}>{group.title}</h2>
            <ul>
              {group.sessions.map((session) => {
                const Entry = session.state === 'needs_input' && !session.external ? NeedsInputCard : EntryRow;
                return (
                  <li key={session.id}>
                    <Entry session={session} open={session.id === openSessionId} onOpen={onOpen} />
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
