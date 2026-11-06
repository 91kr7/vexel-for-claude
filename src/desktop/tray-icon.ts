import type { MenuItemConstructorOptions } from 'electron';

export const TRAY_TOOLTIP = 'Vexel for Claude';

export interface TrayActions {
  openWindow: () => void;
  quit: () => void;
}

export function trayMenuTemplate(actions: TrayActions): MenuItemConstructorOptions[] {
  return [
    { label: 'Open Window', click: () => actions.openWindow() },
    { label: 'Quit', click: () => actions.quit() },
  ];
}
