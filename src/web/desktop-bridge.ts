import { useEffect, useRef, useState } from 'react';

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

// Optional: a bridge without the window functions, like a test fake, keeps the page working.
export interface DesktopBridge {
  closeWindow?(): void;
  minimizeWindow?(): void;
  toggleMaximizeWindow?(): void;
  isWindowMaximized?(): Promise<boolean>;
  onWindowMaximizedChange?(listener: (maximized: boolean) => void): () => void;
}

export function closeWindow(): void {
  window.desktopBridge?.closeWindow?.();
}

export function minimizeWindow(): void {
  window.desktopBridge?.minimizeWindow?.();
}

export function toggleMaximizeWindow(): void {
  window.desktopBridge?.toggleMaximizeWindow?.();
}

export function useWindowMaximized(): boolean {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    const bridge = window.desktopBridge;
    let changed = false;
    let active = true;
    const unsubscribe = bridge?.onWindowMaximizedChange?.((value) => {
      changed = true;
      setMaximized(value);
    });
    void bridge?.isWindowMaximized?.().then((value) => {
      if (active && !changed) setMaximized(value);
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);
  return maximized;
}
