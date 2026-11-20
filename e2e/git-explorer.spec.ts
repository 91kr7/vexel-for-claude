// e2e of plan-git_explorer, batches explorer-access, uncommitted-changes, history and refresh: the "Git Explorer" button, the panel, its uncommitted changes, the history and the refresh.
// Changes list box and diff on open-source components, light and dark: plan-git_graph, batch open-source-explorer.
// The history as a commit graph, the branch label and the commit files list box: plan-git_graph, batch graph-history.
// Several repositories of a workspace folder in the header: plan-multi_repo_workspace, batch repo-detection.
// The changes of every repository, one group per repository: plan-multi_repo_workspace, batch grouped-changes.
// The combined history of every repository in one graph: plan-multi_repo_workspace, batch combined-history.
// The repository filter of the header: plan-multi_repo_workspace, batch repo-filter.
// Repositories are real git repositories in temp folders. External sessions use fixture files in E2E_CLAUDE_DIR.
import { type ChildProcess, execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';
import { toggleThemeInSettings } from './settings';

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
// During a session switch the leaving view keeps its terminal until its fade ends (plan-ui_transitions/REQ-10).
const terminal = (page: Page) => page.locator('.main-view:not(.is-leaving) .xterm-rows');
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
  await entry(page, folder).getByTitle(folder, { exact: true }).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
}

/** Waits for the end of the opening slide of the panel (plan-ui_transitions/REQ-5), so its size is final. */
const slideEnded = (page: Page) => explorer(page).evaluate((panel) => Promise.all(panel.getAnimations().map((animation) => animation.finished)));

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
    await slideEnded(page);

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
    await slideEnded(page);
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
    await entry(page, repo).getByTitle(repo, { exact: true }).click();
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
    await slideEnded(page);
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
    await entry(page, plain).getByTitle(plain, { exact: true }).click();
    await expect(conversation(page)).toContainText('Hi there');
    expect(await (await lookup).json()).toEqual({ status: 'none' });
    await expect(externalHeader(page).getByRole('button', { name: 'Git Explorer', exact: true })).toHaveCount(0);
  });
});

