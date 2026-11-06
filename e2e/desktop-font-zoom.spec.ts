// e2e of plan-terminal_addons, batch font-zoom, in the desktop app (Electron group only).
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

let app: ElectronApplication | undefined;
let port: number | undefined;
let home: string | undefined;

function listenerPids(listening: number): number[] {
  const out = execFileSync('ss', ['-Hltnp', `sport = :${listening}`], { encoding: 'utf8' });
  return [...out.matchAll(/pid=(\d+)/g)].map((match) => Number(match[1]));
}

async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

// Not `app.close()`: the detached backend inherits Electron's descriptors, so close() would wait for it.
test.afterEach(async () => {
  if (app) {
    let electron: ChildProcess | undefined;
    try {
      electron = app.process();
    } catch {
      electron = undefined;
    }
    if (electron && electron.exitCode === null && electron.signalCode === null) {
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
  }
  if (port) for (const pid of listenerPids(port)) if (pid !== process.pid) process.kill(pid, 'SIGKILL');
  if (home) await rm(home, { recursive: true, force: true });
  app = undefined;
  port = undefined;
  home = undefined;
});

const terminal = (page: Page) => page.locator('.xterm-rows');
const terminalTextSize = (page: Page) => terminal(page).evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
const pageZoom = (desktop: ElectronApplication) =>
  desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((window) => window.webContents.getZoomFactor()));
/** The roles of every item of the application menu, submenus included, in lower case. */
const menuRoles = (desktop: ElectronApplication) =>
  desktop.evaluate(({ Menu }) => {
    const roles: string[] = [];
    type MenuLike = { items: { role?: string; submenu?: MenuLike }[] };
    const walk = (menu: MenuLike) => {
      for (const item of menu.items) {
        if (item.role) roles.push(item.role.toLowerCase());
        if (item.submenu) walk(item.submenu);
      }
    };
    const menu = Menu.getApplicationMenu();
    if (menu) walk(menu);
    return roles;
  });

test.describe('Desktop font zoom', () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeAll(() => {
    execFileSync('npx', ['tsc', '-b', 'tsconfig.desktop.build.json'], { cwd: repoRoot, stdio: 'ignore' });
    expect(existsSync(path.join(repoRoot, 'dist/web/index.html'))).toBe(true);
  });

  // Scenario "The user makes the terminal text larger", in the desktop app
  test('REQ-39: Ctrl+= in the terminal makes the terminal text larger and leaves the page zoom of the window unchanged', async () => {
    port = await freePort();
    home = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-desktop-'));
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
    };
    app = await _electron.launch({ executablePath: electronBinary, args: ['.'], cwd: repoRoot, env });
    const page = await app.firstWindow();
    const client = `http://127.0.0.1:${port}/`;
    const list = page.getByRole('region', { name: 'Session List' });
    await expect(list).toBeVisible({ timeout: 20_000 });

    // DesktopApp spec: the menu keeps its items, without the three page zoom items.
    const roles = await menuRoles(app);
    for (const zoomRole of ['zoomin', 'zoomout', 'resetzoom']) expect(roles).not.toContain(zoomRole);
    for (const kept of ['quit', 'undo', 'copy', 'paste', 'reload', 'toggledevtools', 'togglefullscreen']) expect(roles).toContain(kept);

    const folder = path.join(home, 'project-zoom');
    await mkdir(folder);
    const started = await fetch(`${client}api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: folder }),
    });
    expect(started.status).toBe(201);
    const entry = list.getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
    await entry.click();
    await expect(terminal(page)).toContainText('READY');
    await page.locator('.xterm-screen').click();
    await expect.poll(() => terminalTextSize(page)).toBe(12);
    const zoomBefore = await pageZoom(app);
    const pixelRatio = await page.evaluate(() => window.devicePixelRatio);

    await page.keyboard.press('Control+Equal');
    await expect.poll(() => terminalTextSize(page)).toBe(13);
    await page.waitForTimeout(500);
    expect(await pageZoom(app)).toEqual(zoomBefore);
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(pixelRatio);

    // Outside the terminal the keys zoom neither the page nor the terminal.
    await page.keyboard.press('Control+Shift+L');
    await expect(entry).toBeFocused();
    await page.keyboard.press('Control+Equal');
    await page.keyboard.press('Control+Minus');
    await page.waitForTimeout(500);
    expect(await pageZoom(app)).toEqual(zoomBefore);
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(pixelRatio);
    expect(await terminalTextSize(page)).toBe(13);
  });
});
