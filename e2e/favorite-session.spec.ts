// e2e of plan-favorite_session, batch favorite. The server runs the fake CLI, reads the fixture Claude Code folder E2E_CLAUDE_DIR
// and keeps the favorite marks in its own data folder (playwright.config.ts). Every session gets a unique Claude Code session id,
// so marks never collide. A mark is removed before each test ends. A restart of the client is covered by the unit tests of the store.
/// <reference lib="dom" />
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, type Response, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
const FAVORITES_FILE = path.join(os.tmpdir(), 'ai-client-e2e-data', 'session-favorites.json');
// The external scanner reads the sessions folder every 2 seconds.
const SCAN = { timeout: 10_000 };

let projectsRoot: string;
/** Folder of the current test: sessions of other tests and spec files stay on the server and must not show. */
let testRoot: string;
const createdIds: string[] = [];
const transcripts: string[] = [];
/** Claude Code session ids of the sessions a test marked: their mark is removed after the test. */
const marked: string[] = [];
const terminals: { process: ChildProcess; files: string[] }[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-favorite-'));
  await mkdir(SESSIONS_DIR, { recursive: true });
});

test.beforeEach(async () => {
  testRoot = await mkdtemp(path.join(projectsRoot, 'test-'));
});

test.afterEach(async ({ request }) => {
  for (const claudeId of marked.splice(0)) await clearMark(request, claudeId);
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
const byFolder = (page: Page, folder: string) => page.getByTitle(folder, { exact: true });
const item = (page: Page, folder: string) => list(page).getByRole('listitem').filter({ has: byFolder(page, folder) });
const entry = (page: Page, folder: string) => list(page).locator('.session-entry').filter({ has: byFolder(page, folder) });
const group = (page: Page, title: string) => list(page).locator('.session-group').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
const markButton = (page: Page, folder: string) => item(page, folder).getByRole('button', { name: 'Mark as Favorite', exact: true });
const removeButton = (page: Page, folder: string) => item(page, folder).getByRole('button', { name: 'Remove Favorite', exact: true });
const indicator = (page: Page, folder: string) => item(page, folder).getByRole('img', { name: 'Favorite', exact: true });
const resumeDialog = (page: Page) => page.getByRole('dialog', { name: 'Resume Session' });
const warning = (page: Page) => page.getByRole('alertdialog', { name: 'Session Running in a Terminal' });
const terminal = (page: Page) => page.locator('.xterm-rows');
const isFavoriteRequest = (r: { url(): string; method(): string }) => r.method() === 'PUT' && /^\/api\/sessions\/[^/]+\/favorite$/.test(new URL(r.url()).pathname);

/** Shows in the page only the sessions of the current test. */
async function showOnlyOwnSessions(page: Page): Promise<void> {
  const own = (session: { folder?: unknown } | undefined) => typeof session?.folder === 'string' && session.folder.startsWith(testRoot + path.sep);
  await page.route(
    (url) => url.pathname === '/api/sessions',
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      const sessions = (await response.json()) as { folder?: unknown }[];
      await route.fulfill({ response, json: sessions.filter(own) });
    },
  );
  await page.routeWebSocket(/\/api\/sessions\/events$/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((message) => {
      const frame = JSON.parse(String(message)) as { type?: string; session?: { folder?: unknown } };
      if (frame.type !== 'session' || own(frame.session)) ws.send(message);
    });
  });
}

async function newFolder(name: string): Promise<string> {
  const folder = path.join(testRoot, name);
  await mkdir(folder);
  return folder;
}

interface Hosted {
  id: string;
  claudeId: string;
  folder: string;
  prompt: string;
}

/** A hosted session that got a first prompt; idle unless `state` says otherwise. */
async function hostedSession(request: APIRequestContext, name: string, state: 'idle' | 'needs_input' | 'ended' = 'idle'): Promise<Hosted> {
  const folder = await newFolder(name);
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  const claudeId = randomUUID();
  const prompt = `Fix the ${name} page`;
  await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt, session_id: claudeId });
  if (state === 'needs_input') await postHook(request, id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  else await postHook(request, id, { hook_event_name: 'Stop' });
  if (state === 'ended') {
    await transcript(claudeId, folder, prompt);
    expect((await request.post(`/api/sessions/${id}/stop`)).ok()).toBe(true);
    await expect.poll(() => summaryOf(request, id).then((s) => s?.state), { message: `session ${name} ends` }).toBe('ended');
  }
  return { id, claudeId, folder, prompt };
}