const group = (page: Page, name: 'Staged' | 'Unstaged') => explorer(page).getByRole('group', { name, exact: true });
const fileEntry = (page: Page, name: 'Staged' | 'Unstaged', file: string) => group(page, name).getByRole('option').filter({ hasText: file });
// DiffView draws one table row per line, each with a single cell.
const diffLines = (page: Page) => explorer(page).locator('.diff-view td');
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
    await expect(group(page, 'Staged').getByRole('option')).toHaveCount(1);
    await expect(group(page, 'Unstaged').getByRole('option')).toHaveCount(2);
    const stagedBox = await box(group(page, 'Staged'));
    const unstagedBox = await box(group(page, 'Unstaged'));
    expect(stagedBox.y, '"Staged" is above "Unstaged"').toBeLessThan(unstagedBox.y);

    await fileEntry(page, 'Unstaged', 'lib/util.ts').click();
    await expect(fileEntry(page, 'Unstaged', 'lib/util.ts')).toHaveAttribute('aria-selected', 'true');
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
    await expect(fileEntry(page, 'Unstaged', 'logo.png')).toHaveAttribute('aria-selected', 'true');
    await expect(explorer(page)).toContainText('Binary file, no diff shown');
    expect(Date.now() - clicked, 'a click after the large diff answers within 2 s').toBeLessThan(2_000);
  });

  // plan-git_graph/REQ-1, REQ-2, REQ-3, REQ-4: human acceptance scenario "The user sees the uncommitted changes and their diff on the new components"
  test('the list box and the diff take their colours from the theme tokens, in the light and in the dark theme', async ({ page, request }) => {
    const repo = await newRepository('theme-repo');
    await writeFile(path.join(repo, 'notes.md'), 'keep\nold\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'notes');
    await writeFile(path.join(repo, 'staged.ts'), 'export const staged = 1;\n');
    git(repo, 'add', 'staged.ts');
    await writeFile(path.join(repo, 'notes.md'), 'keep\nadded line\n');
    await writeFile(path.join(repo, 'loose.txt'), 'loose\n');

    await openExplorer(page, request, repo);
    await expect(explorer(page).getByRole('listbox', { name: 'Changed files', exact: true })).toBeVisible();
    await expect(fileEntry(page, 'Staged', 'staged.ts')).toContainText('Added');
    await expect(fileEntry(page, 'Unstaged', 'notes.md')).toContainText('Modified');
    await expect(fileEntry(page, 'Unstaged', 'loose.txt')).toContainText('Untracked');
    await fileEntry(page, 'Unstaged', 'notes.md').click();
    await expect(fileEntry(page, 'Unstaged', 'notes.md')).toHaveAttribute('aria-selected', 'true');
    await expect(diffLines(page).filter({ hasText: /^\+added line$/ })).toHaveCount(1);
    await page.mouse.move(0, 0);

    const colours = async () => {
      const read = (locator: Locator, property: 'color' | 'backgroundColor') => locator.evaluate((el, p) => getComputedStyle(el)[p], property);
      return {
        added: await read(diffLines(page).filter({ hasText: /^\+added line$/ }), 'color'),
        addedTint: await read(diffLines(page).filter({ hasText: /^\+added line$/ }), 'backgroundColor'),
        removed: await read(diffLines(page).filter({ hasText: /^-old$/ }), 'color'),
        context: await read(diffLines(page).filter({ hasText: /^\s?keep$/ }), 'color'),
        hunk: await read(diffLines(page).filter({ hasText: /^@@ / }), 'color'),
        selected: await read(fileEntry(page, 'Unstaged', 'notes.md'), 'backgroundColor'),
      };
    };
    const tokens = async () => ({
      green: await cssColour(page, '--emerald-400'),
      red: await cssColour(page, '--color-error'),
      text: await cssColour(page, '--text-primary'),
      muted: await cssColour(page, '--text-muted'),
      cardActive: await cssColour(page, '--role-card-active'),
    });
    const expectThemeColours = async () => {
      const t = await tokens();
      // The selected row fades between themes: wait for its colour to settle.
      await expect
        .poll(() => fileEntry(page, 'Unstaged', 'notes.md').evaluate((el) => getComputedStyle(el).backgroundColor), { message: 'selected entry on the active card surface' })
        .toBe(t.cardActive);
      const c = await colours();
      expect(c.added, 'added line in the success colour').toBe(t.green);
      expect(c.removed, 'removed line in the error colour').toBe(t.red);
      expect(c.context, 'context line in the normal text colour').toBe(t.text);
      expect(c.hunk, 'hunk header muted').toBe(t.muted);
      expect(c.selected, 'selected entry on the active card surface').toBe(t.cardActive);
      expect(c.addedTint, 'added line on a tint').not.toBe('rgba(0, 0, 0, 0)');
      return c;
    };

    await toggleThemeInSettings(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.mouse.move(0, 0);
    const light = await expectThemeColours();

    await toggleThemeInSettings(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.mouse.move(0, 0);
    const dark = await expectThemeColours();
    expect(dark.added, 'the added colour changes with the theme').not.toBe(light.added);
    expect(dark.selected, 'the selected entry changes with the theme').not.toBe(light.selected);
    expect(dark.context, 'the text colour changes with the theme').not.toBe(light.context);
  });

  // plan-git_graph/REQ-2: the keyboard moves through the list box and selects an entry
  test('the arrow keys move between the entries and Enter shows the diff of the focused one', async ({ page, request }) => {
    const repo = await newRepository('keyboard-repo');
    await writeFile(path.join(repo, 'README.md'), 'hello\nmore\n');
    await writeFile(path.join(repo, 'a.txt'), 'alpha\n');
    await writeFile(path.join(repo, 'b.txt'), 'beta\n');
    await openExplorer(page, request, repo);

    const entries = group(page, 'Unstaged').getByRole('option');
    await expect(entries).toHaveCount(3);
    await entries.nth(0).click();
    await expect(entries.nth(0)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(entries.nth(1)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(entries.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(entries.nth(0)).toHaveAttribute('aria-selected', 'false');
    const name = (await entries.nth(1).getByTitle(/./).textContent()) ?? '';
    const expected = { 'README.md': /^\+more$/, 'a.txt': /^\+alpha$/, 'b.txt': /^\+beta$/ }[name];
    expect(expected, `known entry ${name}`).toBeDefined();
    await expect(diffLines(page).filter({ hasText: expected! })).toHaveCount(1);
    await page.keyboard.press('ArrowDown');
    await expect(entries.nth(2)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(entries.nth(2)).toHaveAttribute('aria-selected', 'true');
    await expect(group(page, 'Unstaged').getByRole('option', { selected: true })).toHaveCount(1);
  });

  // plan-git_graph/REQ-2: human acceptance scenario "The user sees a binary file and a clean repository"
  test('a binary file shows its note, and after a commit of every change "Refresh" shows "No uncommitted changes"', async ({ page, request }) => {
    const repo = await newRepository('binary-clean-repo');
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1]);
    await writeFile(path.join(repo, 'icon.png'), png);
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'icon');
    await writeFile(path.join(repo, 'icon.png'), Buffer.concat([png, Buffer.from([0, 3, 0, 5])]));

    await openExplorer(page, request, repo);
    await fileEntry(page, 'Unstaged', 'icon.png').click();
    await expect(explorer(page)).toContainText('Binary file, no diff shown');
    await expect(diffLines(page)).toHaveCount(0);

    git(repo, 'commit', '-q', '-a', '-m', 'icon again');
    await explorer(page).getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(explorer(page)).toContainText('No uncommitted changes');
    await expect(explorer(page)).not.toContainText('Binary file, no diff shown');
    await expect(explorer(page).getByRole('listbox', { name: 'Changed files', exact: true })).toHaveCount(0);
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

const tab = (page: Page, name: 'Changes' | 'History') => explorer(page).getByRole('tab', { name, exact: true });
const commitRows = (page: Page) => explorer(page).locator('[aria-label="Commits"]').getByRole('button');
const changedFiles = (page: Page) => explorer(page).getByRole('listbox', { name: 'Changed files', exact: true }).getByRole('option');
const backButton = (page: Page) => explorer(page).getByRole('button', { name: /^Back/ });
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1]);

/** DD/MM/YYYY HH:MM in local time. */
function localDate(iso: string): string {
  const d = new Date(iso);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** Status of the repository and its exit code, git's error output included, without touching the index. */
function gitStatus(folder: string): string {
  const result = spawnSync('git', ['--no-optional-locks', 'status', '--porcelain=v2'], { cwd: folder, encoding: 'utf8' });
  return `${result.status}\n${result.stdout}\n${result.stderr}`;
}

test.describe('History in the git explorer', () => {
  // plan-git_explorer/REQ-16, REQ-17, REQ-18, REQ-19: human acceptance scenario "The user browses the history and the diff of a commit"
  test('lists three commits newest first, shows the files of the newest and the diff of one file', async ({ page, request }) => {
    const repo = await newRepository('history-repo');
    await writeFile(path.join(repo, 'app.ts'), 'export const version = 1;\n');
    git(repo, 'add', '.');
    git(repo, '-c', 'user.name=Grace Hopper', 'commit', '-q', '-m', 'Add the app');
    await writeFile(path.join(repo, 'app.ts'), 'export const version = 2;\n');
    await writeFile(path.join(repo, 'notes.md'), 'notes\n');
    git(repo, 'add', '.');
    git(repo, '-c', 'user.name=Ada Lovelace', 'commit', '-q', '-m', 'Bump the version', '-m', 'Also add notes.');
    const log = git(repo, 'log', '--format=%h|%an|%aI').split('\n').map((line) => line.split('|'));

    await openExplorer(page, request, repo);
    await expect(tab(page, 'Changes')).toHaveAttribute('aria-selected', 'true');
    await tab(page, 'History').click();
    await expect(tab(page, 'History')).toHaveAttribute('aria-selected', 'true');

    await expect(commitRows(page)).toHaveCount(3);
    const subjects = ['Bump the version', 'Add the app', 'first'];
    for (const [index, subject] of subjects.entries()) {
      const [shortHash, author, date] = log[index]!;
      const row = commitRows(page).nth(index);
      await expect(row).toContainText(shortHash!);
      await expect(row).toContainText(subject);
      await expect(row).toContainText(author!);
      await expect(row).toContainText(localDate(date!));
    }
    await expect(commitRows(page).first()).not.toContainText('Also add notes.');

    await commitRows(page).first().click();
    await expect(explorer(page)).toContainText('Also add notes.');
    await expect(changedFiles(page)).toHaveCount(2);
    await expect(changedFiles(page).filter({ hasText: 'app.ts' })).toContainText('Modified');
    await expect(changedFiles(page).filter({ hasText: 'notes.md' })).toContainText('Added');

    await changedFiles(page).filter({ hasText: 'app.ts' }).click();
    await expect(changedFiles(page).filter({ hasText: 'app.ts' })).toHaveAttribute('aria-selected', 'true');
    await expect(diffLines(page).filter({ hasText: /^-export const version = 1;$/ })).toHaveCount(1);
    await expect(diffLines(page).filter({ hasText: /^\+export const version = 2;$/ })).toHaveCount(1);

    await backButton(page).click();
    await expect(commitRows(page)).toHaveCount(3);
  });

  // plan-git_explorer/REQ-20: human acceptance scenario "A new repository shows an empty history"
  test('a repository with no commits says "No commits yet" and shows no error', async ({ page, request }) => {
    const repo = path.join(await mkdtemp(path.join(projectsRoot, 'r-')), 'unborn-repo');
    await mkdir(repo);
    git(repo, 'init', '-q', '-b', 'main');
    await openExplorer(page, request, repo);
    await tab(page, 'History').click();
    await expect(explorer(page)).toContainText('No commits yet');
    await expect(explorer(page).getByRole('alert')).toHaveCount(0);
  });

  // plan-git_explorer/REQ-21, REQ-22: human acceptance scenario "A long history and a binary file in a commit"
  test('a history of 250 commits loads in pages, keeps the scroll on "Back", and an image of a commit shows the binary note', async ({ page, request }) => {
    test.setTimeout(90_000);
    const repo = await newRepository('long-repo');
    for (let i = 2; i <= 249; i++) git(repo, 'commit', '-q', '--allow-empty', '-m', `commit ${i}`);
    await writeFile(path.join(repo, 'logo.png'), PNG);
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'Add the logo');

    await openExplorer(page, request, repo);
    await tab(page, 'History').click();
    await expect(commitRows(page)).toHaveCount(100);
    const loadMore = explorer(page).getByRole('button', { name: 'Load more', exact: true });
    await loadMore.click();
    await expect(commitRows(page)).toHaveCount(200);
    await loadMore.click();
    const started = Date.now();
    await expect(commitRows(page)).toHaveCount(250);
    await expect(loadMore).toHaveCount(0);
    await expect(commitRows(page).last()).toContainText('first');

    // The page keeps reacting: the list scrolls, and a click answers at once.
    await commitRows(page).nth(240).scrollIntoViewIfNeeded();
    const scroller = await commitRows(page).first().evaluateHandle((row) => {
      let node: HTMLElement | null = row.parentElement;
      while (node && !(node.scrollHeight > node.clientHeight && /(auto|scroll)/.test(getComputedStyle(node).overflowY))) node = node.parentElement;
      return node;
    });
    const scrolled = await scroller.evaluate((node) => (node as HTMLElement).scrollTop);
    expect(scrolled, 'the list scrolled').toBeGreaterThan(0);
    await commitRows(page).nth(240).click();
    await expect(backButton(page)).toBeVisible();
    expect(Date.now() - started, 'the long list answers within 5 s').toBeLessThan(5_000);
    await backButton(page).click();
    await expect(commitRows(page).nth(240)).toBeVisible();
    expect(await scroller.evaluate((node) => (node as HTMLElement).scrollTop), 'same scroll position after "Back"').toBe(scrolled);

    await commitRows(page).first().scrollIntoViewIfNeeded();
    await commitRows(page).first().click();
    const logo = changedFiles(page).filter({ hasText: 'logo.png' });
    await expect(logo).toContainText('Added');
    await expect(logo).toContainText('Binary');
    await logo.click();
    await expect(explorer(page)).toContainText('Binary file, no diff shown');
    await expect(diffLines(page)).toHaveCount(0);
  });

  // plan-git_explorer/REQ-6, REQ-8: human acceptance scenario "A git error stays in the panel and changes nothing"
  test('a corrupt index shows the git error in "Changes", the client keeps working and the repository is unchanged', async ({ page, request }) => {
    const repo = await newRepository('corrupt-repo');
    const other = await newRepository('healthy-repo');
    await writeFile(path.join(repo, 'README.md'), 'changed\n');
    await writeFile(path.join(repo, '.git', 'index'), 'not an index');
    const indexBefore = await readFile(path.join(repo, '.git', 'index'));
    const statusBefore = gitStatus(repo);
    expect(statusBefore, 'git itself reports the corrupt index').toMatch(/index/i);
    await startHosted(request, other);

    await openExplorer(page, request, repo);
    await expect(tab(page, 'Changes')).toHaveAttribute('aria-selected', 'true');
    const alert = explorer(page).getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/index/i);
    await tab(page, 'History').click();
    await expect(commitRows(page)).toHaveCount(1);

    await expect(terminalPanel(page)).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasNotText: /index/i })).toHaveCount(0);
    await openHosted(page, other);
    await expect(list(page)).toBeVisible();

    expect(await readFile(path.join(repo, '.git', 'index'))).toEqual(indexBefore);
    expect(gitStatus(repo)).toBe(statusBefore);
    expect(await readFile(path.join(repo, 'README.md'), 'utf8')).toBe('changed\n');
  });
});

const refreshButton = (page: Page) => explorer(page).getByRole('button', { name: 'Refresh', exact: true });

/** An external session in `folder` whose state follows `setStatus` ("busy" is working). */
async function runExternalWithStatus(sessionId: string, folder: string, status: string): Promise<(next: string) => Promise<void>> {
  const file = transcriptPath(folder, sessionId);
  await mkdir(path.dirname(file), { recursive: true });
  const lines = [{ type: 'user', cwd: folder, isSidechain: false, message: { role: 'user', content: 'Hello' } }];
  await writeFile(file, lines.map((line) => `${JSON.stringify(line)}\n`).join(''));
  const process = spawn('sleep', ['300'], { stdio: 'ignore' });
  terminals.push(process);
  const pid = process.pid ?? 0;
  execFileSync('mkfifo', [path.join(SESSIONS_DIR, `${pid}.5a6b7c8d.key`)]);
  const write = (next: string) =>
    writeFile(path.join(SESSIONS_DIR, `${pid}.json`), JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status: next, updatedAt: Date.now() }));
  await write(status);
  return write;
}

