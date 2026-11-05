import { useState } from 'react';
import { FolderChooser } from './folders/FolderChooser';
import { SessionView } from './sessions/SessionView';

export function AppLayout() {
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [choosingFolder, setChoosingFolder] = useState(false);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Sessioni Claude</h1>
        <button type="button" onClick={() => setChoosingFolder(true)}>
          Nuova sessione
        </button>
      </header>
      <main className="session-area">
        {openSessionId ? (
          <SessionView key={openSessionId} sessionId={openSessionId} />
        ) : (
          <p className="empty-state">Nessuna sessione aperta.</p>
        )}
      </main>
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
