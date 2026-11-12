// e2e of plan-recent_projects, batch project-session-start. The server runs the fake CLI and reads the fixture Claude Code folder E2E_CLAUDE_DIR.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

let projectsRoot: string;
const startedIds: string[] = [];

test.beforeEach(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await mkdir(path.join(E2E_CLAUDE_DIR, 'projects'), { recursive: true });
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-session-start-'));
});

test.afterEach(async ({ request }) => {
  for (const id of startedIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  await rm(projectsRoot, { recursive: true, force: true });
});

test.afterAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
});

const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const railButton = (page: Page, name: string) => rail(page).getByRole('button', { name, exact: true });
const panel = (page: Page) => page.getByRole('region', { name: 'Session List' });
const row = (page: Page, folder: string) => panel(page).locator('.project-row').filter({ has: page.getByTitle(folder, { exact: true }) });
const nameDialog = (page: Page) => page.getByRole('dialog', { name: 'New session' });
const nameField = (page: Page) => nameDialog(page).getByRole('textbox', { name: 'Session name' });
const action = (page: Page, name: string) => nameDialog(page).getByRole('button', { name, exact: true });
const sessionEntry = (page: Page, folder: string) => panel(page).locator('.session-entry').filter({ has: page.getByTitle(folder, { exact: true }) });
const header = (page: Page) => page.getByRole('main').locator('.session-header');
const isStartRequest = (r: { url(): string; method(): string }) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/sessions';

/** Writes a past session of a project folder, as Claude Code leaves it, and creates the folder. */
async function project(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder, { recursive: true });
  const dir = path.join(E2E_CLAUDE_DIR, 'projects', folder.replaceAll('/', '-'));
  await mkdir(dir, { recursive: true });
  const common = { cwd: folder, sessionId: `${name}-session`, isSidechain: false };
  const lines = [
    { ...common, type: 'user', message: { role: 'user', content: `Work in ${name}` } },
    { ...common, type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] } },
  ];
  await writeFile(path.join(dir, `${common.sessionId}.jsonl`), lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  return folder;
}

async function openProjects(page: Page): Promise<void> {
  const loaded = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/past-sessions');
  await railButton(page, 'Projects').click();
  await loaded;
}

/** Hosted sessions of the server in a folder. */
async function sessionsIn(request: APIRequestContext, folder: string): Promise<{ id: string; label: string }[]> {
  const sessions = (await (await request.get('/api/sessions')).json()) as { id: string; folder?: string; label: string }[];
  return sessions.filter((session) => session.folder === folder);
}

/** Records every start request the page sends, and the id of each session it starts. */
function startRequests(page: Page): unknown[] {
  const bodies: unknown[] = [];
  page.on('request', (r) => {
    if (isStartRequest(r)) bodies.push(r.postDataJSON());
  });
  page.on('response', async (r) => {
    if (isStartRequest(r.request()) && r.status() === 201) startedIds.push(((await r.json()) as { id: string }).id);
  });
  return bodies;
}

async function computedColour(page: Page, cssValue: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement('div');
    probe.style.color = value;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, cssValue);
}

/** Whether the focused element draws the focus ring colour as an outline or a box-shadow. */
async function focusedShowsRing(page: Page): Promise<boolean> {
  const ring = await computedColour(page, 'var(--color-focus-ring)');
  return page.evaluate((ringColour) => {
    const el = document.activeElement;
    if (!el) return false;
    const s = getComputedStyle(el);
    const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor === ringColour;
    return outline || s.boxShadow.includes(ringColour) || s.borderColor === ringColour;
  }, ring);
}

/** Whether the "▶ New session" label of a row is seen: rendered, visible and not transparent. */
const goLabelSeen = (page: Page, folder: string) =>
  row(page, folder)
    .getByText('New session')
    .evaluateAll((els) => els.some((el) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true })));

