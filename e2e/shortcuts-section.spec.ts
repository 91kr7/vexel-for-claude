// e2e of plan-settings_dialog, batches shortcuts-section and editable-shortcuts: the "Shortcuts" tab of the settings popup, Alt+S, and the shortcuts panel gone.
// It carries the panel tests of plan-keyboard_shortcuts, batch shortcuts-panel, over to the tab.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, type Request, expect, test } from '@playwright/test';
import { chooseInSettings, settingsButton, settingsPopup } from './settings';

const ONE_SECOND = { timeout: 1000 };
const GROUPS = ['Navigation', 'Sessions', 'Terminal', 'General'];

let projectsRoot: string;
const createdIds: string[] = [];

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

// The page shows only the sessions of the running test: other specs and the earlier tests of this file leave theirs on the server.
test.beforeEach(async ({ page }) => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-shortcuts-section-'));
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

const banner = (page: Page) => page.getByRole('banner');
const usageButton = (page: Page) => banner(page).getByRole('button', { name: 'Plan Usage', exact: true });
const newSessionButton = (page: Page) => page.getByRole('main').getByRole('button', { name: 'New Session', exact: true });
const popup = settingsPopup;
const tab = (page: Page, name: string) => popup(page).getByRole('tab', { name, exact: true });
const shortcutList = (page: Page) => popup(page).getByRole('region', { name: 'Shortcut List' });
const anyDialog = (page: Page) => page.locator('[role="dialog"], [role="alertdialog"]');
const group = (page: Page, name: string) => shortcutList(page).locator('section').filter({ has: page.getByRole('heading', { name, exact: true }) });
const chooser = (page: Page) => page.getByRole('dialog', { name: 'New Claude Code Session' });
const history = (page: Page) => page.getByRole('dialog', { name: 'Resume Session' });
const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const byFolder = (page: Page, folder: string) => page.getByTitle(folder, { exact: true });
const item = (page: Page, folder: string) => list(page).getByRole('listitem').filter({ has: byFolder(page, folder) });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: byFolder(page, folder) });
const terminal = (page: Page) => page.locator('.xterm-rows');
const terminalInput = (page: Page) => page.locator('.xterm-helper-textarea');
const searchBox = (page: Page) => page.getByRole('search', { name: 'Terminal search' });

/** Loads the page and waits until it is mounted, so its key listener is in place. */
async function loadPage(page: Page): Promise<void> {
  await page.goto('/');
  await expect(list(page)).toBeVisible();
  await expect(settingsButton(page)).toBeVisible();
}

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

/** Starts an idle session, loads the page and opens the session by a click. */
async function openSession(page: Page, request: APIRequestContext, name: string): Promise<{ id: string; folder: string }> {
  const folder = await newFolder(name);
  const id = await startViaApi(request, folder);
  await loadPage(page);
  await entry(page, folder).getByTitle(folder, { exact: true }).click();
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

/** Records the POST requests that change a session: stop, dismiss and resume. */
function recordActions(page: Page): Request[] {
  const requests: Request[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/(stop|dismiss|resume)$/.test(new URL(r.url()).pathname)) requests.push(r);
  });
  return requests;
}

/** Number of input chunks the fake CLI echoed so far. */
const inputChunks = async (page: Page) => ((await terminal(page).textContent()) ?? '').split('IN:').length - 1;
const firstRow = async (page: Page) => (await terminal(page).locator(':scope > div').first().textContent()) ?? '';
const hasFocusVisible = (locator: Locator) => locator.evaluate((el) => el.matches(':focus-visible'));

