// e2e of plan-resume_favorites, batch popup-mark. Each test sees in the popup and in the list only its own sessions,
// and removes the marks it set before it ends: the e2e data folder is kept between runs.
/// <reference lib="dom" />
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
const ERROR = 'Could not change the favorite mark.';
// The external scanner reads the sessions folder every 2 seconds.
const SCAN = { timeout: 10_000 };

let projectsRoot: string;
let testRoot: string;
const createdIds: string[] = [];
const transcripts: string[] = [];
/** Claude Code session ids whose mark is removed after the test. */
const marked: string[] = [];
const terminals: { process: ChildProcess; files: string[] }[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-popup-mark-'));
  await mkdir(SESSIONS_DIR, { recursive: true });
});

test.beforeEach(async () => {
  testRoot = await mkdtemp(path.join(projectsRoot, 'test-'));
});

test.afterEach(async ({ request }) => {
  for (const id of marked.splice(0)) await request.put(`/api/past-sessions/${id}/favorite`, { data: { favorite: false } });
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const { process, files } of terminals.splice(0)) {
    process.kill('SIGKILL');
    for (const file of files) await rm(file, { force: true });
  }
});

test.afterAll(async () => {
  for (const file of transcripts.splice(0)) await rm(file, { force: true });
  await rm(projectsRoot, { recursive: true, force: true });
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const item = (page: Page, folder: string) => list(page).getByRole('listitem').filter({ has: page.getByTitle(folder, { exact: true }) });
const group = (page: Page, title: string) => list(page).locator('.session-group').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Resume Session' });
const pastGroup = (page: Page, folder: string) => dialog(page).getByRole('region', { name: folder });
const radio = (page: Page, folder: string) => pastGroup(page, folder).getByRole('radio');
const card = (page: Page, folder: string) => pastGroup(page, folder).locator('.list-card');
const markStar = (scope: Locator) => scope.getByRole('button', { name: 'Mark as Favorite', exact: true });
const removeStar = (scope: Locator) => scope.getByRole('button', { name: 'Remove Favorite', exact: true });
const resumeButton = (page: Page) => dialog(page).getByRole('button', { name: 'Resume', exact: true });
const isPastFavoriteRequest = (r: { url(): string; method(): string }, id: string) =>
  r.method() === 'PUT' && new URL(r.url()).pathname === `/api/past-sessions/${id}/favorite`;
const isResumeRequest = (r: { url(): string; method(): string }) => r.method() === 'POST' && /\/api\/past-sessions\/[^/]+\/resume$/.test(new URL(r.url()).pathname);

const own = (folder: unknown) => typeof folder === 'string' && folder.startsWith(testRoot + path.sep);

/** Shows in the popup and in the list only the sessions of the current test. */
async function showOnlyOwnSessions(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname === '/api/past-sessions',
    async (route) => {
      const response = await route.fetch();
      const groups = (await response.json()) as { folder?: unknown }[];
      await route.fulfill({ response, json: groups.filter((g) => own(g.folder)) });
    },
  );
  await page.route(
    (url) => url.pathname === '/api/sessions',
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      const sessions = (await response.json()) as { folder?: unknown }[];
      await route.fulfill({ response, json: sessions.filter((s) => own(s.folder)) });
    },
  );
  await page.routeWebSocket(/\/api\/sessions\/events$/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((message) => {
      const frame = JSON.parse(String(message)) as { type?: string; session?: { folder?: unknown } };
      if (frame.type !== 'session' || own(frame.session?.folder)) ws.send(message);
    });
  });
}

/** Counts the resume requests the page sends. */
function countResumes(page: Page): () => number {
  let count = 0;
  page.on('request', (r) => {
    if (isResumeRequest(r)) count++;
  });
  return () => count;
}

async function newFolder(name: string): Promise<string> {
  const folder = path.join(testRoot, name);
  await mkdir(folder);
  return folder;
}

/** Writes the transcript Claude Code leaves for a conversation, so the popup lists it. */
async function transcript(claudeId: string, folder: string, firstMessage: string): Promise<void> {
  const dir = path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'));
  await mkdir(dir, { recursive: true });
  const common = { cwd: folder, sessionId: claudeId, isSidechain: false };
  const lines = [
    { ...common, type: 'user', message: { role: 'user', content: firstMessage } },
    { ...common, type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] } },
  ];
  const file = path.join(dir, `${claudeId}.jsonl`);
  await writeFile(file, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  transcripts.push(file);
}