// plan-recent_projects/REQ-14, REQ-16, REQ-17, REQ-18, REQ-20, REQ-23, REQ-24 — scenario "the user starts a named session in a past project"
test('Enter on a project row, a name and Enter start a named session in that folder, open in the main area and in the session list', async ({ page, request }) => {
  const folder = await project('shop-api');
  const bodies = startRequests(page);
  await page.goto('/');
  await openProjects(page);
  await row(page, folder).focus();
  await page.keyboard.press('Enter');

  await expect(nameDialog(page)).toBeVisible();
  await expect(nameDialog(page)).toContainText('shop-api');
  await expect(nameDialog(page).getByText(folder, { exact: true })).toBeVisible();
  await expect(nameDialog(page)).toContainText('Leave it empty to use the default name. Enter starts, Esc cancels.');
  await expect(action(page, 'Cancel')).toBeVisible();
  await expect(action(page, 'Start Session')).toBeVisible();
  await expect(nameField(page)).toBeFocused();
  await expect(nameField(page)).toHaveValue('');

  await page.keyboard.type('  Rate limiter tests  ');
  await page.keyboard.press('Enter');
  await expect(nameDialog(page)).toHaveCount(0);
  expect(bodies).toEqual([{ path: folder, name: 'Rate limiter tests' }]);

  await expect(header(page)).toContainText('shop-api');
  await expect(header(page)).toContainText('Rate limiter tests');
  await expect(page.getByRole('main')).toContainText(folder);
  const [started] = await sessionsIn(request, folder);
  expect(started?.label).toBe('Rate limiter tests');
  expect(started?.id).toBe(startedIds[0]);

  // The side column stays on the Projects view; the session is in the session list.
  await expect(panel(page).getByRole('heading', { level: 1, name: 'Projects', exact: true })).toBeVisible();
  await railButton(page, 'Sessions').click();
  await expect(sessionEntry(page, folder)).toHaveCount(1);
  await expect(sessionEntry(page, folder)).toContainText('Rate limiter tests');
});

// plan-recent_projects/REQ-14: a click and Space choose an available row too
test('a click and Space on an available row open the name dialog for that project', async ({ page }) => {
  const folder = await project('web-dashboard');
  await page.goto('/');
  await openProjects(page);
  await row(page, folder).click();
  await expect(nameDialog(page)).toBeVisible();
  await expect(nameDialog(page)).toContainText('web-dashboard');
  await action(page, 'Cancel').click();
  await expect(nameDialog(page)).toHaveCount(0);

  await row(page, folder).focus();
  await page.keyboard.press('Space');
  await expect(nameDialog(page)).toBeVisible();
});

// plan-recent_projects/REQ-19 — scenario "an empty name gives the default label"
test('spaces only and "Start Session" start the session with the default label', async ({ page, request }) => {
  const folder = await project('billing');
  const bodies = startRequests(page);
  await page.goto('/');
  await openProjects(page);
  await row(page, folder).click();
  await nameField(page).fill('    ');
  await action(page, 'Start Session').click();
  await expect(nameDialog(page)).toHaveCount(0);
  expect(bodies).toEqual([{ path: folder, name: '' }]);

  await expect(header(page)).toContainText('billing');
  // The default label of a new session is its folder name.
  await expect.poll(async () => (await sessionsIn(request, folder)).map((s) => s.label)).toEqual(['billing']);
  await railButton(page, 'Sessions').click();
  await expect(sessionEntry(page, folder)).toHaveCount(1);
  await expect(sessionEntry(page, folder)).toContainText('billing');
});

// plan-recent_projects/REQ-21 — scenario "the user cancels the name dialog"
test('Esc and "Cancel" close the name dialog, start no session, and give the focus back to the row', async ({ page, request }) => {
  const folder = await project('cancelled');
  const bodies = startRequests(page);
  await page.goto('/');
  await openProjects(page);

  await row(page, folder).focus();
  await page.keyboard.press('Enter');
  await nameField(page).fill('Never started');
  await page.keyboard.press('Escape');
  await expect(nameDialog(page)).toHaveCount(0);
  await expect(row(page, folder)).toBeFocused();

  await page.keyboard.press('Enter');
  await action(page, 'Cancel').click();
  await expect(nameDialog(page)).toHaveCount(0);
  await expect(row(page, folder)).toBeFocused();

  expect(bodies).toEqual([]);
  expect(await sessionsIn(request, folder)).toEqual([]);
  await railButton(page, 'Sessions').click();
  await expect(sessionEntry(page, folder)).toHaveCount(0);
});