async function postHook(request: APIRequestContext, id: string, event: Record<string, string>): Promise<void> {
  const response = await request.post(`/api/sessions/${id}/hook-events`, { data: event });
  expect(response.status()).toBe(204);
}

async function summaryOf(request: APIRequestContext, id: string): Promise<{ state: string; label: string; favorite?: true } | undefined> {
  const sessions = (await (await request.get('/api/sessions')).json()) as { id: string; state: string; label: string; favorite?: true }[];
  return sessions.find((s) => s.id === id);
}

/** Removes the mark of a conversation, also when its list entry is gone: a new hosted session takes the same Claude Code session id. */
async function clearMark(request: APIRequestContext, claudeId: string): Promise<void> {
  const folder = await mkdtemp(path.join(projectsRoot, 'clear-'));
  const { id } = (await (await request.post('/api/sessions', { data: { path: folder } })).json()) as { id: string };
  await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt: 'clear', session_id: claudeId });
  await request.put(`/api/sessions/${id}/favorite`, { data: { favorite: false } });
  await request.post(`/api/sessions/${id}/stop`);
}

/** The keys marked in the data folder of the e2e server. */
async function savedMarks(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(FAVORITES_FILE, 'utf8').catch(() => '{}')) as Record<string, unknown>;
}

/** Writes the transcript Claude Code leaves for a conversation, so the history lists it and can resume it. */
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

/** Waits for a resume answer and stops the new session after the test. */
async function resumed(response: Promise<Response>): Promise<string> {
  const answer = await response;
  expect(answer.status()).toBe(201);
  const { id } = (await answer.json()) as { id: string };
  createdIds.push(id);
  return id;
}

/** Marks from the list with the mouse: hover, "Mark as Favorite". */
async function markFromList(page: Page, folder: string, claudeId: string): Promise<void> {
  marked.push(claudeId);
  await item(page, folder).hover();
  const answer = page.waitForResponse((r) => isFavoriteRequest(r.request()));
  await markButton(page, folder).click();
  expect((await answer).status()).toBe(204);
  await expect(indicator(page, folder)).toHaveCount(1);
}

async function openHistory(page: Page): Promise<void> {
  await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(resumeDialog(page)).not.toContainText('Loading…');
}

const pastRow = (page: Page, folder: string) => resumeDialog(page).getByRole('region', { name: folder }).getByRole('radio');
const pastIndicator = (page: Page, folder: string) => resumeDialog(page).getByRole('region', { name: folder }).getByRole('img', { name: 'Favorite', exact: true });

/** The folders of the list entries, top to bottom. */
const listOrder = (page: Page) => list(page).getByRole('listitem').evaluateAll((items) => items.map((li) => li.querySelector('[title^="/"]')?.getAttribute('title') ?? ''));