/** A past session with only its transcript: no list entry. */
async function pastSession(name: string): Promise<{ id: string; folder: string; label: string }> {
  const folder = await newFolder(name);
  const id = randomUUID();
  const label = `Task ${name}`;
  await transcript(id, folder, label);
  return { id, folder, label };
}

async function postHook(request: APIRequestContext, id: string, event: Record<string, string>): Promise<void> {
  expect((await request.post(`/api/sessions/${id}/hook-events`, { data: event })).status()).toBe(204);
}

/** A hosted session that got a prompt, then ended: it is in the group "Ended" and in the popup. */
async function endedSession(request: APIRequestContext, name: string): Promise<{ id: string; claudeId: string; folder: string }> {
  const folder = await newFolder(name);
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  const claudeId = randomUUID();
  const prompt = `Fix the ${name} page`;
  await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt, session_id: claudeId });
  await postHook(request, id, { hook_event_name: 'Stop' });
  await transcript(claudeId, folder, prompt);
  expect((await request.post(`/api/sessions/${id}/stop`)).ok()).toBe(true);
  await expect
    .poll(async () => ((await (await request.get('/api/sessions')).json()) as { id: string; state: string }[]).find((s) => s.id === id)?.state)
    .toBe('ended');
  return { id, claudeId, folder };
}

/** Simulates Claude Code in another terminal: a live process, its `sessions/<pid>.json` and the `<pid>.<hash>.key` FIFO. */
async function runInTerminal(sessionId: string, folder: string): Promise<void> {
  const process = spawn('sleep', ['300'], { stdio: 'ignore' });
  const pid = process.pid ?? 0;
  const key = path.join(SESSIONS_DIR, `${pid}.5a6b7c8d.key`);
  const file = path.join(SESSIONS_DIR, `${pid}.json`);
  terminals.push({ process, files: [key, file] });
  execFileSync('mkfifo', [key]);
  await writeFile(file, JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status: 'idle', updatedAt: Date.now() }));
}

async function openPopup(page: Page): Promise<void> {
  await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).not.toContainText('Loading…');
}

/** Presses a star with the mouse and waits for the answer of PastSessionFavoriteRoute. */
async function clickStar(page: Page, star: Locator, folder: string, id: string): Promise<number> {
  await card(page, folder).hover();
  const answer = page.waitForResponse((r) => isPastFavoriteRequest(r.request(), id));
  await star.click();
  return (await answer).status();
}

async function markedOnServer(request: APIRequestContext, id: string): Promise<boolean> {
  const groups = (await (await request.get('/api/past-sessions')).json()) as { sessions: { id: string; favorite?: true }[] }[];
  return groups.flatMap((g) => g.sessions).find((s) => s.id === id)?.favorite === true;
}

/** Opacity the user sees: the product of the opacities of the element and its ancestors. */
const seenOpacity = (locator: Locator) =>
  locator.evaluate((el) => {
    let value = 1;
    for (let node: Element | null = el; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
    return value;
  });

const starFill = (star: Locator) => star.locator('svg path').first().evaluate((path) => getComputedStyle(path).fill);

/** Whether the focused element draws the focus ring colour as an outline or a box-shadow. */
async function focusedShowsRing(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.color = 'var(--color-focus-ring)';
    document.body.append(probe);
    const ring = getComputedStyle(probe).color;
    probe.remove();
    const el = document.activeElement;
    if (!el) return false;
    const s = getComputedStyle(el);
    return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor === ring) || s.boxShadow.includes(ring);
  });
}

