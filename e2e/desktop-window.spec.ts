// e2e of plan-desktop_app, batches desktop-window and window-tray, and of plan-light_theme, batch remembered-theme. Each Electron launch gets its own HOME, free port and Claude folder: it never touches the user's app, backend or files.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ElectronApplication, type Page, _electron, expect, test } from '@playwright/test';
import type { MessageBoxOptions } from 'electron';
import { startupPageUrl } from '../src/desktop/startup-page.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const electronBinary = createRequire(import.meta.url)('electron') as string;
const fakeClaude = fileURLToPath(new URL('../test-support/fake-claude.mjs', import.meta.url));
const LIGHT_CANVAS = 'rgb(244, 241, 234)';
// Canvas, text, accent and error of the dark theme: the startup page never shows them (plan-light_theme/REQ-20).
const DARK_ONLY = ['rgb(11, 11, 14)', 'rgb(243, 242, 238)', 'rgb(140, 207, 255)', 'rgb(251, 113, 133)'];
const LOADING = 'Starting the backend…';
const ERROR = 'The backend could not start.';

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });

// Cleanup registry, emptied after each test.
const apps: ElectronApplication[] = [];
const children: ChildProcess[] = [];
const ports: number[] = [];
const dirs: string[] = [];
const holders: http.Server[] = [];

// Not `app.close()`: the detached backend inherits Electron's descriptors, Playwright's connection included, so close() would wait for the backend.
async function quitDesktop(app: ElectronApplication): Promise<void> {
  // process() throws once Playwright has disposed of an app that already quit.
  let electron: ChildProcess;
  try {
    electron = app.process();
  } catch {
    return;
  }
  if (electron.exitCode !== null || electron.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => electron.once('exit', () => resolve()));
  await stubQuitDialog(app, 1).catch(() => undefined);
  await app.evaluate(({ app: electronApp }) => electronApp.quit()).catch(() => undefined);
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 10_000))]);
  if (electron.exitCode === null && electron.signalCode === null) electron.kill('SIGKILL');
}

test.afterEach(async () => {
  for (const app of apps.splice(0)) await quitDesktop(app);
  for (const child of children.splice(0)) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  for (const port of ports.splice(0)) await stopListeners(port);
  for (const server of holders.splice(0)) await new Promise((resolve) => server.close(resolve));
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
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
    await expect.poll(() => listenerPids(port).includes(pid), { timeout: 5000 }).toBe(false).catch(() => process.kill(pid, 'SIGKILL'));
  }
}

async function healthStatus(port: number): Promise<number | undefined> {
  try {
    return (await fetch(`http://127.0.0.1:${port}/api/health`)).status;
  } catch {
    return undefined;
  }
}

/** Environment of an isolated desktop session: its own HOME, so its own Electron profile and single-instance lock. */
async function desktopEnv(port: number, extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const home = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-desktop-'));
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
    ...extra,
  };
}

async function launchDesktop(env: Record<string, string>): Promise<ElectronApplication> {
  const app = await _electron.launch({ executablePath: electronBinary, args: ['.'], cwd: repoRoot, env });
  apps.push(app);
  return app;
}

const windowState = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((window) => ({
      size: window.getSize(),
      menuBarVisible: window.isMenuBarVisible(),
      minimized: window.isMinimized(),
      visible: window.isVisible(),
      focused: window.isFocused(),
    })),
  );

interface QuitDialogGlobals {
  quitDialogs: MessageBoxOptions[];
  answerQuitDialog?: (response: number) => void;
}

/** Replaces the native message box: it records each call and answers `response`, or waits for `answerQuitDialog` when `response` is null. */
async function stubQuitDialog(app: ElectronApplication, response: number | null): Promise<void> {
  await app.evaluate(({ dialog }, answer) => {
    const globals = globalThis as unknown as QuitDialogGlobals;
    globals.quitDialogs = [];
    dialog.showMessageBox = ((...args: unknown[]) => {
      globals.quitDialogs.push(args.at(-1) as MessageBoxOptions);
      if (answer !== null) return Promise.resolve({ response: answer, checkboxChecked: false });
      return new Promise((resolve) => {
        globals.answerQuitDialog = (chosen) => resolve({ response: chosen, checkboxChecked: false });
      });
    }) as never;
  }, response);
}

