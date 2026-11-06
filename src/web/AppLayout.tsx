import { useRef, useState } from 'react';
import { EmptyState } from './EmptyState';
import { ConversationView } from './external/ConversationView';
import { FolderChooser } from './folders/FolderChooser';
import { ResumeDialog } from './history/ResumeDialog';
import { NavigationRail } from './NavigationRail';
import { NeedsInputSnackbar, useNeedsInputSnackbar } from './NeedsInputSnackbar';
import { countNeedsInput, NeedsInputCounter } from './sessions/NeedsInputCounter';
import { SessionList } from './sessions/SessionList';
import { SessionView } from './sessions/SessionView';
import { type SessionSummary, useLiveSessions } from './sessions/live-session-store';
import { TopBar } from './TopBar';

export function AppLayout() {
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [openIsExternal, setOpenIsExternal] = useState(false);
  const [choosingFolder, setChoosingFolder] = useState(false);
  const [resuming, setResuming] = useState(false);
  const listPanelRef = useRef<HTMLElement>(null);
  const newSessionRef = useRef<HTMLButtonElement>(null);
  const { sessions, status } = useLiveSessions();
  const snackbarSession = useNeedsInputSnackbar(sessions, status, openSessionId);
  const lastOpenSummary = useRef<SessionSummary | undefined>(undefined);
  const listedSummary = sessions.find((session) => session.id === openSessionId);
  if (listedSummary) lastOpenSummary.current = listedSummary;
  const openSummary = listedSummary ?? (lastOpenSummary.current?.id === openSessionId ? lastOpenSummary.current : undefined);
  const openHosted = (sessionId: string) => {
    setOpenSessionId(sessionId);
    setOpenIsExternal(false);
  };
  const openFromList = (sessionId: string) => {
    setOpenSessionId(sessionId);
    setOpenIsExternal(sessions.find((session) => session.id === sessionId)?.external === true);
  };

  const snackbar = snackbarSession && <NeedsInputSnackbar session={snackbarSession} onOpen={openFromList} />;

  const focusList = () => {
    const list = listPanelRef.current?.querySelector('.session-list');
    const target =
      list?.querySelector<HTMLElement>('[aria-current="true"]') ?? list?.querySelector<HTMLElement>('button:not(:disabled)') ?? newSessionRef.current;
    target?.focus({ focusVisible: true });
  };

  return (
    <div className="app">
      <TopBar onNewSession={() => setChoosingFolder(true)} />
      <div className="app-body">
        <NavigationRail
          needsInputCount={countNeedsInput(sessions)}
          onNewSession={() => setChoosingFolder(true)}
          onShowSessions={focusList}
          onResume={() => setResuming(true)}
          newSessionRef={newSessionRef}
        />
        <section className="list-panel" aria-label="Session List" ref={listPanelRef}>
          <div className="list-panel-title">
            <h1 className="section-label">Sessions</h1>
            <NeedsInputCounter sessions={sessions} />
          </div>
          <SessionList sessions={sessions} status={status} openSessionId={openSessionId} onOpen={openFromList} />
        </section>
        <main className="session-area vx-dot-grid">
          {openSessionId && openIsExternal ? (
            <ConversationView key={openSessionId} sessionId={openSessionId} session={openSummary} onResumed={openHosted} />
          ) : openSessionId ? (
            <SessionView key={openSessionId} sessionId={openSessionId} session={openSummary} onLeaveTerminal={focusList} />
          ) : (
            <EmptyState onNewSession={() => setChoosingFolder(true)} onResumeSession={() => setResuming(true)} />
          )}
        </main>
      </div>
      {snackbar}
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
