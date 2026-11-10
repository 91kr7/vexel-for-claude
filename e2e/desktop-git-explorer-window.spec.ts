// e2e of plan-git_explorer, batch explorer-access, in the desktop app (Electron group only).
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
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
const processes: ChildProcess[] = [];

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
  for (const child of processes.splice(0)) child.kill('SIGKILL');
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
  const home = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-desktop-git-')));
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

const git = (folder: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: folder, encoding: 'utf8' }).trim();

async function newRepository(parent: string, name: string): Promise<string> {
  const root = path.join(parent, name);
  await mkdir(root, { recursive: true });
  git(root, 'init', '-q', '-b', 'main');
  await writeFile(path.join(root, 'README.md'), 'hello\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'first');
  return root;
}

/** Simulates Claude Code in another terminal: a live process, its session file and transcript in the Claude folder. */
async function runExternal(claudeDir: string, sessionId: string, folder: string): Promise<void> {
  const sessions = path.join(claudeDir, 'sessions');
  const transcript = path.join(claudeDir, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'), `${sessionId}.jsonl`);
  await mkdir(sessions, { recursive: true });
  await mkdir(path.dirname(transcript), { recursive: true });
  const entries = [
    { type: 'user', cwd: folder, isSidechain: false, message: { role: 'user', content: 'Hello' } },
    { type: 'assistant', cwd: folder, isSidechain: false, message: { role: 'assistant', content: [{ type: 'text', text: 'Hi there' }] } },
  ];
  await writeFile(transcript, entries.map((entry) => `${JSON.stringify(entry)}\n`).join(''));
  const child = spawn('sleep', ['300'], { stdio: 'ignore' });
  processes.push(child);
  const pid = child.pid ?? 0;
  execFileSync('mkfifo', [path.join(sessions, `${pid}.5a6b7c8d.key`)]);
  await writeFile(path.join(sessions, `${pid}.json`), JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status: 'idle', updatedAt: Date.now() }));
}

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const mainArea = (page: Page) => page.getByRole('main');
const explorerButton = (page: Page) => mainArea(page).locator('.session-header').getByRole('button', { name: 'Git Explorer', exact: true });
const explorer = (page: Page) => mainArea(page).getByRole('region', { name: 'Git Explorer', exact: true });

async function expectRepositoryShown(page: Page, root: string): Promise<void> {
  await expect(explorer(page)).toBeVisible();
  await expect(explorer(page).getByTitle(root, { exact: true })).toHaveText(path.basename(root));
  await expect(explorer(page)).toContainText('main');
}

test.describe('Git explorer in the desktop app', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(() => {
    execFileSync('npx', ['tsc', '-b', 'tsconfig.desktop.build.json'], { cwd: repoRoot, stdio: 'ignore' });
    expect(existsSync(path.join(repoRoot, 'dist/web/index.html'))).toBe(true);
  });

  // plan-git_explorer/REQ-7, with REQ-1, REQ-3, REQ-4: hosted and external sessions in the desktop window
  test('the "Git Explorer" button opens the panel with the repository and the branch, for hosted and external sessions', async () => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const hostedRepo = await newRepository(env.HOME!, 'hosted-repo');
    const externalRepo = await newRepository(env.HOME!, 'external-repo');
    await runExternal(env.CLAUDE_CONFIG_DIR!, '8f1c2d3e-0000-4000-8000-0000000000e1', externalRepo);

    const app = await _electron.launch({ executablePath: electronBinary, args: ['.'], cwd: repoRoot, env });
    apps.push(app);
    const page = await app.firstWindow();
    await expect(list(page)).toBeVisible({ timeout: 20_000 });

    const created = await fetch(`http://127.0.0.1:${port}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: hostedRepo }),
    });
    expect(created.status).toBe(201);

    await entry(page, hostedRepo).click();
    await explorerButton(page).click();
    await expectRepositoryShown(page, hostedRepo);

    await expect(entry(page, externalRepo)).toBeVisible({ timeout: 10_000 });
    await entry(page, externalRepo).click();
    await expect(page.locator('.conversation-view')).toContainText('Hi there');
    await explorerButton(page).click();
    await expectRepositoryShown(page, externalRepo);
  });
});
