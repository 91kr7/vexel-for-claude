// e2e of plan-session_notifications, batch tray-signal, in the desktop app. Each launch gets its own HOME, free port and Claude folder,
// and a private D-Bus session bus whose notification server and tray host are fakes: nothing reaches the user's panel or notifications.
import { type ChildProcess, type ChildProcessByStdio, execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { Message, type MessageBus, sessionBus, Variant } from '@jellybrick/dbus-next';
import { type ElectronApplication, type Page, _electron, expect, test } from '@playwright/test';
import { killLeftovers } from './leftovers';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const electronBinary = createRequire(import.meta.url)('electron') as string;
const fakeClaude = fileURLToPath(new URL('../test-support/fake-claude.mjs', import.meta.url));
const NOTIFICATIONS = 'org.freedesktop.Notifications';
const NOTIFICATIONS_PATH = '/org/freedesktop/Notifications';
const WATCHER = 'org.kde.StatusNotifierWatcher';
const WATCHER_PATH = '/StatusNotifierWatcher';
const PROPERTIES = 'org.freedesktop.DBus.Properties';
const SEPARATOR = '---';
const TRAY_UPDATE = 10_000;

interface TrayItem {
  service: string;
  path: string;
}

interface TrayState {
  tooltip: string;
  menu: string[];
  icon: string;
}

type MenuNode = [number, Record<string, Variant>, Variant<MenuNode>[]];

const host = { items: [] as TrayItem[], nextNotificationId: 0 };
let daemon: ChildProcessByStdio<null, Readable, null>;
let busAddress: string;
let bus: MessageBus;

const apps: ElectronApplication[] = [];
const ports: number[] = [];
const dirs: string[] = [];

const watcherProperties = (): Record<string, Variant> => ({
  IsStatusNotifierHostRegistered: new Variant('b', true),
  ProtocolVersion: new Variant('i', 0),
  RegisteredStatusNotifierItems: new Variant('as', host.items.map((item) => item.service)),
});

function handle(msg: Message): boolean {
  const body = msg.body as unknown[];
  const reply = (signature = '', values: unknown[] = []) => {
    bus.send(Message.newMethodReturn(msg, signature, values));
    return true;
  };
  if (msg.path === NOTIFICATIONS_PATH && msg.interface === NOTIFICATIONS) {
    if (msg.member === 'GetCapabilities') return reply('as', [['body', 'actions', 'persistence']]);
    if (msg.member === 'Notify') return reply('u', [(body[1] as number) || (host.nextNotificationId += 1)]);
    if (msg.member === 'CloseNotification') return reply();
    return false;
  }
  if (msg.path !== WATCHER_PATH) return false;
  if (msg.interface === WATCHER && msg.member === 'RegisterStatusNotifierItem') {
    const [item] = body as [string];
    host.items.push(item.startsWith('/') ? { service: msg.sender, path: item } : { service: item, path: '/StatusNotifierItem' });
    return reply();
  }
  if (msg.interface === WATCHER && msg.member === 'RegisterStatusNotifierHost') return reply();
  if (msg.interface === PROPERTIES && msg.member === 'GetAll') return reply('a{sv}', [watcherProperties()]);
  if (msg.interface === PROPERTIES && msg.member === 'Get') {
    const value = watcherProperties()[(body as [string, string])[1]];
    return value ? reply('v', [value]) : false;
  }
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
  bus = sessionBus({ busAddress });
  bus.addMethodHandler(handle);
  // 4 = DO_NOT_QUEUE; 1 = primary owner.
  expect(await bus.requestName(NOTIFICATIONS, 4)).toBe(1);
  expect(await bus.requestName(WATCHER, 4)).toBe(1);
});

test.afterAll(() => {
  bus?.disconnect();
  daemon?.kill('SIGTERM');
});