const quitDialogs = (app: ElectronApplication) =>
  app.evaluate(() =>
    (globalThis as unknown as QuitDialogGlobals).quitDialogs.map(({ type, title, message, detail, buttons, defaultId, cancelId }) => ({
      type,
      title,
      message,
      detail,
      buttons,
      defaultId,
      cancelId,
    })),
  );

const exitOf = (app: ElectronApplication) => new Promise<void>((resolve) => app.process().once('exit', () => resolve()));

// The tray icon is a StatusNotifierItem on the session bus; its menu is a dbusmenu that busctl reads and clicks like the shell does.
const WATCHER = ['org.kde.StatusNotifierWatcher', '/StatusNotifierWatcher', 'org.kde.StatusNotifierWatcher'];

function busctl(...args: string[]): unknown {
  return (JSON.parse(execFileSync('busctl', ['--user', '--json=short', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) as { data: unknown }).data;
}

function hasTrayHost(): boolean {
  try {
    busctl('get-property', ...WATCHER, 'RegisteredStatusNotifierItems');
    return true;
  } catch {
    return false;
  }
}

interface TrayItem {
  service: string;
  path: string;
}

/** The tray item registered by the process `pid`, if any. */
function trayItemOf(pid: number): TrayItem | undefined {
  for (const entry of busctl('get-property', ...WATCHER, 'RegisteredStatusNotifierItems') as string[]) {
    const at = entry.indexOf('@/');
    const item = at < 0 ? { service: entry, path: '/StatusNotifierItem' } : { service: entry.slice(0, at), path: entry.slice(at + 1) };
    try {
      const [owner] = busctl('call', 'org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', 'GetConnectionUnixProcessID', 's', item.service) as number[];
      if (owner === pid) return item;
    } catch {
      // A stale entry whose connection is gone.
    }
  }
  return undefined;
}

async function trayOf(app: ElectronApplication): Promise<TrayItem> {
  await expect.poll(() => trayItemOf(app.process().pid!), { timeout: 10_000 }).toBeDefined();
  return trayItemOf(app.process().pid!)!;
}

const trayProperty = (tray: TrayItem, name: string) => busctl('get-property', tray.service, tray.path, 'org.kde.StatusNotifierItem', name);

type MenuNode = [number, Record<string, { data: unknown }>, { data: MenuNode }[]];

function trayMenu(tray: TrayItem): { label: string; id: number }[] {
  const menu = trayProperty(tray, 'Menu') as string;
  const [, root] = busctl('call', '--', tray.service, menu, 'com.canonical.dbusmenu', 'GetLayout', 'iias', '0', '-1', '0') as [number, MenuNode];
  return root[2].map(({ data: [id, props] }) => ({ id, label: props.label?.data as string }));
}

function clickTray(tray: TrayItem, label: string): void {
  const item = trayMenu(tray).find((entry) => entry.label === label);
  if (!item) throw new Error(`no tray item ${label}`);
  const menu = trayProperty(tray, 'Menu') as string;
  execFileSync('busctl', ['--user', 'call', '--', tray.service, menu, 'com.canonical.dbusmenu', 'Event', 'isvu', String(item.id), 'clicked', 's', '', '0']);
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

async function sessionState(port: number, id: string): Promise<string | undefined> {
  const sessions = (await (await fetch(`http://127.0.0.1:${port}/api/sessions`)).json()) as { id: string; state: string }[];
  return sessions.find((session) => session.id === id)?.state;
}

async function makeWorking(port: number, id: string): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${port}/api/sessions/${id}/hook-events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: 'work' }),
  });
  expect(response.ok).toBe(true);
  await expect.poll(() => sessionState(port, id)).toBe('working');
}

/** PIDs of the fake CLI processes of the backend listening on `port`. */
function cliPids(port: number): number[] {
  return listenerPids(port).flatMap((pid) => {
    try {
      return execFileSync('pgrep', ['-P', String(pid), '-f', 'fake-claude'], { encoding: 'utf8' }).trim().split('\n').map(Number);
    } catch {
      return [];
    }
  });
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const sessionEntry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });

