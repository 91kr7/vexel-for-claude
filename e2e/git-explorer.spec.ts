// e2e of plan-git_explorer, batch explorer-access: the "Git Explorer" button and panel of hosted and external sessions.
// Repositories are real git repositories in temp folders. External sessions use fixture files in E2E_CLAUDE_DIR.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
// The scanner reads the sessions folder every 2 seconds.
const SCAN = { timeout: 10_000 };

let projectsRoot: string;
const createdIds: string[] = [];
const terminals: ChildProcess[] = [];

test.beforeAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await mkdir(SESSIONS_DIR, { recursive: true });
  await mkdir(path.join(E2E_CLAUDE_DIR, 'projects'), { recursive: true });
  projectsRoot = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-git-')));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const terminal of terminals.splice(0)) terminal.kill('SIGKILL');
});

test.afterAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await rm(projectsRoot, { recursive: true, force: true });
});

const git = (folder: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: folder, encoding: 'utf8' }).trim();

/** A repository on `main` with one commit. */
async function newRepository(name: string): Promise<string> {
  const root = path.join(await mkdtemp(path.join(projectsRoot, 'r-')), name);
  await mkdir(root);
  git(root, 'init', '-q', '-b', 'main');
  await writeFile(path.join(root, 'README.md'), 'hello\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'first');
  return root;
}

async function newPlainFolder(name: string): Promise<string> {
  const folder = path.join(await mkdtemp(path.join(projectsRoot, 'p-')), name);
  await mkdir(folder);
  return folder;
}

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const mainArea = (page: Page) => page.getByRole('main');
const terminalPanel = (page: Page) => mainArea(page).getByRole('region', { name: /^Terminal/ });
const terminal = (page: Page) => page.locator('.xterm-rows');
const header = (page: Page) => mainArea(page).locator('.session-header');
const explorerButton = (page: Page) => header(page).getByRole('button', { name: 'Git Explorer', exact: true });
const explorer = (page: Page) => mainArea(page).getByRole('region', { name: 'Git Explorer', exact: true });
const isLookup = (url: string) => new URL(url).pathname === '/api/git/repository';

async function startHosted(request: APIRequestContext, folder: string): Promise<void> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  createdIds.push(((await response.json()) as { id: string }).id);
}

async function openHosted(page: Page, folder: string): Promise<void> {
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
}

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
}

/** The accessible names of the header buttons, left to right. */
const headerButtonNames = (page: Page) =>
  header(page)
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim() ?? ''));

/** The panel shows the repository folder name, the full path on hover, and the branch. */
async function expectRepositoryShown(page: Page, root: string, branch: string): Promise<void> {
  await expect(explorer(page)).toBeVisible();
  const name = explorer(page).getByTitle(root, { exact: true });
  await expect(name).toHaveText(path.basename(root));
  await expect(explorer(page)).toContainText(branch);
}

test.describe('Git explorer of a hosted session', () => {
  // plan-git_explorer/REQ-1, REQ-3, REQ-4: the button opens a panel at the right with the repository and the branch
  test('the "Git Explorer" button, first in the header actions, opens and closes the panel of the repository', async ({ page, request }) => {
    const repo = await newRepository('alpha-repo');
    await startHosted(request, repo);
    await page.goto('/');
    await openHosted(page, repo);

    await expect(explorerButton(page)).toBeVisible();
    await expect(explorerButton(page)).toHaveAttribute('title', 'Git Explorer');
    await expect(explorerButton(page)).toHaveAttribute('aria-expanded', 'false');
    const names = await headerButtonNames(page);
    expect(names.indexOf('Git Explorer'), names.join(' | ')).toBeGreaterThanOrEqual(0);
    expect(names.indexOf('Git Explorer'), 'before Search').toBeLessThan(names.indexOf('Search'));
    await expect(explorer(page), 'the panel is closed when the view opens').toHaveCount(0);

    const before = await box(terminalPanel(page));
    await explorerButton(page).click();
    await expect(explorerButton(page)).toHaveAttribute('aria-expanded', 'true');
    await expectRepositoryShown(page, repo, 'main');

    const panel = await box(explorer(page));
    const term = await box(terminalPanel(page));
    expect(panel.x, 'the panel is at the right of the terminal').toBeGreaterThanOrEqual(term.x + term.width - 1);
    expect(term.width, 'the terminal takes the width that is left').toBeLessThan(before.width);
    expect(panel.width).toBeGreaterThanOrEqual(360);

    await explorerButton(page).click();
    await expect(explorer(page)).toHaveCount(0);
    await expect(explorerButton(page)).toHaveAttribute('aria-expanded', 'false');
  });

  // plan-git_explorer/REQ-7 (spec GitExplorerPanel): 50 % of the session content, at least 360 px
  test('the panel takes half of the session content width', async ({ page, request }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const repo = await newRepository('wide-repo');
    await startHosted(request, repo);
    await page.goto('/');
    await openHosted(page, repo);
    await explorerButton(page).click();
    await expect(explorer(page)).toBeVisible();
    const panel = await box(explorer(page));
    const term = await box(terminalPanel(page));
    const content = panel.x + panel.width - term.x;
    expect(Math.abs(panel.width - content / 2), `panel ${panel.width} of content ${content}`).toBeLessThanOrEqual(content * 0.03);
  });

  test('a subfolder of a repository shows the repository root', async ({ page, request }) => {
    const repo = await newRepository('nested-repo');
    const sub = path.join(repo, 'frontend');
    await mkdir(sub);
    await startHosted(request, sub);
    await page.goto('/');
    await openHosted(page, sub);
    await explorerButton(page).click();
    await expectRepositoryShown(page, repo, 'main');
  });

  // plan-git_explorer/REQ-2: no button outside a repository
  test('a folder outside any repository shows no "Git Explorer" button', async ({ page, request }) => {
    const plain = await newPlainFolder('plain-folder');
    await startHosted(request, plain);
    await page.goto('/');
    const lookup = page.waitForResponse((r) => isLookup(r.url()));
    await openHosted(page, plain);
    expect(await (await lookup).json()).toEqual({ status: 'none' });
    await expect(header(page).getByRole('button', { name: 'Search', exact: true })).toBeVisible();
    await expect(explorerButton(page)).toHaveCount(0);
  });

  // plan-git_explorer/REQ-4: detached HEAD shows "detached" and the short hash
  test('a detached HEAD shows "detached" and the short hash in the branch chip', async ({ page, request }) => {
    const repo = await newRepository('detached-repo');
    git(repo, 'checkout', '-q', '--detach');
    const hash = git(repo, 'rev-parse', '--short', 'HEAD');
    await startHosted(request, repo);
    await page.goto('/');
    await openHosted(page, repo);
    await explorerButton(page).click();
    await expectRepositoryShown(page, repo, `detached ${hash}`);
  });

  // plan-git_explorer/REQ-6 (served here): a git error keeps the button, the panel shows the message, the session keeps working
  test('a git error appears as an alert in the panel', async ({ page, request }) => {
    const repo = await newRepository('error-repo');
    await startHosted(request, repo);
    await page.route((url) => isLookup(url.href), (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'git_error', message: 'fatal: test failure' }) }),
    );
    await page.goto('/');
    await openHosted(page, repo);
    await explorerButton(page).click();
    await expect(explorer(page).getByRole('alert')).toHaveText('fatal: test failure');
    await expect(terminalPanel(page)).toBeVisible();
  });
});

