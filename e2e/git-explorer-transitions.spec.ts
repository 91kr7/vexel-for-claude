// e2e of plan-ui_transitions, batch git-explorer-panel: the Git Explorer panel slides in from the right edge and out to it,
// in the view of a hosted session and of an external session; the terminal fits once when each slide ends.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';
import { presses, recordPresses, settled } from './motion';

interface Sample {
  t: number;
  leaving: boolean;
  // Hidden from assistive technologies.
  hidden: boolean;
  left: number;
  edge: number;
}
interface Resize {
  t: number;
  cols: number;
  rows: number;
}

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
const SLOW_MS = 1500;

let projectsRoot: string;
const createdIds: string[] = [];
const sleepers: ChildProcess[] = [];
const fixtureFiles: string[] = [];

test.beforeAll(async () => {
  await mkdir(SESSIONS_DIR, { recursive: true });
  projectsRoot = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-git-motion-')));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const sleeper of sleepers.splice(0)) sleeper.kill('SIGKILL');
  for (const file of fixtureFiles.splice(0)) await rm(file, { recursive: true, force: true });
});

test.afterAll(async () => {
  await rm(projectsRoot, { recursive: true, force: true });
});

const git = (folder: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: folder, encoding: 'utf8' });

async function newRepository(name: string): Promise<string> {
  const root = path.join(await mkdtemp(path.join(projectsRoot, 'r-')), name);
  await mkdir(root);
  git(root, 'init', '-q', '-b', 'main');
  await writeFile(path.join(root, 'README.md'), 'hello\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'first');
  return root;
}

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const mainArea = (page: Page) => page.getByRole('main');
const terminalPanel = (page: Page) => mainArea(page).getByRole('region', { name: /^Terminal/ });
const terminal = (page: Page) => page.locator('.xterm-rows');
const explorerButton = (page: Page) => mainArea(page).locator('.session-header').getByRole('button', { name: 'Git Explorer', exact: true });
const explorer = (page: Page) => mainArea(page).getByRole('region', { name: 'Git Explorer', exact: true });
const panels = (page: Page) => page.locator('.git-explorer-panel');
const tab = (page: Page, name: string) => panels(page).getByRole('tab', { name, exact: true });

async function startHosted(request: APIRequestContext, folder: string): Promise<void> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  createdIds.push(((await response.json()) as { id: string }).id);
}

/** Records every `resize` the page sends to a terminal, with its time on the page clock. */
function recordResizes(page: Page): Resize[] {
  const resizes: Resize[] = [];
  page.on('websocket', (socket) => {
    socket.on('framesent', (frame) => {
      if (typeof frame.payload !== 'string') return;
      try {
        const message = JSON.parse(frame.payload) as { type?: string; cols?: number; rows?: number };
        if (message.type === 'resize') resizes.push({ t: Date.now(), cols: Number(message.cols), rows: Number(message.rows) });
      } catch {
        // not JSON: not a resize
      }
    });
  });
  return resizes;
}

async function openHosted(page: Page, folder: string): Promise<void> {
  await entry(page, folder).getByTitle(folder, { exact: true }).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
  // The fit at connection settles before the test starts counting.
  await page.waitForTimeout(500);
}