// plan-resume_favorites/REQ-5, REQ-6, REQ-7 — scenario "The user marks a session from the resume popup"
test('marks and unmarks a row from the popup: the star flips at once, the popup stays open and nothing is resumed', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const session = await pastSession('mark');
  marked.push(session.id);
  const resumes = countResumes(page);
  await page.goto('/');
  await openPopup(page);
  const row = pastGroup(page, session.folder);
  await expect(radio(page, session.folder)).toHaveAccessibleName(session.label);
  await expect(removeStar(row)).toHaveCount(0);
  expect(await starFill(markStar(row))).toBe('none');

  expect(await clickStar(page, markStar(row), session.folder, session.id)).toBe(204);
  await expect(removeStar(row)).toBeVisible();
  await expect(removeStar(row)).toHaveAttribute('title', 'Remove Favorite');
  expect(await starFill(removeStar(row))).not.toBe('none');
  await expect(radio(page, session.folder)).toHaveAccessibleDescription(/Favorite/);
  expect(await markedOnServer(request, session.id)).toBe(true);

  await expect(dialog(page)).toBeVisible();
  await expect(radio(page, session.folder)).not.toBeChecked();
  await expect(resumeButton(page)).toBeDisabled();

  expect(await clickStar(page, removeStar(row), session.folder, session.id)).toBe(204);
  await expect(markStar(row)).toHaveCount(1);
  await expect(removeStar(row)).toHaveCount(0);
  expect(await starFill(markStar(row))).toBe('none');
  await expect(radio(page, session.folder)).not.toHaveAccessibleDescription(/Favorite/);
  expect(await markedOnServer(request, session.id)).toBe(false);
  await expect(dialog(page)).toBeVisible();
  expect(resumes()).toBe(0);
});

// ResumeDialog "Actions": the selected row stays the same
test('marking a row keeps the selected row', async ({ page }) => {
  await showOnlyOwnSessions(page);
  const selected = await pastSession('selected');
  const other = await pastSession('other');
  marked.push(other.id);
  await page.goto('/');
  await openPopup(page);
  await card(page, selected.folder).click();
  await expect(radio(page, selected.folder)).toBeChecked();

  expect(await clickStar(page, markStar(pastGroup(page, other.folder)), other.folder, other.id)).toBe(204);
  await expect(removeStar(pastGroup(page, other.folder))).toHaveCount(1);
  await expect(radio(page, selected.folder)).toBeChecked();
  await expect(radio(page, other.folder)).not.toBeChecked();
  await expect(resumeButton(page)).toBeEnabled();
});

// plan-resume_favorites/REQ-8 — scenario "The session list follows the mark of the popup"
test('the list entry of an ended session follows the mark set in the popup, without a reload', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const ended = await endedSession(request, 'ended');
  marked.push(ended.claudeId);
  await page.goto('/');
  const entry = group(page, 'Ended').getByRole('listitem').filter({ has: page.getByTitle(ended.folder, { exact: true }) });
  await expect(entry).toHaveCount(1);
  await expect(removeStar(entry)).toHaveCount(0);

  await openPopup(page);
  expect(await clickStar(page, markStar(pastGroup(page, ended.folder)), ended.folder, ended.claudeId)).toBe(204);
  await expect(removeStar(entry)).toHaveCount(1);
  await dialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(removeStar(entry)).toBeVisible();

  await openPopup(page);
  await expect(removeStar(pastGroup(page, ended.folder))).toHaveCount(1);
  expect(await clickStar(page, removeStar(pastGroup(page, ended.folder)), ended.folder, ended.claudeId)).toBe(204);
  await expect(removeStar(entry)).toHaveCount(0);
  await expect(markStar(entry)).toHaveCount(1);
});

// plan-resume_favorites/REQ-8: an external session too
test('the list entry of a session in another terminal follows the mark set in the popup, without a reload', async ({ page }) => {
  await showOnlyOwnSessions(page);
  const folder = await newFolder('terminal');
  const externalId = randomUUID();
  await transcript(externalId, folder, 'Task in a terminal');
  await runInTerminal(externalId, folder);
  marked.push(externalId);
  await page.goto('/');
  const entry = group(page, 'In Other Terminals').getByRole('listitem').filter({ has: page.getByTitle(folder, { exact: true }) });
  await expect(entry).toHaveCount(1, SCAN);
  await expect(removeStar(entry)).toHaveCount(0);

  await openPopup(page);
  expect(await clickStar(page, markStar(pastGroup(page, folder)), folder, externalId)).toBe(204);
  await expect(removeStar(entry)).toHaveCount(1);
  await expect(entry).toHaveCount(1);
});

