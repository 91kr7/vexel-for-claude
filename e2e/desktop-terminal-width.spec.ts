// e2e of plan-terminal_overflow and plan-terminal_clip, batch terminal-width, in the desktop app (Electron group only).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ElectronApplication, type Page, _electron, expect, test } from '@playwright/test';
import { currentView, pageSettled } from './motion';
import { expectRightWidth } from './terminal-width';
import { quitDesktop } from './desktop-quit';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const electronBinary = createRequire(import.meta.url)('electron') as string;
const fakeClaude = fileURLToPath(new URL('../test-support/fake-claude.mjs', import.meta.url));

const apps: ElectronApplication[] = [];
const ports: number[] = [];
const dirs: string[] = [];
const sessions: { port: number; id: string }[] = [];

function listenerPids(listening: number): number[] {
  const out = execFileSync('ss', ['-Hltnp', `sport = :${listening}`], { encoding: 'utf8' });
  return [...out.matchAll(/pid=(\d+)/g)].map((match) => Number(match[1]));
}

test.afterEach(async () => {
  for (const { port, id } of sessions.splice(0)) await fetch(`http://127.0.0.1:${port}/api/sessions/${id}/stop`, { method: 'POST' }).catch(() => undefined);
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

async function startSession(port: number, folder: string): Promise<string> {
  await mkdir(folder, { recursive: true });
  const response = await fetch(`http://127.0.0.1:${port}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: folder }),
  });
  expect(response.status).toBe(201);
  const { id } = (await response.json()) as { id: string };
  sessions.push({ port, id });
  return id;
}

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const isMaximized = (app: ElectronApplication) => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isMaximized());
const widthAndMaximized = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]!;
    return [window.getSize()[0], window.isMaximized()];
  });

async function openSession(page: Page, port: number, folder: string): Promise<string> {
  const id = await startSession(port, folder);
  await list(page).getByTitle(folder, { exact: true }).click();
  await expect(currentView(page).locator('.xterm-rows')).toContainText('READY');
  await pageSettled(page);
  return id;
}

test.describe('Terminal width in the desktop app', () => {
  test.beforeAll(() => {
    execFileSync('npx', ['tsc', '-b', 'tsconfig.desktop.build.json'], { cwd: repoRoot, stdio: 'ignore' });
    expect(existsSync(path.join(repoRoot, 'dist/web/index.html'))).toBe(true);
  });

  // Scenario "The user restores the window and reads every line to its end"
  test('REQ-1, REQ-3, REQ-4, REQ-6: the terminal has the right width at app start, maximized, and restored', async () => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const app = await launchDesktop(env);
    const page = await app.firstWindow();
    await expect(list(page)).toBeVisible({ timeout: 20_000 });
    expect(await isMaximized(app), 'the window starts at its smaller size').toBe(false);
    const folder = path.join(env.HOME!, 'project-width');
    const id = await startSession(port, folder);
    await list(page).getByTitle(folder, { exact: true }).click();
    await expect(currentView(page).locator('.xterm-rows')).toContainText('READY');
    await pageSettled(page);
    const baseURL = `http://127.0.0.1:${port}`;
    const started = await expectRightWidth(page, baseURL, id, 'app start');

    const bar = page.getByRole('banner');
    await bar.getByRole('button', { name: 'Maximize', exact: true }).click();
    await expect.poll(() => isMaximized(app), { message: 'the window maximizes' }).toBe(true);
    const maximized = await expectRightWidth(page, baseURL, id, 'maximized');
    expect(maximized.cols, 'the maximized panel shows more columns').toBeGreaterThan(started.cols);

    await bar.getByRole('button', { name: 'Restore', exact: true }).click();
    await expect.poll(() => isMaximized(app), { message: 'the window restores' }).toBe(false);
    const restored = await expectRightWidth(page, baseURL, id, 'restored');
    expect(restored.cols, 'Claude Code draws its lines again for the smaller panel').toBeLessThan(maximized.cols);
  });

  // Scenario "The user starts the desktop app and reads every last character whole"; plan-terminal_clip/REQ-12
  test('plan-terminal_clip REQ-1, REQ-2, REQ-12: when the desktop maximizes the window at start and the app restores it to 1280x800, the terminal has the right width', async () => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const app = await launchDesktop(env);
    const page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.maximize());
    await expect.poll(() => widthAndMaximized(app), { message: 'the app restores the window to 1280 px' }).toEqual([1280, false]);
    await expect(list(page)).toBeVisible({ timeout: 20_000 });
    const id = await openSession(page, port, path.join(env.HOME!, 'project-start'));

    await expectRightWidth(page, `http://127.0.0.1:${port}`, id, 'start restored to 1280x800');
  });

  // Scenario "The terminal stays whole after a quick series of window sizes"; plan-terminal_clip/REQ-5, REQ-11
  test('plan-terminal_clip REQ-5, REQ-11: maximize and restore, once and three times in quick succession, leave the terminal at the right width', async () => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const app = await launchDesktop(env);
    const page = await app.firstWindow();
    await expect(list(page)).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => widthAndMaximized(app), { message: 'the window starts at 1280 px' }).toEqual([1280, false]);
    const id = await openSession(page, port, path.join(env.HOME!, 'project-series'));
    const baseURL = `http://127.0.0.1:${port}`;
    const started = await expectRightWidth(page, baseURL, id, 'app start');

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.maximize());
    await expect.poll(() => isMaximized(app), { message: 'the window maximizes' }).toBe(true);
    await pageSettled(page);
    await expectRightWidth(page, baseURL, id, 'maximized once');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.unmaximize());
    await expect.poll(() => isMaximized(app), { message: 'the window restores' }).toBe(false);
    await pageSettled(page);
    await expectRightWidth(page, baseURL, id, 'restored once');

    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]!;
      for (let round = 0; round < 3; round++) {
        window.maximize();
        window.unmaximize();
      }
    });
    await expect.poll(() => widthAndMaximized(app), { message: 'the window ends restored' }).toEqual([1280, false]);
    await pageSettled(page);
    const after = await expectRightWidth(page, baseURL, id, 'after three maximize and restore');
    expect(after.cols, 'the terminal is back to its columns of the restored window').toBe(started.cols);
  });
});