// plan-recent_projects/REQ-15 — scenario "an unavailable folder starts nothing"
test('a click, Enter or Space on a "Folder not found" row opens no dialog and starts no session', async ({ page, request }) => {
  const folder = await project('gone');
  await rm(folder, { recursive: true });
  const bodies = startRequests(page);
  await page.goto('/');
  await openProjects(page);
  await expect(row(page, folder)).toContainText('Folder not found');

  await row(page, folder).click({ force: true });
  await row(page, folder).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(bodies).toEqual([]);
  expect(await sessionsIn(request, folder)).toEqual([]);
});

// plan-recent_projects/REQ-22 — scenario "the start fails"
test('when the folder was deleted after the list loaded, the dialog shows "Could not start the session." and stays open', async ({ page, request }) => {
  const folder = await project('deleted-later');
  await page.goto('/');
  await openProjects(page);
  await row(page, folder).click();
  await expect(nameDialog(page)).toBeVisible();
  await rm(folder, { recursive: true });

  await nameField(page).fill('Lost');
  const answered = page.waitForResponse((r) => isStartRequest(r.request()));
  await action(page, 'Start Session').click();
  expect((await answered).status()).toBe(404);
  await expect(nameDialog(page)).toContainText('Could not start the session.');
  await expect(nameDialog(page)).toBeVisible();
  await expect(action(page, 'Start Session')).toBeEnabled();
  expect(await sessionsIn(request, folder)).toEqual([]);

  await action(page, 'Cancel').click();
  await railButton(page, 'Sessions').click();
  await expect(sessionEntry(page, folder)).toHaveCount(0);
});

// plan-recent_projects/REQ-22: a network failure is a failed start too
test('a network failure shows "Could not start the session." and keeps the dialog open', async ({ page }) => {
  const folder = await project('offline');
  await page.route((url) => url.pathname === '/api/sessions', (route) => (route.request().method() === 'POST' ? route.abort() : route.fallback()));
  await page.goto('/');
  await openProjects(page);
  await row(page, folder).click();
  await action(page, 'Start Session').click();
  await expect(nameDialog(page)).toContainText('Could not start the session.');
  await expect(nameDialog(page)).toBeVisible();
});

// plan-recent_projects/REQ-23: the name dialog works from the keyboard, with visible focus
test('Tab moves through the name dialog with the focus ring, and stays inside it', async ({ page }) => {
  const folder = await project('keyboard');
  await page.goto('/');
  await openProjects(page);
  await row(page, folder).focus();
  await page.keyboard.press('Enter');
  await expect(nameField(page)).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(action(page, 'Cancel')).toBeFocused();
  expect(await focusedShowsRing(page), 'focus ring on "Cancel"').toBe(true);
  await page.keyboard.press('Tab');
  await expect(action(page, 'Start Session')).toBeFocused();
  expect(await focusedShowsRing(page), 'focus ring on "Start Session"').toBe(true);
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('Tab');
    expect(await nameDialog(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
});

// plan-recent_projects/REQ-18: the field takes up to 200 characters, counted as code points
test('the field takes a name of 150 characters outside the basic plane', async ({ page }) => {
  const folder = await project('emoji');
  await page.goto('/');
  await openProjects(page);
  await row(page, folder).click();
  await nameField(page).focus();
  await page.keyboard.insertText('😀'.repeat(150));
  expect(Array.from(await nameField(page).inputValue())).toHaveLength(150);
});

// ProjectList: "▶ New session" on hover and visible focus of an available row, never on an unavailable row, never in the row name
test('an available row shows "▶ New session" on hover and on focus; an unavailable row never does', async ({ page }) => {
  const available = await project('hover-me');
  const unavailable = await project('missing-one');
  await rm(unavailable, { recursive: true });
  await page.goto('/');
  await openProjects(page);
  await railButton(page, 'Projects').focus();

  await page.mouse.move(900, 600);
  await expect.poll(() => goLabelSeen(page, available)).toBe(false);
  await row(page, available).hover();
  await expect.poll(() => goLabelSeen(page, available)).toBe(true);
  await expect(row(page, available).getByText('▶ New session')).toHaveCount(1);
  await expect(row(page, available)).not.toHaveAccessibleName(/New session/);

  await page.mouse.move(900, 600);
  await page.keyboard.press('Shift');
  await row(page, available).focus();
  await expect.poll(() => goLabelSeen(page, available)).toBe(true);

  await row(page, unavailable).hover({ force: true });
  expect(await goLabelSeen(page, unavailable)).toBe(false);
});
