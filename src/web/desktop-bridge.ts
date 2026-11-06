import { useEffect, useRef } from 'react';

export interface DesktopBridge {
  reportOpenSession(sessionId: string | null): void;
  onOpenSession(listener: (sessionId: string) => void): () => void;
}

declare global {
  interface Window {
    desktopBridge?: DesktopBridge;
  }
}

export function useDesktopBridge(openSessionId: string | null, onOpenSession: (sessionId: string) => void): void {
  const latestOnOpenSession = useRef(onOpenSession);
  useEffect(() => {
    latestOnOpenSession.current = onOpenSession;
  });

  useEffect(() => {
    window.desktopBridge?.reportOpenSession(openSessionId);
  }, [openSessionId]);

  useEffect(() => window.desktopBridge?.onOpenSession((sessionId) => latestOnOpenSession.current(sessionId)), []);
}

export function isDesktopWindow(): boolean {
  return typeof window !== 'undefined' && window.desktopBridge !== undefined;
}
