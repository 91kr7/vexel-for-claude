// e2e of plan-session_notifications, batch needs-input-notification, in the desktop app. Each launch gets its own HOME, free port and Claude folder,
// and a private D-Bus session bus whose notification server is a fake: no real notification reaches the user's display.
import { type ChildProcess, type ChildProcessByStdio, execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { Message, type MessageBus, sessionBus, type Variant } from '@jellybrick/dbus-next';
import { type ElectronApplication, type Page, _electron, expect, test } from '@playwright/test';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const electronBinary = createRequire(import.meta.url)('electron') as string;
const fakeClaude = fileURLToPath(new URL('../test-support/fake-claude.mjs', import.meta.url));
const NAME = 'org.freedesktop.Notifications';
const OBJECT_PATH = '/org/freedesktop/Notifications';
// REQ-2: within 5 seconds of the state change.
const FIVE_SECONDS = 5000;

interface NotifyCall {
  appName: string;
  replacesId: number;
  appIcon: string;
  summary: string;
  body: string;
  actions: string[];
  hints: Record<string, Variant>;
  expireTimeout: number;
  id: number;
}

const fake = { notifyCalls: [] as NotifyCall[], closeCalls: [] as number[], nextId: 70 };
let daemon: ChildProcessByStdio<null, Readable, null>;
let busAddress: string;
let service: MessageBus;

const apps: ElectronApplication[] = [];
const ports: number[] = [];
const dirs: string[] = [];

function handle(msg: Message): boolean {
  if (msg.interface !== NAME || msg.path !== OBJECT_PATH) return false;
  const body = msg.body as unknown[];
  switch (msg.member) {
    case 'GetCapabilities':
      service.send(Message.newMethodReturn(msg, 'as', [['body', 'actions', 'persistence']]));
      return true;
    case 'Notify': {
      const [appName, replacesId, appIcon, summary, text, actions, hints, expireTimeout] = body as [
        string,
        number,
        string,
        string,
        string,
        string[],
        Record<string, Variant>,
        number,
      ];
      const id = replacesId !== 0 ? replacesId : (fake.nextId += 1);
      fake.notifyCalls.push({ appName, replacesId, appIcon, summary, body: text, actions, hints, expireTimeout, id });
      service.send(Message.newMethodReturn(msg, 'u', [id]));
      return true;
    }
    case 'CloseNotification':
      fake.closeCalls.push(body[0] as number);
      service.send(Message.newMethodReturn(msg, '', []));
      return true;
    default:
      return false;
  }
}

/** The user clicks the notification: the server reports its default action. */
const clickNotification = (id: number) => service.send(Message.newSignal(OBJECT_PATH, NAME, 'ActionInvoked', 'us', [id, 'default']));

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
});

test.afterAll(() => {
  service?.disconnect();
  daemon?.kill('SIGTERM');
});

test.beforeEach(() => {
  fake.notifyCalls.length = 0;
  fake.closeCalls.length = 0;
});

test.afterEach(async () => {
  for (const app of apps.splice(0)) await quitDesktop(app);
  for (const port of ports.splice(0)) await stopListeners(port);
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
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
  // Answers "Quit" to the confirmation that busy sessions bring.
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

/** Environment of an isolated desktop session: its own HOME (own Electron profile and single-instance lock), port and private bus. */
async function desktopEnv(port: number): Promise<Record<string, string>> {
  const home = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-notify-'));
  dirs.push(home);
  const base = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  delete base.ELECTRON_RUN_AS_NODE;
  return {
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
}

async function readyDesktop(): Promise<{ app: ElectronApplication; window: Page; port: number; home: string }> {
  const port = await freePort();
  const env = await desktopEnv(port);
  const app = await _electron.launch({ executablePath: electronBinary, args: ['.'], cwd: repoRoot, env });
  apps.push(app);
  const window = await app.firstWindow();
  await expect(window.getByRole('region', { name: 'Session List' })).toBeVisible({ timeout: 20_000 });
  return { app, window, port, home: env.HOME! };
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

/** The session asks for permission to run `tool` after a new prompt. */
async function askPermission(port: number, id: string, prompt: string, tool: string): Promise<void> {
  await hook(port, id, { hook_event_name: 'UserPromptSubmit', prompt });
  await hook(port, id, { hook_event_name: 'PermissionRequest', tool_name: tool });
}

async function sessionState(port: number, id: string): Promise<string | undefined> {
  const sessions = (await (await fetch(`http://127.0.0.1:${port}/api/sessions`)).json()) as { id: string; state: string }[];
  return sessions.find((session) => session.id === id)?.state;
}

const windowState = async (app: ElectronApplication) =>
  (
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((window) => ({ visible: window.isVisible(), minimized: window.isMinimized(), focused: window.isFocused() })),
    )
  )[0];

const closeWindow = (app: ElectronApplication) => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
const minimizeWindow = (app: ElectronApplication) => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.minimize());
const focusWindow = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]!;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  });

const header = (page: Page) => page.getByRole('main').locator('.session-header');