test.describe('Refresh of the git explorer', () => {
  // plan-git_explorer/REQ-25, REQ-26: human acceptance scenario "The git explorer follows a turn of another session in the same repository"
  test('a turn end of a session in a subfolder of the repository refreshes the changes and the open diff with no click', async ({ page, request }) => {
    const repo = await newRepository('progetto');
    await mkdir(path.join(repo, 'frontend'));
    await writeFile(path.join(repo, 'README.md'), 'hello\nfirst edit\n');
    const setStatus = await runExternalWithStatus('8f1c2d3e-0000-4000-8000-000000000010', path.join(repo, 'frontend'), 'busy');

    await openExplorer(page, request, repo);
    await expect(entry(page, path.join(repo, 'frontend'))).toContainText('Running', SCAN);
    await fileEntry(page, 'Unstaged', 'README.md').click();
    await expect(diffLines(page).filter({ hasText: /^\+first edit$/ })).toHaveCount(1);

    await writeFile(path.join(repo, 'README.md'), 'hello\nfirst edit\nsecond edit\n');
    await writeFile(path.join(repo, 'frontend', 'new.ts'), 'export const fresh = true;\n');
    // No refresh before the turn ends: the panel does not poll.
    await page.waitForTimeout(3_000);
    await expect(fileEntry(page, 'Unstaged', 'frontend/new.ts')).toHaveCount(0);

    await setStatus('idle');
    await expect(entry(page, path.join(repo, 'frontend'))).toContainText('Idle', SCAN);
    await expect(fileEntry(page, 'Unstaged', 'frontend/new.ts')).toContainText('Untracked');
    await expect(fileEntry(page, 'Unstaged', 'README.md')).toHaveAttribute('aria-selected', 'true');
    await expect(diffLines(page).filter({ hasText: /^\+second edit$/ })).toHaveCount(1);
    await expect(diffLines(page).filter({ hasText: /^\+first edit$/ })).toHaveCount(1);
  });

  // plan-git_explorer/REQ-25: a session outside the repository does not refresh it
  test('a turn end of a session outside the repository does not refresh the panel', async ({ page, request }) => {
    const repo = await newRepository('quiet-repo');
    const other = await newPlainFolder('elsewhere');
    const setStatus = await runExternalWithStatus('8f1c2d3e-0000-4000-8000-000000000011', other, 'busy');

    await openExplorer(page, request, repo);
    await expect(entry(page, other)).toContainText('Running', SCAN);
    await expect(explorer(page)).toContainText('No uncommitted changes');
    await writeFile(path.join(repo, 'late.txt'), 'late\n');
    let changesReads = 0;
    page.on('request', (r) => {
      if (isChanges(r.url())) changesReads += 1;
    });
    await setStatus('idle');
    await expect(entry(page, other)).toContainText('Idle', SCAN);
    await page.waitForTimeout(1_000);
    expect(changesReads).toBe(0);
    await expect(explorer(page)).toContainText('No uncommitted changes');
  });

  // plan-git_explorer/REQ-24, REQ-26: human acceptance scenario "The user refreshes by hand"
  test('"Refresh" after restoring the open file removes it from the list and closes its diff', async ({ page, request }) => {
    const repo = await newRepository('manual-repo');
    await writeFile(path.join(repo, 'README.md'), 'hello\nchanged\n');
    await writeFile(path.join(repo, 'other.txt'), 'other\n');

    await openExplorer(page, request, repo);
    await expect(refreshButton(page)).toHaveAttribute('title', 'Refresh');
    await fileEntry(page, 'Unstaged', 'README.md').click();
    await expect(diffLines(page).filter({ hasText: /^\+changed$/ })).toHaveCount(1);

    git(repo, 'checkout', '--', 'README.md');
    await refreshButton(page).click();
    await expect(fileEntry(page, 'Unstaged', 'README.md')).toHaveCount(0);
    await expect(fileEntry(page, 'Unstaged', 'other.txt')).toBeVisible();
    await expect(diffLines(page)).toHaveCount(0);
    await expect(group(page, 'Unstaged').getByRole('option', { selected: true })).toHaveCount(0);
  });

  // plan-git_explorer/REQ-24: "Refresh" reads the history and the branch again
  test('"Refresh" shows a new commit in "History" and a new branch in the header', async ({ page, request }) => {
    const repo = await newRepository('refresh-history-repo');
    await openExplorer(page, request, repo);
    await tab(page, 'History').click();
    await expect(commitRows(page)).toHaveCount(1);

    git(repo, 'checkout', '-q', '-b', 'feature/refresh');
    await writeFile(path.join(repo, 'next.txt'), 'next\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'Add next');
    await refreshButton(page).click();
    await expect(commitRows(page)).toHaveCount(2);
    await expect(commitRows(page).first()).toContainText('Add next');
    await expect(explorer(page)).toContainText('feature/refresh');
  });

  // plan-git_explorer/REQ-24: the same button in the panel of an external session
  test('"Refresh" in the panel of an external session reads the changes and the branch again', async ({ page }) => {
    const repo = await newRepository('external-refresh-repo');
    await runExternal('8f1c2d3e-0000-4000-8000-000000000012', repo);
    await page.goto('/');
    await expect(entry(page, repo)).toBeVisible(SCAN);
    await entry(page, repo).getByTitle(repo, { exact: true }).click();
    await expect(conversation(page)).toContainText('Hi there');
    await externalHeader(page).getByRole('button', { name: 'Git Explorer', exact: true }).click();
    await expect(explorer(page)).toContainText('No uncommitted changes');

    await writeFile(path.join(repo, 'added.txt'), 'added\n');
    git(repo, 'checkout', '-q', '-b', 'ext-branch');
    await refreshButton(page).click();
    await expect(fileEntry(page, 'Unstaged', 'added.txt')).toContainText('Untracked');
    await expect(explorer(page)).toContainText('ext-branch');
  });

  // plan-git_explorer/REQ-23: human acceptance scenario "Opening the panel again reads the repository again"
  test('opening the panel again after a commit made in a terminal shows the new commit and no longer lists its files', async ({ page, request }) => {
    const repo = await newRepository('reopen-repo');
    await writeFile(path.join(repo, 'work.ts'), 'export const work = 1;\n');
    await openExplorer(page, request, repo);
    await expect(fileEntry(page, 'Unstaged', 'work.ts')).toBeVisible();
    await explorerButton(page).click();
    await expect(explorer(page)).toHaveCount(0);

    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'Commit the work');
    await explorerButton(page).click();
    await expect(explorer(page)).toContainText('No uncommitted changes');
    await tab(page, 'History').click();
    await expect(commitRows(page)).toHaveCount(2);
    await expect(commitRows(page).first()).toContainText('Commit the work');
  });

  // plan-git_explorer/REQ-26: an open commit closes when a refresh no longer lists it
  test('an open commit closes after a refresh when it is no longer in the history', async ({ page, request }) => {
    const repo = await newRepository('rewrite-repo');
    await writeFile(path.join(repo, 'a.txt'), 'a\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'To be dropped');
    await openExplorer(page, request, repo);
    await tab(page, 'History').click();
    await commitRows(page).filter({ hasText: 'To be dropped' }).click();
    await expect(backButton(page)).toBeVisible();

    git(repo, 'reset', '-q', '--hard', 'HEAD~1');
    await refreshButton(page).click();
    await expect(backButton(page)).toHaveCount(0);
    await expect(commitRows(page)).toHaveCount(1);
    await expect(commitRows(page).first()).toContainText('first');
  });
});

type Point = { x: number; y: number };
type Stroke = { from: Point; to: Point; colour: string; width: string; curve: boolean };
type GraphView = {
  rows: Array<{ top: number; bottom: number }>;
  /** Commit nodes in page coordinates, top to bottom; `shown` is false when a clipping box hides the node. */
  nodes: Array<Point & { shown: boolean; ring: string }>;
  strokes: Stroke[];
  shadows: number;
};

/** The commit graph of the History tab as drawn on the page: rows, nodes and lines in page coordinates. */
async function readGraph(page: Page): Promise<GraphView> {
  return explorer(page).evaluate((panel) => {
    const list = panel.querySelector('[aria-label="Commits"]')!;
    const rows = [...list.querySelectorAll('button')].map((row) => {
      const r = row.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    });
    const svg = panel.querySelector<SVGSVGElement>('[aria-hidden="true"] svg');
    if (svg === null) return { rows, nodes: [], strokes: [], shadows: 0 };
    const ctm = svg.getScreenCTM()!;
    const toPage = (x: number, y: number) => {
      const p = new DOMPoint(x, y).matrixTransform(ctm);
      return { x: p.x, y: p.y };
    };
    let scroller: Element | null = list.parentElement;
    while (scroller !== null && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    // Clipping boxes up to the scroller of the list only: the boxes above it clip the rows as well.
    const clipped = (el: Element, p: { x: number; y: number }) => {
      for (let node = el.parentElement; node !== null && node !== scroller; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (![style.overflowX, style.overflowY].some((o) => o !== 'visible')) continue;
        const r = node.getBoundingClientRect();
        if (p.x < r.left || p.x > r.right || p.y < r.top || p.y > r.bottom) return true;
      }
      return false;
    };
    const nodes = [...svg.querySelectorAll('g')]
      .map((g) => [...g.querySelectorAll('circle')])
      .filter((circles) => circles.length > 0)
      .map((circles) => {
        const centre = toPage(circles[0]!.cx.baseVal.value, circles[0]!.cy.baseVal.value);
        const ring = circles.find((c) => c.hasAttribute('stroke')) ?? circles[0]!;
        return { ...centre, shown: !clipped(svg, centre), ring: getComputedStyle(ring).stroke };
      })
      .sort((a, b) => a.y - b.y);
    const strokes = [...svg.querySelectorAll<SVGGeometryElement>('line, path')].map((el) => {
      const length = el.getTotalLength();
      const start = el.getPointAtLength(0);
      const end = el.getPointAtLength(length);
      const style = getComputedStyle(el);
      return { from: toPage(start.x, start.y), to: toPage(end.x, end.y), colour: style.stroke, width: style.strokeWidth, curve: el.tagName === 'path' };
    });
    const shadows = [...svg.querySelectorAll('g')].filter((g) => getComputedStyle(g).filter !== 'none').length;
    return { rows, nodes, strokes, shadows };
  });
}

const NEAR = 6;
const close = (a: Point, b: Point) => Math.abs(a.x - b.x) <= NEAR && Math.abs(a.y - b.y) <= NEAR;
/** Vertical strokes of the lane at x. */
const laneStrokes = (graph: GraphView, x: number) => graph.strokes.filter((s) => !s.curve && Math.abs(s.from.x - x) <= 2 && Math.abs(s.to.x - x) <= 2);
/** The lane at x is drawn with no gap from y1 to y2. */
function laneCovers(graph: GraphView, x: number, y1: number, y2: number): boolean {
  const spans = laneStrokes(graph, x)
    .map((s) => [Math.min(s.from.y, s.to.y), Math.max(s.from.y, s.to.y)] as const)
    .sort((a, b) => a[0] - b[0]);
  let reached = y1;
  for (const [top, bottom] of spans) if (top <= reached + 2) reached = Math.max(reached, bottom);
  return reached >= y2 - 2;
}
/** A stroke joins the two nodes: its ends sit on them, or a vertical lane runs through both. */
const joined = (graph: GraphView, a: Point, b: Point) =>
  graph.strokes.some((s) => (close(s.from, a) && close(s.to, b)) || (close(s.from, b) && close(s.to, a))) ||
  (Math.abs(a.x - b.x) <= 2 && laneCovers(graph, a.x, Math.min(a.y, b.y), Math.max(a.y, b.y)));
const shownNodes = (graph: GraphView) => graph.nodes.filter((n) => n.shown);

/** A commit with fixed author and committer dates. */
function commitAt(folder: string, date: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=Grace Hopper', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], {
    cwd: folder,
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
  });
}

