// e2e of plan-session_list_width, batch list-width, in the desktop app (Electron group only).
import { type ChildProcess, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
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

const panel = (page: Page) => page.getByRole('region', { name: 'Session List' });
const edge = (page: Page) => page.getByRole('separator', { name: 'Resize Session List' });

async function panelWidth(page: Page): Promise<number> {
  const b = await panel(page).boundingBox();
  expect(b, 'list panel is rendered').not.toBeNull();
  return b!.width;
}

test.describe('List panel width in the desktop app', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(() => {
    execFileSync('npx', ['tsc', '-b', 'tsconfig.desktop.build.json'], { cwd: repoRoot, stdio: 'ignore' });
    expect(existsSync(path.join(repoRoot, 'dist/web/index.html'))).toBe(true);
  });

  // plan-session_list_width/REQ-8, REQ-9: the width set in the window survives an app restart, from the first frame
  test('a width set by dragging the edge survives an app restart and shows from the first frame', async () => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const first = await launchDesktop(env);
    const firstWindow = await first.firstWindow();
    await expect(edge(firstWindow)).toBeVisible({ timeout: 20_000 });
    expect(await panelWidth(firstWindow), 'a new profile starts at 224 px').toBeCloseTo(224, 0);

    const b = (await edge(firstWindow).boundingBox())!;
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    await firstWindow.mouse.move(x, y);
    await firstWindow.mouse.down();
    for (let i = 1; i <= 5; i++) await firstWindow.mouse.move(x + i * 20, y);
    await firstWindow.mouse.up();
    expect(await panelWidth(firstWindow)).toBeCloseTo(324, 0);

    await quitDesktop(first);
    await expect.poll(() => healthStatus(port), { timeout: 15_000 }).toBeUndefined();

    // A slow Node keeps the startup page on screen long enough to watch the client page from its first frame.
    const slowNode = path.join(env.HOME!, 'slow-node');
    await writeFile(slowNode, `#!/bin/sh\nsleep 3\nexec '${process.execPath}' "$@"\n`);
    await chmod(slowNode, 0o755);
    const second = await launchDesktop({ ...env, AI_CLIENT_NODE: slowNode });
    const client = await second.firstWindow();
    // Every width the panel takes from its first appearance in the client page.
    await client.addInitScript(() => {
      const seen: number[] = [];
      (window as unknown as { listWidths: number[] }).listWidths = seen;
      const watch = new MutationObserver(() => {
        const el = document.querySelector('[aria-label="Session List"]');
        if (!el) return;
        watch.disconnect();
        seen.push(el.getBoundingClientRect().width);
        new ResizeObserver((entries) => entries.forEach((e) => seen.push(e.borderBoxSize[0]!.inlineSize))).observe(el);
      });
      watch.observe(document, { childList: true, subtree: true });
    });
    await expect(edge(client)).toBeVisible({ timeout: 20_000 });
    expect(await panelWidth(client)).toBeCloseTo(324, 0);
    await expect(edge(client)).toHaveAttribute('aria-valuenow', '324');
    const widths = await client.evaluate(() => (window as unknown as { listWidths?: number[] }).listWidths ?? []);
    expect(widths.length, 'the client page was watched from its start').toBeGreaterThan(0);
    for (const width of widths) expect(width, `every width since the first frame: ${widths.join(', ')}`).toBeCloseTo(324, 0);
  });
});