/** Opacity the user sees: the product of the opacities of the element and its ancestors. */
const seenOpacity = (page: Page, folder: string) =>
  markButton(page, folder).evaluate((el) => {
    let value = 1;
    for (let node: Element | null = el; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
    return value;
  });

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

// plan-favorite_session/REQ-1, REQ-2, REQ-3, REQ-9, REQ-13 — scenario "The user marks a session as favorite from the list"
test('the keyboard marks a running session: the indicator shows and the entry keeps its place and group', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const first = await hostedSession(request, 'alpha');
  const target = await hostedSession(request, 'release');
  const last = await hostedSession(request, 'omega');
  marked.push(target.claudeId);
  const sent: unknown[] = [];
  page.on('request', (r) => {
    if (isFavoriteRequest(r)) sent.push(r.postDataJSON());
  });
  await page.goto('/');
  await expect(item(page, first.folder)).toHaveCount(1);
  await expect(item(page, last.folder)).toHaveCount(1);
  await expect(group(page, 'Running').getByRole('listitem')).toHaveCount(3);
  const before = await listOrder(page);
  await expect(indicator(page, target.folder)).toHaveCount(0);

  // the button is hidden until the focus inside the entry is visible from the keyboard
  await page.mouse.move(1, 1);
  await expect.poll(() => seenOpacity(page, target.folder)).toBe(0);
  await entry(page, target.folder).focus();
  await page.keyboard.press('Tab');
  await expect(markButton(page, target.folder)).toBeFocused();
  await expect(markButton(page, target.folder)).toHaveAttribute('title', 'Mark as Favorite');
  await expect.poll(() => seenOpacity(page, target.folder)).toBe(1);
  expect(await focusedShowsRing(page), 'the favorite button shows the focus ring').toBe(true);

  await page.keyboard.press('Enter');

  await expect(indicator(page, target.folder)).toHaveCount(1);
  await expect(indicator(page, target.folder)).toHaveAttribute('title', 'Favorite');
  await expect(removeButton(page, target.folder)).toHaveCount(1);
  await expect(markButton(page, target.folder)).toHaveCount(0);
  expect(sent).toEqual([{ favorite: true }]);
  expect(await listOrder(page)).toEqual(before);
  await expect(group(page, 'Running').getByRole('listitem').filter({ has: byFolder(page, target.folder) })).toHaveCount(1);
  expect((await summaryOf(request, target.id))?.favorite).toBe(true);
  expect(await indicator(page, first.folder).count()).toBe(0);
  expect(await indicator(page, last.folder).count()).toBe(0);
});

// plan-favorite_session/REQ-5, REQ-13 — "Remove Favorite" with the keyboard (Space)
test('the keyboard removes the mark: the indicator is gone and the entry keeps its place', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const session = await hostedSession(request, 'toggle');
  await hostedSession(request, 'other');
  await page.goto('/');
  await markFromList(page, session.folder, session.claudeId);
  const before = await listOrder(page);

  await entry(page, session.folder).focus();
  await page.keyboard.press('Tab');
  await expect(removeButton(page, session.folder)).toBeFocused();
  await expect(removeButton(page, session.folder)).toHaveAttribute('title', 'Remove Favorite');
  await page.keyboard.press('Space');

  await expect(indicator(page, session.folder)).toHaveCount(0);
  await expect(markButton(page, session.folder)).toHaveCount(1);
  expect(await listOrder(page)).toEqual(before);
  expect((await summaryOf(request, session.id))?.favorite).toBeUndefined();
  expect(await savedMarks()).not.toHaveProperty(session.claudeId);
});

// plan-favorite_session/REQ-4, REQ-5 — scenarios "The favorite indicator shows in the resume history" and "The user removes the mark"
test('the history shows the indicator on the marked row only, and a new history shows none after the mark is removed', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const favorite = await hostedSession(request, 'history-marked', 'ended');
  const plain = await hostedSession(request, 'history-plain', 'ended');
  await page.goto('/');
  await markFromList(page, favorite.folder, favorite.claudeId);

  await openHistory(page);
  await expect(pastRow(page, favorite.folder)).toHaveCount(1);
  await expect(pastRow(page, plain.folder)).toHaveCount(1);
  await expect(pastIndicator(page, favorite.folder)).toHaveCount(1);
  await expect(pastIndicator(page, favorite.folder)).toHaveAttribute('title', 'Favorite');
  await expect(pastIndicator(page, plain.folder)).toHaveCount(0);
  // the radio keeps its name (the label) and is described by "Favorite"
  await expect(pastRow(page, favorite.folder)).toHaveAccessibleName(favorite.prompt);
  await expect(pastRow(page, favorite.folder)).toHaveAccessibleDescription(/Favorite/);
  await expect(pastRow(page, plain.folder)).not.toHaveAccessibleDescription(/Favorite/);
  // the history offers no mark action
  await expect(resumeDialog(page).getByRole('button', { name: /Favorite/ })).toHaveCount(0);
  await resumeDialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();

  await removeButton(page, favorite.folder).click();
  await expect(indicator(page, favorite.folder)).toHaveCount(0);
  await openHistory(page);
  await expect(pastRow(page, favorite.folder)).toHaveCount(1);
  await expect(pastIndicator(page, favorite.folder)).toHaveCount(0);
});

