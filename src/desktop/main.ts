import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow } from 'electron';
import { launchBackend } from './backend-launcher.js';
import { startupPageUrl } from './startup-page.js';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));
const iconPath = path.join(rootDir, 'src/desktop/icons/vexel-for-claude.png');

let mainWindow: BrowserWindow | undefined;

function showWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

async function start(): Promise<void> {
  const current = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Vexel for Claude',
    icon: iconPath,
    backgroundColor: '#0b0b0e',
    autoHideMenuBar: true,
  });
  mainWindow = current;
  await current.loadURL(startupPageUrl({ kind: 'loading' }));

  const result = await launchBackend({ rootDir, logFile: path.join(app.getPath('logs'), 'backend.log') });
  if (current.isDestroyed()) return;
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
  app.on('window-all-closed', () => app.quit());
  void app.whenReady().then(start);
}
