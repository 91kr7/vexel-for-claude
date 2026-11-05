import type { SessionState, SessionSummary } from './live-session-store';
import { orderSessions } from './session-order';

const STATE_NAMES: Record<SessionState, string> = {
  working: 'In lavorazione',
  needs_input: 'Richiede input',
  idle: 'In attesa',
  ended: 'Terminata',
};

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
                className={session.state === 'needs_input' ? 'session-entry needs-input' : 'session-entry'}
                aria-current={session.id === openSessionId ? 'true' : undefined}
                onClick={() => onOpen(session.id)}
              >
                <span className="session-entry-label">{session.label}</span>
                <span className="session-entry-folder">{session.folder}</span>
                <span className="session-entry-meta">
                  <span className={`session-state state-${session.state}`}>{STATE_NAMES[session.state]}</span>
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
