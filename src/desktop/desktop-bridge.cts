import electron = require('electron');

const OPEN_SESSION_CHANGED_CHANNEL = 'desktop-bridge:open-session-changed';
const OPEN_SESSION_CHANNEL = 'desktop-bridge:open-session';

const WINDOW_CLOSE_CHANNEL = 'desktop-bridge:window-close';
const WINDOW_MINIMIZE_CHANNEL = 'desktop-bridge:window-minimize';
const WINDOW_TOGGLE_MAXIMIZE_CHANNEL = 'desktop-bridge:window-toggle-maximize';
const WINDOW_IS_MAXIMIZED_CHANNEL = 'desktop-bridge:window-is-maximized';
const WINDOW_MAXIMIZED_CHANNEL = 'desktop-bridge:window-maximized';

const windowControls = {
  closeWindow(): void {
    electron.ipcRenderer.send(WINDOW_CLOSE_CHANNEL);
  },
  minimizeWindow(): void {
    electron.ipcRenderer.send(WINDOW_MINIMIZE_CHANNEL);
  },
  toggleMaximizeWindow(): void {
    electron.ipcRenderer.send(WINDOW_TOGGLE_MAXIMIZE_CHANNEL);
  },
  async isWindowMaximized(): Promise<boolean> {
    return (await electron.ipcRenderer.invoke(WINDOW_IS_MAXIMIZED_CHANNEL)) === true;
  },
  onWindowMaximizedChange(listener: (maximized: boolean) => void): () => void {
    const forward = (_event: unknown, maximized: unknown) => {
      if (typeof maximized === 'boolean') listener(maximized);
    };
    electron.ipcRenderer.on(WINDOW_MAXIMIZED_CHANNEL, forward);
    return () => {
      electron.ipcRenderer.removeListener(WINDOW_MAXIMIZED_CHANNEL, forward);
    };
  },
};

electron.contextBridge.exposeInMainWorld('desktopBridge', {
  ...windowControls,
  reportOpenSession(sessionId: unknown): void {
    if (typeof sessionId === 'string' || sessionId === null) {
      electron.ipcRenderer.send(OPEN_SESSION_CHANGED_CHANNEL, sessionId);
    }
  },
  onOpenSession(listener: (sessionId: string) => void): () => void {
    const forward = (_event: unknown, sessionId: unknown) => {
      if (typeof sessionId === 'string') listener(sessionId);
    };
    electron.ipcRenderer.on(OPEN_SESSION_CHANNEL, forward);
    return () => {
      electron.ipcRenderer.removeListener(OPEN_SESSION_CHANNEL, forward);
    };
  },
});