// plan-resume_favorites/REQ-9 — scenario "The mark works with the keyboard"
test('Tab reaches the star of a row with a focus ring; Space marks and Enter unmarks, with nothing resumed', async ({ page }) => {
  await showOnlyOwnSessions(page);
  const first = await pastSession('first');
  const target = await pastSession('target');
  marked.push(target.id);
  const resumes = countResumes(page);
  await page.goto('/');
  await openPopup(page);
  const row = pastGroup(page, target.folder);
  const star = markStar(row);

  let reached = false;
  for (let i = 0; i < 12 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = await star.evaluate((el) => el === document.activeElement);
  }
  expect(reached, 'Tab reaches the star of the row').toBe(true);
  expect(await focusedShowsRing(page)).toBe(true);
  await expect.poll(() => seenOpacity(star), { message: 'the focused star is shown' }).toBeGreaterThan(0.6);

  const markAnswer = page.waitForResponse((r) => isPastFavoriteRequest(r.request(), target.id));
  await page.keyboard.press('Space');
  expect((await markAnswer).status()).toBe(204);
  await expect(removeStar(row)).toHaveCount(1);
  await expect(radio(page, target.folder)).toHaveAccessibleDescription(/Favorite/);
  await expect(removeStar(row)).toBeFocused();

  const unmarkAnswer = page.waitForResponse((r) => isPastFavoriteRequest(r.request(), target.id));
  await page.keyboard.press('Enter');
  expect((await unmarkAnswer).status()).toBe(204);
  await expect(markStar(row)).toHaveCount(1);

  await expect(dialog(page)).toBeVisible();
  await expect(radio(page, first.folder)).not.toBeChecked();
  await expect(radio(page, target.folder)).not.toBeChecked();
  expect(resumes()).toBe(0);
});

// plan-resume_favorites/REQ-5 — scenario "The mark fails"
test('a failed request shows "Could not change the favorite mark." under the row and keeps the empty star', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const session = await pastSession('failure');
  await page.route((url) => /\/api\/past-sessions\/[^/]+\/favorite$/.test(url.pathname), (route) => route.fulfill({ status: 500, json: { error: 'boom' } }));
  await page.goto('/');
  await openPopup(page);
  const row = pastGroup(page, session.folder);

  expect(await clickStar(page, markStar(row), session.folder, session.id)).toBe(500);
  const error = row.getByText(ERROR, { exact: true });
  await expect(error).toBeVisible();
  const errorBox = (await error.boundingBox())!;
  const cardBox = (await card(page, session.folder).boundingBox())!;
  expect(errorBox.y, 'the error is under the row').toBeGreaterThanOrEqual(cardBox.y + cardBox.height - 1);
  await expect(markStar(row)).toHaveCount(1);
  await expect(removeStar(row)).toHaveCount(0);
  await expect(radio(page, session.folder)).not.toHaveAccessibleDescription(/Favorite/);
  await expect(dialog(page)).toBeVisible();
  expect(await markedOnServer(request, session.id)).toBe(false);
});

// ResumeDialog "Shows": the star sits after the label on its line; outline hidden until hover, filled star always shown
test('the outline star shows only on row hover, the filled star always, right after the label on the same line', async ({ page }) => {
  await showOnlyOwnSessions(page);
  const plain = await pastSession('plain');
  const favorite = await pastSession('favorite');
  marked.push(favorite.id);
  await page.goto('/');
  await openPopup(page);
  expect(await clickStar(page, markStar(pastGroup(page, favorite.folder)), favorite.folder, favorite.id)).toBe(204);

  await page.mouse.move(1, 1);
  const outline = markStar(pastGroup(page, plain.folder));
  const filled = removeStar(pastGroup(page, favorite.folder));
  await expect.poll(() => seenOpacity(outline)).toBe(0);
  await expect.poll(() => seenOpacity(filled)).toBe(1);

  await card(page, plain.folder).hover();
  await expect.poll(() => seenOpacity(outline)).toBeGreaterThan(0.5);

  const label = pastGroup(page, plain.folder).getByText(plain.label, { exact: true });
  const labelBox = (await label.boundingBox())!;
  const starBox = (await outline.boundingBox())!;
  expect(starBox.x, 'the star is after the label').toBeGreaterThanOrEqual(labelBox.x + labelBox.width - 1);
  const labelMiddle = labelBox.y + labelBox.height / 2;
  expect(labelMiddle, 'the star is on the line of the label').toBeGreaterThanOrEqual(starBox.y);
  expect(labelMiddle, 'the star is on the line of the label').toBeLessThanOrEqual(starBox.y + starBox.height);
});
