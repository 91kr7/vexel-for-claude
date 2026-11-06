import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, Menu, Tray } from 'electron';
import { type LaunchResult, launchBackend, stopStartedBackend } from './backend-launcher.js';
import { confirmQuit } from './quit-check.js';
import { startupPageUrl } from './startup-page.js';
import { TRAY_TOOLTIP, trayMenuTemplate } from './tray-icon.js';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));
const iconPath = path.join(rootDir, 'src/desktop/icons/vexel-for-claude.png');

let mainWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
let backend: LaunchResult | undefined;
let quitRunning = false;
let quitConfirmed = false;

function showWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

async function requestQuit(): Promise<void> {
  if (quitRunning) return;
  quitRunning = true;
  try {
    const readyBackend = backend?.status === 'ready' ? backend : undefined;
    if (!(await confirmQuit(readyBackend, (options) => dialog.showMessageBox(options)))) return;
    await stopStartedBackend();
    quitConfirmed = true;
    app.quit();
  } finally {
    quitRunning = false;
  }
}

async function start(): Promise<void> {
  tray = new Tray(iconPath);
  tray.setToolTip(TRAY_TOOLTIP);
  tray.setContextMenu(Menu.buildFromTemplate(trayMenuTemplate({ openWindow: showWindow, quit: () => app.quit() })));

  const current = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Vexel for Claude',
    icon: iconPath,
    backgroundColor: '#0b0b0e',
    autoHideMenuBar: true,
  });
  mainWindow = current;
  current.on('close', (event) => {
    if (quitConfirmed) return;
    event.preventDefault();
    current.hide();
  });
  await current.loadURL(startupPageUrl({ kind: 'loading' }));

  const result = await launchBackend({ rootDir, logFile: path.join(app.getPath('logs'), 'backend.log') });
  backend = result;
  if (current.isDestroyed() || quitRunning || quitConfirmed) return;
  if (result.status === 'ready') {
    await current.loadURL(`${result.origin}/`);
  } else {
    await current.loadURL(startupPageUrl({ kind: 'error', outputLines: result.outputLines }));
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.on('before-quit', (event) => {
    if (quitConfirmed) return;
    event.preventDefault();
    void requestQuit();
  });
  void app.whenReady().then(start);
}