/** Records, at each frame, the left edge of the panel and the right edge of the content row it slides from. */
function installPanelWatcher(): void {
  const store = window as unknown as { __panel: Sample[] };
  store.__panel = [];
  const tick = () => {
    const panel = document.querySelector('.git-explorer-panel');
    const row = panel?.parentElement;
    if (panel && row) {
      store.__panel.push({
        t: performance.now(),
        leaving: panel.classList.contains('is-leaving'),
        hidden: panel.closest('[aria-hidden="true"]') !== null,
        left: panel.getBoundingClientRect().left,
        edge: row.getBoundingClientRect().right,
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const watchPanel = (page: Page) => page.evaluate(installPanelWatcher);
const samples = (page: Page) => page.evaluate(() => (window as unknown as { __panel: Sample[] }).__panel);

/** Makes both slides long enough to observe and to act during them. */
async function slowMotion(page: Page): Promise<void> {
  await page.evaluate((ms) => {
    document.documentElement.style.setProperty('--motion-duration-enter', `${ms}ms`);
    document.documentElement.style.setProperty('--motion-duration-exit', `${ms}ms`);
  }, SLOW_MS);
}

async function pointerGoesThrough(target: Locator): Promise<boolean> {
  return target.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return top === null || !element.contains(top);
  });
}

/** The panel enters from the right edge: it starts at the edge and moves left, never back. */
function expectSlideIn(opening: Sample[]): void {
  expect(opening.length, 'frames of the opening slide').toBeGreaterThan(5);
  const first = opening[0]!;
  const last = opening[opening.length - 1]!;
  expect(first.left, `starts at the right edge ${JSON.stringify(first)}`).toBeGreaterThanOrEqual(first.edge - 2);
  expect(last.left, 'ends inside the content row').toBeLessThan(last.edge - 300);
  for (let i = 1; i < opening.length; i++) expect(opening[i]!.left, 'moves only to the left').toBeLessThanOrEqual(opening[i - 1]!.left + 0.5);
}

/** The panel leaves to the right edge: it moves right, never back, and ends near the edge. */
function expectSlideOut(leaving: Sample[], openLeft: number): void {
  expect(leaving.length, 'frames of the closing slide').toBeGreaterThan(5);
  expect(leaving.filter((sample) => !sample.hidden), 'no longer exposed in any frame of the exit').toEqual([]);
  const first = leaving[0]!;
  const last = leaving[leaving.length - 1]!;
  expect(first.left, 'starts from the open position').toBeLessThanOrEqual(openLeft + 2);
  const width = first.edge - openLeft;
  expect(last.left, `ends near the right edge ${JSON.stringify(last)}`).toBeGreaterThanOrEqual(last.edge - width * 0.15);
  for (let i = 1; i < leaving.length; i++) expect(leaving[i]!.left, 'moves only to the right').toBeGreaterThanOrEqual(leaving[i - 1]!.left - 0.5);
}

test.describe('Git Explorer slide of a hosted session', () => {
  // plan-ui_transitions/REQ-5, REQ-6 — scenario "the Git Explorer slides in and out"
  test('the panel slides in from the right and out to the right; the terminal keeps its text and sends one resize per slide', async ({ page, request }) => {
    const repo = await newRepository('slide-repo');
    await startHosted(request, repo);
    const resizes = recordResizes(page);
    await page.goto('/');
    await openHosted(page, repo);
    await slowMotion(page);
    await watchPanel(page);
    const startCols = resizes[resizes.length - 1]?.cols;
    expect(startCols, 'a resize at connection').toBeDefined();
    resizes.splice(0);

    const openedAt = Date.now();
    await explorerButton(page).click();
    await expect(explorer(page)).toBeVisible();
    await page.waitForTimeout(SLOW_MS + 600);
    const opening = await samples(page);
    expectSlideIn(opening);
    expect(resizes, 'one resize for the opening slide').toHaveLength(1);
    expect(resizes[0]!.t - openedAt, 'sent when the slide ends, not during it').toBeGreaterThanOrEqual(SLOW_MS - 200);
    expect(resizes[0]!.cols, 'the terminal is narrower').toBeLessThan(startCols!);
    await expect(terminal(page)).toContainText(`CWD:${repo}`);

    const openLeft = opening[opening.length - 1]!.left;
    resizes.splice(0);
    const closedAt = Date.now();
    await explorerButton(page).click();
    await expect(explorerButton(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(panels(page)).toHaveCount(0, { timeout: SLOW_MS + 1000 });
    await page.waitForTimeout(600);
    const leaving = (await samples(page)).filter((sample) => sample.leaving);
    expectSlideOut(leaving, openLeft);
    expect(resizes, 'one resize for the closing slide').toHaveLength(1);
    expect(resizes[0]!.t - closedAt, 'sent when the slide ends, not during it').toBeGreaterThanOrEqual(SLOW_MS - 200);
    expect(resizes[0]!.cols, 'the terminal has its full width again').toBe(startCols);
    await expect(terminal(page)).toContainText(`CWD:${repo}`);
  });

  // plan-ui_transitions/REQ-26, REQ-27: the controls take clicks and keys from the first frame of the slide
  test('the tabs of the panel take clicks and keys while it slides in', async ({ page, request }) => {
    const repo = await newRepository('input-repo');
    await startHosted(request, repo);
    await page.goto('/');
    await openHosted(page, repo);
    await slowMotion(page);
    await recordPresses(page, '.git-explorer-panel');

    await explorerButton(page).click();
    // force: the click lands while the panel still moves.
    await tab(page, 'History').click({ force: true });
    await expect(tab(page, 'History')).toHaveAttribute('aria-selected', 'true');
    await tab(page, 'Changes').focus();
    await page.keyboard.press('Enter');
    await expect(tab(page, 'Changes')).toHaveAttribute('aria-selected', 'true');
    // On the page clock: both presses land while the panel slides in.
    const all = await presses(page);
    expect(all.filter((press) => press.type === 'pointerdown')[1]?.during, 'the click on "History" lands during the slide').toBe(true);
    expect(all.find((press) => press.key === 'Enter')?.during, 'Enter lands during the slide').toBe(true);
    expect(
      await panels(page).evaluate((panel) => panel.getAnimations().some((animation) => animation.playState === 'running')),
      'the slide is still playing',
    ).toBe(true);
  });

  // plan-ui_transitions/REQ-6, REQ-26: the leaving panel is hidden from assistive technologies and lets the pointer through
  test('while the panel slides out it is no longer exposed and takes no pointer input', async ({ page, request }) => {
    const repo = await newRepository('leaving-repo');
    await startHosted(request, repo);
    await page.goto('/');
    await openHosted(page, repo);
    await explorerButton(page).click();
    await expect(explorer(page)).toBeVisible();
    await settled(panels(page));
    await slowMotion(page);
    await watchPanel(page);

    await explorerButton(page).click();
    await expect(explorer(page), 'closed: no longer exposed').toHaveCount(0);
    await expect(panels(page), 'the panel plays its exit').toHaveCount(1);
    await expect(panels(page)).toHaveAttribute('aria-hidden', 'true');
    expect(await pointerGoesThrough(panels(page)), 'the leaving panel takes no pointer input').toBe(true);
    await expect(panels(page)).toHaveCount(0, { timeout: SLOW_MS + 1000 });
    const leaving = (await samples(page)).filter((sample) => sample.leaving);
    expect(leaving.length, 'frames of the closing slide').toBeGreaterThan(0);
    expect(leaving.filter((sample) => !sample.hidden), 'no longer exposed in any frame of the exit').toEqual([]);
  });

  // plan-ui_transitions/REQ-26, REQ-28 — scenario "a click during the slide wins"
  test('two quick clicks on "Git Explorer" leave the panel closed and the terminal at its full width', async ({ page, request }) => {
    const repo = await newRepository('double-repo');
    await startHosted(request, repo);
    const resizes = recordResizes(page);
    await page.goto('/');
    await openHosted(page, repo);
    const startCols = resizes[resizes.length - 1]?.cols;
    const before = await terminalPanel(page).boundingBox();
    await slowMotion(page);
    await recordPresses(page, '.git-explorer-panel');

    await explorerButton(page).click();
    await explorerButton(page).click();
    expect((await presses(page))[1]?.during, 'the second click lands during the slide').toBe(true);

    await expect(explorerButton(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(panels(page)).toHaveCount(0, { timeout: SLOW_MS + 1000 });
    await page.waitForTimeout(600);
    const after = await terminalPanel(page).boundingBox();
    expect(after?.width, 'the terminal panel has its full width').toBeCloseTo(before!.width, 0);
    expect(resizes[resizes.length - 1]?.cols, 'the last resize is the full width').toBe(startCols);
  });

  // plan-ui_transitions/REQ-28: a click during the slide out reverses it, and the panel ends open
  test('a click on "Git Explorer" while the panel slides out leaves it open at its full width', async ({ page, request }) => {
    const repo = await newRepository('reopen-repo');
    await startHosted(request, repo);
    await page.goto('/');
    await openHosted(page, repo);
    await explorerButton(page).click();
    await expect(explorer(page)).toBeVisible();
    await page.waitForTimeout(400);
    const open = await explorer(page).boundingBox();
    await slowMotion(page);
    await recordPresses(page, '.git-explorer-panel.is-leaving');

    await explorerButton(page).click();
    await expect(panels(page)).toHaveClass(/is-leaving/);
    await explorerButton(page).click();
    expect((await presses(page))[1]?.during, 'the click lands while the panel slides out').toBe(true);

    await expect(explorerButton(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(explorer(page)).toBeVisible();
    await page.waitForTimeout(SLOW_MS + 600);
    await expect(panels(page), 'one panel').toHaveCount(1);
    await expect(explorer(page), 'the old exit does not close it').toBeVisible();
    const end = await explorer(page).boundingBox();
    expect(end?.x).toBeCloseTo(open!.x, 0);
    expect(end?.width).toBeCloseTo(open!.width, 0);
  });

  // plan-ui_transitions/REQ-29 — scenario "no slide when the app starts"
  test('no panel slides in when the app starts and a session opens', async ({ page, request }) => {
    const repo = await newRepository('start-repo');
    await startHosted(request, repo);
    await page.addInitScript(installPanelWatcher);
    await page.goto('/');
    await openHosted(page, repo);
    await expect(explorerButton(page)).toBeVisible();
    await expect(explorerButton(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(panels(page)).toHaveCount(0);
    expect(await samples(page), 'no panel was ever on screen').toEqual([]);

    await page.reload();
    await openHosted(page, repo);
    await expect(panels(page)).toHaveCount(0);
    expect(await samples(page), 'no panel after a reload either').toEqual([]);
  });

  // plan-ui_transitions/REQ-5, REQ-6 with reduced motion (REQ-25): no slide, the panel appears and goes at once
  test('with reduced motion the panel appears and goes with no slide', async ({ page, request }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const repo = await newRepository('reduced-repo');
    await startHosted(request, repo);
    await page.goto('/');
    await openHosted(page, repo);
    await watchPanel(page);

    await explorerButton(page).click();
    await expect(explorer(page)).toBeVisible();
    await page.waitForTimeout(300);
    const opening = await samples(page);
    expect(opening.length).toBeGreaterThan(0);
    expect(opening[0]!.left, 'the first frame is the final position').toBeCloseTo(opening[opening.length - 1]!.left, 0);

    await explorerButton(page).click();
    expect(await panels(page).count(), 'the panel goes at once').toBe(0);
    expect((await samples(page)).filter((sample) => sample.leaving), 'no leaving phase').toEqual([]);
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
  fixtureFiles.push(path.dirname(file));
  const sleeper = spawn('sleep', ['300'], { stdio: 'ignore' });
  sleepers.push(sleeper);
  const pid = sleeper.pid ?? 0;
  const key = path.join(SESSIONS_DIR, `${pid}.5a6b7c8d.key`);
  execFileSync('mkfifo', [key]);
  const record = path.join(SESSIONS_DIR, `${pid}.json`);
  await writeFile(record, JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status: 'idle', updatedAt: Date.now() }));
  fixtureFiles.push(key, record);
}

test.describe('Git Explorer slide of an external session', () => {
  // plan-ui_transitions/REQ-5, REQ-6: the same slides beside the conversation
  test('the panel slides in from the right and out to the right beside the conversation', async ({ page }) => {
    const repo = await newRepository('external-slide-repo');
    await runExternal('9a1c2d3e-0000-4000-8000-000000000101', repo);
    await page.goto('/');
    await expect(entry(page, repo)).toBeVisible({ timeout: 10_000 });
    await entry(page, repo).getByTitle(repo, { exact: true }).click();
    const conversation = page.locator('.conversation-view');
    await expect(conversation).toContainText('Hi there');
    await slowMotion(page);
    await watchPanel(page);

    const button = conversation.locator('.session-header').getByRole('button', { name: 'Git Explorer', exact: true });
    await button.click();
    await expect(explorer(page)).toBeVisible();
    await page.waitForTimeout(SLOW_MS + 300);
    const opening = await samples(page);
    expectSlideIn(opening);

    await button.click();
    await expect(explorer(page), 'closed: no longer exposed').toHaveCount(0);
    await expect(panels(page), 'the panel plays its exit').toHaveCount(1);
    await expect(panels(page)).toHaveAttribute('aria-hidden', 'true');
    await expect(panels(page)).toHaveCount(0, { timeout: SLOW_MS + 1000 });
    expectSlideOut(
      (await samples(page)).filter((sample) => sample.leaving),
      opening[opening.length - 1]!.left,
    );
  });
});
