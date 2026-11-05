import type { SessionState, SessionSummary } from './live-session-store';
import { orderSessions } from './session-order';

const STATE_NAMES: Record<SessionState, string> = {
  working: 'In lavorazione',
  needs_input: 'Richiede input',
  idle: 'In attesa',
  ended: 'Terminata',
};

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
}

function formatActivity(iso: string): string {
  const time = new Date(iso);
  const clock = time.toLocaleTimeString('it-IT');
  const sameDay = time.toDateString() === new Date().toDateString();
  return sameDay ? clock : `${time.toLocaleDateString('it-IT')} ${clock}`;
}

export function SessionList({ sessions, openSessionId, onOpen }: SessionListProps) {
  return (
    <nav className="session-list" aria-label="Elenco sessioni">
      {sessions.length === 0 ? (
        <p className="session-list-empty">Nessuna sessione.</p>
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
                <span className="session-entry-label">{session.label}</span>
                <span className="session-entry-folder">{session.folder}</span>
                <span className="session-entry-meta">
                  <span className={`session-state state-${session.state}`}>{STATE_NAMES[session.state]}</span>
                  <time dateTime={session.lastActivity}>{formatActivity(session.lastActivity)}</time>
                  {session.external && (
                    <span className="session-external" title={EXTERNAL_TOOLTIP}>
                      Esterna
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