function buildDesktop(): void {
  execFileSync('npx', ['tsc', '-b', 'tsconfig.desktop.build.json'], { cwd: repoRoot, stdio: 'ignore' });
  expect(existsSync(path.join(repoRoot, 'dist/web/index.html'))).toBe(true);
}

test.describe('StartupPage in the browser', () => {
  // plan-light_theme/REQ-20: always the light colours
  test('loading state: waiting text, rotating accent indicator, light colours', async ({ page }) => {
    await page.goto(startupPageUrl({ kind: 'loading' }));
    await expect(page).toHaveTitle('Vexel for Claude');
    await expect(page.getByText(LOADING, { exact: true })).toBeVisible();
    await expect(page.getByText(ERROR)).toHaveCount(0);
    const style = await page.evaluate(() => {
      const canvas = [document.documentElement, document.body].map((element) => getComputedStyle(element).backgroundColor);
      const colours = [...document.querySelectorAll('*')].flatMap((element) => {
        const s = getComputedStyle(element);
        return [s.color, s.backgroundColor, s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor];
      });
      const scheme = getComputedStyle(document.documentElement).colorScheme;
      return { canvas, text: getComputedStyle(document.body).color, colours, scheme, animations: document.getAnimations().length };
    });
    expect(style.canvas).toContain(LIGHT_CANVAS);
    expect(style.text).toBe('rgb(28, 25, 23)');
    expect(style.colours).toContain('rgb(0, 101, 174)');
    expect(style.scheme).toBe('light');
    expect(style.colours.filter((colour) => DARK_ONLY.includes(colour)), 'no colour of the dark theme').toEqual([]);
    expect(style.animations).toBeGreaterThan(0);
  });

  test('error state: error colour, output lines as plain monospace rows in order', async ({ page }) => {
    const lines = ['first line', '<b>not bold</b>', 'Backend exited with code 1.'];
    await page.goto(startupPageUrl({ kind: 'error', outputLines: lines }));
    await expect(page.getByText(LOADING)).toHaveCount(0);
    const title = page.getByText(ERROR, { exact: true });
    await expect(title).toBeVisible();
    await expect(title).toHaveCSS('color', 'rgb(159, 18, 57)');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(LIGHT_CANVAS);
    const block = page.getByText(lines[0]!);
    await expect(block).toBeVisible();
    expect(await block.evaluate((element) => getComputedStyle(element).fontFamily)).toMatch(/mono/i);
    expect((await block.innerText()).split('\n').filter(Boolean)).toEqual(lines);
    await expect(page.locator('b')).toHaveCount(0);
  });

  test('loads nothing: no request, and its policy blocks scripts and remote images', async ({ page }) => {
    const loaded: string[] = [];
    page.on('requestfinished', (request) => loaded.push(request.url()));
    await page.goto(startupPageUrl({ kind: 'error', outputLines: ['x'] }));
    const probe = await page.evaluate(async () => {
      const violations: string[] = [];
      document.addEventListener('securitypolicyviolation', (event) => violations.push(event.effectiveDirective));
      const script = document.createElement('script');
      script.textContent = 'window.__startupScriptRan = true';
      document.body.append(script);
      const image = document.createElement('img');
      image.src = 'http://127.0.0.1:9/startup-page-probe.png';
      document.body.append(image);
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { ran: (window as unknown as { __startupScriptRan?: boolean }).__startupScriptRan === true, violations };
    });
    expect(probe.ran).toBe(false);
    expect(probe.violations).toEqual(expect.arrayContaining(['script-src-elem', 'img-src']));
    expect(loaded.filter((url) => !url.startsWith('data:'))).toEqual([]);
  });
});

