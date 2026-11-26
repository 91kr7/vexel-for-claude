import { useEffect, useRef, useState } from 'react';

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

export function isDesktopWindow(): boolean {
  return typeof window !== 'undefined' && window.desktopBridge !== undefined;
}

// Optional: a bridge without these members, like a test fake, keeps the page working.
export interface DesktopBridge {
  closeWindow?(): void;
  minimizeWindow?(): void;
  toggleMaximizeWindow?(): void;
  isWindowMaximized?(): Promise<boolean>;
  onWindowMaximizedChange?(listener: (maximized: boolean) => void): () => void;
  quitApp?(): void;
  onPlaySound?(listener: () => void): () => void;
  readRemoteSettings?(): Promise<RemoteSettings>;
  saveRemoteSettings?(settings: RemoteSettings): Promise<void>;
  sendTestNotification?(): Promise<TestNotificationResult | null>;
}

export type TestNotificationResult = { status: 'sent' } | { status: 'failed'; reason: string };

export interface RemoteSettings {
  enabled: boolean;
  topicUrl: string;
  token: string;
}

const DEFAULT_REMOTE_SETTINGS: RemoteSettings = { enabled: false, topicUrl: '', token: '' };

export function closeWindow(): void {
  window.desktopBridge?.closeWindow?.();
}

export function minimizeWindow(): void {
  window.desktopBridge?.minimizeWindow?.();
}

export function toggleMaximizeWindow(): void {
  window.desktopBridge?.toggleMaximizeWindow?.();
}

export function quitApp(): void {
  window.desktopBridge?.quitApp?.();
}

export function onSoundRequest(listener: () => void): () => void {
  return window.desktopBridge?.onPlaySound?.(listener) ?? (() => {});
}

export async function readRemoteSettings(): Promise<RemoteSettings> {
  try {
    return (await window.desktopBridge?.readRemoteSettings?.()) ?? { ...DEFAULT_REMOTE_SETTINGS };
  } catch {
    return { ...DEFAULT_REMOTE_SETTINGS };
  }
}

export async function saveRemoteSettings(settings: RemoteSettings): Promise<void> {
  try {
    await window.desktopBridge?.saveRemoteSettings?.(settings);
  } catch {
    // The section keeps showing the values; the next change saves them again.
  }
}

export async function sendTestNotification(): Promise<TestNotificationResult | null> {
  try {
    return (await window.desktopBridge?.sendTestNotification?.()) ?? null;
  } catch {
    return null;
  }
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