test.beforeEach(() => {
  host.items.length = 0;
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

async function readyDesktop(): Promise<{ app: ElectronApplication; window: Page; port: number; home: string }> {
  const port = await freePort();
  const home = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-tray-'));
  dirs.push(home);
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

async function startSession(port: number, folder: string): Promise<string> {
  await mkdir(folder, { recursive: true });
  const response = await fetch(`http://127.0.0.1:${port}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: folder }),
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

async function hook(port: number, id: string, event: Record<string, unknown>): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${port}/api/sessions/${id}/hook-events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
  });
  expect(response.ok).toBe(true);
}

async function askPermission(port: number, id: string, prompt: string, tool: string): Promise<void> {
  await hook(port, id, { hook_event_name: 'UserPromptSubmit', prompt });
  await hook(port, id, { hook_event_name: 'PermissionRequest', tool_name: tool });
}

async function call(destination: string, objectPath: string, iface: string, member: string, signature = '', body: unknown[] = []): Promise<unknown[]> {
  const reply = await bus.call(new Message({ destination, path: objectPath, interface: iface, member, signature, body }));
  return reply?.body ?? [];
}

const itemProperty = async (item: TrayItem, name: string): Promise<unknown> =>
  ((await call(item.service, item.path, PROPERTIES, 'Get', 'ss', ['org.kde.StatusNotifierItem', name]))[0] as Variant).value;

async function ownerPid(service: string): Promise<number | undefined> {
  const [pid] = await call('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', 'GetConnectionUnixProcessID', 's', [service]).catch(() => []);
  return pid as number | undefined;
}

async function trayOf(app: ElectronApplication): Promise<TrayItem> {
  const pid = app.process().pid!;
  const find = async () => {
    for (const item of host.items) if ((await ownerPid(item.service)) === pid) return item;
    return undefined;
  };
  await expect.poll(find, { timeout: 10_000 }).toBeDefined();
  return (await find())!;
}

async function menuItems(item: TrayItem): Promise<{ id: number; label: string }[]> {
  const menuPath = (await itemProperty(item, 'Menu')) as string;
  const [, root] = (await call(item.service, menuPath, 'com.canonical.dbusmenu', 'GetLayout', 'iias', [0, -1, []])) as [number, MenuNode];
  return root[2].map(({ value: [id, props] }) => ({ id, label: props.type?.value === 'separator' ? SEPARATOR : (props.label?.value as string) }));
}

async function trayState(item: TrayItem): Promise<TrayState | undefined> {
  try {
    const [, , tooltip] = (await itemProperty(item, 'ToolTip')) as [string, unknown, string, string];
    const menu = (await menuItems(item)).map((entry) => entry.label);
    const iconFile = path.join((await itemProperty(item, 'IconThemePath')) as string, `${(await itemProperty(item, 'IconName')) as string}.png`);
    const icon = createHash('sha256').update(await readFile(iconFile)).digest('hex');
    return { tooltip, menu, icon };
  } catch {
    return undefined;
  }
}

async function clickTray(item: TrayItem, label: string): Promise<void> {
  const entry = (await menuItems(item)).find((candidate) => candidate.label === label);
  if (!entry) throw new Error(`no tray item ${label}`);
  const menuPath = (await itemProperty(item, 'Menu')) as string;
  await call(item.service, menuPath, 'com.canonical.dbusmenu', 'Event', 'isvu', [entry.id, 'clicked', new Variant('s', ''), 0]);
}

async function normalTray(item: TrayItem): Promise<TrayState> {
  await expect.poll(() => trayState(item), { timeout: TRAY_UPDATE }).toMatchObject({ tooltip: 'Vexel for Claude', menu: ['Open Window', 'Quit'] });
  return (await trayState(item))!;
}

const windowState = async (app: ElectronApplication) =>
  (
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((window) => ({ visible: window.isVisible(), minimized: window.isMinimized(), focused: window.isFocused() })),
    )
  )[0];

const closeWindow = (app: ElectronApplication) => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
const focusWindow = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]!;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  });

const header = (page: Page) => page.getByRole('main').locator('.session-header');

test.describe('Tray signal in the desktop app', () => {
  test.describe.configure({ timeout: 90_000 });

  // Scenarios "The tray lists the sessions that wait" and "A tray entry opens its session"
  test('REQ-30, REQ-32, REQ-33, REQ-35, REQ-37, REQ-34: two waiting sessions give the attention icon, the count and one entry each, longest waiting first; an entry brings the window back on its session', async () => {
    const { app, window, port, home } = await readyDesktop();
    const tray = await trayOf(app);
    const normal = await normalTray(tray);
    const alpha = await startSession(port, path.join(home, 'alpha'));
    const beta = await startSession(port, path.join(home, 'beta'));
    await closeWindow(app);
    await expect.poll(async () => (await windowState(app))?.visible).toBe(false);

    await askPermission(port, alpha, 'Fix the login form', 'Bash');
    await expect.poll(async () => (await trayState(tray))?.tooltip, { timeout: TRAY_UPDATE }).toBe('Vexel for Claude · 1 session needs input');
    await askPermission(port, beta, 'Review the invoices', 'Edit');
    await expect.poll(() => trayState(tray), { timeout: TRAY_UPDATE }).toMatchObject({
      tooltip: 'Vexel for Claude · 2 sessions need input',
      menu: ['alpha · Fix the login form', 'beta · Review the invoices', SEPARATOR, 'Open Window', 'Quit'],
    });
    expect((await trayState(tray))?.icon, 'attention look').not.toBe(normal.icon);

    await clickTray(tray, 'alpha · Fix the login form');
    await expect.poll(async () => windowState(app)).toEqual({ visible: true, minimized: false, focused: true });
    await expect(header(window).getByRole('heading', { level: 2 })).toHaveText('alpha');
  });

  // Scenario "The tray returns to normal while the user works in the window"
  test('REQ-36, REQ-30: with the window focused on the waiting session, the tray signals it and returns to normal after the answer', async () => {
    const { app, window, port, home } = await readyDesktop();
    const tray = await trayOf(app);
    const normal = await normalTray(tray);
    const folder = path.join(home, 'gamma');
    const id = await startSession(port, folder);
    await focusWindow(app);
    await expect.poll(async () => (await windowState(app))?.focused).toBe(true);
    await window.getByRole('region', { name: 'Session List' }).getByRole('button').filter({ has: window.getByTitle(folder, { exact: true }) }).click();
    await expect(header(window).getByRole('heading', { level: 2 })).toHaveText('gamma');

    await askPermission(port, id, 'Run the migrations', 'Bash');
    await expect.poll(() => trayState(tray), { timeout: TRAY_UPDATE }).toMatchObject({
      tooltip: 'Vexel for Claude · 1 session needs input',
      menu: ['gamma · Run the migrations', SEPARATOR, 'Open Window', 'Quit'],
    });
    expect((await trayState(tray))?.icon, 'attention look').not.toBe(normal.icon);
    expect((await windowState(app))?.focused).toBe(true);

    await hook(port, id, { hook_event_name: 'PostToolUse' });
    await expect.poll(() => trayState(tray), { timeout: TRAY_UPDATE }).toEqual(normal);
  });
});