/**
 * main: "first", "main work", "Merge feature" (newest); feature, from "first": "feature one" (logo.png, feature.txt),
 * "feature two". In date order: Merge feature, feature two, main work, feature one, first.
 */
async function mergedRepository(name: string): Promise<string> {
  const root = path.join(await mkdtemp(path.join(projectsRoot, 'r-')), name);
  await mkdir(root);
  git(root, 'init', '-q', '-b', 'main');
  await writeFile(path.join(root, 'README.md'), 'hello\n');
  git(root, 'add', '.');
  commitAt(root, '2026-01-10T10:00:00Z', 'commit', '-q', '-m', 'first');
  git(root, 'checkout', '-q', '-b', 'feature');
  await writeFile(path.join(root, 'feature.txt'), 'alpha\n');
  await writeFile(path.join(root, 'logo.png'), PNG);
  git(root, 'add', '.');
  commitAt(root, '2026-01-11T10:00:00Z', 'commit', '-q', '-m', 'feature one');
  await writeFile(path.join(root, 'feature.txt'), 'alpha\nbeta\n');
  commitAt(root, '2026-01-13T10:00:00Z', 'commit', '-q', '-a', '-m', 'feature two');
  git(root, 'checkout', '-q', 'main');
  await writeFile(path.join(root, 'README.md'), 'hello again\n');
  commitAt(root, '2026-01-12T10:00:00Z', 'commit', '-q', '-a', '-m', 'main work');
  commitAt(root, '2026-01-14T10:00:00Z', 'merge', '-q', '--no-ff', '-m', 'Merge feature', 'feature');
  return root;
}

async function openHistory(page: Page, request: APIRequestContext, repo: string): Promise<void> {
  await openExplorer(page, request, repo);
  await tab(page, 'History').click();
  await expect(tab(page, 'History')).toHaveAttribute('aria-selected', 'true');
}

test.describe('Graph history in the git explorer', () => {
  // plan-git_graph/REQ-3, REQ-8, REQ-9, REQ-10, REQ-12, REQ-13: human acceptance scenario "The user reads the history of a branch with a merge as a graph"
  test('shows the history with a merge as a graph, newest first, with "main" on the tip and a line from the merge to each parent', async ({ page, request }) => {
    const repo = await mergedRepository('graph-repo');
    const log = git(repo, 'log', '--date-order', '--format=%h|%s|%an|%aI').split('\n').map((line) => line.split('|'));
    expect(log.map((entry) => entry[1])).toEqual(['Merge feature', 'feature two', 'main work', 'feature one', 'first']);

    await openHistory(page, request, repo);
    await expect(commitRows(page)).toHaveCount(5);
    for (const [index, [shortHash, subject, author, date]] of log.entries()) {
      const row = commitRows(page).nth(index);
      await expect(row).toContainText(shortHash!);
      await expect(row).toContainText(subject!);
      await expect(row).toContainText(author!);
      await expect(row).toContainText(localDate(date!));
    }
    await expect(commitRows(page).first().getByText('main', { exact: true })).toBeVisible();
    for (let index = 1; index < 5; index++) await expect(commitRows(page).nth(index).getByText('main', { exact: true })).toHaveCount(0);

    const graph = await readGraph(page);
    const nodes = shownNodes(graph);
    expect(nodes, 'one node per row').toHaveLength(5);
    for (const [index, node] of nodes.entries()) {
      const row = graph.rows[index]!;
      expect(Math.abs(node.y - (row.top + row.bottom) / 2), `node ${index} in the middle of its row`).toBeLessThanOrEqual(3);
    }
    const [merge, featureTwo, mainWork, featureOne, first] = nodes;
    expect(featureTwo!.x, 'the second parent in a lane to the right').toBeGreaterThan(merge!.x);
    expect(joined(graph, merge!, mainWork!), 'merge → first parent "main work"').toBe(true);
    expect(joined(graph, merge!, featureTwo!), 'merge → second parent "feature two"').toBe(true);
    expect(joined(graph, featureTwo!, featureOne!), 'feature two → feature one').toBe(true);
    expect(joined(graph, mainWork!, first!), 'main work → first').toBe(true);
    await expect(explorer(page).getByRole('alert')).toHaveCount(0);
  });

  // plan-git_graph/REQ-12: on a detached HEAD the tip says "detached"
  test('labels the tip "detached" on a detached HEAD', async ({ page, request }) => {
    const repo = await newRepository('graph-detached-repo');
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'second');
    git(repo, 'checkout', '-q', '--detach');
    await openHistory(page, request, repo);
    await expect(commitRows(page)).toHaveCount(2);
    await expect(commitRows(page).first().getByText('detached', { exact: true })).toBeVisible();
    await expect(commitRows(page).nth(1).getByText('detached', { exact: true })).toHaveCount(0);
  });

  // plan-git_graph/REQ-14, REQ-15, REQ-16: human acceptance scenario "The user opens the files and a diff of a merge commit"
  test('the merge commit lists its files against the first parent, shows the diff of one and the binary note of an image', async ({ page, request }) => {
    const repo = await mergedRepository('graph-merge-files-repo');
    await openHistory(page, request, repo);
    await commitRows(page).filter({ hasText: 'Merge feature' }).click();
    await expect(backButton(page)).toBeVisible();
    await expect(changedFiles(page)).toHaveCount(2);
    await expect(changedFiles(page).filter({ hasText: 'feature.txt' })).toContainText('Added');
    const logo = changedFiles(page).filter({ hasText: 'logo.png' });
    await expect(logo).toContainText('Added');
    await expect(logo).toContainText('Binary');
    await expect(changedFiles(page).filter({ hasText: 'README.md' }), 'a change of the first parent is not a change of the merge').toHaveCount(0);

    await changedFiles(page).filter({ hasText: 'feature.txt' }).click();
    await expect(changedFiles(page).filter({ hasText: 'feature.txt' })).toHaveAttribute('aria-selected', 'true');
    await expect(diffLines(page).filter({ hasText: /^\+alpha$/ })).toHaveCount(1);
    await expect(diffLines(page).filter({ hasText: /^\+beta$/ })).toHaveCount(1);
    await expect(diffLines(page).filter({ hasText: /^-/ })).toHaveCount(0);

    await logo.click();
    await expect(logo).toHaveAttribute('aria-selected', 'true');
    await expect(explorer(page)).toContainText('Binary file, no diff shown');
    await expect(diffLines(page)).toHaveCount(0);
  });

  // plan-git_graph/REQ-11, REQ-18, REQ-19: human acceptance scenario "The user loads a long history"
  test('a long history with no merges stays one straight line, and "Load more" joins the line with no gap', async ({ page, request }) => {
    test.setTimeout(90_000);
    const repo = await newRepository('graph-long-repo');
    for (let i = 2; i <= 150; i++) git(repo, 'commit', '-q', '--allow-empty', '-m', `commit ${i}`);
    await openHistory(page, request, repo);
    await expect(commitRows(page)).toHaveCount(100);

    const before = await readGraph(page);
    const firstPage = shownNodes(before);
    expect(firstPage, 'one node per row, no node for the unloaded parent').toHaveLength(100);
    expect(new Set(firstPage.map((n) => Math.round(n.x))).size, 'one lane').toBe(1);
    expect(before.strokes.filter((s) => s.curve), 'no curves').toHaveLength(0);
    const lastRow = before.rows[99]!;
    expect(laneCovers(before, firstPage[0]!.x, firstPage[0]!.y, lastRow.bottom), 'the line runs to the bottom edge of the last row').toBe(true);

    const started = Date.now();
    await explorer(page).getByRole('button', { name: 'Load more', exact: true }).click();
    await expect(commitRows(page)).toHaveCount(150);
    await commitRows(page).nth(120).click();
    await expect(backButton(page)).toBeVisible();
    expect(Date.now() - started, 'the page answers within 5 s').toBeLessThan(5_000);
    await backButton(page).click();

    const after = await readGraph(page);
    const all = shownNodes(after);
    expect(all).toHaveLength(150);
    expect(new Set(all.map((n) => Math.round(n.x))).size, 'still one lane').toBe(1);
    expect(after.strokes.filter((s) => s.curve)).toHaveLength(0);
    for (const index of [0, 99, 100, 149]) {
      const row = after.rows[index]!;
      expect(Math.abs(all[index]!.y - (row.top + row.bottom) / 2), `node ${index} in the middle of its row`).toBeLessThanOrEqual(3);
    }
    expect(laneCovers(after, all[0]!.x, all[0]!.y, all[149]!.y), 'no gap across the page border').toBe(true);
  });

  // plan-git_graph/REQ-17: human acceptance scenario "The user opens the history of a repository with no commits"
  test('a repository with no commits shows "No commits yet", no rows and no error', async ({ page, request }) => {
    const repo = path.join(await mkdtemp(path.join(projectsRoot, 'r-')), 'graph-unborn-repo');
    await mkdir(repo);
    git(repo, 'init', '-q', '-b', 'main');
    await openHistory(page, request, repo);
    await expect(explorer(page)).toContainText('No commits yet');
    await expect(explorer(page).getByRole('alert')).toHaveCount(0);
    await expect(commitRows(page)).toHaveCount(0);
  });

  // plan-git_graph/REQ-4: lane colours from the theme tokens, in the dark and in the light theme
  test('the graph lanes take the theme colours, 2 px with no shadow, and follow a theme switch', async ({ page, request }) => {
    const repo = await mergedRepository('graph-theme-repo');
    await openHistory(page, request, repo);
    await expect(commitRows(page)).toHaveCount(5);

    const expectThemeColours = async () => {
      const graph = await readGraph(page);
      const [merge, featureTwo] = shownNodes(graph);
      const primary = await cssColour(page, '--accent-primary');
      const second = await cssColour(page, '--emerald-400');
      const panel = await cssColour(page, '--bg-surface-1');
      const firstLane = laneStrokes(graph, merge!.x);
      const secondLane = laneStrokes(graph, featureTwo!.x);
      expect(firstLane.length, 'a line in the first lane').toBeGreaterThan(0);
      expect(secondLane.length, 'a line in the second lane').toBeGreaterThan(0);
      for (const s of firstLane) expect(s.colour, 'first lane in accent primary').toBe(primary);
      for (const s of secondLane) expect(s.colour, 'second lane in emerald 400').toBe(second);
      for (const s of graph.strokes) expect(s.width).toBe('2px');
      expect(graph.shadows, 'no shadow').toBe(0);
      for (const n of shownNodes(graph)) expect(n.ring, 'node ring in the panel colour').toBe(panel);
      return { primary, second };
    };

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const dark = await expectThemeColours();
    await toggleThemeInSettings(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect.poll(async () => laneStrokes(await readGraph(page), shownNodes(await readGraph(page))[0]!.x)[0]?.colour).not.toBe(dark.primary);
    const light = await expectThemeColours();
    expect(light.primary, 'the lane colour changes with the theme').not.toBe(dark.primary);
  });
});