// plan-favorite_session/REQ-2, REQ-3 — scenario "Any session can be marked, also in the Ended group and in another terminal"
test('an ended session and a session in another terminal can be marked, and keep their groups', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const ended = await hostedSession(request, 'ended-one', 'ended');
  const folder = await newFolder('terminal');
  const externalId = randomUUID();
  await runInTerminal(externalId, folder);
  await page.goto('/');
  await expect(entry(page, folder)).toBeVisible(SCAN);
  await expect(group(page, 'In Other Terminals').getByRole('listitem').filter({ has: byFolder(page, folder) })).toHaveCount(1);
  await expect(group(page, 'Ended').getByRole('listitem').filter({ has: byFolder(page, ended.folder) })).toHaveCount(1);

  await markFromList(page, ended.folder, ended.claudeId);
  await markFromList(page, folder, externalId);

  await expect(group(page, 'Ended').getByRole('img', { name: 'Favorite', exact: true })).toHaveCount(1);
  await expect(group(page, 'In Other Terminals').getByRole('img', { name: 'Favorite', exact: true })).toHaveCount(1);
  await expect(group(page, 'Ended').getByRole('listitem').filter({ has: byFolder(page, ended.folder) })).toHaveCount(1);
  await expect(group(page, 'In Other Terminals').getByRole('listitem').filter({ has: byFolder(page, folder) })).toHaveCount(1);
});

// plan-favorite_session/REQ-1, REQ-3 — the needs-input card has the button and the indicator
test('the needs-input card marks its session', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const session = await hostedSession(request, 'card', 'needs_input');
  await page.goto('/');
  await expect(group(page, 'Needs Input').locator('.session-card').filter({ has: byFolder(page, session.folder) })).toHaveCount(1);

  await markFromList(page, session.folder, session.claudeId);

  await expect(group(page, 'Needs Input').locator('.session-card').filter({ has: page.getByRole('img', { name: 'Favorite', exact: true }) })).toHaveCount(1);
  expect((await summaryOf(request, session.id))?.state).toBe('needs_input');
});

// plan-favorite_session/REQ-6 — scenario "The mark survives reload and restart" (restart: unit tests of SessionFavoriteStore.load)
test('the mark survives a reload and is saved in the data folder', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const session = await hostedSession(request, 'reload');
  await page.goto('/');
  await markFromList(page, session.folder, session.claudeId);
  expect(await savedMarks()).toHaveProperty(session.claudeId, true);

  await page.reload();

  await expect(entry(page, session.folder)).toBeVisible();
  await expect(indicator(page, session.folder)).toHaveCount(1);
  await expect(removeButton(page, session.folder)).toHaveCount(1);
});

// plan-favorite_session/REQ-7 — scenario "The mark survives a Resume": "Resume" of the ended entry
test('"Resume" of a favorite ended entry starts a session that shows the indicator', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const session = await hostedSession(request, 'list-resume', 'ended');
  await page.goto('/');
  await markFromList(page, session.folder, session.claudeId);

  const answer = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/sessions/${session.id}/resume`);
  await item(page, session.folder).getByRole('button', { name: 'Resume', exact: true }).click();
  const newId = await resumed(answer);

  expect((await summaryOf(request, newId))?.favorite).toBe(true);
  await expect(item(page, session.folder)).toHaveCount(1);
  await expect(indicator(page, session.folder)).toHaveCount(1);
});

// plan-favorite_session/REQ-7: "Resume" in the resume history
test('"Resume" from the resume history starts a session that shows the indicator', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const session = await hostedSession(request, 'history-resume', 'ended');
  await page.goto('/');
  await markFromList(page, session.folder, session.claudeId);

  await openHistory(page);
  await pastRow(page, session.folder).click();
  const answer = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/past-sessions/${session.claudeId}/resume`);
  await resumeDialog(page).getByRole('button', { name: 'Resume', exact: true }).click();
  const newId = await resumed(answer);

  await expect(terminal(page)).toContainText(`"--resume","${session.claudeId}"`);
  expect((await summaryOf(request, newId))?.favorite).toBe(true);
  await expect(list(page).locator('li').filter({ has: page.locator('.session-entry[aria-current="true"]') }).getByRole('img', { name: 'Favorite', exact: true })).toHaveCount(1);
});

