// e2e of plan-resume_favorites, batch favorites-filter. Each test sees in the popup only its own sessions,
// and removes the marks it set before it ends: the e2e data folder is kept between runs.
/// <reference lib="dom" />
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

let projectsRoot: string;
let testRoot: string;
const transcripts: string[] = [];
/** Claude Code session ids whose mark is removed after the test. */
const marked: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-favorites-filter-'));
});

test.beforeEach(async () => {
  testRoot = await mkdtemp(path.join(projectsRoot, 'test-'));
});

test.afterEach(async ({ request }) => {
  for (const id of marked.splice(0)) await request.put(`/api/past-sessions/${id}/favorite`, { data: { favorite: false } });
});

test.afterAll(async () => {
  for (const file of transcripts.splice(0)) await rm(file, { force: true });
  await rm(projectsRoot, { recursive: true, force: true });
});

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Resume Session' });
const searchBar = (page: Page) => dialog(page).getByRole('textbox', { name: 'Search Past Sessions' });
const toggle = (page: Page) => dialog(page).getByRole('button', { name: 'Only Favorites', exact: true });
const pastGroup = (page: Page, folder: string) => dialog(page).getByRole('region', { name: folder });
const radios = (page: Page) => dialog(page).getByRole('radio');
const removeStar = (scope: Locator) => scope.getByRole('button', { name: 'Remove Favorite', exact: true });
const isResumeRequest = (r: { url(): string; method(): string }) => r.method() === 'POST' && /\/api\/past-sessions\/[^/]+\/resume$/.test(new URL(r.url()).pathname);

const own = (folder: unknown) => typeof folder === 'string' && folder.startsWith(testRoot + path.sep);

/** Shows in the popup only the sessions of the current test. */
async function showOnlyOwnSessions(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname === '/api/past-sessions',
    async (route) => {
      const response = await route.fetch();
      const groups = (await response.json()) as { folder?: unknown }[];
      await route.fulfill({ response, json: groups.filter((g) => own(g.folder)) });
    },
  );
}

function countResumes(page: Page): () => number {
  let count = 0;
  page.on('request', (r) => {
    if (isResumeRequest(r)) count++;
  });
  return () => count;
}

/** A past session with only its transcript, marked as favorite when asked. */
async function pastSession(request: APIRequestContext, name: string, label: string, favorite = false): Promise<{ id: string; folder: string; label: string }> {
  const folder = path.join(testRoot, name);
  await mkdir(folder);
  const id = randomUUID();
  const dir = path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'));
  await mkdir(dir, { recursive: true });
  const common = { cwd: folder, sessionId: id, isSidechain: false };
  const lines = [
    { ...common, type: 'user', message: { role: 'user', content: label } },
    { ...common, type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] } },
  ];
  const file = path.join(dir, `${id}.jsonl`);
  await writeFile(file, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  transcripts.push(file);
  if (favorite) {
    marked.push(id);
    expect((await request.put(`/api/past-sessions/${id}/favorite`, { data: { favorite: true } })).ok()).toBe(true);
  }
  return { id, folder, label };
}

async function openPopup(page: Page): Promise<void> {
  await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).not.toContainText('Loading…');
}

const starFill = (button: Locator) => button.locator('svg path').first().evaluate((p) => getComputedStyle(p).fill);
const look = (button: Locator) =>
  button.evaluate((el) => {
    const s = getComputedStyle(el);
    return { border: s.borderTopColor, background: s.backgroundColor };
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

// plan-resume_favorites/REQ-10, REQ-11, REQ-12, REQ-16, REQ-19 — scenario "The user shows only the favorite sessions"
test('"Only Favorites" with search text shows only the matching favorites, with a filled star and a pressed look', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const favLogin = await pastSession(request, 'fav-login', 'Fix login form', true);
  const plainLogin = await pastSession(request, 'plain-login', 'Fix login redirect');
  const favOther = await pastSession(request, 'fav-other', 'Write release notes', true);
  await pastSession(request, 'plain-other', 'Tidy imports');
  await page.goto('/');
  await openPopup(page);
  await expect(radios(page)).toHaveCount(4);

  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle(page)).toHaveAttribute('title', 'Only Favorites');
  expect(await starFill(toggle(page))).toBe('none');
  const offLook = await look(toggle(page));

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(radios(page)).toHaveCount(2);
  expect(await starFill(toggle(page))).not.toBe('none');
  await page.mouse.move(1, 1);
  const onLook = await look(toggle(page));
  expect(onLook.border, 'the pressed look has another border').not.toBe(offLook.border);
  expect(onLook.background, 'the pressed look has another background').not.toBe(offLook.background);

  await searchBar(page).fill('login');
  await expect(radios(page)).toHaveCount(1);
  await expect(pastGroup(page, favLogin.folder).getByRole('radio')).toHaveAccessibleName(favLogin.label);
  await expect(pastGroup(page, plainLogin.folder)).toHaveCount(0);
  await expect(pastGroup(page, favOther.folder)).toHaveCount(0);

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(radios(page)).toHaveCount(2);
  await expect(pastGroup(page, plainLogin.folder).getByRole('radio')).toHaveAccessibleName(plainLogin.label);
  expect(await starFill(toggle(page))).toBe('none');
});