test.describe('Desktop window', () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeAll(buildDesktop);

  test('REQ-1, REQ-3, REQ-4, REQ-9: starts the backend and shows the client page within 5 seconds', async () => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const start = Date.now();
    const app = await launchDesktop(env);
    const window = await app.firstWindow();
    await expect(list(window)).toBeVisible({ timeout: 20_000 });
    expect(Date.now() - start).toBeLessThan(5000);
    expect(window.url()).toBe(`http://127.0.0.1:${port}/`);
    expect(await healthStatus(port)).toBe(200);
    const [state, ...others] = await windowState(app);
    expect(others).toEqual([]);
    expect(state).toMatchObject({ menuBarVisible: false, minimized: false, visible: true });
    // 1280 × 800 is the outer size: on X11 Electron reports it without the window manager's title bar.
    expect(state!.size[0]).toBe(1280);
    expect(state!.size[1]).toBeGreaterThan(740);
    expect(state!.size[1]).toBeLessThanOrEqual(800);
    expect(await window.evaluate(() => [typeof (globalThis as { require?: unknown }).require, typeof (globalThis as { process?: unknown }).process])).toEqual([
      'undefined',
      'undefined',
    ]);
  });

  test('REQ-7: the window shows "Starting the backend…" while the backend starts', async () => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const slowNode = path.join(env.HOME!, 'slow-node');
    await writeFile(slowNode, `#!/bin/sh\nsleep 3\nexec '${process.execPath}' "$@"\n`);
    await chmod(slowNode, 0o755);
    const app = await launchDesktop({ ...env, AI_CLIENT_NODE: slowNode });
    const window = await app.firstWindow();
    await expect(window.getByText(LOADING, { exact: true })).toBeVisible();
    expect(await window.title()).toBe('Vexel for Claude');
    await expect(list(window)).toBeVisible({ timeout: 20_000 });
  });

  test('REQ-7: the window says that the backend could not start when another program holds the port', async () => {
    const holder = http.createServer((_request, response) => response.writeHead(404).end());
    holders.push(holder);
    await new Promise<void>((resolve) => holder.listen(0, '127.0.0.1', resolve));
    const port = (holder.address() as net.AddressInfo).port;
    const app = await launchDesktop(await desktopEnv(port));
    const window = await app.firstWindow();
    await expect(window.getByText(ERROR, { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(window.getByText(/Backend exited with (code \d+|signal \w+)\./)).toBeVisible();
    await expect(window.getByText(/EADDRINUSE/).first()).toBeVisible();
  });

  test('REQ-5: uses the backend that already runs, with its sessions, and starts no second one', async () => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const backend = spawn(process.execPath, ['--import', 'tsx', 'src/server/main.ts'], { cwd: repoRoot, env: { ...env, NODE_ENV: 'production' }, stdio: 'ignore' });
    children.push(backend);
    await expect.poll(() => healthStatus(port), { timeout: 20_000 }).toBe(200);
    const folder = path.join(env.HOME!, 'project-reused');
    await mkdir(folder);
    const started = await fetch(`http://127.0.0.1:${port}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: folder }),
    });
    expect(started.status).toBe(201);

    const app = await launchDesktop(env);
    const window = await app.firstWindow();
    await expect(list(window).getByTitle(folder, { exact: true })).toBeVisible({ timeout: 20_000 });
    expect(window.url()).toBe(`http://127.0.0.1:${port}/`);
    expect(listenerPids(port)).toEqual([backend.pid]);
    const logs = await app.evaluate(({ app: electronApp }) => electronApp.getPath('logs'));
    expect(existsSync(path.join(logs, 'backend.log'))).toBe(false);
  });

  test('REQ-6: a second launch shows the existing window and opens no second app', async () => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const app = await launchDesktop(env);
    const window = await app.firstWindow();
    await expect(list(window)).toBeVisible({ timeout: 20_000 });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.minimize());
    await expect.poll(async () => (await windowState(app))[0]?.minimized).toBe(true);

    const second = spawn(electronBinary, ['.'], { cwd: repoRoot, env, stdio: 'ignore' });
    children.push(second);
    const exitCode = await new Promise<number | null>((resolve) => second.once('exit', (code) => resolve(code)));
    expect(exitCode).not.toBeNull();

    await expect.poll(async () => (await windowState(app)).map((state) => [state.minimized, state.visible])).toEqual([[false, true]]);
    await expect.poll(async () => (await windowState(app))[0]?.focused).toBe(true);
    expect(app.windows()).toHaveLength(1);
  });
});