const repoRoot = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const PERMISSIVE = /^(MIT|ISC|Apache-2\.0|BSD-2-Clause|BSD-3-Clause|0BSD)$/;

test.describe('Licences of the git explorer components', () => {
  // plan-git_graph/REQ-6, REQ-7: human acceptance scenario "The user finds the licences of the new components"
  for (const name of ['react-diff-view', 'react-aria-components', 'commit-graph']) {
    test(`${name} has a permissive licence, a notice with its version and licence text, and an entry in the licences of the build`, async ({ request }) => {
      const manifest = JSON.parse(await readFile(path.join(repoRoot, 'node_modules', name, 'package.json'), 'utf8')) as { version: string; license: string };
      expect(manifest.license, 'permissive licence').toMatch(PERMISSIVE);

      const notices = await readFile(path.join(repoRoot, 'THIRD-PARTY-NOTICES.md'), 'utf8');
      const entry = notices.split(/^## /m).find((section) => section.includes(`${name} ${manifest.version}`));
      expect(entry, `a notice of ${name} ${manifest.version}`).toBeDefined();
      expect(entry).toContain(manifest.license);
      const licenceFile = [...entry!.matchAll(/`([^`]+\.LICENSE)`/g)].map((m) => m[1]!)[0];
      expect(licenceFile, 'the path of its licence text').toBeDefined();
      const shipped = await readFile(path.join(repoRoot, licenceFile!), 'utf8');
      const original = await readFile(path.join(repoRoot, 'node_modules', name, 'LICENSE'), 'utf8');
      expect(shipped.trim(), 'the licence text of the package').toBe(original.trim());

      // The browser page and the desktop window load the same web build.
      const built = await request.get('/third-party-licenses.md');
      expect(built.status()).toBe(200);
      expect(await built.text()).toContain(`## ${name} - ${manifest.version} (${manifest.license})`);
    });
  }

  // plan-git_graph/REQ-7: the packages commit-graph copies into its bundle
  test('the dependency licence list names the packages that commit-graph bundles', async () => {
    const manifest = JSON.parse(await readFile(path.join(repoRoot, 'node_modules', 'commit-graph', 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    const list = await readFile(path.join(repoRoot, 'docs', 'dependency-licenses.md'), 'utf8');
    for (const dependency of Object.keys(manifest.dependencies ?? {})) expect(list, dependency).toContain(`| ${dependency}@`);
  });
});

/** A repository on `main` with one commit at `relative` below `parent`. */
async function repositoryAt(parent: string, relative: string): Promise<string> {
  const root = path.join(parent, relative);
  await mkdir(root, { recursive: true });
  git(root, 'init', '-q', '-b', 'main');
  await writeFile(path.join(root, 'README.md'), 'hello\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'first');
  return root;
}

/**
 * The workspace of the human acceptance scenarios: a plain folder with `api` (and its submodule `libs/sub`) and `web/app`,
 * plus repositories that detection must leave out: `a/b/c/d/deep` (level 5) and `node_modules/pkg`.
 */
async function newWorkspace(name: string): Promise<string> {
  const ws = await newPlainFolder(name);
  const api = await repositoryAt(ws, 'api');
  const source = await repositoryAt(path.dirname(ws), 'sub-source');
  git(api, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', source, 'libs/sub');
  git(api, 'commit', '-q', '-m', 'add submodule');
  await repositoryAt(ws, 'web/app');
  await repositoryAt(ws, 'a/b/c/d/deep');
  await repositoryAt(ws, 'node_modules/pkg');
  return ws;
}

const repositoryList = (page: Page) => explorer(page).getByRole('list', { name: 'Repositories', exact: true });
const repositoryEntries = (page: Page) => repositoryList(page).getByRole('listitem');
const repositoryEntry = (page: Page, root: string) => repositoryEntries(page).filter({ has: page.getByTitle(root, { exact: true }) });
/** The relative path of each entry of the repository list, in order. */
const listedPaths = (page: Page) => repositoryEntries(page).locator('.git-repository-path').allTextContents();

test.describe('Git explorer of a workspace with several repositories', () => {
  // plan-multi_repo_workspace/REQ-1 to REQ-5, REQ-7, REQ-8: human acceptance scenario "The user sees every repository of a workspace folder"
  test('lists api, then web/app, with colour, path and branch, and leaves out level 5, node_modules and the submodule', async ({ page, request }) => {
    const ws = await newWorkspace('workspace');
    await openExplorer(page, request, ws);

    await expect(repositoryList(page)).toBeVisible();
    await expect.poll(() => listedPaths(page)).toEqual(['api', 'web/app']);
    const api = repositoryEntry(page, path.join(ws, 'api'));
    const app = repositoryEntry(page, path.join(ws, 'web', 'app'));
    await expect(api.locator('.git-repository-name')).toHaveText('api');
    await expect(app.locator('.git-repository-name')).toHaveText('app');
    await expect(api).toContainText('main');
    await expect(app).toContainText('main');
    const colours = await repositoryEntries(page)
      .locator('.git-repository-mark')
      .evaluateAll((marks) => marks.map((m) => getComputedStyle(m).backgroundColor));
    expect(colours).toHaveLength(2);
    expect(colours[0], 'each repository has its own colour').not.toBe(colours[1]);
    expect(colours.every((c) => c !== 'rgba(0, 0, 0, 0)'), colours.join(' | ')).toBe(true);
    await expect(explorer(page)).not.toContainText('deep');
    await expect(explorer(page)).not.toContainText('pkg');
    await expect(explorer(page)).not.toContainText('libs/sub');
  });

  // plan-multi_repo_workspace/REQ-10: human acceptance scenario "The user finds a new repository after a refresh"
  test('a repository created in the folder appears in path order after "Refresh"', async ({ page, request }) => {
    const ws = await newWorkspace('refreshed');
    await openExplorer(page, request, ws);
    await expect.poll(() => listedPaths(page)).toEqual(['api', 'web/app']);

    git(ws, 'init', '-q', '-b', 'main', 'tools');
    await explorer(page).getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect.poll(() => listedPaths(page)).toEqual(['api', 'tools', 'web/app']);
  });

  // plan-multi_repo_workspace/REQ-11: human acceptance scenario "The git explorer refreshes after a turn in a nested repository"
  test('a turn end of a session in a nested repository refreshes the list with no click', async ({ page, request }) => {
    const ws = await newWorkspace('turn-end');
    const api = path.join(ws, 'api');
    const setStatus = await runExternalWithStatus('8f1c2d3e-0000-4000-8000-000000000101', api, 'busy');
    await openExplorer(page, request, ws);
    await expect(entry(page, api)).toContainText('Running', SCAN);
    await expect.poll(() => listedPaths(page)).toEqual(['api', 'web/app']);

    await repositoryAt(api, 'plugins/x');
    await setStatus('idle');
    await expect(entry(page, api)).toContainText('Idle', SCAN);
    await expect.poll(() => listedPaths(page), SCAN).toEqual(['api', 'api/plugins/x', 'web/app']);
  });

  // plan-multi_repo_workspace/REQ-9: human acceptance scenario "The user sees one failing repository among the others"
  test('a damaged repository shows the git message on its entry and the others keep their branch', async ({ page, request }) => {
    const ws = await newWorkspace('damaged');
    const app = path.join(ws, 'web', 'app');
    await rm(path.join(app, '.git'), { recursive: true, force: true });
    await writeFile(path.join(app, '.git'), `gitdir: ${path.join(ws, 'missing-gitdir')}\n`);
    await openExplorer(page, request, ws);

    await expect.poll(() => listedPaths(page)).toEqual(['api', 'web/app']);
    const broken = repositoryEntry(page, app).locator('.git-repository-error');
    await expect(broken).toBeVisible();
    expect((await broken.textContent())?.trim().length, 'a git message').toBeGreaterThan(0);
    await expect(repositoryEntry(page, app)).not.toContainText('main');
    await expect(repositoryEntry(page, path.join(ws, 'api'))).toContainText('main');
  });

  // plan-multi_repo_workspace/REQ-13: human acceptance scenario "A single repository looks as today"
  test('a single repository shows its name and branch chip in the header, with no repository list', async ({ page, request }) => {
    const repo = await newRepository('single-repo');
    await openExplorer(page, request, repo);
    await expectRepositoryShown(page, repo, 'main');
    await expect(repositoryList(page)).toHaveCount(0);
    await expect(explorer(page).getByRole('tab', { name: 'Changes' })).toBeVisible();
  });

  // plan-multi_repo_workspace/REQ-6: human acceptance scenario "A folder with no repository has no git explorer", with nested plain folders
  test('a folder with only plain subfolders and a repository at level 5 shows no "Git Explorer" button', async ({ page, request }) => {
    const plain = await newPlainFolder('no-repos');
    await mkdir(path.join(plain, 'a', 'b'), { recursive: true });
    await repositoryAt(plain, 'v/w/x/y/z');
    await startHosted(request, plain);
    await page.goto('/');
    const lookup = page.waitForResponse((r) => isLookup(r.url()));
    await openHosted(page, plain);
    expect(await (await lookup).json()).toEqual({ status: 'none' });
    await expect(header(page).getByRole('button', { name: 'Search', exact: true })).toBeVisible();
    await expect(explorerButton(page)).toHaveCount(0);
  });

  // plan-multi_repo_workspace/REQ-12: human acceptance scenario "A large folder does not block the client"
  test('detection in a folder with thousands of subfolders leaves the page and the session list responsive', async ({ page, request }) => {
    test.setTimeout(120_000);
    const big = await newPlainFolder('big');
    const leaves: string[] = [];
    for (let a = 0; a < 16; a += 1) for (let b = 0; b < 16; b += 1) for (let c = 0; c < 16; c += 1) leaves.push(path.join(big, `a${a}`, `b${b}`, `c${c}`, 'd'));
    for (let i = 0; i < leaves.length; i += 500) await Promise.all(leaves.slice(i, i + 500).map((leaf) => mkdir(leaf, { recursive: true })));
    await repositoryAt(big, 'a7/b7/c7/repo');
    await startHosted(request, big);

    await page.goto('/');
    await openHosted(page, big);
    // The detection of the session runs now: the server keeps answering and the page keeps reacting meanwhile.
    const started = Date.now();
    const sessions = await request.get('/api/sessions');
    expect(sessions.ok()).toBe(true);
    expect(Date.now() - started, 'the session list answers during detection').toBeLessThan(2_000);
    expect(await page.evaluate(() => 1 + 1)).toBe(2);
    await expect(list(page)).toBeVisible();

    await expect(explorerButton(page)).toBeVisible({ timeout: 60_000 });
    await explorerButton(page).click();
    await expectRepositoryShown(page, path.join(big, 'a7', 'b7', 'c7', 'repo'), 'main');
  });
});


const repositoryGroup = (page: Page, name: string) => explorer(page).getByRole('region', { name, exact: true });
const groupFiles = (page: Page, repository: string, name: 'Staged' | 'Unstaged') =>
  repositoryGroup(page, repository).getByRole('group', { name, exact: true }).getByRole('option');
/** The colours drawn in an element and its descendants, background and text, with no transparent ones. */
const drawnColours = (locator: Locator) =>
  locator.evaluate((root) =>
    [root, ...root.querySelectorAll('*')]
      .flatMap((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color])
      .filter((c) => c !== 'rgba(0, 0, 0, 0)'),
  );

test.describe('Grouped changes of a workspace with several repositories', () => {
  // plan-multi_repo_workspace/REQ-14, REQ-15, REQ-16, REQ-17: human acceptance scenario "The user reads the changes of every repository, grouped"
  test('shows the group api, then the group web/app, with their colours; api splits staged and unstaged, web/app has no changes', async ({ page, request }) => {
    const ws = await newWorkspace('grouped');
    const api = path.join(ws, 'api');
    await writeFile(path.join(api, 'staged.ts'), 'export const staged = 1;\n');
    git(api, 'add', 'staged.ts');
    await writeFile(path.join(api, 'README.md'), 'hello api\n');
    await openExplorer(page, request, ws);

    const apiGroup = repositoryGroup(page, 'api');
    const appGroup = repositoryGroup(page, 'app');
    await expect(apiGroup).toBeVisible();
    await expect(appGroup).toBeVisible();
    expect((await box(apiGroup)).y, 'api comes before web/app').toBeLessThan((await box(appGroup)).y);

    await expect(groupFiles(page, 'api', 'Staged')).toHaveCount(1);
    await expect(groupFiles(page, 'api', 'Staged').first()).toContainText('staged.ts');
    await expect(groupFiles(page, 'api', 'Unstaged')).toHaveCount(1);
    await expect(groupFiles(page, 'api', 'Unstaged').first()).toContainText('README.md');
    expect((await box(apiGroup.getByRole('group', { name: 'Staged', exact: true }))).y).toBeLessThan(
      (await box(apiGroup.getByRole('group', { name: 'Unstaged', exact: true }))).y,
    );
    await expect(appGroup).toContainText('No uncommitted changes');
    await expect(appGroup.getByRole('option')).toHaveCount(0);
    await expect(apiGroup).not.toContainText('No uncommitted changes');

    for (const [name, root] of [['api', api], ['app', path.join(ws, 'web', 'app')]] as const) {
      const entryColour = await repositoryEntry(page, root).locator('.git-repository-mark').evaluate((m) => getComputedStyle(m).backgroundColor);
      await expect(repositoryGroup(page, name).getByTitle(root, { exact: true })).toContainText(name);
      expect(await drawnColours(repositoryGroup(page, name).getByTitle(root, { exact: true })), `${name}: header colour`).toContain(entryColour);
    }
  });

  // plan-multi_repo_workspace/REQ-18: human acceptance scenario "The user opens a diff in a nested repository"
  test('after an edit in web/app and "Refresh", a click on its file shows its diff in web/app below the list', async ({ page, request }) => {
    const ws = await newWorkspace('nested-diff');
    await writeFile(path.join(ws, 'api', 'README.md'), 'hello api\n');
    await openExplorer(page, request, ws);
    await expect(repositoryGroup(page, 'app')).toContainText('No uncommitted changes');

    await writeFile(path.join(ws, 'web', 'app', 'README.md'), 'hello app\n');
    await explorer(page).getByRole('button', { name: 'Refresh', exact: true }).click();
    const appFile = groupFiles(page, 'app', 'Unstaged').filter({ hasText: 'README.md' });
    await expect(appFile).toHaveCount(1);
    const diffRequest = page.waitForRequest((r) => new URL(r.url()).pathname === '/api/git/diff');
    await appFile.click();
    expect(new URL((await diffRequest).url()).searchParams.get('path')).toBe(path.join(ws, 'web', 'app'));
    await expect(appFile).toHaveAttribute('aria-selected', 'true');
    await expect(groupFiles(page, 'api', 'Unstaged').filter({ hasText: 'README.md' })).toHaveAttribute('aria-selected', 'false');
    await expect(diffLines(page).filter({ hasText: /^\+hello app$/ })).toHaveCount(1);
    await expect(diffLines(page).filter({ hasText: /^\+hello api$/ })).toHaveCount(0);
    const diffTop = (await box(diffLines(page).first())).y;
    expect((await box(repositoryGroup(page, 'app'))).y, 'the diff is below the groups').toBeLessThan(diffTop);
    expect(diffTop).toBeGreaterThan((await box(repositoryGroup(page, 'api'))).y);
  });

  // plan-multi_repo_workspace/REQ-19: human acceptance scenario "The user sees one group fail while the others still show"
  test('a damaged web/app shows the git message in its group, and api shows its files', async ({ page, request }) => {
    const ws = await newWorkspace('damaged-changes');
    await writeFile(path.join(ws, 'api', 'README.md'), 'hello api\n');
    const app = path.join(ws, 'web', 'app');
    await rm(path.join(app, '.git'), { recursive: true, force: true });
    await writeFile(path.join(app, '.git'), `gitdir: ${path.join(ws, 'missing-gitdir')}\n`);
    await openExplorer(page, request, ws);

    const alert = repositoryGroup(page, 'app').getByRole('alert');
    await expect(alert).toBeVisible();
    expect((await alert.textContent())?.trim().length, 'a git message').toBeGreaterThan(0);
    await expect(repositoryGroup(page, 'api').getByRole('alert')).toHaveCount(0);
    await expect(groupFiles(page, 'api', 'Unstaged').filter({ hasText: 'README.md' })).toHaveCount(1);
  });

  // plan-multi_repo_workspace/REQ-20: human acceptance scenario "The changes of a single repository look as today"
  test('a single repository with changes shows "Staged" and "Unstaged" with no repository group', async ({ page, request }) => {
    const repo = await newRepository('single-changes');
    await writeFile(path.join(repo, 'added.ts'), 'export const a = 1;\n');
    git(repo, 'add', 'added.ts');
    await writeFile(path.join(repo, 'README.md'), 'changed\n');
    await openExplorer(page, request, repo);

    await expect(fileEntry(page, 'Staged', 'added.ts')).toContainText('Added');
    await expect(fileEntry(page, 'Unstaged', 'README.md')).toContainText('Modified');
    await expect(changedFiles(page)).toHaveCount(2);
    await expect(repositoryGroup(page, 'single-changes')).toHaveCount(0);
    await expect(explorer(page).locator('.changes-repository-title')).toHaveCount(0);
  });
});

/** An empty commit, or a commit of every change with `-a`, at `date` (author and committer). */
const commitOn = (folder: string, date: string, message: string, ...args: string[]) => commitAt(folder, date, 'commit', '-q', '--allow-empty', ...args, '-m', message);

/**
 * The workspace of the combined history scenarios: `api` on `main` with a merge, `web/app` on `develop`, commits on different days.
 * Newest first: app third, Merge api feature, app second, api main work, api feature, app first, api first.
 */
async function historyWorkspace(name: string): Promise<{ ws: string; api: string; app: string }> {
  const ws = await newPlainFolder(name);
  const api = path.join(ws, 'api');
  await mkdir(api, { recursive: true });
  git(api, 'init', '-q', '-b', 'main');
  commitOn(api, '2026-01-10T10:00:00Z', 'api first');
  git(api, 'checkout', '-q', '-b', 'feature');
  commitOn(api, '2026-01-12T10:00:00Z', 'api feature');
  git(api, 'checkout', '-q', 'main');
  commitOn(api, '2026-01-13T10:00:00Z', 'api main work');
  commitAt(api, '2026-01-15T10:00:00Z', 'merge', '-q', '--no-ff', '-m', 'Merge api feature', 'feature');
  const app = path.join(ws, 'web', 'app');
  await mkdir(app, { recursive: true });
  git(app, 'init', '-q', '-b', 'develop');
  await writeFile(path.join(app, 'app.txt'), 'app first\n');
  git(app, 'add', '.');
  commitOn(app, '2026-01-11T10:00:00Z', 'app first');
  await writeFile(path.join(app, 'app.txt'), 'app first\napp second\n');
  commitOn(app, '2026-01-14T10:00:00Z', 'app second', '-a');
  commitOn(app, '2026-01-16T10:00:00Z', 'app third');
  return { ws, api, app };
}

/**
 * The two nodes are linked by a chain of strokes, end to end or along a vertical lane, that passes through no other node.
 * A line from a merge to a parent rows below runs as a curve and then a lane.
 */
function linked(graph: GraphView, a: Point, b: Point): boolean {
  const others = shownNodes(graph).filter((n) => !close(n, a) && !close(n, b));
  const touches = (s: Stroke, p: Point) =>
    close(s.from, p) ||
    close(s.to, p) ||
    (!s.curve && Math.abs(s.from.x - p.x) <= 2 && Math.abs(s.to.x - p.x) <= 2 && p.y >= Math.min(s.from.y, s.to.y) - 2 && p.y <= Math.max(s.from.y, s.to.y) + 2);
  const seen = new Set<Stroke>();
  const queue: Point[] = [a];
  while (queue.length > 0) {
    const p = queue.shift()!;
    if (close(p, b)) return true;
    for (const s of graph.strokes) {
      if (seen.has(s) || !touches(s, p)) continue;
      seen.add(s);
      if (touches(s, b)) return true;
      for (const end of [s.from, s.to]) if (!others.some((n) => close(n, end))) queue.push(end);
    }
  }
  return false;
}

const COMBINED = ['app third', 'Merge api feature', 'app second', 'api main work', 'api feature', 'app first', 'api first'];
const repositoryOfRow = (row: Locator) => row.locator('.history-commit-repository');
const markColour = (locator: Locator) => locator.locator('.git-repository-mark').first().evaluate((m) => getComputedStyle(m).backgroundColor);

async function openCombinedHistory(page: Page, request: APIRequestContext, ws: string): Promise<void> {
  await openExplorer(page, request, ws);
  await expect.poll(() => listedPaths(page)).toEqual(['api', 'web/app']);
  await tab(page, 'History').click();
  await expect(tab(page, 'History')).toHaveAttribute('aria-selected', 'true');
}

test.describe('Combined history of a workspace with several repositories', () => {
  // plan-multi_repo_workspace/REQ-21, REQ-22, REQ-23, REQ-24, REQ-25: human acceptance scenario "The user reads the history of every repository in one graph"
  test('shows the commits of api and web/app in one graph, newest first, each with the name and colour of its repository', async ({ page, request }) => {
    const { ws, api, app } = await historyWorkspace('combined');
    await openCombinedHistory(page, request, ws);

    await expect(commitRows(page)).toHaveCount(COMBINED.length);
    for (const [index, subject] of COMBINED.entries()) await expect(commitRows(page).nth(index)).toContainText(subject);
    const owner = (subject: string) => (subject.startsWith('app') ? 'app' : 'api');
    for (const [index, subject] of COMBINED.entries()) {
      const repository = repositoryOfRow(commitRows(page).nth(index));
      await expect(repository).toHaveText(owner(subject));
      await expect(repository).toHaveAttribute('title', owner(subject) === 'app' ? app : api);
    }

    // REQ-23: the same colour in the header, the Changes group and the History rows
    const headerColour = { api: await markColour(repositoryEntry(page, api)), app: await markColour(repositoryEntry(page, app)) };
    expect(headerColour.api).not.toBe(headerColour.app);
    for (const [index, subject] of COMBINED.entries()) expect(await markColour(commitRows(page).nth(index)), subject).toBe(headerColour[owner(subject)]);
    await tab(page, 'Changes').click();
    for (const [name, root] of [['api', api], ['app', app]] as const) {
      expect(await drawnColours(repositoryGroup(page, name).getByTitle(root, { exact: true })), `${name}: Changes group colour`).toContain(headerColour[name]);
    }
    await tab(page, 'History').click();

    // REQ-24: the tip of each repository carries its own branch
    await expect(commitRows(page).nth(0).getByText('develop', { exact: true })).toBeVisible();
    await expect(commitRows(page).nth(1).getByText('main', { exact: true })).toBeVisible();
    for (let index = 2; index < COMBINED.length; index++) {
      await expect(commitRows(page).nth(index).getByText(/^(main|develop)$/)).toHaveCount(0);
    }

    // REQ-24, REQ-25: lines join the commits of a repository, never two repositories
    const graph = await readGraph(page);
    const nodes = shownNodes(graph);
    expect(nodes, 'one node per row').toHaveLength(COMBINED.length);
    const at = (subject: string) => nodes[COMBINED.indexOf(subject)]!;
    expect(linked(graph, at('app third'), at('app second'))).toBe(true);
    expect(linked(graph, at('app second'), at('app first'))).toBe(true);
    expect(linked(graph, at('Merge api feature'), at('api main work')), 'merge → first parent').toBe(true);
    expect(linked(graph, at('Merge api feature'), at('api feature')), 'merge → second parent').toBe(true);
    expect(linked(graph, at('api main work'), at('api first'))).toBe(true);
    for (const a of COMBINED.filter((s) => owner(s) === 'api')) {
      for (const b of COMBINED.filter((s) => owner(s) === 'app')) expect(linked(graph, at(a), at(b)), `no line between "${a}" and "${b}"`).toBe(false);
    }
    await expect(explorer(page).getByRole('alert')).toHaveCount(0);
  });

  // plan-multi_repo_workspace/REQ-24: human acceptance scenario "The user opens a commit of a nested repository"
  test('a click on a commit of web/app shows its files, and a click on a file its diff in web/app', async ({ page, request }) => {
    const { ws, app } = await historyWorkspace('combined-detail');
    await openCombinedHistory(page, request, ws);
    await expect(commitRows(page)).toHaveCount(COMBINED.length);

    const filesRequest = page.waitForRequest((r) => new URL(r.url()).pathname === '/api/git/commit-files');
    await commitRows(page).filter({ hasText: 'app second' }).click();
    expect(new URL((await filesRequest).url()).searchParams.get('path')).toBe(app);
    await expect(backButton(page)).toBeVisible();
    await expect(changedFiles(page)).toHaveCount(1);
    await expect(changedFiles(page).first()).toContainText('app.txt');
    await expect(changedFiles(page).first()).toContainText('Modified');

    const diffRequest = page.waitForRequest((r) => new URL(r.url()).pathname === '/api/git/commit-diff');
    await changedFiles(page).first().click();
    expect(new URL((await diffRequest).url()).searchParams.get('path')).toBe(app);
    await expect(diffLines(page).filter({ hasText: /^\+app second$/ })).toHaveCount(1);
    await expect(diffLines(page).filter({ hasText: /^-/ })).toHaveCount(0);
  });

  // plan-multi_repo_workspace/REQ-21, REQ-24: human acceptance scenario "The user loads more of a long combined history"
  test('"Load more" on two histories of 120 commits with mixed dates appends the next commits newest first, with no gap in the lines', async ({ page, request }) => {
    test.setTimeout(120_000);
    const ws = await newPlainFolder('combined-long');
    const hour = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 3_600_000).toISOString();
    for (const [relative, offset] of [['api', 0], ['web/app', 1]] as const) {
      const root = path.join(ws, relative);
      await mkdir(root, { recursive: true });
      git(root, 'init', '-q', '-b', 'main');
      // api on even hours, web/app on odd hours: the two histories interleave one by one.
      for (let i = 0; i < 120; i++) commitOn(root, hour(2 * i + offset), `${path.basename(relative)} ${i + 1}`);
    }
    await openCombinedHistory(page, request, ws);
    const loadMore = explorer(page).getByRole('button', { name: 'Load more', exact: true });
    await expect(loadMore).toBeVisible();
    // First pages: api 21 to 120, app 21 to 120. The list stops once app, which has more, has shown "app 21": "api 21" waits.
    await expect(commitRows(page)).toHaveCount(199);
    const firstTexts = await commitRows(page).locator('.history-commit-subject').allTextContents();
    expect(firstTexts.at(-1)).toBe('app 21');

    // Each "Load more" reads the repository at the border; the two histories end after two parts.
    await loadMore.click();
    await expect(commitRows(page)).not.toHaveCount(199);
    const secondTexts = await commitRows(page).locator('.history-commit-subject').allTextContents();
    expect(secondTexts.slice(0, 199), 'the next commits appear under the first ones').toEqual(firstTexts);
    await loadMore.click();
    await expect(commitRows(page)).toHaveCount(240);
    await expect(loadMore).toHaveCount(0);
    const subjects = await commitRows(page).locator('.history-commit-subject').allTextContents();
    expect(subjects.slice(0, secondTexts.length)).toEqual(secondTexts);
    const expected = Array.from({ length: 240 }, (_, k) => {
      const n = 239 - k;
      return n % 2 === 0 ? `api ${n / 2 + 1}` : `app ${(n - 1) / 2 + 1}`;
    });
    expect(subjects, 'newest first across both repositories').toEqual(expected);

    const graph = await readGraph(page);
    const nodes = shownNodes(graph);
    expect(nodes).toHaveLength(240);
    for (const name of ['api', 'app']) {
      const own = nodes.filter((_, index) => subjects[index]!.startsWith(`${name} `));
      expect(new Set(own.map((n) => Math.round(n.x))).size, `${name}: one lane`).toBe(1);
      expect(laneCovers(graph, own[0]!.x, own[0]!.y, own.at(-1)!.y), `${name}: no gap across the parts`).toBe(true);
    }
    expect(Math.round(nodes[0]!.x), 'the two repositories in their own lanes').not.toBe(Math.round(nodes[1]!.x));
  });

  // plan-multi_repo_workspace/REQ-26: human acceptance scenario "The user sees one history fail while the others still show"
  test('a damaged web/app shows its git message in History, above the commits of api', async ({ page, request }) => {
    const { ws, app } = await historyWorkspace('combined-damaged');
    await rm(path.join(app, '.git'), { recursive: true, force: true });
    await writeFile(path.join(app, '.git'), `gitdir: ${path.join(ws, 'missing-gitdir')}\n`);
    await openCombinedHistory(page, request, ws);

    const alert = explorer(page).getByRole('tabpanel').getByRole('alert');
    await expect(alert).toHaveCount(1);
    await expect(alert).toContainText(/^app: \S/);
    await expect(commitRows(page)).toHaveCount(4);
    for (const [index, subject] of ['Merge api feature', 'api main work', 'api feature', 'api first'].entries()) {
      await expect(commitRows(page).nth(index)).toContainText(subject);
    }
    expect((await box(alert)).y, 'the message is above the commits').toBeLessThan((await box(commitRows(page).first())).y);
  });

  // plan-multi_repo_workspace/REQ-27: human acceptance scenario "The history of a single repository looks as today"
  test('a single repository shows the graph with no repository name on the rows', async ({ page, request }) => {
    const repo = await mergedRepository('combined-single');
    await openHistory(page, request, repo);
    await expect(commitRows(page)).toHaveCount(5);
    await expect(explorer(page).locator('[aria-label="Commits"] .history-commit-repository')).toHaveCount(0);
    await expect(explorer(page).locator('[aria-label="Commits"] .git-repository-mark')).toHaveCount(0);
    await expect(explorer(page).locator('[aria-label="Commits"]')).not.toContainText('combined-single');
    await expect(commitRows(page).first().getByText('main', { exact: true })).toBeVisible();
    expect(shownNodes(await readGraph(page))).toHaveLength(5);
  });
});

/** The workspace of the filter scenarios: `api`, `tools` and `web/app`, each with a commit `<name> commit` and an unstaged `<name>-change.ts`. */
async function filterWorkspace(name: string): Promise<{ ws: string; api: string; tools: string; app: string }> {
  const ws = await newPlainFolder(name);
  const [api, tools, app] = await Promise.all(['api', 'tools', 'web/app'].map((relative) => repositoryAt(ws, relative)));
  for (const root of [api!, tools!, app!]) {
    const short = path.basename(root);
    await writeFile(path.join(root, 'README.md'), `hello ${short}\n`);
    git(root, 'commit', '-q', '-a', '-m', `${short} commit`);
    await writeFile(path.join(root, `${short}-change.ts`), 'export {};\n');
  }
  return { ws, api: api!, tools: tools!, app: app! };
}

const allRepositories = (page: Page) => explorer(page).getByRole('button', { name: 'All repositories', exact: true });
const filterToggle = (page: Page, root: string) => repositoryEntry(page, root).getByRole('button');
/** The repository groups shown in "Changes", in order. */
const shownGroups = (page: Page) => explorer(page).locator('.changes-repository-title').allTextContents();
/** The repository of each commit row of "History", in order, with no repeat. */
const historyRepositories = async (page: Page) => [...new Set(await commitRows(page).locator('.history-commit-repository').allTextContents())].sort();

/** Both tabs show exactly the repositories `names` (group titles and history rows). */
async function expectShown(page: Page, names: string[]): Promise<void> {
  await tab(page, 'Changes').click();
  for (const name of ['api', 'tools', 'app']) await expect(repositoryGroup(page, name)).toHaveCount(names.includes(name) ? 1 : 0);
  for (const name of names) await expect(repositoryGroup(page, name)).toContainText(`${name}-change.ts`);
  await tab(page, 'History').click();
  await expect(commitRows(page)).toHaveCount(2 * names.length);
  expect(await historyRepositories(page)).toEqual([...names].sort());
  for (const name of names) await expect(commitRows(page).filter({ hasText: `${name} commit` })).toHaveCount(1);
  await tab(page, 'Changes').click();
}

test.describe('Repository filter of a workspace with several repositories', () => {
  // plan-multi_repo_workspace/REQ-28, REQ-29, REQ-30: human acceptance scenarios "The user filters the git explorer by one repository" and "The user clears the filter"
  test('picking web/app, then api, filters both tabs; the filter survives closing the panel, and "All repositories" clears it', async ({ page, request }) => {
    const { ws, api, tools, app } = await filterWorkspace('filtered');
    await openExplorer(page, request, ws);
    await expect.poll(() => listedPaths(page)).toEqual(['api', 'tools', 'web/app']);
    await expect(allRepositories(page)).toHaveAttribute('aria-pressed', 'true');
    await expectShown(page, ['api', 'tools', 'app']);
    const appColour = await markColour(repositoryEntry(page, app));

    await filterToggle(page, app).click();
    await expect(filterToggle(page, app)).toHaveAttribute('aria-pressed', 'true');
    await expect(allRepositories(page)).toHaveAttribute('aria-pressed', 'false');
    await expectShown(page, ['app']);
    // The chosen repository keeps the colour of its position in the full list.
    expect(await drawnColours(repositoryGroup(page, 'app').getByTitle(app, { exact: true }))).toContain(appColour);

    await filterToggle(page, api).click();
    await expect(filterToggle(page, api)).toHaveAttribute('aria-pressed', 'true');
    await expect(filterToggle(page, tools)).toHaveAttribute('aria-pressed', 'false');
    await expectShown(page, ['api', 'app']);
    expect(await shownGroups(page), 'list order').toEqual(['api', 'app']);

    // The filter lasts while the page stays open.
    await explorerButton(page).click();
    await expect(explorer(page)).toHaveCount(0);
    await explorerButton(page).click();
    await expect(filterToggle(page, app)).toHaveAttribute('aria-pressed', 'true');
    await expect(filterToggle(page, api)).toHaveAttribute('aria-pressed', 'true');
    await expectShown(page, ['api', 'app']);

    await allRepositories(page).click();
    await expect(allRepositories(page)).toHaveAttribute('aria-pressed', 'true');
    for (const root of [api, tools, app]) await expect(filterToggle(page, root)).toHaveAttribute('aria-pressed', 'false');
    await expectShown(page, ['api', 'tools', 'app']);
  });

  // plan-multi_repo_workspace/REQ-28, REQ-30 (Filter life): a repository that a refresh removes leaves the filter
  test('a chosen repository deleted from the folder leaves the filter after "Refresh", and every other repository shows', async ({ page, request }) => {
    const { ws, app } = await filterWorkspace('filter-removed');
    await openExplorer(page, request, ws);
    await expect.poll(() => listedPaths(page)).toEqual(['api', 'tools', 'web/app']);
    await filterToggle(page, app).click();
    await expectShown(page, ['app']);

    await rm(app, { recursive: true, force: true });
    await refreshButton(page).click();
    await expect.poll(() => listedPaths(page)).toEqual(['api', 'tools']);
    await expect(allRepositories(page)).toHaveAttribute('aria-pressed', 'true');
    await expectShown(page, ['api', 'tools']);
  });

  // plan-multi_repo_workspace/REQ-31: human acceptance scenario "A single repository has no filter"
  test('a single repository shows no repository list and no filter control', async ({ page, request }) => {
    const repo = await newRepository('filter-single');
    await openExplorer(page, request, repo);
    await expectRepositoryShown(page, repo, 'main');
    await expect(repositoryList(page)).toHaveCount(0);
    await expect(allRepositories(page)).toHaveCount(0);
    await expect(explorer(page).locator('[aria-pressed]')).toHaveCount(0);
  });
});