// plan-resume_favorites/REQ-12, REQ-13, REQ-18 — scenario "The filter starts off"
test('the filter is off at the next opening, every session shows and the search bar has the focus', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  await pastSession(request, 'fav', 'Favorite task', true);
  await pastSession(request, 'plain', 'Plain task');
  await page.goto('/');
  await openPopup(page);
  await expect(searchBar(page)).toBeFocused();
  await toggle(page).click();
  await expect(radios(page)).toHaveCount(1);
  await dialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);

  await openPopup(page);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(radios(page)).toHaveCount(2);
  await expect(searchBar(page)).toBeFocused();
});

// plan-resume_favorites/REQ-14 — scenario "An unmarked row leaves the filtered list"
test('a row unmarked with the filter on leaves the list, the other favorite stays', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const first = await pastSession(request, 'first', 'First favorite', true);
  const second = await pastSession(request, 'second', 'Second favorite', true);
  await pastSession(request, 'plain', 'Plain task');
  await page.goto('/');
  await openPopup(page);
  await toggle(page).click();
  await expect(radios(page)).toHaveCount(2);

  const answer = page.waitForResponse((r) => r.request().method() === 'PUT' && new URL(r.url()).pathname === `/api/past-sessions/${first.id}/favorite`);
  await removeStar(pastGroup(page, first.folder)).click();
  expect((await answer).status()).toBe(204);
  await expect(pastGroup(page, first.folder)).toHaveCount(0);
  await expect(radios(page)).toHaveCount(1);
  await expect(pastGroup(page, second.folder).getByRole('radio')).toHaveAccessibleName(second.label);
});

// plan-resume_favorites/REQ-15, REQ-19 — scenario "No favorite matches"
test('the filter on shows the favorite empty states', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  await pastSession(request, 'plain', 'Plain task');
  await page.goto('/');
  await openPopup(page);
  await toggle(page).click();
  await expect(dialog(page).getByText('No favorite sessions.', { exact: true })).toBeVisible();
  await expect(dialog(page).getByRole('radiogroup')).toHaveCount(0);

  await searchBar(page).fill('nothing-like-this');
  await expect(dialog(page).getByText('No favorite sessions match "nothing-like-this".', { exact: true })).toBeVisible();
});

// plan-resume_favorites/REQ-17 — scenario "The filter works with the keyboard"
test('Tab reaches "Only Favorites" from the search bar with a focus ring; Space and Enter switch it, nothing is resumed', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const fav = await pastSession(request, 'fav', 'Favorite task', true);
  const plain = await pastSession(request, 'plain', 'Plain task');
  const resumes = countResumes(page);
  await page.goto('/');
  await openPopup(page);
  await expect(searchBar(page)).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(toggle(page)).toBeFocused();
  expect(await focusedShowsRing(page)).toBe(true);

  await page.keyboard.press('Space');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(radios(page)).toHaveCount(1);
  await expect(toggle(page)).toBeFocused();

  await pastGroup(page, fav.folder).locator('.list-card').click();
  await expect(pastGroup(page, fav.folder).getByRole('radio')).toBeChecked();
  await toggle(page).focus();
  await page.keyboard.press('Enter');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(pastGroup(page, plain.folder)).toHaveCount(1);
  await expect(dialog(page)).toBeVisible();
  expect(resumes()).toBe(0);
});

// ResumeDialog "Tab": "Clear Search", when shown, comes before the toggle
test('with search text, Tab goes from the search bar to "Clear Search" and then to "Only Favorites"', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  await pastSession(request, 'plain', 'Plain task');
  await page.goto('/');
  await openPopup(page);
  await searchBar(page).fill('plain');
  await page.keyboard.press('Tab');
  await expect(dialog(page).getByRole('button', { name: 'Clear Search', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(toggle(page)).toBeFocused();
});
