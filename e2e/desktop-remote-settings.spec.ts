// e2e of plan-remote_notifications, batch notifications-section, in the desktop app. Each launch gets its own HOME and free port, and a
// private D-Bus session bus whose notification server and tray host are fakes: nothing reaches the user's panel or notifications.
import { type ChildProcess, type ChildProcessByStdio, execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { Message, type MessageBus, Variant, sessionBus } from '@jellybrick/dbus-next';
import { type ElectronApplication, type Page, _electron, expect, test } from '@playwright/test';
import { killLeftovers } from './leftovers';
import { settingsButton, settingsPopup } from './settings';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const electronBinary = createRequire(import.meta.url)('electron') as string;
const fakeClaude = fileURLToPath(new URL('../test-support/fake-claude.mjs', import.meta.url));
const NAME = 'org.freedesktop.Notifications';
const OBJECT_PATH = '/org/freedesktop/Notifications';
const WATCHER = 'org.kde.StatusNotifierWatcher';
const WATCHER_PATH = '/StatusNotifierWatcher';
const PROPERTIES = 'org.freedesktop.DBus.Properties';

const SOUND = 'Play a sound when a session needs input';
const REMOTE = 'Send a remote notification after 60 seconds of waiting';
const TOPIC = 'https://ntfy.sh/my-topic';
const TOKEN = 'tk_restart_secret';

let daemon: ChildProcessByStdio<null, Readable, null>;
let busAddress: string;
let service: MessageBus;
let nextId = 40;
const apps: ElectronApplication[] = [];
const ports: number[] = [];
const dirs: string[] = [];

/** The fake notification server and tray host: they answer what the app asks, and record nothing. */
function handle(msg: Message): boolean {
  const reply = (signature = '', values: unknown[] = []) => {
    service.send(Message.newMethodReturn(msg, signature, values));
    return true;
  };
  if (msg.path === WATCHER_PATH) {
    if (msg.interface === WATCHER) return reply();
    const properties: Record<string, Variant> = {
      IsStatusNotifierHostRegistered: new Variant('b', true),
      ProtocolVersion: new Variant('i', 0),
      RegisteredStatusNotifierItems: new Variant('as', []),
    };
    if (msg.interface === PROPERTIES && msg.member === 'GetAll') return reply('a{sv}', [properties]);
    if (msg.interface === PROPERTIES && msg.member === 'Get') {
      const value = properties[(msg.body as [string, string])[1]];
      return value ? reply('v', [value]) : false;
    }
    return false;
  }
  if (msg.interface !== NAME || msg.path !== OBJECT_PATH) return false;
  if (msg.member === 'GetCapabilities') return reply('as', [['body', 'actions', 'persistence']]);
  if (msg.member === 'Notify') return reply('u', [(nextId += 1)]);
  if (msg.member === 'CloseNotification') return reply();
  return false;
}

test.beforeAll(async () => {
  execFileSync('npx', ['tsc', '-b', 'tsconfig.desktop.build.json'], { cwd: repoRoot, stdio: 'ignore' });
  expect(existsSync(path.join(repoRoot, 'dist/web/index.html'))).toBe(true);
  daemon = spawn('dbus-daemon', ['--session', '--nofork', '--print-address=1', `--address=unix:tmpdir=${os.tmpdir()}`], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  busAddress = await new Promise<string>((resolve, reject) => {
    daemon.once('error', reject);
    daemon.stdout.once('data', (data: Buffer) => resolve(data.toString().trim().split('\n')[0] ?? ''));
  });
  expect(busAddress).toMatch(/^unix:path=/);
  service = sessionBus({ busAddress });
  service.addMethodHandler(handle);
  // 4 = DO_NOT_QUEUE; 1 = primary owner.
  expect(await service.requestName(NAME, 4)).toBe(1);
  expect(await service.requestName(WATCHER, 4)).toBe(1);
});

test.afterAll(() => {
  service?.disconnect();
  daemon?.kill('SIGTERM');
});

test.afterEach(async () => {
  for (const app of apps.splice(0)) await quitDesktop(app);
  for (const port of ports.splice(0)) await stopListeners(port);
  for (const dir of dirs.splice(0)) {
    killLeftovers(dir);
    await rm(dir, { recursive: true, force: true });
  }
});

// Not `app.close()`: the detached backend inherits Electron's descriptors, Playwright's connection included, so close() would wait for the backend.
async function quitDesktop(app: ElectronApplication): Promise<void> {
  let electron: ChildProcess;
  try {
    electron = app.process();
  } catch {
    return;
  }
  if (electron.exitCode !== null || electron.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => electron.once('exit', () => resolve()));
  await app
    .evaluate(({ dialog }) => {
      dialog.showMessageBox = (() => Promise.resolve({ response: 1, checkboxChecked: false })) as never;
    })
    .catch(() => undefined);
  await app.evaluate(({ app: electronApp }) => electronApp.quit()).catch(() => undefined);
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 10_000))]);
  if (electron.exitCode === null && electron.signalCode === null) electron.kill('SIGKILL');
}

