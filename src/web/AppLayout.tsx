import { useState } from 'react';
import { FolderChooser } from './folders/FolderChooser';
import { NeedsInputCounter } from './sessions/NeedsInputCounter';
import { SessionList } from './sessions/SessionList';
import { SessionView } from './sessions/SessionView';
import { useLiveSessions } from './sessions/live-session-store';

export function AppLayout() {
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [choosingFolder, setChoosingFolder] = useState(false);
  const sessions = useLiveSessions();

  return (
    <div className="app">
      <header className="app-header">
        <h1>Sessioni Claude</h1>
        <NeedsInputCounter sessions={sessions} />
        <button type="button" onClick={() => setChoosingFolder(true)}>
          Nuova sessione
        </button>
      </header>
      <div className="app-body">
        <SessionList sessions={sessions} openSessionId={openSessionId} onOpen={setOpenSessionId} />
        <main className="session-area">
          {openSessionId ? (
            <SessionView key={openSessionId} sessionId={openSessionId} />
          ) : (
            <p className="empty-state">Nessuna sessione aperta.</p>
          )}
        </main>
      </div>
      {choosingFolder && (
        <FolderChooser
          onStarted={(sessionId) => {
            setChoosingFolder(false);
            setOpenSessionId(sessionId);
          }}
          onCancel={() => setChoosingFolder(false)}
        />
      )}
    </div>
  );
}
