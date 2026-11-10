// e2e of plan-git_explorer, batches explorer-access and uncommitted-changes: the "Git Explorer" button, the panel and its uncommitted changes.
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

const group = (page: Page, name: 'Staged' | 'Unstaged') => explorer(page).getByRole('region', { name, exact: true });
const fileEntry = (page: Page, name: 'Staged' | 'Unstaged', file: string) => group(page, name).getByRole('button').filter({ hasText: file });
const diffLines = (page: Page) => explorer(page).locator('.diff-line');
const isChanges = (url: string) => new URL(url).pathname === '/api/git/changes';

/** The computed colour of a CSS variable, as the browser writes colours (rgb). */
const cssColour = (page: Page, variable: string) =>
  page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, variable);

async function openExplorer(page: Page, request: APIRequestContext, folder: string): Promise<void> {
  await startHosted(request, folder);
  await page.goto('/');
  await openHosted(page, folder);
  await explorerButton(page).click();
  await expect(explorer(page)).toBeVisible();
}

const numbered = (count: number, prefix: string) => Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}\n`).join('');

test.describe('Uncommitted changes in the git explorer', () => {
  // plan-git_explorer/REQ-5, REQ-9, REQ-10, REQ-11, REQ-12: human acceptance scenario "The user sees the uncommitted changes and their diff"
  test('lists staged and unstaged changes of the whole repository and shows the diff of a clicked file', async ({ page, request }) => {
    const repo = await newRepository('changes-repo');
    await mkdir(path.join(repo, 'app'));
    await mkdir(path.join(repo, 'lib'));
    await writeFile(path.join(repo, 'lib', 'util.ts'), 'export const a = 1;\nexport const b = 2;\nexport const c = 3;\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'second');
    await writeFile(path.join(repo, 'app', 'feature.ts'), 'export const feature = true;\n');
    git(repo, 'add', 'app/feature.ts');
    await writeFile(path.join(repo, 'lib', 'util.ts'), 'export const a = 1;\nexport const b = 20;\nexport const c = 3;\n');
    await writeFile(path.join(repo, 'todo.md'), 'later\n');

    await openExplorer(page, request, path.join(repo, 'app'));

    await expect(fileEntry(page, 'Staged', 'app/feature.ts')).toContainText('Added');
    await expect(fileEntry(page, 'Unstaged', 'lib/util.ts')).toContainText('Modified');
    await expect(fileEntry(page, 'Unstaged', 'todo.md')).toContainText('Untracked');
    await expect(group(page, 'Staged').getByRole('button')).toHaveCount(1);
    await expect(group(page, 'Unstaged').getByRole('button')).toHaveCount(2);
    const stagedBox = await box(group(page, 'Staged'));
    const unstagedBox = await box(group(page, 'Unstaged'));
    expect(stagedBox.y, '"Staged" is above "Unstaged"').toBeLessThan(unstagedBox.y);

    await fileEntry(page, 'Unstaged', 'lib/util.ts').click();
    await expect(fileEntry(page, 'Unstaged', 'lib/util.ts')).toHaveAttribute('aria-pressed', 'true');
    const removed = diffLines(page).filter({ hasText: /^-export const b = 2;$/ });
    const added = diffLines(page).filter({ hasText: /^\+export const b = 20;$/ });
    await expect(removed).toHaveCount(1);
    await expect(added).toHaveCount(1);
    await expect(diffLines(page).filter({ hasText: /^@@ / })).toHaveCount(1);

    const green = await cssColour(page, '--emerald-400');
    const red = await cssColour(page, '--color-error');
    expect(green).not.toBe(red);
    await expect(added).toHaveCSS('color', green);
    await expect(removed).toHaveCSS('color', red);
    expect(await added.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Roboto Mono');
  });

  // plan-git_explorer/REQ-12: an untracked file shows all its lines as added
  test('shows every line of an untracked file as added', async ({ page, request }) => {
    const repo = await newRepository('untracked-repo');
    await writeFile(path.join(repo, 'draft.txt'), 'first\nsecond\n');
    await openExplorer(page, request, repo);
    await fileEntry(page, 'Unstaged', 'draft.txt').click();
    await expect(diffLines(page).filter({ hasText: /^\+(first|second)$/ })).toHaveCount(2);
    await expect(diffLines(page).filter({ hasText: /^-/ })).toHaveCount(0);
  });

  // plan-git_explorer/REQ-13: human acceptance scenario "A clean repository says it has no changes"
  test('a clean repository says "No uncommitted changes"', async ({ page, request }) => {
    const repo = await newRepository('clean-repo');
    await openExplorer(page, request, repo);
    await expect(explorer(page)).toContainText('No uncommitted changes');
    await expect(group(page, 'Staged')).toHaveCount(0);
    await expect(group(page, 'Unstaged')).toHaveCount(0);
  });

  // plan-git_explorer/REQ-14, REQ-15: human acceptance scenario "A binary file and a very large diff stay readable"
  test('a binary file shows its note, and a 20,000-line diff shows its first lines, the cut note, and the page keeps reacting', async ({ page, request }) => {
    const repo = await newRepository('large-repo');
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1]);
    await writeFile(path.join(repo, 'logo.png'), png);
    await writeFile(path.join(repo, 'data.txt'), numbered(20_000, 'old'));
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'assets');
    await writeFile(path.join(repo, 'logo.png'), Buffer.concat([png, Buffer.from([0, 7, 0, 9])]));
    await writeFile(path.join(repo, 'data.txt'), numbered(20_000, 'new'));

    await openExplorer(page, request, repo);
    await expect(fileEntry(page, 'Unstaged', 'logo.png')).toContainText('Modified');

    await fileEntry(page, 'Unstaged', 'logo.png').click();
    await expect(explorer(page)).toContainText('Binary file, no diff shown');
    await expect(diffLines(page)).toHaveCount(0);

    const started = Date.now();
    await fileEntry(page, 'Unstaged', 'data.txt').click();
    await expect(explorer(page)).toContainText('Diff cut at 5,000 lines', { timeout: 10_000 });
    expect(Date.now() - started, 'the cut diff shows within 5 s').toBeLessThan(5_000);
    await expect(diffLines(page).first()).toHaveText(/^@@ /);
    await expect(diffLines(page).nth(1)).toHaveText('-old 1');
    await expect(diffLines(page)).toHaveCount(5_000);
    await expect(explorer(page)).not.toContainText('Binary file, no diff shown');

    // The page keeps reacting: the diff scrolls, and a click answers at once.
    const scroller = await diffLines(page).first().evaluateHandle((line) => {
      let node: HTMLElement | null = line.parentElement;
      while (node && !(node.scrollHeight > node.clientHeight && /(auto|scroll)/.test(getComputedStyle(node).overflowY))) node = node.parentElement;
      return node;
    });
    expect(await scroller.evaluate((node) => node !== null), 'the diff has a vertical scroll').toBe(true);
    const lineBox = await box(diffLines(page).nth(3));
    await page.mouse.move(lineBox.x + 20, lineBox.y + 5);
    await page.mouse.wheel(0, 3_000);
    await expect.poll(() => scroller.evaluate((node) => (node as HTMLElement).scrollTop)).toBeGreaterThan(0);

    const clicked = Date.now();
    await fileEntry(page, 'Unstaged', 'logo.png').click();
    await expect(fileEntry(page, 'Unstaged', 'logo.png')).toHaveAttribute('aria-pressed', 'true');
    await expect(explorer(page)).toContainText('Binary file, no diff shown');
    expect(Date.now() - clicked, 'a click after the large diff answers within 2 s').toBeLessThan(2_000);
  });

  // plan-git_explorer/REQ-6 (served here): a git error of the changes appears in the panel
  test('a git error of the changes appears as an alert in the panel', async ({ page, request }) => {
    const repo = await newRepository('changes-error-repo');
    await page.route((url) => isChanges(url.href), (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'git_error', message: 'fatal: index file corrupt' }) }),
    );
    await openExplorer(page, request, repo);
    await expect(explorer(page).getByRole('alert')).toHaveText('fatal: index file corrupt');
    await expect(terminalPanel(page)).toBeVisible();
  });
});
