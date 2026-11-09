// e2e of plan-keyboard_shortcuts, batch shortcuts-panel, in the desktop app (Electron group only): a few Alt keys work as in the browser.
import { type ChildProcess, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ElectronApplication, type Page, _electron, expect, test } from '@playwright/test';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const electronBinary = createRequire(import.meta.url)('electron') as string;
const fakeClaude = fileURLToPath(new URL('../test-support/fake-claude.mjs', import.meta.url));

const apps: ElectronApplication[] = [];
const ports: number[] = [];
const dirs: string[] = [];

function listenerPids(listening: number): number[] {
  const out = execFileSync('ss', ['-Hltnp', `sport = :${listening}`], { encoding: 'utf8' });
  return [...out.matchAll(/pid=(\d+)/g)].map((match) => Number(match[1]));
}

// Not `app.close()`: the detached backend inherits Electron's descriptors, so close() would wait for it.
async function quitDesktop(app: ElectronApplication): Promise<void> {
  let electron: ChildProcess;
  try {
    electron = app.process();
  } catch {
    return;
  }
  if (electron.exitCode !== null || electron.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => electron.once('exit', () => resolve()));
  // "Quit" may ask first while a session runs: answer 1 is "Quit".
  await app
    .evaluate(({ dialog }) => {
      dialog.showMessageBox = (() => Promise.resolve({ response: 1, checkboxChecked: false })) as never;
    })
    .catch(() => undefined);
  await app.evaluate(({ app: electronApp }) => electronApp.quit()).catch(() => undefined);
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 10_000))]);
  if (electron.exitCode === null && electron.signalCode === null) electron.kill('SIGKILL');
}

test.afterEach(async () => {
  for (const app of apps.splice(0)) await quitDesktop(app);
  for (const port of ports.splice(0)) for (const pid of listenerPids(port)) if (pid !== process.pid) process.kill(pid, 'SIGKILL');
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

async function healthStatus(port: number): Promise<number | undefined> {
  try {
    return (await fetch(`http://127.0.0.1:${port}/api/health`)).status;
  } catch {
    return undefined;
  }
}

/** Environment of an isolated desktop session: its own HOME, so its own Electron profile and single-instance lock. */
async function desktopEnv(port: number): Promise<Record<string, string>> {
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
  };
}

async function launchDesktop(env: Record<string, string>): Promise<ElectronApplication> {
  const app = await _electron.launch({ executablePath: electronBinary, args: ['.'], cwd: repoRoot, env });
  apps.push(app);
  return app;
}

const ONE_SECOND = { timeout: 1000 };
const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const terminal = (page: Page) => page.locator('.xterm-rows');
const terminalInput = (page: Page) => page.locator('.xterm-helper-textarea');
const shortcutsPanel = (page: Page) => page.getByRole('dialog', { name: 'Keyboard Shortcuts' });
const menuBarVisible = (app: ElectronApplication) => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isMenuBarVisible());
const windowState = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]!;
    return { count: BrowserWindow.getAllWindows().length, visible: window.isVisible(), minimized: window.isMinimized(), maximized: window.isMaximized() };
  });

async function startSession(port: number, folder: string): Promise<void> {
  await mkdir(folder, { recursive: true });
  const response = await fetch(`http://127.0.0.1:${port}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: folder }),
  });
  expect(response.status).toBe(201);
}

test.describe('Keyboard shortcuts in the desktop app', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(() => {
    execFileSync('npx', ['tsc', '-b', 'tsconfig.desktop.build.json'], { cwd: repoRoot, stdio: 'ignore' });
    expect(existsSync(path.join(repoRoot, 'dist/web/index.html'))).toBe(true);
  });

  // plan-keyboard_shortcuts/REQ-38, REQ-39, REQ-40, REQ-46 — scenario "The shortcuts work the same in the desktop app": Alt+Down, Alt+S and Alt+L act in the window as in the browser
  test('Alt+Down in the terminal opens the next session, Alt+S toggles the panel and Alt+L focuses the list, with no menu bar and no window action', async () => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const app = await launchDesktop(env);
    const page = await app.firstWindow();
    await expect(list(page)).toBeVisible({ timeout: 20_000 });

    const first = path.join(env.HOME!, 'projects', 'alpha');
    const second = path.join(env.HOME!, 'projects', 'beta');
    await startSession(port, first);
    await startSession(port, second);
    await expect(entry(page, first)).toBeVisible({ timeout: 10_000 });
    await expect(entry(page, second)).toBeVisible({ timeout: 10_000 });
    const order = await list(page).getByRole('button').filter({ has: page.locator('[title]') }).evaluateAll((buttons, folders) =>
      buttons.map((b) => folders.find((f) => b.querySelector(`[title="${f}"]`) !== null)).filter((f) => f !== undefined), [first, second]);
    const [top, next] = order as [string, string];

    await entry(page, top).click();
    await expect(terminal(page)).toContainText(`CWD:${top}`, { timeout: 10_000 });
    await expect(terminal(page)).toContainText('READY');
    await page.locator('.xterm-screen').click();
    await expect(terminalInput(page)).toBeFocused();
    const before = await windowState(app);

    await page.keyboard.press('Alt+ArrowDown');
    await expect(terminal(page)).toContainText(`CWD:${next}`, ONE_SECOND);
    await expect(terminal(page)).toContainText('READY');
    expect(await menuBarVisible(app), 'Alt shows no menu bar').toBe(false);

    await page.locator('.xterm-screen').click();
    await page.keyboard.press('Alt+KeyS');
    await expect(shortcutsPanel(page)).toBeVisible(ONE_SECOND);
    await page.keyboard.press('Alt+KeyS');
    await expect(shortcutsPanel(page)).toHaveCount(0, ONE_SECOND);
    await expect(terminalInput(page)).toBeFocused();

    await page.keyboard.press('Alt+KeyL');
    await expect(entry(page, next)).toBeFocused(ONE_SECOND);

    expect(await menuBarVisible(app), 'Alt shows no menu bar').toBe(false);
    expect(await windowState(app), 'no window action started').toEqual(before);
    await expect(terminal(page), 'a client key reached the CLI').not.toContainText('IN:');
  });
});
