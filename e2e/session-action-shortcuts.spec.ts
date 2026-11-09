// e2e of plan-keyboard_shortcuts, batch session-actions: the session action shortcuts on hosted sessions, the dialogs and the theme.
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, type Request, expect, test } from '@playwright/test';

const ONE_SECOND = { timeout: 1000 };

let projectsRoot: string;
const createdIds: string[] = [];

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

// The page shows only the sessions of the running test: other specs and the earlier tests of this file leave theirs on the server.
test.beforeEach(async ({ page }) => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-action-keys-'));
  const own = (session: { folder?: unknown } | undefined) => typeof session?.folder === 'string' && session.folder.startsWith(projectsRoot + path.sep);
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
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const byFolder = (page: Page, folder: string) => page.getByTitle(folder, { exact: true });
const item = (page: Page, folder: string) => list(page).getByRole('listitem').filter({ has: byFolder(page, folder) });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: byFolder(page, folder) });
const nameField = (page: Page) => list(page).getByRole('textbox', { name: 'Session Name', exact: true });
const terminal = (page: Page) => page.locator('.xterm-rows');
const terminalInput = (page: Page) => page.locator('.xterm-helper-textarea');
const confirmation = (page: Page) => page.getByRole('alertdialog', { name: 'Terminate the Session?' });
const chooser = (page: Page) => page.getByRole('dialog', { name: 'New Claude Code Session' });
const history = (page: Page) => page.getByRole('dialog', { name: 'Resume Session' });
const anyDialog = (page: Page) => page.locator('[role="dialog"], [role="alertdialog"]');
const noOpenSession = (page: Page) => page.getByText('No open session.');
const themeSwitch = (page: Page) => page.getByRole('banner').getByRole('button', { name: 'Dark theme', exact: true });

async function newFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  return folder;
}

async function startViaApi(request: APIRequestContext, folder: string): Promise<string> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  return id;
}

async function postHook(request: APIRequestContext, id: string, event: Record<string, string>): Promise<void> {
  const response = await request.post(`/api/sessions/${id}/hook-events`, { data: event });
  expect(response.status()).toBe(204);
}

async function stateOf(request: APIRequestContext, id: string): Promise<string | undefined> {
  const sessions = (await (await request.get('/api/sessions')).json()) as { id: string; state: string }[];
  return sessions.find((s) => s.id === id)?.state;
}

/** A hosted session that ended with no saved conversation: its entry offers only "Dismiss". */
async function endedSession(request: APIRequestContext, name: string): Promise<{ id: string; folder: string }> {
  const folder = await newFolder(name);
  const id = await startViaApi(request, folder);
  await postHook(request, id, { hook_event_name: 'SessionStart', session_id: randomUUID() });
  expect((await request.post(`/api/sessions/${id}/stop`)).ok()).toBe(true);
  await expect.poll(() => stateOf(request, id), { message: `session ${name} ends` }).toBe('ended');
  return { id, folder };
}

/** Starts an idle session, loads the page and opens the session by a click. */
async function openSession(page: Page, request: APIRequestContext, name: string): Promise<{ id: string; folder: string }> {
  const folder = await newFolder(name);
  const id = await startViaApi(request, folder);
  await page.goto('/');
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
  await expect(terminal(page)).toContainText('READY');
  return { id, folder };
}

async function focusTerminal(page: Page): Promise<void> {
  await page.locator('.xterm-screen').click();
  await expect(terminalInput(page)).toBeFocused();
}

async function typeLine(page: Page, text: string): Promise<void> {
  await focusTerminal(page);
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

/** Records the POST requests of the session actions: stop, dismiss and resume of any session. */
function recordActions(page: Page): Request[] {
  const requests: Request[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/(stop|dismiss|resume)$/.test(new URL(r.url()).pathname)) requests.push(r);
  });
  return requests;
}

const paths = (requests: Request[]) => requests.map((r) => new URL(r.url()).pathname);

