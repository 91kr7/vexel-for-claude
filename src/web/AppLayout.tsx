import { useState } from 'react';
import { EmptyState } from './EmptyState';
import { ConversationView } from './external/ConversationView';
import { FolderChooser } from './folders/FolderChooser';
import { ResumeDialog } from './history/ResumeDialog';
import { HistoryIcon, PlusIcon } from './icons/Icons';
import { NeedsInputCounter } from './sessions/NeedsInputCounter';
import { SessionList } from './sessions/SessionList';
import { SessionView } from './sessions/SessionView';
import { useLiveSessions } from './sessions/live-session-store';

export function AppLayout() {
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [openIsExternal, setOpenIsExternal] = useState(false);
  const [choosingFolder, setChoosingFolder] = useState(false);
  const [resuming, setResuming] = useState(false);
  const sessions = useLiveSessions();
  const openSessionState = sessions.find((session) => session.id === openSessionId)?.state;
  const openHosted = (sessionId: string) => {
    setOpenSessionId(sessionId);
    setOpenIsExternal(false);
  };
  const openFromList = (sessionId: string) => {
    setOpenSessionId(sessionId);
    setOpenIsExternal(sessions.find((session) => session.id === sessionId)?.external === true);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-title">
            <h1>Sessioni Claude</h1>
            <NeedsInputCounter sessions={sessions} />
          </div>
          <button type="button" className="button-primary" onClick={() => setChoosingFolder(true)}>
            <PlusIcon />
            Nuova sessione
          </button>
          <button type="button" onClick={() => setResuming(true)}>
            <HistoryIcon />
            Riprendi sessione
          </button>
        </div>
        <SessionList sessions={sessions} openSessionId={openSessionId} onOpen={openFromList} />
      </aside>
      <main className="session-area">
        {openSessionId && openIsExternal ? (
          <ConversationView key={openSessionId} sessionId={openSessionId} onResumed={openHosted} />
        ) : openSessionId ? (
          <SessionView key={openSessionId} sessionId={openSessionId} state={openSessionState} />
        ) : (
          <EmptyState onNewSession={() => setChoosingFolder(true)} onResumeSession={() => setResuming(true)} />
        )}
      </main>
      {choosingFolder && (
        <FolderChooser
          onStarted={(sessionId) => {
            setChoosingFolder(false);
            openHosted(sessionId);
          }}
          onCancel={() => setChoosingFolder(false)}
        />
      )}
      {resuming && (
        <ResumeDialog
          onResumed={(sessionId) => {
            setResuming(false);
            openHosted(sessionId);
          }}
          onCancel={() => setResuming(false)}
        />
      )}
    </div>
  );
}
