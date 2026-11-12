import { type ReactNode, type RefObject, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useDesktopBridge } from './desktop-bridge';
import { EmptyState } from './EmptyState';
import { ConversationView } from './external/ConversationView';
import { FolderChooser } from './folders/FolderChooser';
import { pageProjectListStore } from './folders/project-list-store';
import { ProjectList } from './folders/ProjectList';
import { ResumeDialog } from './history/ResumeDialog';
import { ListPanelEdge } from './ListPanelEdge';
import { listWidthLimit, pageListWidthStore, shownListWidth, useListWidth } from './list-width-store';
import { NavigationRail, type SideView } from './NavigationRail';
import { NeedsInputSnackbar, useNeedsInputSnackbar } from './NeedsInputSnackbar';
import { PlanUsagePopover } from './plan-usage/PlanUsagePopover';
import { usePlanUsage } from './plan-usage/plan-usage-store';
import { ShortcutsPanel } from './ShortcutsPanel';
import { ShortMessageToast, useShortMessage } from './ShortMessageToast';
import { countNeedsInput, NeedsInputCounter } from './sessions/NeedsInputCounter';
import { SessionList } from './sessions/SessionList';
import { SessionView } from './sessions/SessionView';
import { type SessionSummary, useLiveSessions } from './sessions/live-session-store';
import { sessionToOpen } from './sessions/navigation-targets';
import { useSessionOrder } from './sessions/session-order-store';
import { sendSessionCommand } from './shortcut-channel';
import { useShortcutKeys } from './shortcut-keys';
import type { ShortcutCommand } from './shortcut-map';
import { pageThemeStore } from './theme/theme-store';
import { TopBar } from './TopBar';

function subscribeToWindowResize(listener: () => void): () => void {
  window.addEventListener('resize', listener);
  return () => window.removeEventListener('resize', listener);
}

function useWindowWidth(): number {
  return useSyncExternalStore(subscribeToWindowResize, () => window.innerWidth, () => Number.POSITIVE_INFINITY);
}

function ListPanel({ panelRef, children }: { panelRef: RefObject<HTMLElement>; children: ReactNode }) {
  const store = pageListWidthStore();
  const width = useListWidth(store);
  const windowWidth = useWindowWidth();
  const shownWidth = shownListWidth(width, windowWidth);
  return (
    <section className="list-panel" aria-label="Session List" ref={panelRef} style={{ width: shownWidth }}>
      {children}
      <ListPanelEdge
        width={shownWidth}
        maxWidth={listWidthLimit(windowWidth)}
        onPreview={(next) => store.preview(next)}
        onCommit={(next) => store.commit(next)}
      />
    </section>
  );
}

