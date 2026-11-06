import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, Menu, Tray } from 'electron';
import { type AttentionSession, connectAttention } from './attention-client.js';
import { type LaunchResult, launchBackend, stopStartedBackend } from './backend-launcher.js';
import { type NotificationCommand, NotificationRules } from './notification-rules.js';
import { groupNotificationTexts, notificationTexts } from './notification-texts.js';
import { confirmQuit } from './quit-check.js';
import { startupPageUrl } from './startup-page.js';
import { SystemNotifications } from './system-notifications.js';
import { trayIconFile, trayMenuTemplate, trayTooltip } from './tray-icon.js';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));
const iconsDir = path.join(rootDir, 'src/desktop/icons');
const iconPath = path.join(iconsDir, 'vexel-for-claude.png');
const preloadPath = fileURLToPath(new URL('desktop-bridge.cjs', import.meta.url));
const OPEN_SESSION_CHANGED_CHANNEL = 'desktop-bridge:open-session-changed';
const OPEN_SESSION_CHANNEL = 'desktop-bridge:open-session';

let mainWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
let backend: LaunchResult | undefined;
let quitRunning = false;
let quitConfirmed = false;
const notificationRules = new NotificationRules();
const notifications = new SystemNotifications({ appName: 'Vexel for Claude', iconPath });

function showWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function runNotificationCommands(commands: NotificationCommand[]): void {
  for (const command of commands) {
    if (command.type === 'show') {
      const { event, replaces } = command;
      void notifications.show({ sessionId: event.sessionId, replaces, kind: event.kind, ...notificationTexts(event) });
    } else if (command.type === 'show-group') {
      const { sessionId, replaces, kind, events } = command;
      void notifications.show({ sessionId, replaces, kind, ...groupNotificationTexts(events) });
    } else {
      void notifications.close(command.sessionId);
    }
  }
}

function openNotifiedSession(sessionId: string): void {
  showWindow();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(OPEN_SESSION_CHANNEL, sessionId);
}

function updateTray(sessions: readonly AttentionSession[]): void {
  if (!tray || tray.isDestroyed()) return;
  tray.setImage(path.join(iconsDir, trayIconFile(sessions.length)));
  tray.setToolTip(trayTooltip(sessions.length));
  const actions = { openWindow: showWindow, quit: () => app.quit(), openSession: openNotifiedSession };
  tray.setContextMenu(Menu.buildFromTemplate(trayMenuTemplate(actions, sessions)));
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
  updateTray([]);

  const current = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Vexel for Claude',
    icon: iconPath,
    backgroundColor: '#0b0b0e',
    autoHideMenuBar: true,
    webPreferences: { preload: preloadPath },
  });
  mainWindow = current;
  const updateWindowFocus = () =>
    runNotificationCommands(
      notificationRules.setWindowFocused(current.isFocused() && current.isVisible() && !current.isMinimized()),
    );
  current.on('focus', updateWindowFocus).on('blur', updateWindowFocus).on('hide', updateWindowFocus).on('minimize', updateWindowFocus);
  ipcMain.on(OPEN_SESSION_CHANGED_CHANNEL, (event, sessionId: unknown) => {
    if (current.isDestroyed() || event.sender !== current.webContents) return;
    if (typeof sessionId === 'string' || sessionId === null) runNotificationCommands(notificationRules.setOpenSession(sessionId));
  });
  notifications.onClick(openNotifiedSession);
  notifications.onClosed((sessionId) => notificationRules.notificationClosed(sessionId));
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
    connectAttention(result.origin, {
      onEvent: (event) => runNotificationCommands(notificationRules.receiveEvent(event)),
      onNeedsInput: (sessions) => {
        updateTray(sessions);
        runNotificationCommands(notificationRules.receiveNeedsInput(sessions));
      },
    });
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