test.describe('Needs-input notification in the desktop app', () => {
  test.describe.configure({ timeout: 90_000 });

  // plan-session_notifications/REQ-12, REQ-13: the preload gives the page the bridge and nothing else
  test('the window page gets window.desktopBridge with its two functions, and no Node access', async () => {
    const { window } = await readyDesktop();
    const page = await window.evaluate(() => {
      const bridge = (window as unknown as { desktopBridge?: Record<string, unknown> }).desktopBridge;
      return {
        keys: bridge ? Object.keys(bridge).sort() : null,
        types: bridge ? Object.values(bridge).map((value) => typeof value) : null,
        require: typeof (globalThis as { require?: unknown }).require,
        process: typeof (globalThis as { process?: unknown }).process,
      };
    });
    expect(page).toEqual({ keys: ['onOpenSession', 'reportOpenSession'], types: ['function', 'function'], require: 'undefined', process: 'undefined' });
  });

  // Scenarios "A waiting session alerts the user while the window is closed" and "A click on the notification opens the session"
  test('REQ-1, REQ-2, REQ-4, REQ-7, REQ-8, REQ-10, REQ-13, REQ-12: closed to the tray, a session asking for Bash shows an urgent notification; its click brings the window back on that session', async () => {
    const { app, window, port, home } = await readyDesktop();
    const folder = path.join(home, 'ai-client');
    const id = await startSession(port, folder);
    await closeWindow(app);
    await expect.poll(async () => (await windowState(app))?.visible).toBe(false);

    const changedAt = Date.now();
    await askPermission(port, id, 'Fix the login form', 'Bash');
    await expect.poll(() => fake.notifyCalls.length, { timeout: FIVE_SECONDS }).toBe(1);
    expect(Date.now() - changedAt).toBeLessThan(FIVE_SECONDS);

    const call = fake.notifyCalls[0]!;
    expect(call).toMatchObject({
      appName: 'Vexel for Claude',
      replacesId: 0,
      summary: 'ai-client · Fix the login form',
      body: 'Permission for Bash',
      actions: ['default', 'Open'],
      expireTimeout: 0,
    });
    expect(call.hints.urgency?.signature).toBe('y');
    expect(call.hints.urgency?.value).toBe(2);
    expect(call.appIcon).toMatch(/vexel-for-claude\.png$/);
    expect(existsSync(call.appIcon.replace(/^file:\/\//, ''))).toBe(true);
    // REQ-10: the app does not close it while the session waits and nobody opens it.
    await window.waitForTimeout(1500);
    expect(fake.closeCalls).toEqual([]);

    clickNotification(call.id);
    await expect.poll(async () => windowState(app)).toEqual({ visible: true, minimized: false, focused: true });
    await expect(header(window).getByRole('heading', { level: 2 })).toHaveText('ai-client');
    // REQ-12: the window has the focus and the session is open.
    await expect.poll(() => fake.closeCalls).toEqual([call.id]);
  });

  // Scenarios "No notification while the user looks at the window", "Bringing back the window on the open session clears its notification",
  // "The notification goes when the need is gone"
  test('REQ-3, REQ-4, REQ-12, REQ-11: nothing while the window has the focus; minimized it notifies; focus on the open session and an answer clear the notification', async () => {
    const { app, window, port, home } = await readyDesktop();
    const folder = path.join(home, 'focus-project');
    const id = await startSession(port, folder);
    await focusWindow(app);
    await expect.poll(async () => (await windowState(app))?.focused).toBe(true);
    await window.getByRole('region', { name: 'Session List' }).getByRole('button').filter({ has: window.getByTitle(folder, { exact: true }) }).click();
    await expect(header(window).getByRole('heading', { level: 2 })).toHaveText('focus-project');

    // REQ-3
    await askPermission(port, id, 'Run the migrations', 'Bash');
    await expect.poll(() => sessionState(port, id)).toBe('needs_input');
    await window.waitForTimeout(3000);
    expect(fake.notifyCalls).toEqual([]);

    // REQ-4: minimized
    await hook(port, id, { hook_event_name: 'PostToolUse' });
    await minimizeWindow(app);
    await expect.poll(async () => (await windowState(app))?.focused).toBe(false);
    await hook(port, id, { hook_event_name: 'PermissionRequest', tool_name: 'Edit' });
    await expect.poll(() => fake.notifyCalls.length, { timeout: FIVE_SECONDS }).toBe(1);
    expect(fake.notifyCalls[0]).toMatchObject({ summary: 'focus-project · Run the migrations', body: 'Permission for Edit' });

    // REQ-12 (gatekeeper decision): the window gets the focus while the session is open
    await focusWindow(app);
    await expect.poll(async () => (await windowState(app))?.focused).toBe(true);
    await expect.poll(() => fake.closeCalls).toEqual([fake.notifyCalls[0]!.id]);

    // REQ-11: the session gets its answer
    await minimizeWindow(app);
    await expect.poll(async () => (await windowState(app))?.focused).toBe(false);
    await hook(port, id, { hook_event_name: 'PostToolUse' });
    await hook(port, id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    await expect.poll(() => fake.notifyCalls.length, { timeout: FIVE_SECONDS }).toBe(2);
    const second = fake.notifyCalls[1]!;
    await hook(port, id, { hook_event_name: 'PostToolUse' });
    await expect.poll(() => fake.closeCalls, { timeout: FIVE_SECONDS }).toEqual([fake.notifyCalls[0]!.id, second.id]);
  });
});