async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  await new Promise((resolve) => server.close(resolve));
  ports.push(address.port);
  return address.port;
}

function listenerPids(port: number): number[] {
  const out = execFileSync('ss', ['-Hltnp', `sport = :${port}`], { encoding: 'utf8' });
  return [...out.matchAll(/pid=(\d+)/g)].map((match) => Number(match[1]));
}

async function stopListeners(port: number): Promise<void> {
  for (const pid of listenerPids(port)) {
    if (pid === process.pid) continue;
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      continue;
    }
    await expect
      .poll(() => listenerPids(port).includes(pid), { timeout: 5000 })
      .toBe(false)
      .catch(() => process.kill(pid, 'SIGKILL'));
  }
}

interface Desktop {
  app: ElectronApplication;
  window: Page;
  port: number;
  home: string;
}

/** Launches the app on its own HOME; `restart` launches it again on the HOME and port of a quit app, as after a restart. */
async function readyDesktop(restart?: { home: string; port: number }): Promise<Desktop> {
  const port = restart?.port ?? (await freePort());
  const home = restart?.home ?? (await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-remote-')));
  if (!restart) dirs.push(home);
  const base = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  delete base.ELECTRON_RUN_AS_NODE;
  const env = {
    ...base,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    XDG_CACHE_HOME: path.join(home, '.cache'),
    XDG_DATA_HOME: path.join(home, '.local/share'),
    PORT: String(port),
    AI_CLIENT_NODE: process.execPath,
    CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
    AI_CLIENT_CLAUDE_CLI: fakeClaude,
    DBUS_SESSION_BUS_ADDRESS: busAddress,
  };
  const app = await _electron.launch({ executablePath: electronBinary, args: ['.'], cwd: repoRoot, env });
  apps.push(app);
  const window = await app.firstWindow();
  await expect(window.getByRole('region', { name: 'Session List' })).toBeVisible({ timeout: 20_000 });
  return { app, window, port, home };
}

const panel = (page: Page) => settingsPopup(page).getByRole('tabpanel', { name: 'Notifications' });
const soundSwitch = (page: Page) => panel(page).getByRole('switch', { name: SOUND, exact: true });
const remoteSwitch = (page: Page) => panel(page).getByRole('switch', { name: REMOTE, exact: true });
const topicField = (page: Page) => panel(page).getByRole('textbox', { name: 'Topic URL', exact: true });
const tokenField = (page: Page) => panel(page).getByLabel('Access token (optional)', { exact: true });

async function openNotifications(page: Page): Promise<void> {
  await settingsButton(page).click();
  await settingsPopup(page).getByRole('tab', { name: 'Notifications', exact: true }).click();
  await expect(topicField(page)).toBeEnabled();
}

async function closeSettings(page: Page): Promise<void> {
  await settingsPopup(page).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
}

const settingsFile = async (app: ElectronApplication) =>
  path.join(await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData')), 'remote-notifications.json');

test.describe('Remote notification settings in the desktop app', () => {
  test.describe.configure({ timeout: 120_000 });

  // Scenarios "The user sets up the remote notification" and "The settings stay after a restart"
  test('REQ-5, REQ-11, REQ-12: the remote switch, the topic URL and the token survive a restart; the file is private', async () => {
    const first = await readyDesktop();
    const menu = settingsPopup(first.window).getByRole('tablist', { name: 'Settings sections' });
    await settingsButton(first.window).click();
    await expect(menu.getByRole('tab'), 'REQ-1, REQ-2, REQ-3').toHaveText(['Appearance', 'Shortcuts', 'Processes', 'Notifications', 'Updates']);
    await closeSettings(first.window);

    await openNotifications(first.window);
    await expect(remoteSwitch(first.window), 'REQ-5: off at first start').toHaveAttribute('aria-checked', 'false');
    await expect(topicField(first.window)).toHaveValue('');
    await expect(tokenField(first.window)).toHaveValue('');
    await expect(soundSwitch(first.window), 'REQ-13').toHaveAttribute('aria-checked', 'true');

    await topicField(first.window).fill(TOPIC);
    await tokenField(first.window).fill(TOKEN);
    await remoteSwitch(first.window).click();
    await expect(remoteSwitch(first.window)).toHaveAttribute('aria-checked', 'true');

    const file = await settingsFile(first.app);
    await expect
      .poll(async () => JSON.parse(await readFile(file, 'utf8').catch(() => 'null')), { message: 'REQ-11: saved at once' })
      .toEqual({ enabled: true, topicUrl: TOPIC, token: TOKEN });
    expect((await stat(file)).mode & 0o777, 'decision "Where the settings live": mode 0600').toBe(0o600);
    await closeSettings(first.window);
    await quitDesktop(first.app);

    const { window } = await readyDesktop({ home: first.home, port: first.port });
    await openNotifications(window);
    await expect(topicField(window), 'REQ-12').toHaveValue(TOPIC);
    await expect(tokenField(window), 'REQ-12').toHaveValue(TOKEN);
    await expect(tokenField(window), 'REQ-8: the token shows as dots').toHaveAttribute('type', 'password');
    await expect(remoteSwitch(window), 'REQ-12').toHaveAttribute('aria-checked', 'true');
    await expect(soundSwitch(window), 'REQ-13').toHaveAttribute('aria-checked', 'true');
  });

  // spec DesktopApp: the read and the save answer only the web contents of the window
  test('another web contents with the preload gets the defaults and saves nothing', async () => {
    const { app, window } = await readyDesktop();
    await openNotifications(window);
    await topicField(window).fill(TOPIC);
    await remoteSwitch(window).click();
    await expect(remoteSwitch(window)).toHaveAttribute('aria-checked', 'true');
    const file = await settingsFile(app);
    await expect.poll(async () => JSON.parse(await readFile(file, 'utf8').catch(() => 'null'))).toEqual({ enabled: true, topicUrl: TOPIC, token: '' });

    const preload = path.join(repoRoot, 'dist/desktop/desktop-bridge.cjs');
    const other = await app.evaluate(async ({ BrowserWindow }, preloadPath) => {
      const hidden = new BrowserWindow({ show: false, webPreferences: { preload: preloadPath } });
      try {
        await hidden.loadURL('data:text/html,<p>other</p>');
        return (await hidden.webContents.executeJavaScript(
          `(async () => {
            const bridge = window.desktopBridge;
            if (!bridge) return { bridge: false };
            const read = await bridge.readRemoteSettings();
            let saveError = null;
            try { await bridge.saveRemoteSettings({ enabled: false, topicUrl: 'https://ntfy.sh/intruder', token: 'x' }); } catch (error) { saveError = String(error); }
            return { bridge: true, read, saveError };
          })()`,
        )) as { bridge: boolean; read?: unknown; saveError?: string | null };
      } finally {
        hidden.destroy();
      }
    }, preload);

    expect(other.bridge, 'the preload ran in the other web contents').toBe(true);
    expect(other.read, 'the read gives no settings: the bridge falls back to the defaults').toEqual({ enabled: false, topicUrl: '', token: '' });
    expect(JSON.parse(await readFile(file, 'utf8')), 'the save wrote nothing').toEqual({ enabled: true, topicUrl: TOPIC, token: '' });
  });
});
