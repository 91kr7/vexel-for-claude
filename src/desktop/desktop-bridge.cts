import electron = require('electron');

const OPEN_SESSION_CHANGED_CHANNEL = 'desktop-bridge:open-session-changed';
const OPEN_SESSION_CHANNEL = 'desktop-bridge:open-session';

electron.contextBridge.exposeInMainWorld('desktopBridge', {
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
