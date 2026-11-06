// e2e of plan-desktop_app, batch desktop-window. Each Electron launch gets its own HOME, free port and Claude folder: it never touches the user's app, backend or files.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ElectronApplication, type Page, _electron, expect, test } from '@playwright/test';
import { startupPageUrl } from '../src/desktop/startup-page.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const electronBinary = createRequire(import.meta.url)('electron') as string;
const fakeClaude = fileURLToPath(new URL('../test-support/fake-claude.mjs', import.meta.url));
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
  const electron = app.process();
  if (electron.exitCode !== null || electron.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => electron.once('exit', () => resolve()));
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

test.describe('StartupPage in the browser', () => {
  test('loading state: waiting text, rotating accent indicator, Studio colours', async ({ page }) => {
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
      return { canvas, text: getComputedStyle(document.body).color, colours, animations: document.getAnimations().length };
    });
    expect(style.canvas).toContain('rgb(11, 11, 14)');
    expect(style.text).toBe('rgb(243, 242, 238)');
    expect(style.colours).toContain('rgb(140, 207, 255)');
    expect(style.animations).toBeGreaterThan(0);
  });

  test('error state: error colour, output lines as plain monospace rows in order', async ({ page }) => {
    const lines = ['first line', '<b>not bold</b>', 'Backend exited with code 1.'];
    await page.goto(startupPageUrl({ kind: 'error', outputLines: lines }));
    await expect(page.getByText(LOADING)).toHaveCount(0);
    const title = page.getByText(ERROR, { exact: true });
    await expect(title).toBeVisible();
    await expect(title).toHaveCSS('color', 'rgb(251, 113, 133)');
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

  test.beforeAll(() => {
    execFileSync('npx', ['tsc', '-b', 'tsconfig.desktop.build.json'], { cwd: repoRoot, stdio: 'ignore' });
    expect(existsSync(path.join(repoRoot, 'dist/web/index.html'))).toBe(true);
  });

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

  test('closing the window quits the app and leaves the started backend running', async () => {
    const port = await freePort();
    const app = await launchDesktop(await desktopEnv(port));
    const window = await app.firstWindow();
    await expect(list(window)).toBeVisible({ timeout: 20_000 });
    const exited = new Promise<void>((resolve) => app.process().once('exit', () => resolve()));
    await window.close();
    await exited;
    expect(await healthStatus(port)).toBe(200);
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