/** Number of input chunks the fake CLI echoed so far. */
const inputChunks = async (page: Page) => ((await terminal(page).textContent()) ?? '').split('IN:').length - 1;

// plan-keyboard_shortcuts/REQ-14, REQ-15, REQ-39, REQ-40 — scenario "The user stops a working session from the keyboard, after the confirmation"
test('Alt+Shift+Q in the terminal of a working session asks the confirmation, and "Terminate" ends the session', async ({ page, request }) => {
  const { id, folder } = await openSession(page, request, 'stop-working');
  await typeLine(page, 'WORK');
  await expect(entry(page, folder)).toContainText('Running');
  await focusTerminal(page);
  const typed = await inputChunks(page);
  const actions = recordActions(page);

  await page.keyboard.press('Alt+Shift+KeyQ');
  await expect(confirmation(page)).toBeVisible(ONE_SECOND);
  await expect(confirmation(page).getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.waitForTimeout(300);
  expect(paths(actions), 'no stop request before the confirmation').toEqual([]);
  expect(await inputChunks(page), 'Alt+Shift+Q reached the CLI').toBe(typed);

  await confirmation(page).getByRole('button', { name: 'Terminate', exact: true }).click();
  await expect(confirmation(page)).toHaveCount(0);
  await expect(entry(page, folder)).toContainText('Ended');
  expect(paths(actions)).toEqual([`/api/sessions/${id}/stop`]);
});

// plan-keyboard_shortcuts/REQ-15: "Cancel" in the confirmation of the shortcut keeps the session working
test('"Cancel" in the confirmation opened by Alt+Shift+Q sends no stop and keeps the session working', async ({ page, request }) => {
  const { folder } = await openSession(page, request, 'stop-cancel');
  await typeLine(page, 'WORK');
  await expect(entry(page, folder)).toContainText('Running');
  const actions = recordActions(page);

  await page.keyboard.press('Alt+Shift+KeyQ');
  await expect(confirmation(page)).toBeVisible(ONE_SECOND);
  await confirmation(page).getByRole('button', { name: 'Cancel', exact: true }).click();

  await expect(confirmation(page)).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(paths(actions)).toEqual([]);
  await expect(entry(page, folder)).toContainText('Running');
});

// plan-keyboard_shortcuts/REQ-14: on a session that is not working, the shortcut stops at once, as "Terminate" does
test('Alt+Shift+Q on an idle session stops it at once, with no confirmation', async ({ page, request }) => {
  const { id, folder } = await openSession(page, request, 'stop-idle');
  await expect(entry(page, folder)).toContainText('Idle');
  const actions = recordActions(page);

  await page.keyboard.press('Alt+Shift+KeyQ');
  await expect(entry(page, folder)).toContainText('Ended');
  await expect(anyDialog(page)).toHaveCount(0);
  expect(paths(actions)).toEqual([`/api/sessions/${id}/stop`]);
});

// plan-keyboard_shortcuts/REQ-43 — scenario "A shortcut that does not apply does nothing"
test('with no open session, the session action keys change nothing', async ({ page, request }) => {
  const folder = await newFolder('nothing-open');
  await startViaApi(request, folder);
  await page.goto('/');
  await expect(entry(page, folder)).toBeVisible();
  await expect(noOpenSession(page)).toBeVisible();
  const actions = recordActions(page);

  for (const key of ['Alt+Shift+KeyQ', 'Alt+Shift+KeyW', 'Alt+KeyR', 'Alt+KeyE']) await page.keyboard.press(key);
  await page.waitForTimeout(300);

  await expect(noOpenSession(page)).toBeVisible();
  await expect(anyDialog(page)).toHaveCount(0);
  await expect(nameField(page)).toHaveCount(0);
  await expect(entry(page, folder)).toContainText('Idle');
  expect(paths(actions)).toEqual([]);
});

// plan-keyboard_shortcuts/REQ-17, REQ-18, REQ-43: dismiss and resume do not apply to a running hosted session
test('Alt+Shift+W and Alt+R on a running hosted session do nothing', async ({ page, request }) => {
  const { folder } = await openSession(page, request, 'running-no-dismiss');
  await focusTerminal(page);
  const actions = recordActions(page);

  await page.keyboard.press('Alt+Shift+KeyW');
  await page.keyboard.press('Alt+KeyR');
  await page.waitForTimeout(300);

  expect(paths(actions)).toEqual([]);
  await expect(anyDialog(page)).toHaveCount(0);
  await expect(entry(page, folder)).toHaveAttribute('aria-current', 'true');
  await expect(entry(page, folder)).toContainText('Idle');
  await expect(terminal(page), 'the keys reached the CLI').not.toContainText('IN:');
});

// plan-keyboard_shortcuts/REQ-17 — scenario "The user dismisses an ended session from the keyboard"
test('Alt+Shift+W on the open ended session removes its entry at once and empties the main area', async ({ page, request }) => {
  const ended = await endedSession(request, 'dismiss-open');
  const other = await endedSession(request, 'dismiss-other');
  await page.goto('/');
  await entry(page, ended.folder).click();
  await expect(entry(page, ended.folder)).toHaveAttribute('aria-current', 'true');
  await expect(noOpenSession(page)).toHaveCount(0);
  const actions = recordActions(page);

  await page.keyboard.press('Alt+Shift+KeyW');

  await expect(item(page, ended.folder)).toHaveCount(0, ONE_SECOND);
  await expect(noOpenSession(page)).toBeVisible();
  await expect(anyDialog(page), 'no confirmation').toHaveCount(0);
  await expect(item(page, other.folder), 'the ended session that was not open stays').toBeVisible();
  expect(paths(actions)).toEqual([`/api/sessions/${ended.id}/dismiss`]);
});

// plan-keyboard_shortcuts/REQ-14, REQ-18, REQ-43: stop does not apply to an ended session, and resume needs a saved conversation
test('Alt+Shift+Q and Alt+R on an open ended session with no conversation do nothing', async ({ page, request }) => {
  const ended = await endedSession(request, 'ended-no-conversation');
  await page.goto('/');
  await entry(page, ended.folder).click();
  await expect(entry(page, ended.folder)).toHaveAttribute('aria-current', 'true');
  await expect(item(page, ended.folder).getByRole('button', { name: 'Resume', exact: true })).toHaveCount(0);
  const actions = recordActions(page);

  await page.keyboard.press('Alt+Shift+KeyQ');
  await page.keyboard.press('Alt+KeyR');
  await page.waitForTimeout(300);

  expect(paths(actions)).toEqual([]);
  await expect(anyDialog(page)).toHaveCount(0);
  await expect(item(page, ended.folder)).toContainText('Ended');
  await expect(entry(page, ended.folder)).toHaveAttribute('aria-current', 'true');
});

// plan-keyboard_shortcuts/REQ-12, REQ-13 — scenario "The user opens the session dialogs from the keyboard"
test('Alt+N opens the new-session dialog, and after Esc Alt+H opens the resume history dialog', async ({ page }) => {
  await page.goto('/');
  await expect(noOpenSession(page)).toBeVisible();

  await page.keyboard.press('Alt+KeyN');
  await expect(chooser(page)).toBeVisible(ONE_SECOND);
  await expect(history(page)).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(chooser(page)).toHaveCount(0);

  await page.keyboard.press('Alt+KeyH');
  await expect(history(page)).toBeVisible(ONE_SECOND);
  await expect(chooser(page)).toHaveCount(0);
});

// plan-keyboard_shortcuts/REQ-12, REQ-13, REQ-39, REQ-40: the dialog keys work from the terminal of a hosted session too
test('Alt+N and Alt+H in the terminal open the dialogs and type nothing in the CLI', async ({ page, request }) => {
  await openSession(page, request, 'dialogs-from-terminal');
  await focusTerminal(page);

  await page.keyboard.press('Alt+KeyN');
  await expect(chooser(page)).toBeVisible(ONE_SECOND);
  await page.keyboard.press('Escape');
  await expect(chooser(page)).toHaveCount(0);

  await focusTerminal(page);
  await page.keyboard.press('Alt+KeyH');
  await expect(history(page)).toBeVisible(ONE_SECOND);
  await page.keyboard.press('Escape');
  await expect(history(page)).toHaveCount(0);
  await expect(terminal(page), 'Alt+N or Alt+H reached the CLI').not.toContainText('IN:');
});

// plan-keyboard_shortcuts/REQ-16, REQ-39, REQ-40 — scenario "The user renames the open session from the keyboard"
test('Alt+E in the terminal shows the "Session Name" field in the entry of the open session, with the focus', async ({ page, request }) => {
  const other = await newFolder('rename-other');
  await startViaApi(request, other);
  const { folder } = await openSession(page, request, 'rename-open');
  await expect(entry(page, other)).toBeVisible();
  await focusTerminal(page);

  await page.keyboard.press('Alt+KeyE');

  const field = item(page, folder).getByRole('textbox', { name: 'Session Name', exact: true });
  await expect(field).toBeVisible(ONE_SECOND);
  await expect(field).toBeFocused();
  await expect(nameField(page), 'only the open entry edits').toHaveCount(1);
  await expect(terminal(page), 'Alt+E reached the CLI').not.toContainText('IN:');
});

// SessionList spec, plan-keyboard_shortcuts/REQ-16: the entry of the open session scrolls into view
test('Alt+E scrolls the entry of the open session into view', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  const folders: string[] = [];
  for (let n = 0; n < 14; n++) {
    const folder = await newFolder(`scroll-${String(n).padStart(2, '0')}`);
    await startViaApi(request, folder);
    folders.push(folder);
  }
  await page.goto('/');
  for (const folder of folders) await expect(item(page, folder)).toHaveCount(1);
  const last = await list(page)
    .getByRole('listitem')
    .last()
    .evaluate((li) => li.querySelector('[title^="/"]')?.getAttribute('title') ?? '');
  await entry(page, last).click();
  await expect(entry(page, last)).toHaveAttribute('aria-current', 'true');

  const scrolled = await list(page).evaluate((region) => {
    const scrollers = [region, ...region.querySelectorAll('*')].filter((el) => el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY !== 'visible');
    for (const el of scrollers) el.scrollTop = 0;
    return scrollers.length;
  });
  expect(scrolled, 'the list scrolls: its entries do not fit').toBeGreaterThan(0);
  await expect(entry(page, last)).not.toBeInViewport();

  await page.keyboard.press('Alt+KeyE');

  const field = item(page, last).getByRole('textbox', { name: 'Session Name', exact: true });
  await expect(field).toBeFocused(ONE_SECOND);
  await expect(field).toBeInViewport();
});

// plan-keyboard_shortcuts/REQ-21 — scenario "The user switches the theme from the keyboard"
test('Alt+A switches from the dark to the light theme and back, as the switch does', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(themeSwitch(page)).toHaveAttribute('aria-pressed', 'true');
  const moon = await themeSwitch(page).locator('svg').innerHTML();

  await page.keyboard.press('Alt+KeyA');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light', ONE_SECOND);
  await expect(themeSwitch(page)).toHaveAttribute('aria-pressed', 'false');
  expect(await themeSwitch(page).locator('svg').innerHTML(), 'the switch shows another icon, the sun').not.toBe(moon);
  expect(await page.evaluate(() => localStorage.getItem('ai-client.theme')), 'the choice is saved, as the switch saves it').toBe('light');

  await page.keyboard.press('Alt+KeyA');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark', ONE_SECOND);
  await expect(themeSwitch(page)).toHaveAttribute('aria-pressed', 'true');
  expect(await themeSwitch(page).locator('svg').innerHTML()).toBe(moon);
  expect(await page.evaluate(() => localStorage.getItem('ai-client.theme'))).toBe('dark');
});
