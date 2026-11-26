// e2e of plan-input_sound, batches needs-input-sound and sound-switch, in the desktop app. Each launch gets its own HOME, free port and Claude folder,
// and a private D-Bus session bus whose notification server and tray host are fakes: nothing reaches the user's panel or notifications.
// The page plays the chime at volume 0, so no sound reaches the user's speakers.
import { type ChildProcess, type ChildProcessByStdio, execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
import { quitDesktop } from './desktop-quit';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const electronBinary = createRequire(import.meta.url)('electron') as string;
const fakeClaude = fileURLToPath(new URL('../test-support/fake-claude.mjs', import.meta.url));
const NAME = 'org.freedesktop.Notifications';
const OBJECT_PATH = '/org/freedesktop/Notifications';
const WATCHER = 'org.kde.StatusNotifierWatcher';
const WATCHER_PATH = '/StatusNotifierWatcher';
const PROPERTIES = 'org.freedesktop.DBus.Properties';
const TRAY_UPDATE = 10_000;
// REQ-3: within 5 seconds of the state change.
const FIVE_SECONDS = 5000;
// REQ-4, REQ-6: the 5-second window, with a margin.
const AFTER_WINDOW = 5500;

const fake = { notifyCalls: [] as { summary: string; body: string }[], nextId: 70, trayItems: [] as { service: string; path: string }[] };
let daemon: ChildProcessByStdio<null, Readable, null>;
let busAddress: string;
let service: MessageBus;

const apps: ElectronApplication[] = [];
const ports: number[] = [];
const dirs: string[] = [];
const terminals: ChildProcess[] = [];

const watcherProperties = (): Record<string, Variant> => ({
  IsStatusNotifierHostRegistered: new Variant('b', true),
  ProtocolVersion: new Variant('i', 0),
  RegisteredStatusNotifierItems: new Variant('as', fake.trayItems.map((item) => item.service)),
});

/** The fake tray host: it records the tray items that register. */
function handleWatcher(msg: Message): boolean {
  const reply = (signature = '', values: unknown[] = []) => {
    service.send(Message.newMethodReturn(msg, signature, values));
    return true;
  };
  if (msg.interface === WATCHER && msg.member === 'RegisterStatusNotifierItem') {
    const [item] = msg.body as [string];
    fake.trayItems.push(item.startsWith('/') ? { service: msg.sender, path: item } : { service: item, path: '/StatusNotifierItem' });
    return reply();
  }
  if (msg.interface === WATCHER && msg.member === 'RegisterStatusNotifierHost') return reply();
  if (msg.interface === PROPERTIES && msg.member === 'GetAll') return reply('a{sv}', [watcherProperties()]);
  if (msg.interface === PROPERTIES && msg.member === 'Get') {
    const value = watcherProperties()[(msg.body as [string, string])[1]];
    return value ? reply('v', [value]) : false;
  }
  return false;
}

function handle(msg: Message): boolean {
  if (msg.path === WATCHER_PATH) return handleWatcher(msg);
  if (msg.interface !== NAME || msg.path !== OBJECT_PATH) return false;
  const body = msg.body as unknown[];
  switch (msg.member) {
    case 'GetCapabilities':
      service.send(Message.newMethodReturn(msg, 'as', [['body', 'actions', 'persistence']]));
      return true;
    case 'Notify': {
      const replacesId = body[1] as number;
      const id = replacesId !== 0 ? replacesId : (fake.nextId += 1);
      fake.notifyCalls.push({ summary: body[3] as string, body: body[4] as string });
      service.send(Message.newMethodReturn(msg, 'u', [id]));
      return true;
    }
    case 'CloseNotification':
      service.send(Message.newMethodReturn(msg, '', []));
      return true;
    default:
      return false;
  }
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

test.beforeEach(() => {
  fake.notifyCalls.length = 0;
  fake.trayItems.length = 0;
});

test.afterEach(async () => {
  for (const app of apps.splice(0)) await quitDesktop(app);
  for (const terminal of terminals.splice(0)) terminal.kill('SIGKILL');
  for (const port of ports.splice(0)) await stopListeners(port);
  for (const dir of dirs.splice(0)) {
    killLeftovers(dir);
    await rm(dir, { recursive: true, force: true });
  }
});

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
async function desktopEnv(port: number, reusedHome?: string): Promise<Record<string, string>> {
  const home = reusedHome ?? (await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-sound-')));
  if (!reusedHome) dirs.push(home);
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

interface Desktop {
  app: ElectronApplication;
  window: Page;
  port: number;
  home: string;
}

/**
 * Launches the app; `prepare` runs on its HOME before the launch. Records the sound requests of DesktopApp and the plays of the page.
 * `restart` launches it again on the HOME and port of a quit app: the same profile and page origin, as after a restart.
 */
async function readyDesktop(prepare?: (home: string) => Promise<void>, restart?: { home: string; port: number }): Promise<Desktop> {
  const port = restart?.port ?? (await freePort());
  const env = await desktopEnv(port, restart?.home);
  await prepare?.(env.HOME!);
  const app = await _electron.launch({ executablePath: electronBinary, args: ['.'], cwd: repoRoot, env });
  apps.push(app);
  const window = await app.firstWindow();
  // Main side: each message on the sound channel, from the start of the app.
  await app.evaluate(({ BrowserWindow }) => {
    const contents = BrowserWindow.getAllWindows()[0]!.webContents;
    const sends: number[] = [];
    Object.assign(globalThis, { e2eSoundSends: sends });
    const send = contents.send.bind(contents);
    contents.send = (channel: string, ...args: unknown[]) => {
      if (channel === 'desktop-bridge:play-sound') sends.push(Date.now());
      send(channel, ...args);
    };
  });
  await expect(window.getByRole('region', { name: 'Session List' })).toBeVisible({ timeout: 20_000 });
  // Page side: each play, at volume 0, with its outcome and the length of the sound.
  await window.evaluate(() => {
    const plays: { src: string; at: number; outcome: string; duration: number }[] = [];
    Object.assign(window, { e2ePlays: plays });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      const record = { src: this.src, at: Date.now(), outcome: 'pending', duration: Number.NaN };
      plays.push(record);
      this.volume = 0;
      this.addEventListener('loadedmetadata', () => (record.duration = this.duration));
      const result = play.call(this);
      result.then(
        () => (record.outcome = 'playing'),
        (error: Error) => (record.outcome = `rejected: ${error.name}`),
      );
      return result;
    };
  });
  return { app, window, port, home: env.HOME! };
}

const soundSends = (app: ElectronApplication) => app.evaluate(() => [...(globalThis as unknown as { e2eSoundSends: number[] }).e2eSoundSends]);
type PlayRecord = { src: string; at: number; outcome: string; duration: number };
const plays = (window: Page) => window.evaluate(() => [...(window as unknown as { e2ePlays: PlayRecord[] }).e2ePlays]);

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

async function sessionState(port: number, id: string): Promise<string | undefined> {
  const sessions = (await (await fetch(`http://127.0.0.1:${port}/api/sessions`)).json()) as { id: string; state: string }[];
  return sessions.find((session) => session.id === id)?.state;
}

/** Simulates Claude Code in another terminal: a live process, its session file and transcript in the Claude folder. */
async function runExternal(home: string, sessionId: string, folder: string, status: string) {
  const claudeDir = path.join(home, '.claude');
  const sessions = path.join(claudeDir, 'sessions');
  const transcript = path.join(claudeDir, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'), `${sessionId}.jsonl`);
  await mkdir(folder, { recursive: true });
  await mkdir(sessions, { recursive: true });
  await mkdir(path.dirname(transcript), { recursive: true });
  const entries = [
    { type: 'user', cwd: folder, isSidechain: false, message: { role: 'user', content: 'Hello' } },
    { type: 'assistant', cwd: folder, isSidechain: false, message: { role: 'assistant', content: [{ type: 'text', text: 'Hi there' }] } },
  ];
  await writeFile(transcript, entries.map((entry) => `${JSON.stringify(entry)}\n`).join(''));
  const child = spawn('sleep', ['300'], { stdio: 'ignore' });
  terminals.push(child);
  const pid = child.pid ?? 0;
  execFileSync('mkfifo', [path.join(sessions, `${pid}.5a6b7c8d.key`)]);
  let data = { pid, sessionId, cwd: folder, kind: 'interactive', status, updatedAt: Date.now() };
  const write = () => writeFile(path.join(sessions, `${pid}.json`), JSON.stringify(data));
  await write();
  return {
    update: async (fields: Partial<typeof data>) => {
      data = { ...data, ...fields };
      await write();
    },
  };
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

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const header = (page: Page) => page.getByRole('main').locator('.session-header');

const SWITCH = 'Play a sound when a session needs input';
const soundSwitch = (page: Page) => settingsPopup(page).getByRole('switch', { name: SWITCH, exact: true });

async function openSoundMenu(page: Page): Promise<void> {
  await settingsButton(page).click();
  await settingsPopup(page).getByRole('tab', { name: 'Notifications', exact: true }).click();
  await expect(soundSwitch(page)).toBeVisible();
}

async function closeSettings(page: Page): Promise<void> {
  await settingsPopup(page).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
}

/** The tooltip of the app's tray item, read from the fake tray host. */
async function trayTooltip(): Promise<string | undefined> {
  const item = fake.trayItems.at(-1);
  if (!item) return undefined;
  try {
    const reply = await service.call(
      new Message({ destination: item.service, path: item.path, interface: PROPERTIES, member: 'Get', signature: 'ss', body: ['org.kde.StatusNotifierItem', 'ToolTip'] }),
    );
    return ((reply?.body[0] as Variant).value as [string, unknown, string, string])[2];
  } catch {
    return undefined;
  }
}

/** Waits until the sound count reaches `count` within 5 s of `changedAt`, then checks that the page played the chime. */
async function expectSound(desktop: Desktop, count: number, changedAt: number): Promise<number> {
  await expect.poll(async () => (await soundSends(desktop.app)).length, { timeout: FIVE_SECONDS }).toBe(count);
  const sentAt = (await soundSends(desktop.app))[count - 1]!;
  expect(sentAt - changedAt).toBeLessThan(FIVE_SECONDS);
  await expect.poll(async () => (await plays(desktop.window)).length).toBe(count);
  await expect.poll(async () => (await plays(desktop.window))[count - 1]?.outcome).toBe('playing');
  const played = (await plays(desktop.window))[count - 1]!;
  expect(played.src).toMatch(/needs-input-chime.*\.wav$/);
  expect(played.at - changedAt).toBeLessThan(FIVE_SECONDS);
  return sentAt;
}

async function waitUntil(time: number, window: Page): Promise<void> {
  const left = time - Date.now();
  if (left > 0) await window.waitForTimeout(left);
}

test.describe('Needs-input sound in the desktop app', () => {
  test.describe.configure({ timeout: 120_000 });

  // Scenario "A sound plays when Claude asks for a permission"
  test('REQ-1, REQ-2, REQ-3, REQ-9, REQ-5: with the focus, a permission request plays the sound within 5 s, the window reacts to clicks, and the sound does not repeat while the session waits', async () => {
    const desktop = await readyDesktop();
    const { app, window, port, home } = desktop;
    const folder = path.join(home, 'focused-project');
    const id = await startSession(port, folder);
    await expect(entry(window, folder)).toBeVisible();
    await focusWindow(app);
    await expect.poll(async () => (await windowState(app))?.focused).toBe(true);

    const changedAt = Date.now();
    await askPermission(port, id, 'Fix the login form', 'Bash');
    await expectSound(desktop, 1, changedAt);

    // REQ-9: the page answers a click while the sound plays.
    await entry(window, folder).getByTitle(folder, { exact: true }).click();
    await expect(header(window).getByRole('heading', { level: 2 })).toHaveText('focused-project', { timeout: 2000 });
    await expect.poll(async () => (await plays(window))[0]?.duration).toBeLessThanOrEqual(2);

    // REQ-5: still waiting, past the 5-second window.
    await window.waitForTimeout(AFTER_WINDOW + 1000);
    expect(await sessionState(port, id)).toBe('needs_input');
    expect(await soundSends(app)).toHaveLength(1);
    expect(await plays(window)).toHaveLength(1);
  });

  // Scenarios "The sound plays with the window closed to the tray", "Two sessions that start to wait together play one sound",
  // "A new question plays the sound again"
  test('REQ-1, REQ-2, REQ-4, REQ-5, REQ-6: closed to the tray, an external session plays the sound and its notification shows; a second session within 5 s plays nothing; a new question after 5 s plays again, also minimized', async () => {
    const desktop = await readyDesktop();
    const { app, window, port, home } = desktop;
    const externalFolder = path.join(home, 'terminal-project');
    const external = await runExternal(home, 'e2e-sound-external', externalFolder, 'idle');
    await expect(entry(window, externalFolder)).toContainText('Idle', { timeout: 10_000 });
    const hostedFolder = path.join(home, 'hosted-project');
    const hosted = await startSession(port, hostedFolder);
    await hook(port, hosted, { hook_event_name: 'UserPromptSubmit', prompt: 'Run the migrations' });
    await expect(entry(window, hostedFolder)).toBeVisible();

    await closeWindow(app);
    await expect.poll(async () => (await windowState(app))?.visible).toBe(false);

    // REQ-1 (external), REQ-2 (closed to the tray)
    let changedAt = Date.now();
    await external.update({ status: 'waiting', updatedAt: changedAt });
    const first = await expectSound(desktop, 1, changedAt);
    await expect.poll(() => fake.notifyCalls.length, { timeout: FIVE_SECONDS }).toBeGreaterThan(0);

    // REQ-4: a second session within 5 s of the first sound
    await hook(port, hosted, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    await expect.poll(() => sessionState(port, hosted)).toBe('needs_input');
    expect(Date.now() - first).toBeLessThan(FIVE_SECONDS);
    // REQ-5: both keep waiting past the window
    await waitUntil(first + AFTER_WINDOW + 1000, window);
    expect(await soundSends(app)).toHaveLength(1);

    // REQ-6: the hosted session gets its answer and asks again, more than 5 s after the sound
    await hook(port, hosted, { hook_event_name: 'PostToolUse' });
    await expect.poll(() => sessionState(port, hosted)).not.toBe('needs_input');
    changedAt = Date.now();
    await hook(port, hosted, { hook_event_name: 'PermissionRequest', tool_name: 'Edit' });
    const second = await expectSound(desktop, 2, changedAt);

    // REQ-2: minimized
    await focusWindow(app);
    await minimizeWindow(app);
    await expect.poll(async () => (await windowState(app))?.minimized).toBe(true);
    await hook(port, hosted, { hook_event_name: 'PostToolUse' });
    await expect.poll(() => sessionState(port, hosted)).not.toBe('needs_input');
    await waitUntil(second + AFTER_WINDOW, window);
    changedAt = Date.now();
    await hook(port, hosted, { hook_event_name: 'PermissionRequest', tool_name: 'Write' });
    await expectSound(desktop, 3, changedAt);
  });

  // Scenarios "No sound for a session that already waited", "No sound at the end of a turn"
  test('REQ-7, REQ-8: a session that waited before the start plays nothing; a turn end in the background shows its notification and plays nothing', async () => {
    let waitingFolder = '';
    const desktop = await readyDesktop(async (home) => {
      waitingFolder = path.join(home, 'waiting-project');
      await runExternal(home, 'e2e-sound-waiting', waitingFolder, 'waiting');
    });
    const { app, window, port, home } = desktop;

    // REQ-7
    await expect(entry(window, waitingFolder)).toContainText('Needs Input', { timeout: 10_000 });
    await window.waitForTimeout(AFTER_WINDOW);
    expect(await soundSends(app)).toEqual([]);
    expect(await plays(window)).toEqual([]);

    // REQ-8: turn end, with the window in the background
    const folder = path.join(home, 'turn-project');
    const id = await startSession(port, folder);
    await expect(entry(window, folder)).toBeVisible();
    await minimizeWindow(app);
    await expect.poll(async () => (await windowState(app))?.focused).toBe(false);
    await hook(port, id, { hook_event_name: 'UserPromptSubmit', prompt: 'Explain the code' });
    await expect.poll(() => sessionState(port, id)).toBe('working');
    await hook(port, id, { hook_event_name: 'Stop' });
    await expect.poll(() => fake.notifyCalls.some((call) => call.summary.startsWith('turn-project')), { timeout: FIVE_SECONDS }).toBe(true);
    await window.waitForTimeout(1500);
    expect(await soundSends(app)).toEqual([]);
    expect(await plays(window)).toEqual([]);
  });

  // Scenarios "The user turns the sound off" and "No sound with the switch off"
  test('REQ-10, REQ-11, REQ-13, REQ-14: the switch is on at first start and turns off at once; then a permission request in the background plays nothing, while its notification and the tray show as before', async () => {
    const desktop = await readyDesktop();
    const { app, window, port, home } = desktop;
    await expect.poll(trayTooltip, { timeout: TRAY_UPDATE }).toBe('Vexel for Claude');

    await openSoundMenu(window);
    await expect(soundSwitch(window), 'REQ-10: on at first start').toHaveAttribute('aria-checked', 'true');
    await soundSwitch(window).click();
    await expect(soundSwitch(window)).toHaveAttribute('aria-checked', 'false');
    await closeSettings(window);

    const folder = path.join(home, 'quiet-project');
    const id = await startSession(port, folder);
    await expect(entry(window, folder)).toBeVisible();
    await minimizeWindow(app);
    await expect.poll(async () => (await windowState(app))?.focused).toBe(false);

    await askPermission(port, id, 'Fix the login form', 'Bash');
    await expect.poll(() => sessionState(port, id)).toBe('needs_input');
    await expect.poll(async () => (await soundSends(app)).length, { timeout: FIVE_SECONDS, message: 'REQ-14: the desktop app still asks for the sound' }).toBe(1);
    await expect
      .poll(() => fake.notifyCalls.some((call) => call.summary.startsWith('quiet-project')), { timeout: FIVE_SECONDS, message: 'REQ-14: notification' })
      .toBe(true);
    await expect.poll(trayTooltip, { timeout: TRAY_UPDATE, message: 'REQ-14: tray' }).toBe('Vexel for Claude · 1 session needs input');
    await window.waitForTimeout(1500);
    expect(await plays(window), 'REQ-13: no play').toEqual([]);
  });

  // Scenario "The switch stays off after a restart"
  test('REQ-12, REQ-13: the switch turned off stays off after the app quits and starts again, and a permission request then plays nothing', async () => {
    const first = await readyDesktop();
    await openSoundMenu(first.window);
    await soundSwitch(first.window).click();
    await expect(soundSwitch(first.window)).toHaveAttribute('aria-checked', 'false');
    await closeSettings(first.window);
    await quitDesktop(first.app);

    const desktop = await readyDesktop(undefined, { home: first.home, port: first.port });
    const { app, window, port, home } = desktop;
    await openSoundMenu(window);
    await expect(soundSwitch(window)).toHaveAttribute('aria-checked', 'false');
    await closeSettings(window);

    const folder = path.join(home, 'restart-project');
    const id = await startSession(port, folder);
    await expect(entry(window, folder)).toBeVisible();
    await askPermission(port, id, 'Run the migrations', 'Bash');
    await expect.poll(async () => (await soundSends(app)).length, { timeout: FIVE_SECONDS }).toBe(1);
    await window.waitForTimeout(1500);
    expect(await plays(window)).toEqual([]);
  });
});
