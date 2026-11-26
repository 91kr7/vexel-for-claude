// e2e of plan-git_explorer batch explorer-access and plan-git_graph batch graph-history, in the desktop app (Electron group only).
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ElectronApplication, type Page, _electron, expect, test } from '@playwright/test';
import { quitDesktop } from './desktop-quit';

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

    await entry(page, hostedRepo).getByTitle(hostedRepo, { exact: true }).click();
    await explorerButton(page).click();
    await expectRepositoryShown(page, hostedRepo);

    await expect(entry(page, externalRepo)).toBeVisible({ timeout: 10_000 });
    await entry(page, externalRepo).getByTitle(externalRepo, { exact: true }).click();
    await expect(page.locator('.conversation-view')).toContainText('Hi there');
    await explorerButton(page).click();
    await expectRepositoryShown(page, externalRepo);
  });

  // plan-git_graph/REQ-5: human acceptance scenario "The user uses the git explorer in the desktop window"
  test('the diff of a changed file in "Changes" and the graph with a merge in "History" show in the desktop window', async () => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const repo = await newRepository(env.HOME!, 'graph-repo');
    git(repo, 'checkout', '-q', '-b', 'feature');
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'feature work');
    git(repo, 'checkout', '-q', 'main');
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'main work');
    git(repo, 'merge', '-q', '--no-ff', '-m', 'Merge feature', 'feature');
    await writeFile(path.join(repo, 'README.md'), 'hello\nchanged line\n');

    const app = await _electron.launch({ executablePath: electronBinary, args: ['.'], cwd: repoRoot, env });
    apps.push(app);
    const page = await app.firstWindow();
    await expect(list(page)).toBeVisible({ timeout: 20_000 });
    const created = await fetch(`http://127.0.0.1:${port}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    });
    expect(created.status).toBe(201);
    await entry(page, repo).getByTitle(repo, { exact: true }).click();
    await explorerButton(page).click();
    await expectRepositoryShown(page, repo);

    const files = explorer(page).getByRole('listbox', { name: 'Changed files', exact: true }).getByRole('option');
    await files.filter({ hasText: 'README.md' }).click();
    await expect(files.filter({ hasText: 'README.md' })).toHaveAttribute('aria-selected', 'true');
    await expect(explorer(page).locator('.diff-view td').filter({ hasText: /^\+changed line$/ })).toHaveCount(1);

    await explorer(page).getByRole('tab', { name: 'History', exact: true }).click();
    const rows = explorer(page).locator('[aria-label="Commits"]').getByRole('button');
    await expect(rows).toHaveCount(4);
    await expect(rows.first()).toContainText('Merge feature');
    await expect(rows.first().getByText('main', { exact: true })).toBeVisible();
    const graph = explorer(page).locator('[aria-hidden="true"] svg').filter({ has: page.locator('circle') });
    await expect(graph).toHaveCount(1);
    await expect(graph).toBeVisible();
    const lanes = await graph.evaluate((svg) => new Set([...svg.querySelectorAll('circle')].map((c) => c.getAttribute('cx'))).size);
    expect(lanes, 'the merged branch runs in a second lane').toBeGreaterThanOrEqual(2);
  });
});