const transcriptPath = (folder: string, id: string) => path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'), `${id}.jsonl`);

async function runExternal(sessionId: string, folder: string): Promise<void> {
  const file = transcriptPath(folder, sessionId);
  await mkdir(path.dirname(file), { recursive: true });
  const lines = [
    { type: 'user', cwd: folder, isSidechain: false, message: { role: 'user', content: 'Hello' } },
    { type: 'assistant', cwd: folder, isSidechain: false, message: { role: 'assistant', content: [{ type: 'text', text: 'Hi there' }] } },
  ];
  await writeFile(file, lines.map((line) => `${JSON.stringify(line)}\n`).join(''));
  const process = spawn('sleep', ['300'], { stdio: 'ignore' });
  terminals.push(process);
  const pid = process.pid ?? 0;
  execFileSync('mkfifo', [path.join(SESSIONS_DIR, `${pid}.5a6b7c8d.key`)]);
  await writeFile(path.join(SESSIONS_DIR, `${pid}.json`), JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status: 'idle', updatedAt: Date.now() }));
}

const conversation = (page: Page) => page.locator('.conversation-view');
const externalHeader = (page: Page) => conversation(page).locator('.session-header');

test.describe('Git explorer of an external session', () => {
  // plan-git_explorer/REQ-1, REQ-3, REQ-4: same button, before "Resume Here", and the panel beside the conversation
  test('the "Git Explorer" button, before "Resume Here", opens the panel of the repository', async ({ page }) => {
    const repo = await newRepository('external-repo');
    await runExternal('8f1c2d3e-0000-4000-8000-000000000001', repo);
    await page.goto('/');
    await expect(entry(page, repo)).toBeVisible(SCAN);
    await entry(page, repo).click();
    await expect(conversation(page)).toContainText('Hi there');

    const button = externalHeader(page).getByRole('button', { name: 'Git Explorer', exact: true });
    await expect(button).toBeVisible();
    const names = await externalHeader(page)
      .getByRole('button')
      .evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim() ?? ''));
    const resume = names.findIndex((name) => name.includes('Resume Here'));
    expect(resume, names.join(' | ')).toBeGreaterThanOrEqual(0);
    expect(names.indexOf('Git Explorer'), 'before Resume Here').toBeLessThan(resume);

    const before = await box(conversation(page).locator('.conversation-items'));
    await button.click();
    await expectRepositoryShown(page, repo, 'main');
    const panel = await box(explorer(page));
    const content = await box(conversation(page).locator('.conversation-items'));
    expect(panel.x, 'the panel is at the right of the conversation').toBeGreaterThanOrEqual(content.x + content.width - 1);
    expect(content.width).toBeLessThan(before.width);

    await button.click();
    await expect(explorer(page)).toHaveCount(0);
  });

  // plan-git_explorer/REQ-2
  test('an external session outside any repository shows no "Git Explorer" button', async ({ page }) => {
    const plain = await newPlainFolder('external-plain');
    await runExternal('8f1c2d3e-0000-4000-8000-000000000002', plain);
    await page.goto('/');
    await expect(entry(page, plain)).toBeVisible(SCAN);
    const lookup = page.waitForResponse((r) => isLookup(r.url()));
    await entry(page, plain).click();
    await expect(conversation(page)).toContainText('Hi there');
    expect(await (await lookup).json()).toEqual({ status: 'none' });
    await expect(externalHeader(page).getByRole('button', { name: 'Git Explorer', exact: true })).toHaveCount(0);
  });
});
