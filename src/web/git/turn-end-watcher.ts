import { useEffect, useRef } from 'react';
import type { SessionSummary } from '../sessions/live-session-store';

const withoutTrailingSlash = (path: string) => (path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path);

function isAtOrUnder(path: string, base: string): boolean {
  const parent = withoutTrailingSlash(base);
  const child = withoutTrailingSlash(path);
  return child === parent || child.startsWith(parent === '/' ? '/' : `${parent}/`);
}

const isRelated = (folder: string, roots: readonly string[]) => roots.some((root) => isAtOrUnder(folder, root) || isAtOrUnder(root, folder));

export function turnEndedInRepository(previous: readonly SessionSummary[], next: readonly SessionSummary[], roots: readonly string[]): boolean {
  return next.some(
    (session) =>
      session.state === 'idle' &&
      previous.find((before) => before.id === session.id)?.state === 'working' &&
      isRelated(session.folder, roots),
  );
}

/** Calls `onTurnEnd` when a session at, under or above one of `roots` goes from `working` to `idle`. */
export function useTurnEndSignal(sessions: readonly SessionSummary[], roots: readonly string[], onTurnEnd: () => void): void {
  const last = useRef(sessions);
  const callback = useRef(onTurnEnd);
  callback.current = onTurnEnd;

  useEffect(() => {
    const previous = last.current;
    last.current = sessions;
    if (previous !== sessions && turnEndedInRepository(previous, sessions, roots)) callback.current();
  }, [sessions, roots]);
}
