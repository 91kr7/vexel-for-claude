// e2e of plan-terminal_addons, batch clickable-links, in the desktop app (Electron group only).
// shell.openExternal is replaced in the main process: the test never opens the system browser on the user's display.
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
// Printed by the fake CLI on the line command LINKS.
const PLAIN = 'https://example.test/plain/page';

let app: ElectronApplication | undefined;
let port: number | undefined;
let home: string | undefined;

interface OpenedGlobals {
  openedExternal: string[];
}

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
      // The session is working after LINKS: "Quit" asks first, and answer 1 is "Quit".
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

/** Centre of the character `column` (0-based) of the row that starts with `marker`. */
const cell = (page: Page, marker: string, column: number) =>
  terminal(page).evaluate(
    (rows, [marker, column]) => {
      const row = [...rows.children].find((element) => element.textContent?.startsWith(marker as string));
      const node = row && document.createTreeWalker(row, NodeFilter.SHOW_TEXT).nextNode();
      if (!node) throw new Error(`no row ${marker}`);
      const range = document.createRange();
      range.setStart(node, column as number);
      range.setEnd(node, (column as number) + 1);
      const box = range.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    },
    [marker, column] as const,
  );

const cursorOf = (page: Page, { x, y }: { x: number; y: number }) =>
  page.evaluate(([x, y]) => getComputedStyle(document.elementFromPoint(x, y)!).cursor, [x, y] as const);
const openedExternal = (desktop: ElectronApplication) => desktop.evaluate(() => (globalThis as unknown as OpenedGlobals).openedExternal);
const windowCount = (desktop: ElectronApplication) => desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);

test.describe('Desktop links', () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeAll(() => {
    execFileSync('npx', ['tsc', '-b', 'tsconfig.desktop.build.json'], { cwd: repoRoot, stdio: 'ignore' });
    expect(existsSync(path.join(repoRoot, 'dist/web/index.html'))).toBe(true);
  });

  test('REQ-9, REQ-11, REQ-12: Ctrl+click sends a web address to the system browser and opens no Electron window', async () => {
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
    await app.evaluate(({ shell }) => {
      const globals = globalThis as unknown as OpenedGlobals;
      globals.openedExternal = [];
      shell.openExternal = (async (url: string) => {
        globals.openedExternal.push(url);
      }) as never;
    });
    const page = await app.firstWindow();
    const client = `http://127.0.0.1:${port}/`;
    await expect(page.getByRole('region', { name: 'Session List' })).toBeVisible({ timeout: 20_000 });

    const folder = path.join(home, 'project-links');
    await mkdir(folder);
    const started = await fetch(`${client}api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: folder }),
    });
    expect(started.status).toBe(201);
    await page
      .getByRole('region', { name: 'Session List' })
      .getByRole('button')
      .filter({ has: page.getByTitle(folder, { exact: true }) })
      .click();
    await expect(terminal(page)).toContainText('READY');
    await page.locator('.xterm-screen').click();
    await page.keyboard.type('LINKS');
    await page.keyboard.press('Enter');
    await expect(terminal(page)).toContainText('LINKS-DONE');

    const point = await cell(page, 'WEB:', 12);
    await page.mouse.move(point.x, point.y);
    await expect.poll(() => cursorOf(page, point)).toBe('pointer');
    await page.keyboard.down('Control');
    await page.mouse.click(point.x, point.y);
    await page.keyboard.up('Control');
    await expect.poll(() => openedExternal(app!)).toEqual([PLAIN]);
    expect(await windowCount(app)).toBe(1);
    expect(page.url()).toBe(client);
    await expect(terminal(page)).toContainText('LINKS-DONE');

    // DesktopApp spec: a request to open another scheme opens nothing, not even a window.
    await page.evaluate(() => window.open('file:///etc/hostname', '_blank'));
    await page.waitForTimeout(1000);
    expect(await openedExternal(app)).toEqual([PLAIN]);
    expect(await windowCount(app)).toBe(1);
    expect(page.url()).toBe(client);
  });
});
