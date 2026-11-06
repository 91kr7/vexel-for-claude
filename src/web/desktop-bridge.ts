import { useEffect, useRef } from 'react';

export interface DesktopBridge {
  reportOpenSession(sessionId: string | null): void;
  onOpenSession(listener: (sessionId: string) => void): () => void;
  getPathForFile(file: File): string;
}

declare global {
  interface Window {
    desktopBridge?: DesktopBridge;
  }
}

export function desktopFilePathLookup(): ((file: File) => string) | null {
  const bridge = window.desktopBridge;
  return bridge ? (file) => bridge.getPathForFile(file) : null;
}

const preventDefault = (event: Event) => event.preventDefault();

export function useDesktopBridge(openSessionId: string | null, onOpenSession: (sessionId: string) => void): void {
  const latestOnOpenSession = useRef(onOpenSession);
  useEffect(() => {
    latestOnOpenSession.current = onOpenSession;
  });

  useEffect(() => {
    window.desktopBridge?.reportOpenSession(openSessionId);
  }, [openSessionId]);

  useEffect(() => window.desktopBridge?.onOpenSession((sessionId) => latestOnOpenSession.current(sessionId)), []);

  useEffect(() => {
    if (!window.desktopBridge) return;
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
  }, []);
}