test.describe('Window and tray', () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeAll(buildDesktop);
  test.beforeEach(() => test.skip(!hasTrayHost(), 'no StatusNotifierWatcher on the session bus'));

  async function readyDesktop(env: Record<string, string>): Promise<{ app: ElectronApplication; window: Page; tray: TrayItem }> {
    const app = await launchDesktop(env);
    const window = await app.firstWindow();
    await expect(list(window)).toBeVisible({ timeout: 20_000 });
    return { app, window, tray: await trayOf(app) };
  }

  const closeWindow = (app: ElectronApplication) => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());

  test('REQ-12, REQ-13, REQ-14: the tray icon shows "Vexel for Claude" and the menu "Open Window", "Quit"', async () => {
    const { tray } = await readyDesktop(await desktopEnv(await freePort()));
    const [, , title] = trayProperty(tray, 'ToolTip') as [string, unknown, string, string];
    expect(title).toBe('Vexel for Claude');
    expect(trayMenu(tray).map((item) => item.label)).toEqual(['Open Window', 'Quit']);
    // Electron hands the icon over as a PNG file: <IconThemePath>/<IconName>.png.
    const icon = path.join(trayProperty(tray, 'IconThemePath') as string, `${trayProperty(tray, 'IconName') as string}.png`);
    const header = await readFile(icon);
    expect(header.subarray(1, 4).toString('latin1')).toBe('PNG');
    expect([header.readUInt32BE(16), header.readUInt32BE(20)]).toEqual([256, 256]);
  });

  test('REQ-11, REQ-12: closing the window hides it; the app, the tray icon, the backend and a working session keep running', async ({ page }) => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const { app } = await readyDesktop(env);
    const folder = path.join(env.HOME!, 'project-close');
    const id = await startSession(port, folder);
    await makeWorking(port, id);
    const [cli] = cliPids(port);

    await closeWindow(app);

    await expect.poll(async () => (await windowState(app)).map((state) => state.visible)).toEqual([false]);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(app.process().exitCode).toBeNull();
    expect(app.process().signalCode).toBeNull();
    expect(trayItemOf(app.process().pid!)).toBeDefined();
    expect(await healthStatus(port)).toBe(200);
    expect(await sessionState(port, id)).toBe('working');
    expect(cli !== undefined && isAlive(cli)).toBe(true);
    await page.goto(`http://127.0.0.1:${port}/`);
    await expect(sessionEntry(page, folder)).toContainText('Running');
  });

  test('REQ-13: "Open Window" shows the hidden window again, with the page still loaded and the current sessions', async () => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const { app, window, tray } = await readyDesktop(env);
    await window.evaluate(() => ((globalThis as { pageMarker?: number }).pageMarker = 42));
    await closeWindow(app);
    await expect.poll(async () => (await windowState(app)).map((state) => state.visible)).toEqual([false]);
    const folder = path.join(env.HOME!, 'project-while-hidden');
    await startSession(port, folder);

    clickTray(tray, 'Open Window');

    await expect.poll(async () => (await windowState(app)).map((state) => [state.visible, state.minimized])).toEqual([[true, false]]);
    await expect.poll(async () => (await windowState(app))[0]?.focused).toBe(true);
    expect(await window.evaluate(() => (globalThis as { pageMarker?: number }).pageMarker)).toBe(42);
    await expect(list(window).getByTitle(folder, { exact: true })).toBeVisible();
    expect(app.windows()).toHaveLength(1);
  });

  test('REQ-6: a second launch shows the window again when it is closed, and opens no second app', async () => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const { app } = await readyDesktop(env);
    await closeWindow(app);
    await expect.poll(async () => (await windowState(app)).map((state) => state.visible)).toEqual([false]);

    const second = spawn(electronBinary, ['.'], { cwd: repoRoot, env, stdio: 'ignore' });
    children.push(second);
    const exitCode = await new Promise<number | null>((resolve) => second.once('exit', (code) => resolve(code)));
    expect(exitCode).not.toBeNull();

    await expect.poll(async () => (await windowState(app)).map((state) => [state.visible, state.minimized])).toEqual([[true, false]]);
    await expect.poll(async () => (await windowState(app))[0]?.focused).toBe(true);
    expect(app.windows()).toHaveLength(1);
  });

  test('REQ-14, REQ-15: "Quit" with no busy session quits without asking and stops the started backend and its sessions', async () => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const { app, tray } = await readyDesktop(env);
    const id = await startSession(port, path.join(env.HOME!, 'project-idle'));
    expect(await sessionState(port, id)).toBe('idle');
    await expect.poll(() => cliPids(port).length).toBe(1);
    const [cli] = cliPids(port);
    const pid = app.process().pid!;
    // "Cancel" if asked: a dialog would then keep the app running and fail the test.
    await stubQuitDialog(app, 0);
    const exited = exitOf(app);

    clickTray(tray, 'Quit');

    await exited;
    expect(await healthStatus(port)).toBeUndefined();
    expect(listenerPids(port)).toEqual([]);
    expect(isAlive(cli!)).toBe(false);
    expect(trayItemOf(pid)).toBeUndefined();
  });

  test('REQ-17, REQ-15: "Quit" with a working session asks first; "Cancel" keeps everything, "Quit" stops the backend', async ({ page }) => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const { app, tray } = await readyDesktop(env);
    const folder = path.join(env.HOME!, 'project-busy');
    const id = await startSession(port, folder);
    await makeWorking(port, id);
    const [cli] = cliPids(port);
    const pid = app.process().pid!;
    await stubQuitDialog(app, null);

    clickTray(tray, 'Quit');

    await expect.poll(async () => (await quitDialogs(app)).length).toBe(1);
    expect((await quitDialogs(app))[0]).toEqual({
      type: 'warning',
      title: 'Quit Vexel for Claude?',
      message: 'Quit Vexel for Claude?',
      detail: '1 session is working or needs input. Quitting ends it.',
      buttons: ['Cancel', 'Quit'],
      defaultId: 0,
      cancelId: 0,
    });

    // DesktopApp: a quit request while one is already running is ignored, from the tray or from any other quit.
    clickTray(tray, 'Quit');
    await app.evaluate(({ app: electronApp }) => electronApp.quit());
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(await quitDialogs(app)).toHaveLength(1);

    await app.evaluate(() => (globalThis as unknown as QuitDialogGlobals).answerQuitDialog!(0));
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(app.process().exitCode).toBeNull();
    expect(app.process().signalCode).toBeNull();
    expect(await healthStatus(port)).toBe(200);
    expect(await sessionState(port, id)).toBe('working');
    await page.goto(`http://127.0.0.1:${port}/`);
    await expect(sessionEntry(page, folder)).toContainText('Running');

    await stubQuitDialog(app, 1);
    const exited = exitOf(app);
    clickTray(tray, 'Quit');
    await exited;

    expect(await quitDialogs(app).catch(() => undefined)).toBeUndefined();
    expect(await healthStatus(port)).toBeUndefined();
    expect(listenerPids(port)).toEqual([]);
    expect(isAlive(cli!)).toBe(false);
    expect(trayItemOf(pid)).toBeUndefined();
  });

  test('REQ-16, REQ-17: "Quit" leaves a backend the app did not start running with its working session, and asks nothing', async ({ page }) => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const backend = spawn(process.execPath, ['--import', 'tsx', 'src/server/main.ts'], { cwd: repoRoot, env: { ...env, NODE_ENV: 'production' }, stdio: 'ignore' });
    children.push(backend);
    await expect.poll(() => healthStatus(port), { timeout: 20_000 }).toBe(200);
    const folder = path.join(env.HOME!, 'project-elsewhere');
    const id = await startSession(port, folder);
    await makeWorking(port, id);
    const [cli] = cliPids(port);
    const { app, tray } = await readyDesktop(env);
    await stubQuitDialog(app, 0);
    const exited = exitOf(app);

    clickTray(tray, 'Quit');

    await exited;
    expect(listenerPids(port)).toEqual([backend.pid]);
    expect(await sessionState(port, id)).toBe('working');
    expect(isAlive(cli!)).toBe(true);
    await page.goto(`http://127.0.0.1:${port}/`);
    await expect(sessionEntry(page, folder)).toContainText('Running');
  });

  test('DesktopApp: "Quit" during the backend start asks nothing and stops the server being started', async () => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const slowNode = path.join(env.HOME!, 'slow-node');
    await writeFile(slowNode, `#!/bin/sh\nsleep 3\nexec '${process.execPath}' "$@"\n`);
    await chmod(slowNode, 0o755);
    const app = await launchDesktop({ ...env, AI_CLIENT_NODE: slowNode });
    const window = await app.firstWindow();
    await expect(window.getByText(LOADING, { exact: true })).toBeVisible();
    const tray = await trayOf(app);
    await stubQuitDialog(app, 0);
    const exited = exitOf(app);

    clickTray(tray, 'Quit');

    await exited;
    await new Promise((resolve) => setTimeout(resolve, 5000));
    expect(await healthStatus(port)).toBeUndefined();
    expect(listenerPids(port)).toEqual([]);
  });
});

