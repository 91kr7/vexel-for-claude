import { ErrorMessage } from '../feedback/ErrorMessage';
import { ProgressIndicator } from '../feedback/ProgressIndicator';
import { TerminalIcon } from '../icons/Icons';
import type { LoadStatus, SessionSummary } from './live-session-store';
import { orderSessions } from './session-order';
import { StateBadge } from './StateBadge';

const EXTERNAL_TOOLTIP = 'Sessione in un altro terminale: lo stato «Richiede input» non è disponibile';

function entryClass(session: SessionSummary): string {
  const classes = ['session-entry'];
  if (session.state === 'needs_input') classes.push('needs-input');
  if (session.external) classes.push('external');
  return classes.join(' ');
}

interface SessionListProps {
  sessions: readonly SessionSummary[];
  openSessionId: string | null;
  onOpen: (sessionId: string) => void;
  status?: LoadStatus;
}

function formatActivity(iso: string): string {
  const time = new Date(iso);
  const clock = time.toLocaleTimeString('it-IT');
  const sameDay = time.toDateString() === new Date().toDateString();
  return sameDay ? clock : `${time.toLocaleDateString('it-IT')} ${clock}`;
}

export function SessionList({ sessions, openSessionId, onOpen, status = 'ready' }: SessionListProps) {
  return (
    <nav className="session-list" aria-label="Elenco sessioni">
      {status === 'error' && <ErrorMessage className="session-list-alert">Connessione al server persa. Ricarica la pagina.</ErrorMessage>}
      {sessions.length === 0 ? (
        status === 'loading' ? (
          <ProgressIndicator className="session-list-empty" />
        ) : (
          status === 'ready' && <p className="session-list-empty">Nessuna sessione.</p>
        )
      ) : (
        <ul>
          {orderSessions(sessions).map((session) => (
            <li key={session.id}>
              <button
                type="button"
                className={entryClass(session)}
                aria-current={session.id === openSessionId ? 'true' : undefined}
                onClick={() => onOpen(session.id)}
              >
                <span className="session-entry-line">
                  <span className="session-entry-label" title={session.label}>
                    {session.label}
                  </span>
                  <StateBadge state={session.state} />
                </span>
                <span className="session-entry-line session-entry-meta">
                  <span className="session-entry-folder" title={session.folder}>
                    {session.folder}
                  </span>
                  {session.external && (
                    <span className="session-external" title={EXTERNAL_TOOLTIP}>
                      <TerminalIcon />
                      Esterna
                    </span>
                  )}
                  <time dateTime={session.lastActivity}>{formatActivity(session.lastActivity)}</time>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
