import type { BrowserWindow, IpcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';

export const WINDOW_CLOSE_CHANNEL = 'desktop-bridge:window-close';
export const WINDOW_MINIMIZE_CHANNEL = 'desktop-bridge:window-minimize';
export const WINDOW_TOGGLE_MAXIMIZE_CHANNEL = 'desktop-bridge:window-toggle-maximize';
export const WINDOW_IS_MAXIMIZED_CHANNEL = 'desktop-bridge:window-is-maximized';
export const WINDOW_MAXIMIZED_CHANNEL = 'desktop-bridge:window-maximized';

type WindowIpc = Pick<IpcMain, 'on' | 'handle'>;

export function connectWindowActions(window: BrowserWindow, ipc: WindowIpc): void {
  const fromWindow = (event: IpcMainEvent | IpcMainInvokeEvent) => !window.isDestroyed() && event.sender === window.webContents;

  ipc.on(WINDOW_CLOSE_CHANNEL, (event) => {
    if (fromWindow(event)) window.close();
  });
  ipc.on(WINDOW_MINIMIZE_CHANNEL, (event) => {
    if (fromWindow(event)) window.minimize();
  });
  ipc.on(WINDOW_TOGGLE_MAXIMIZE_CHANNEL, (event) => {
    if (!fromWindow(event)) return;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  ipc.handle(WINDOW_IS_MAXIMIZED_CHANNEL, (event) => fromWindow(event) && window.isMaximized());

  const sendMaximized = () => {
    if (!window.isDestroyed()) window.webContents.send(WINDOW_MAXIMIZED_CHANNEL, window.isMaximized());
  };
  window.on('maximize', sendMaximized).on('unmaximize', sendMaximized);
}
