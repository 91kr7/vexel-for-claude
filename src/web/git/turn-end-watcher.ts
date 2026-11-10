import { useEffect, useRef } from 'react';
import type { SessionSummary } from '../sessions/live-session-store';

const withoutTrailingSlash = (path: string) => (path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path);

function isInRepository(folder: string, root: string): boolean {
  const base = withoutTrailingSlash(root);
  const path = withoutTrailingSlash(folder);
  return path === base || path.startsWith(base === '/' ? '/' : `${base}/`);
}

export function turnEndedInRepository(previous: readonly SessionSummary[], next: readonly SessionSummary[], root: string): boolean {
  return next.some(
    (session) =>
      session.state === 'idle' &&
      previous.find((before) => before.id === session.id)?.state === 'working' &&
      isInRepository(session.folder, root),
  );
}

/** Calls `onTurnEnd` when a session in the repository of `root` goes from `working` to `idle`. */
export function useTurnEndSignal(sessions: readonly SessionSummary[], root: string | undefined, onTurnEnd: () => void): void {
  const last = useRef(sessions);
  const callback = useRef(onTurnEnd);
  callback.current = onTurnEnd;

  useEffect(() => {
    const previous = last.current;
    last.current = sessions;
    if (root !== undefined && previous !== sessions && turnEndedInRepository(previous, sessions, root)) callback.current();
  }, [sessions, root]);
}
