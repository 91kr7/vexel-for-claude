import { useId } from 'react';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { ProgressIndicator } from '../feedback/ProgressIndicator';
import { TerminalIcon } from '../icons/Icons';
import { Avatar, folderNameOf } from './Avatar';
import type { LoadStatus, SessionSummary } from './live-session-store';
import { ProgressBar } from './ProgressBar';
import { RelativeTime } from './RelativeTime';
import { groupSessions } from './session-order';
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
      Permesso per <b>{session.waitingTool}</b>
    </>
  );
}

function EntryHeading({ session, showTag = false }: { session: SessionSummary; showTag?: boolean }) {
  return (
    <span className="session-entry-heading">
      <span className="session-entry-title-line">
        <span className="title-m session-entry-title" title={session.folder}>
          {folderNameOf(session.folder)}
        </span>
        {showTag && (
          <span className="label-m session-external">
            <TerminalIcon />
            Esterna
          </span>
        )}
      </span>
      <span className="body-m session-entry-label" title={session.label}>
        {showTag ? <PermissionText session={session} /> : session.label}
      </span>
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
      <Avatar folder={session.folder} state={session.state} external={session.external} />
      <span className="session-entry-text">
        <EntryHeading session={session} showTag={externalNeedsInput} />
        {session.state === 'working' && !session.external && <ProgressBar />}
      </span>
      <span className="session-entry-side">
        <StateBadge state={session.state} />
        <RelativeTime className="body-s session-entry-time" iso={session.lastActivity} />
      </span>
    </button>
  );
}

function NeedsInputCard({ session, open, onOpen }: EntryProps) {
  const lineId = useId();
  return (
    <div className={open ? 'session-card open' : 'session-card'}>
      <button
        type="button"
        className={entryClass(session)}
        aria-current={open ? 'true' : undefined}
        aria-describedby={lineId}
        onClick={() => onOpen(session.id)}
      >
        <Avatar folder={session.folder} state={session.state} />
        <span className="session-entry-text">
          <EntryHeading session={session} />
        </span>
        <span className="session-entry-side">
          <StateBadge state={session.state} />
        </span>
      </button>
      <div className="session-card-actions">
        <span className="body-s session-card-line" id={lineId}>
          <PermissionText session={session} /> · <RelativeTime iso={session.lastActivity} />
        </span>
        <button type="button" className="btn label-l session-card-reply" onClick={() => onOpen(session.id)}>
          Rispondi
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
}

export function SessionList({ sessions, openSessionId, onOpen, status = 'ready' }: SessionListProps) {
  return (
    <div className="session-list">
      {status === 'error' && <ErrorMessage className="session-list-alert">Connessione al server persa. Ricarica la pagina.</ErrorMessage>}
      {status === 'loading' ? (
        <ProgressIndicator className="session-list-empty" />
      ) : sessions.length === 0 ? (
        status === 'ready' && <p className="session-list-empty">Nessuna sessione.</p>
      ) : (
        groupSessions(sessions).map((group) => (
          <div key={group.id} className="session-group">
            <h2 className={`label-l session-group-heading session-group-${group.id}`}>
              {group.title}
            </h2>
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