// plan-light_theme, batch remembered-theme — scenario "The desktop app keeps its own choice, with a light startup page"
test.describe('Remembered theme in the desktop app', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(buildDesktop);

  test('REQ-17, REQ-19, REQ-20: dark chosen in the window survives a restart; the startup page stays light; the browser client stays light', async ({ page }) => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const first = await launchDesktop(env);
    const firstWindow = await first.firstWindow();
    await expect(list(firstWindow)).toBeVisible({ timeout: 20_000 });
    const themeSwitch = firstWindow.getByRole('banner').getByRole('button', { name: 'Dark theme', exact: true });
    await expect(themeSwitch, 'REQ-19: a new profile starts light').toHaveAttribute('aria-pressed', 'false');
    await expect(firstWindow.locator('html')).toHaveAttribute('data-theme', 'light');
    await themeSwitch.click();
    await expect(firstWindow.locator('html')).toHaveAttribute('data-theme', 'dark');
    await quitDesktop(first);
    await expect.poll(() => healthStatus(port), { timeout: 15_000 }).toBeUndefined();

    const slowNode = path.join(env.HOME!, 'slow-node');
    await writeFile(slowNode, `#!/bin/sh\nsleep 3\nexec '${process.execPath}' "$@"\n`);
    await chmod(slowNode, 0o755);
    const second = await launchDesktop({ ...env, AI_CLIENT_NODE: slowNode });
    const client = await second.firstWindow();
    await client.addInitScript(() => {
      const marks: (string | null)[] = [];
      (window as unknown as { themeMarks: (string | null)[] }).themeMarks = marks;
      new MutationObserver(() => marks.push(document.documentElement.getAttribute('data-theme'))).observe(document, {
        attributes: true,
        attributeFilter: ['data-theme'],
        subtree: true,
      });
    });
    await expect(client.getByText(LOADING, { exact: true })).toBeVisible();
    const startup = await client.evaluate(() => ({
      canvas: getComputedStyle(document.body).backgroundColor,
      scheme: getComputedStyle(document.documentElement).colorScheme,
    }));
    expect(startup, 'REQ-20: light startup page with dark chosen').toEqual({ canvas: LIGHT_CANVAS, scheme: 'light' });

    await expect(list(client)).toBeVisible({ timeout: 20_000 });
    await expect(client.getByRole('banner').getByRole('button', { name: 'Dark theme', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const marks = await client.evaluate(() => [...new Set((window as unknown as { themeMarks: (string | null)[] }).themeMarks)]);
    expect(marks, 'REQ-18: the client page only ever carries the dark mark').toEqual(['dark']);

    await page.goto(`http://127.0.0.1:${port}/`);
    await expect(page.getByRole('banner').getByRole('button', { name: 'Dark theme', exact: true })).toHaveAttribute('aria-pressed', 'false');
    expect(await page.locator('html').getAttribute('data-theme'), 'the browser keeps its own choice').toBe('light');
  });
});
