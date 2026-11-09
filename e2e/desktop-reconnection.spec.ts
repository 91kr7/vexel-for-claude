// e2e of plan-claude_sessions_client, batch backend-reconnection: REQ-53 in the desktop window, with a real backend stopped and started again.
// Electron group only (E2E_DESKTOP=1): it opens a window on the display.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
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
const LOST_SERVER = 'Connection to the server lost. Reload the page.';
// plan-claude_sessions_client/REQ-47
const RECOVERY_MS = 5000;

const apps: ElectronApplication[] = [];
const children: ChildProcess[] = [];
const ports: number[] = [];
const dirs: string[] = [];

// Not `app.close()`: it would wait for processes that inherited Playwright's connection.
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

function listenerPids(port: number): number[] {
  const out = execFileSync('ss', ['-Hltnp', `sport = :${port}`], { encoding: 'utf8' });
  return [...out.matchAll(/pid=(\d+)/g)].map((match) => Number(match[1]));
}

test.afterEach(async () => {
  for (const app of apps.splice(0)) await quitDesktop(app);
  for (const child of children.splice(0)) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  for (const port of ports.splice(0)) for (const pid of listenerPids(port)) if (pid !== process.pid) process.kill(pid, 'SIGKILL');
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as net.AddressInfo;
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
  const home = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-desktop-reconnection-'));
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

/** Starts a backend the way `npm start` does, and waits until it answers. */
async function startBackend(env: Record<string, string>, port: number): Promise<{ backend: ChildProcess; reachableAt: number }> {
  const backend = spawn(process.execPath, ['--import', 'tsx', 'src/server/main.ts'], { cwd: repoRoot, env: { ...env, NODE_ENV: 'production' }, stdio: 'ignore' });
  children.push(backend);
  await expect.poll(() => healthStatus(port), { timeout: 20_000, intervals: [50] }).toBe(200);
  return { backend, reachableAt: Date.now() };
}

/** Stops the backend as Ctrl+C in its terminal does. */
async function stopBackend(backend: ChildProcess): Promise<void> {
  const exited = new Promise<void>((resolve) => backend.once('exit', () => resolve()));
  backend.kill('SIGINT');
  await exited;
}

async function startSession(port: number, folder: string): Promise<void> {
  await mkdir(folder, { recursive: true });
  const response = await fetch(`http://127.0.0.1:${port}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: folder }),
  });
  expect(response.status).toBe(201);
}

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });

test.describe('Desktop window reconnection', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(() => {
    execFileSync('npx', ['tsc', '-b', 'tsconfig.desktop.build.json'], { cwd: repoRoot, stdio: 'ignore' });
    expect(existsSync(path.join(repoRoot, 'dist/web/index.html'))).toBe(true);
  });

  // plan-claude_sessions_client/REQ-53 (REQ-46, REQ-47, REQ-48, REQ-52 in the desktop window)
  test('REQ-53: the window shows the error when the backend stops and clears it within 5 s of each new start, without a reload', async () => {
    const port = await freePort();
    const env = await desktopEnv(port);
    let { backend } = await startBackend(env, port);
    const firstFolder = path.join(env.HOME!, 'project-before');
    await startSession(port, firstFolder);

    const app = await _electron.launch({ executablePath: electronBinary, args: ['.'], cwd: repoRoot, env });
    apps.push(app);
    const page = await app.firstWindow();
    await expect(entry(page, firstFolder)).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => ((window as unknown as { reconnectionMark?: number }).reconnectionMark = 1));

    let previousFolder = firstFolder;
    for (let cycle = 1; cycle <= 2; cycle += 1) {
      await stopBackend(backend);
      await expect(list(page).getByRole('alert')).toHaveText(LOST_SERVER, { timeout: 10_000 });
      await page.waitForTimeout(3000);
      await expect(list(page).getByRole('alert')).toHaveText(LOST_SERVER);

      const started = await startBackend(env, port);
      backend = started.backend;
      await expect(list(page).getByRole('alert')).toHaveCount(0, { timeout: RECOVERY_MS + 2000 });
      expect(Date.now() - started.reachableAt, 'error gone within 5 s of the backend start').toBeLessThan(RECOVERY_MS);

      await expect(entry(page, previousFolder), 'the new backend does not list the sessions of the stopped one').toHaveCount(0);
      const folder = path.join(env.HOME!, `project-after-${cycle}`);
      await startSession(port, folder);
      await expect(entry(page, folder), 'live updates work again').toBeVisible();
      previousFolder = folder;
    }

    expect(await page.evaluate(() => (window as unknown as { reconnectionMark?: number }).reconnectionMark), 'no reload of the page').toBe(1);
  });
});