/** Relative luminance of the computed background colour of an element. */
const backgroundLuminance = (locator: Locator) =>
  locator.evaluate((el) => {
    const [r, g, b] = (getComputedStyle(el).backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
    const channel = (v = 0) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  });

/** Row text of a group, keys as `[badge]`, then the action. */
const rowTexts = (page: Page, name: string) =>
  group(page, name)
    .locator('li')
    .evaluateAll((rows) =>
      rows.map((row) => {
        const clone = row.cloneNode(true) as HTMLElement;
        for (const badge of clone.querySelectorAll('.kbd-badge')) badge.textContent = `[${badge.textContent ?? ''}]`;
        for (const el of clone.querySelectorAll('button, [role="alert"]')) el.remove();
        for (const el of clone.querySelectorAll('*')) el.append(' ');
        return (clone.textContent ?? '').replace(/\s+/g, ' ').replace(/\]\s*\+\s*\[/g, ']+[').trim();
      }),
    );

/** Alt+S with no dialog open: the settings popup opens on the "Shortcuts" tab, which takes the focus. */
async function openWithAltS(page: Page): Promise<void> {
  await page.keyboard.press('Alt+KeyS');
  await expect(popup(page)).toBeVisible(ONE_SECOND);
  await expect(tab(page, 'Shortcuts')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Shortcuts')).toBeFocused();
}

const ROWS = {
  Navigation: [
    '[Alt]+[L] Focus the list',
    '[Alt]+[C] Focus the main view',
    '[Alt]+[Up] Previous session',
    '[Alt]+[Down] Next session',
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((position) => `[Alt]+[${position}] Session at position ${position}`),
    '[Alt]+[I] Next session that needs input',
  ],
  Sessions: [
    '[Alt]+[N] New session dialog',
    '[Alt]+[H] Resume history dialog',
    '[Alt]+[E] Rename the open session',
    '[Alt]+[R] "Resume" or "Resume Here" on the open session',
    '[Alt]+[Shift]+[Q] Stop the open hosted session',
    '[Alt]+[Shift]+[W] Dismiss the open ended session',
  ],
  Terminal: [
    '[Ctrl]+[Shift]+[F] Search',
    '[Ctrl]+[=] / [Ctrl]+[+] Larger text',
    '[Ctrl]+[-] Smaller text',
    '[Ctrl]+[0] Default text size',
    '[Ctrl]+[Shift]+[L] Focus the list',
  ],
  General: ['[Alt]+[A] Light/Dark theme', '[Alt]+[S] Shortcut settings'],
};

// plan-settings_dialog/REQ-3, REQ-21, REQ-22, REQ-23, REQ-25 — scenario "Alt+S shows the shortcuts in the settings"
test('with the tooltip "Settings (Alt+S)" shown, Alt+S opens the popup on the "Shortcuts" tab, after "Theme" and "Window Look", with every shortcut by area', async ({
  page,
}) => {
  await loadPage(page);
  await settingsButton(page).hover();
  const tooltip = settingsButton(page).locator('.vx-tooltip');
  await expect(tooltip).toHaveText('Settings (Alt+S)');
  await expect(tooltip).toBeVisible();

  await openWithAltS(page);
  await expect(popup(page).getByRole('tablist', { name: 'Settings sections' }).getByRole('tab')).toHaveText(['Theme', 'Window Look', 'Shortcuts']);
  await expect(shortcutList(page)).toBeVisible();
  await expect(popup(page).getByRole('tabpanel')).toHaveCount(1);
  await expect(shortcutList(page).getByRole('heading')).toHaveText(GROUPS);
  for (const [name, rows] of Object.entries(ROWS)) expect(await rowTexts(page, name), name).toEqual(rows);
  await expect(shortcutList(page).locator('.kbd-badge').first()).toBeVisible();
});

// plan-settings_dialog/REQ-4, REQ-25, assumption "First section": the settings button opens the "Theme" tab, only Alt+S opens "Shortcuts"
test('the settings button opens the popup on "Theme", and a click on "Shortcuts" shows the shortcut list', async ({ page }) => {
  await loadPage(page);
  await settingsButton(page).click();
  await expect(popup(page)).toBeVisible();
  await expect(tab(page, 'Theme')).toHaveAttribute('aria-selected', 'true');
  await expect(shortcutList(page)).toHaveCount(0);
  await tab(page, 'Shortcuts').click();
  await expect(tab(page, 'Shortcuts')).toHaveAttribute('aria-selected', 'true');
  await expect(shortcutList(page).getByRole('heading')).toHaveText(GROUPS);
});

// plan-settings_dialog/REQ-24 — scenario "The shortcuts panel is gone from the top bar"
test('the top bar has no "Keyboard Shortcuts" button, and no separate shortcuts panel opens', async ({ page }) => {
  await loadPage(page);
  await expect(usageButton(page)).toBeVisible();
  await expect(banner(page).getByRole('button', { name: 'Keyboard Shortcuts' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Keyboard Shortcuts' })).toHaveCount(0);

  await openWithAltS(page);
  await expect(page.getByRole('dialog', { name: 'Keyboard Shortcuts' })).toHaveCount(0);
  await expect(page.locator('.shortcuts-panel')).toHaveCount(0);
  await expect(anyDialog(page)).toHaveCount(1);
});

// plan-settings_dialog/REQ-22, plan-keyboard_shortcuts/REQ-32: the section follows the theme, light and dark
test('the shortcuts section is light in the light theme and dark in the dark theme', async ({ page }) => {
  await loadPage(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await openWithAltS(page);
  expect(await backgroundLuminance(popup(page)), 'dark popup').toBeLessThan(0.2);
  await page.keyboard.press('Escape');
  await expect(popup(page)).toHaveCount(0);

  await chooseInSettings(page, 'Light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await openWithAltS(page);
  expect(await backgroundLuminance(popup(page)), 'light popup').toBeGreaterThan(0.6);
  await expect(shortcutList(page).locator('.kbd-badge').first()).toBeVisible();
});

// plan-settings_dialog/REQ-11, REQ-19, REQ-35, plan-keyboard_shortcuts/REQ-33: Tab reaches "Restore All", then the list with a visible focus, Enter adds nothing, the arrows scroll it, Alt+S does nothing
test('in a short window, Tab reaches "Restore All" then the list, the arrows scroll it, Enter and Alt+S do nothing, and the popup stays inside the window', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 420 });
  await loadPage(page);
  await newSessionButton(page).focus();
  await openWithAltS(page);

  await page.keyboard.press('Tab');
  await expect(popup(page).getByRole('button', { name: 'Restore All', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(shortcutList(page)).toBeFocused();
  expect(await hasFocusVisible(shortcutList(page)), 'focus ring on the list').toBe(true);

  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+KeyS');
  await expect(popup(page), 'Enter and Alt+S do not close the popup').toBeVisible();
  await expect(tab(page, 'Shortcuts')).toHaveAttribute('aria-selected', 'true');
  await expect(shortcutList(page)).toBeFocused();

  const overflow = await shortcutList(page).evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(overflow, 'the list does not fit a 420 px high window').toBe(true);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('PageDown');
  await page.keyboard.press('End');
  await expect.poll(() => shortcutList(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect(group(page, 'General').getByText('Shortcut settings')).toBeInViewport();
  const box = await popup(page).boundingBox();
  expect(box!.y + box!.height, 'the popup stays inside the window').toBeLessThanOrEqual(420);

  await page.keyboard.press('Escape');
  await expect(popup(page)).toHaveCount(0);
  await expect(newSessionButton(page), 'the focus goes back where it was').toBeFocused();
});

// plan-settings_dialog/REQ-25, plan-keyboard_shortcuts/REQ-39, REQ-40, REQ-46 — the popup opens over a working, scrolled-up terminal without losing the session
test('Alt+S over a working, scrolled-up terminal opens the popup, the session keeps working, and Esc gives the terminal its focus and scroll back', async ({
  page,
  request,
}) => {
  const { folder } = await openSession(page, request, 'section-working');
  await typeLine(page, 'COUNT');
  await expect(terminal(page)).toContainText('COUNT-DONE');
  await typeLine(page, 'WORK');
  await expect(entry(page, folder)).toContainText('Running');
  await expect(terminal(page)).toContainText('TICK2');

  await page.locator('.xterm-screen').hover();
  await page.mouse.wheel(0, -2000);
  await expect.poll(() => firstRow(page)).toMatch(/^L\d{5}/);
  await expect(terminalInput(page)).toBeFocused();
  const row = await firstRow(page);
  const screen = await page.locator('.xterm-screen').boundingBox();
  const typed = await inputChunks(page);
  const actions = recordActions(page);

  await openWithAltS(page);
  await page.waitForTimeout(800);
  await expect(entry(page, folder), 'the session keeps working behind the popup').toContainText('Running');
  await expect(terminal(page), 'the terminal stays mounted under the popup').toHaveCount(1);
  expect(await page.locator('.xterm-screen').boundingBox(), 'the terminal keeps its size').toEqual(screen);
  expect(await firstRow(page), 'the terminal keeps its scroll position').toBe(row);

  await page.keyboard.press('Escape');
  await expect(popup(page)).toHaveCount(0, ONE_SECOND);
  await expect(terminalInput(page)).toBeFocused();
  expect(await firstRow(page), 'the scroll position is the same after the popup').toBe(row);
  expect(await inputChunks(page), 'Alt+S or Esc reached the CLI').toBe(typed);
  expect(actions, 'the popup changed no session').toEqual([]);
});

// plan-keyboard_shortcuts/REQ-39, REQ-40 — scenario "A client key never reaches Claude Code"
test('Alt+S then Esc at the prompt of an idle session type nothing in the CLI', async ({ page, request }) => {
  await openSession(page, request, 'section-prompt');
  await focusTerminal(page);

  await openWithAltS(page);
  await page.keyboard.press('Escape');
  await expect(popup(page)).toHaveCount(0);
  await expect(terminalInput(page)).toBeFocused();
  await page.waitForTimeout(300);
  await expect(terminal(page), 'Alt+S or Esc reached the CLI').not.toContainText('IN:');
});

// plan-settings_dialog/REQ-19, plan-keyboard_shortcuts/REQ-42: while the popup is open, every other shortcut does nothing
test('while the popup is open on "Shortcuts", Alt+N, Alt+H, Alt+A and the session keys do nothing', async ({ page, request }) => {
  const { folder } = await openSession(page, request, 'section-blocks');
  const other = await newFolder('section-blocks-other');
  await startViaApi(request, other);
  await expect(entry(page, other)).toBeVisible();

  await openWithAltS(page);
  for (const key of ['Alt+KeyN', 'Alt+KeyH', 'Alt+KeyA', 'Alt+ArrowDown', 'Alt+ArrowUp', 'Alt+Digit1', 'Alt+Digit2']) await page.keyboard.press(key);
  await page.waitForTimeout(300);

  await expect(chooser(page)).toHaveCount(0);
  await expect(history(page)).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(popup(page)).toBeVisible();
  await expect(anyDialog(page)).toHaveCount(1);
  await expect(terminal(page), 'the open session did not change').toContainText(`CWD:${folder}`);
  await expect(terminal(page)).not.toContainText(`CWD:${other}`);
});

// plan-keyboard_shortcuts/REQ-42, REQ-43 — scenario "Another dialog blocks every shortcut"
test('while the resume history dialog is open, Alt+S opens nothing and the dialog keeps the focus', async ({ page }) => {
  await loadPage(page);
  await page.keyboard.press('Alt+KeyH');
  await expect(history(page)).toBeVisible(ONE_SECOND);
  const focused = () => page.evaluate(() => document.activeElement?.outerHTML);
  const before = await focused();
  expect(await history(page).evaluate((el) => el.contains(document.activeElement)), 'focus in the history dialog').toBe(true);

  await page.keyboard.press('Alt+KeyS');
  await page.waitForTimeout(300);
  await expect(popup(page)).toHaveCount(0);
  await expect(history(page)).toBeVisible();
  expect(await focused()).toBe(before);
});

// plan-keyboard_shortcuts/REQ-28, REQ-44: a Terminal row of the section opens the search box
test('Ctrl+Shift+F, listed in the Terminal group, opens the terminal search box', async ({ page, request }) => {
  await openSession(page, request, 'section-search');
  await openWithAltS(page);
  await expect(group(page, 'Terminal').locator('li').filter({ hasText: 'Search' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popup(page)).toHaveCount(0);

  await focusTerminal(page);
  await page.keyboard.press('Control+Shift+KeyF');
  await expect(searchBox(page)).toBeVisible(ONE_SECOND);
  await expect(searchBox(page).getByRole('textbox', { name: 'Search in terminal' })).toBeFocused();
  await expect(terminal(page), 'Ctrl+Shift+F reached the CLI').not.toContainText('IN:');
});

// plan-keyboard_shortcuts/REQ-41 — scenario "A text field keeps its editing keys"
test('in the "Session Name" field, Ctrl+A then "api" leaves only "api"', async ({ page, request }) => {
  const { folder } = await openSession(page, request, 'section-rename');
  await focusTerminal(page);
  await page.keyboard.press('Alt+KeyE');
  const field = item(page, folder).getByRole('textbox', { name: 'Session Name', exact: true });
  await expect(field).toBeFocused(ONE_SECOND);
  await field.fill('billing');

  await page.keyboard.press('Control+KeyA');
  await page.keyboard.type('api');
  await expect(field).toHaveValue('api');
  await expect(field).toBeFocused();
});