// plan-favorite_session/REQ-7: "Resume Here" of an external session
test('"Resume Here" of a favorite external session starts a hosted session that shows the indicator', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const folder = await newFolder('takeover');
  const claudeId = randomUUID();
  await transcript(claudeId, folder, 'Run the nightly job');
  await runInTerminal(claudeId, folder);
  await page.goto('/');
  await expect(entry(page, folder)).toBeVisible(SCAN);
  await markFromList(page, folder, claudeId);

  await entry(page, folder).click();
  await page.getByRole('button', { name: 'Resume Here' }).click();
  const answer = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/past-sessions/${claudeId}/resume`);
  await warning(page).getByRole('button', { name: 'Resume Anyway' }).click();
  const newId = await resumed(answer);

  await expect(terminal(page)).toContainText(`"--resume","${claudeId}"`);
  expect((await summaryOf(request, newId))?.favorite).toBe(true);
  await expect(list(page).locator('li').filter({ has: page.locator('.session-entry[aria-current="true"]') }).getByRole('img', { name: 'Favorite', exact: true })).toHaveCount(1);
});

// plan-favorite_session/REQ-8 — scenario "Every open page gets the change" (the desktop window loads the same page)
test('a second page shows the mark and its removal without a reload', async ({ page, context, request }) => {
  const second = await context.newPage();
  for (const p of [page, second]) await showOnlyOwnSessions(p);
  const session = await hostedSession(request, 'tabs');
  await page.goto('/');
  await second.goto('/');
  await second.evaluate(() => ((window as unknown as { noReload: boolean }).noReload = true));
  await expect(entry(second, session.folder)).toBeVisible();

  await markFromList(page, session.folder, session.claudeId);

  await expect(indicator(second, session.folder)).toHaveCount(1);
  await expect(removeButton(second, session.folder)).toHaveCount(1);
  await removeButton(page, session.folder).click();
  await expect(indicator(second, session.folder)).toHaveCount(0);
  expect(await second.evaluate(() => (window as unknown as { noReload?: boolean }).noReload)).toBe(true);
});

// plan-favorite_session/REQ-8: an external session is notified at once, with no wait for the next scan
test('a second page shows the mark of an external session at once', async ({ page, context }) => {
  const second = await context.newPage();
  for (const p of [page, second]) await showOnlyOwnSessions(p);
  const folder = await newFolder('tabs-terminal');
  const claudeId = randomUUID();
  await runInTerminal(claudeId, folder);
  await page.goto('/');
  await second.goto('/');
  await expect(entry(second, folder)).toBeVisible(SCAN);
  await expect(entry(page, folder)).toBeVisible(SCAN);

  await markFromList(page, folder, claudeId);

  await expect(indicator(second, folder)).toHaveCount(1, { timeout: 1_500 });
});

// plan-favorite_session/REQ-10 — scenario "Dismiss keeps the mark"
test('"Dismiss" removes the entry but the history still shows the indicator on its row', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const session = await hostedSession(request, 'dismiss', 'ended');
  await page.goto('/');
  await markFromList(page, session.folder, session.claudeId);

  await item(page, session.folder).getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(item(page, session.folder)).toHaveCount(0);

  await openHistory(page);
  await expect(pastRow(page, session.folder)).toHaveCount(1);
  await expect(pastIndicator(page, session.folder)).toHaveCount(1);
  expect(await savedMarks()).toHaveProperty(session.claudeId, true);
});

// plan-favorite_session/REQ-11, REQ-12 — scenario "The indicator is clear without colour and in English"
for (const theme of ['dark', 'light'] as const) {
  test(`the indicator is a star shape with the tooltip "Favorite" in the ${theme} theme`, async ({ page, request }) => {
    await showOnlyOwnSessions(page);
    const session = await hostedSession(request, `look-${theme}`);
    await page.goto('/');
    if (theme === 'light') {
      await page.getByRole('button', { name: 'Dark theme' }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    }
    await markFromList(page, session.folder, session.claudeId);

    const star = indicator(page, session.folder);
    await star.hover();
    await expect(star).toBeVisible();
    await expect(star).toHaveAttribute('title', 'Favorite');
    const shape = await star.locator('svg').evaluate((svg) => ({
      paths: svg.querySelectorAll('path').length,
      color: getComputedStyle(svg).color,
      box: svg.getBoundingClientRect().width,
    }));
    // one path (the star), 12 px wide, in a colour other than the page background
    expect(shape.paths).toBe(1);
    expect(Math.round(shape.box)).toBe(12);
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(shape.color).not.toBe(background);
  });
}

// FavoriteIndicator spec: "a small filled star"; IconSet: the filled variant is painted with currentColor
test('the star of the indicator and of "Remove Favorite" is filled, as drawn in the browser', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const session = await hostedSession(request, 'filled');
  await page.goto('/');
  await expect(markButton(page, session.folder).locator('svg path')).toHaveCSS('fill', 'none');
  await markFromList(page, session.folder, session.claudeId);

  const paint = (path: Element) => ({ fill: getComputedStyle(path).fill, color: getComputedStyle(path).color });
  const inIndicator = await indicator(page, session.folder).locator('svg path').evaluate(paint);
  expect(inIndicator.fill, 'indicator star fill').toBe(inIndicator.color);
  const inButton = await removeButton(page, session.folder).locator('svg path').evaluate(paint);
  expect(inButton.fill, '"Remove Favorite" star fill').toBe(inButton.color);
});

// FavoriteButton spec: a failed request shows the error under the entry and the entry stays unmarked
test('a failed request shows "Could not change the favorite mark." and does not mark the session', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const session = await hostedSession(request, 'failure');
  await page.route((url) => /\/api\/sessions\/[^/]+\/favorite$/.test(url.pathname), (route) => route.fulfill({ status: 500, json: { error: 'boom' } }));
  await page.goto('/');
  await item(page, session.folder).hover();
  await markButton(page, session.folder).click();

  await expect(item(page, session.folder).getByText('Could not change the favorite mark.', { exact: true })).toBeVisible();
  await expect(indicator(page, session.folder)).toHaveCount(0);
  await expect(markButton(page, session.folder)).toHaveCount(1);
  expect((await summaryOf(request, session.id))?.favorite).toBeUndefined();
});

// FavoriteButton spec: the button does not open the session
test('pressing the favorite button does not open the session', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const session = await hostedSession(request, 'no-open');
  await page.goto('/');
  await markFromList(page, session.folder, session.claudeId);
  await expect(page.getByRole('main').locator('.session-header')).toHaveCount(0);
  await expect(list(page).locator('.session-entry[aria-current="true"]')).toHaveCount(0);
});

// plan-favorite_session/REQ-1, REQ-2, REQ-5 at the REST level: PUT /api/sessions/:id/favorite
test('the route answers 204, 404 session_not_found and 400 invalid_favorite', async ({ request }) => {
  const session = await hostedSession(request, 'rest');
  marked.push(session.claudeId);
  const url = `/api/sessions/${session.id}/favorite`;

  const set = await request.put(url, { data: { favorite: true } });
  expect(set.status()).toBe(204);
  expect(await set.text()).toBe('');
  expect((await summaryOf(request, session.id))?.favorite).toBe(true);
  expect(await savedMarks()).toHaveProperty(session.claudeId, true);

  const bad = await request.put(url, { data: { favorite: 'yes' } });
  expect(bad.status()).toBe(400);
  expect(await bad.json()).toEqual({ error: 'invalid_favorite' });
  expect((await summaryOf(request, session.id))?.favorite).toBe(true);

  const unknown = await request.put('/api/sessions/does-not-exist/favorite', { data: { favorite: true } });
  expect(unknown.status()).toBe(404);
  expect(await unknown.json()).toEqual({ error: 'session_not_found' });

  expect((await request.put(url, { data: { favorite: false } })).status()).toBe(204);
  expect((await summaryOf(request, session.id))?.favorite).toBeUndefined();
  expect(await savedMarks()).not.toHaveProperty(session.claudeId);
});