export function AppLayout() {
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [openIsExternal, setOpenIsExternal] = useState(false);
  const [choosingFolder, setChoosingFolder] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [sideView, setSideView] = useState<SideView>('sessions');
  const [focusRequest, setFocusRequest] = useState<{ view: SideView } | null>(null);
  const [showingShortcuts, setShowingShortcuts] = useState(false);
  const toggleShortcuts = () => setShowingShortcuts((showing) => !showing);
  const [showingPlanUsage, setShowingPlanUsage] = useState(false);
  const planUsage = usePlanUsage(showingPlanUsage);
  const listPanelRef = useRef<HTMLElement>(null);
  const newSessionRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const mainViewRef = useRef<{ focus(): void }>(null);
  const focusMainViewAfterOpen = useRef(false);
  const shortMessage = useShortMessage();
  const { sessions, status } = useLiveSessions();
  const { order: sessionOrder, move: moveSession } = useSessionOrder(sessions, status);
  const snackbarSession = useNeedsInputSnackbar(sessions, status, openSessionId);
  const lastOpenSummary = useRef<SessionSummary | undefined>(undefined);
  const listedSummary = sessions.find((session) => session.id === openSessionId);
  if (listedSummary) lastOpenSummary.current = listedSummary;
  const lastSummary = listedSummary ?? (lastOpenSummary.current?.id === openSessionId ? lastOpenSummary.current : undefined);
  const [previousStatus, setPreviousStatus] = useState(status);
  const [endedWhileAwayId, setEndedWhileAwayId] = useState<string | null>(null);
  if (status !== previousStatus) {
    setPreviousStatus(status);
    if (previousStatus === 'error' && status === 'ready' && !listedSummary && lastSummary) setEndedWhileAwayId(openSessionId);
  }
  const openEndedWhileAway = endedWhileAwayId === openSessionId && !listedSummary && lastSummary !== undefined;
  const openSummary = openEndedWhileAway ? { ...lastSummary, state: 'ended' as const } : lastSummary;
  const openHostedLeftList = !openIsExternal && !openEndedWhileAway && !listedSummary && openSummary !== undefined;
  useEffect(() => {
    if (openHostedLeftList) setOpenSessionId(null);
  }, [openHostedLeftList]);
  const openHosted = (sessionId: string) => {
    setOpenSessionId(sessionId);
    setOpenIsExternal(false);
  };
  const openFromList = (sessionId: string) => {
    setOpenSessionId(sessionId);
    setOpenIsExternal(sessions.find((session) => session.id === sessionId)?.external === true);
  };
  useDesktopBridge(openSessionId, (sessionId) => {
    if (sessions.some((session) => session.id === sessionId)) openFromList(sessionId);
  });

  const snackbar = snackbarSession && <NeedsInputSnackbar session={snackbarSession} onOpen={openFromList} />;

  const focusList = () => {
    const list = listPanelRef.current?.querySelector('.session-list');
    const target =
      list?.querySelector<HTMLElement>('[aria-current="true"]') ?? list?.querySelector<HTMLElement>('button:not(:disabled)') ?? newSessionRef.current;
    target?.focus({ focusVisible: true });
  };

  const showSessions = () => {
    setSideView('sessions');
    setFocusRequest({ view: 'sessions' });
  };

  const showProjects = () => {
    setSideView('projects');
    pageProjectListStore().load();
    setFocusRequest({ view: 'projects' });
  };

  useEffect(() => {
    if (focusRequest === null) return;
    if (focusRequest.view === 'sessions') focusList();
    else listPanelRef.current?.querySelector<HTMLElement>('.project-row')?.focus({ focusVisible: true });
  }, [focusRequest]);

  useEffect(() => {
    if (!focusMainViewAfterOpen.current) return;
    focusMainViewAfterOpen.current = false;
    mainViewRef.current?.focus();
  }, [openSessionId, openIsExternal]);

  useShortcutKeys((command: ShortcutCommand) => {
    if (command.kind === 'focus-list') showSessions();
    else if (command.kind === 'focus-main-view') mainViewRef.current?.focus();
    else if (command.kind === 'new-session') setChoosingFolder(true);
    else if (command.kind === 'resume-history') setResuming(true);
    else if (command.kind === 'toggle-theme') pageThemeStore().toggle();
    else if (command.kind === 'toggle-shortcuts-panel') toggleShortcuts();
    else if (command.kind === 'session-command') sendSessionCommand(command.command);
    else {
      const sessionId = sessionToOpen(sessions, sessionOrder, openSessionId, command.target);
      if (sessionId === null) {
        if (command.target.kind === 'next-needs-input') shortMessage.show('No session needs input');
      } else if (sessionId !== openSessionId) {
        focusMainViewAfterOpen.current = mainRef.current?.contains(document.activeElement) === true;
        openFromList(sessionId);
      }
    }
  });

  return (
    <div className="app">
      <TopBar
        onNewSession={() => setChoosingFolder(true)}
        shortcutsPanelOpen={showingShortcuts}
        onToggleShortcutsPanel={toggleShortcuts}
        planUsageOpen={showingPlanUsage}
        onTogglePlanUsage={() => setShowingPlanUsage((showing) => !showing)}
      />
      {showingPlanUsage && <PlanUsagePopover state={planUsage} onClose={() => setShowingPlanUsage(false)} />}
      <div className="app-body">
        <NavigationRail
          needsInputCount={countNeedsInput(sessions)}
          onNewSession={() => setChoosingFolder(true)}
          onShowSessions={showSessions}
          onShowProjects={showProjects}
          onResume={() => setResuming(true)}
          newSessionRef={newSessionRef}
          shownView={sideView}
        />
        <ListPanel panelRef={listPanelRef}>
          {sideView === 'projects' ? (
            <ProjectList />
          ) : (
            <>
              <div className="list-panel-title">
                <h1 className="section-label">Sessions</h1>
                <NeedsInputCounter sessions={sessions} />
              </div>
              <SessionList
                sessions={sessions}
                status={status}
                order={sessionOrder}
                onReorder={moveSession}
                onResumed={openHosted}
                openSessionId={openSessionId}
                onOpen={openFromList}
              />
            </>
          )}
        </ListPanel>
        <main className="session-area vx-dot-grid" ref={mainRef}>
          {openSessionId && openIsExternal ? (
            <ConversationView
              key={openSessionId}
              sessionId={openSessionId}
              session={openSummary}
              sessions={sessions}
              onResumed={openHosted}
              focusRef={mainViewRef}
            />
          ) : openSessionId ? (
            <SessionView
              key={openSessionId}
              sessionId={openSessionId}
              session={openSummary}
              sessions={sessions}
              onLeaveTerminal={showSessions}
              focusRef={mainViewRef}
            />
          ) : (
            <EmptyState onNewSession={() => setChoosingFolder(true)} onResumeSession={() => setResuming(true)} />
          )}
        </main>
      </div>
      {snackbar}
      <ShortMessageToast text={shortMessage.text} />
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
      {showingShortcuts && <ShortcutsPanel onClose={() => setShowingShortcuts(false)} />}
    </div>
  );
}
