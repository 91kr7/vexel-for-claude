// e2e of plan-terminal_addons, batch file-drop, in the desktop app (Electron group only): the preload gives the real path of a file on disk.
import { type ChildProcess, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ElectronApplication, type Locator, _electron, expect, test } from '@playwright/test';

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

type BridgeWindow = { desktopBridge: { getPathForFile(file: unknown): string }; e2eFile: File };

/** Dispatches a drop of the file picked from disk on `target`; returns whether its default was prevented. */
const dropPickedFile = (target: Locator) =>
  target.evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add((window as unknown as BridgeWindow).e2eFile);
    const event = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });

test.describe('Desktop file drop', () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeAll(() => {
    execFileSync('npx', ['tsc', '-b', 'tsconfig.desktop.build.json'], { cwd: repoRoot, stdio: 'ignore' });
    expect(existsSync(path.join(repoRoot, 'dist/web/index.html'))).toBe(true);
  });

  // DesktopBridge getPathForFile, scenario "The user drops files on the terminal in the desktop app"
  test('REQ-46: the bridge gives the absolute path of a file from disk, and its drop on the terminal pastes that path', async () => {
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
    const onDisk = path.join(home, "My Shot's.png");
    await writeFile(onDisk, 'png');
    app = await _electron.launch({ executablePath: electronBinary, args: ['.'], cwd: repoRoot, env });
    const page = await app.firstWindow();
    const client = `http://127.0.0.1:${port}/`;
    const list = page.getByRole('region', { name: 'Session List' });
    await expect(list).toBeVisible({ timeout: 20_000 });

    const folder = path.join(home, 'project-drop');
    await mkdir(folder);
    const started = await fetch(`${client}api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: folder }),
    });
    expect(started.status).toBe(201);
    await list.getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) }).click();
    const terminal = page.locator('.xterm-rows');
    await expect(terminal).toContainText('READY');

    // A file from disk, as a file input gives it: the bridge reads its absolute path.
    await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'file';
      input.id = 'e2e-file';
      input.addEventListener('change', () => Object.assign(window, { e2eFile: input.files?.[0] }));
      document.body.append(input);
    });
    await page.locator('#e2e-file').setInputFiles(onDisk);
    await expect.poll(() => page.evaluate(() => 'e2eFile' in window)).toBe(true);
    expect(await page.evaluate(() => {
      const { desktopBridge, e2eFile } = window as unknown as BridgeWindow;
      return desktopBridge.getPathForFile(e2eFile);
    })).toBe(onDisk);

    // DesktopBridge: no path for a file made by the page, nor for a value that is not a file; it never throws.
    expect(await page.evaluate(() => (window as unknown as BridgeWindow).desktopBridge.getPathForFile(new File(['x'], 'made.txt')))).toBe('');
    expect(await page.evaluate(() => (window as unknown as BridgeWindow).desktopBridge.getPathForFile('not a file'))).toBe('');

    // REQ-46, REQ-49: the drop pastes the real path, quoted.
    expect(await dropPickedFile(page.locator('.xterm-screen'))).toBe(true);
    const pasted = `'${onDisk.replaceAll("'", "'\\''")}' `;
    await expect(terminal).toContainText(`IN:${Buffer.from(pasted, 'utf8').toString('hex')}`);

    // REQ-53: a drop elsewhere in the window is kept from opening the file.
    expect(await dropPickedFile(list)).toBe(true);
    await expect(list).toBeVisible();
    expect(page.url().startsWith(client)).toBe(true);
  });
});
