import { useEffect, useRef, useState } from 'react';
import type { LoadStatus, SessionState, SessionSummary } from './sessions/live-session-store';

export function nextSnackbarSession(
  previousStates: ReadonlyMap<string, SessionState>,
  sessions: readonly SessionSummary[],
  shownId: string | null,
  openSessionId: string | null,
): string | null {
  let latest: SessionSummary | undefined;
  for (const session of sessions) {
    if (session.state !== 'needs_input' || session.id === openSessionId || previousStates.get(session.id) === 'needs_input') continue;
    if (!latest || Date.parse(session.lastActivity) > Date.parse(latest.lastActivity)) latest = session;
  }
  if (latest) return latest.id;
  const shown = sessions.find((session) => session.id === shownId);
  return shown && shown.state === 'needs_input' && shown.id !== openSessionId ? shown.id : null;
}

const statesOf = (sessions: readonly SessionSummary[]) => new Map(sessions.map((session) => [session.id, session.state]));

export function useNeedsInputSnackbar(
  sessions: readonly SessionSummary[],
  status: LoadStatus,
  openSessionId: string | null,
): SessionSummary | undefined {
  const [shownId, setShownId] = useState<string | null>(null);
  const seenStates = useRef<ReadonlyMap<string, SessionState> | undefined>(undefined);

  useEffect(() => {
    const previous = seenStates.current;
    if (!previous) {
      if (status === 'ready') seenStates.current = statesOf(sessions);
      return;
    }
    seenStates.current = statesOf(sessions);
    setShownId((current) => nextSnackbarSession(previous, sessions, current, openSessionId));
  }, [sessions, status, openSessionId]);

  return sessions.find((session) => session.id === shownId && session.state === 'needs_input' && session.id !== openSessionId);
}

function projectName(folder: string): string {
  const segments = folder.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? folder;
}

interface NeedsInputSnackbarProps {
  session: SessionSummary;
  onOpen: (sessionId: string) => void;
}

export function NeedsInputSnackbar({ session, onOpen }: NeedsInputSnackbarProps) {
  return (
    <div className="snackbar" role="status">
      <span className="body-m snackbar-text">
        <b>{projectName(session.folder)}</b> richiede il tuo input
      </span>
      <button type="button" className="snackbar-action label-l" onClick={() => onOpen(session.id)}>
        Apri
      </button>
    </div>
  );
}
