// e2e of plan-settings_dialog, batch editable-shortcuts: "Change Keys", "Restore Default" and "Restore All" in the "Shortcuts" tab.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { settingsButton, settingsPopup } from './settings';

const ONE_SECOND = { timeout: 1000 };
const EDITING = 'Press new keys, Esc to cancel';

let projectsRoot: string;
const createdIds: string[] = [];

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

// The page shows only the sessions of the running test: other specs leave theirs on the server.
test.beforeEach(async ({ page }) => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-editable-shortcuts-'));
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

const popup = settingsPopup;
const shortcutList = (page: Page) => popup(page).getByRole('region', { name: 'Shortcut List' });
const group = (page: Page, name: string) => shortcutList(page).locator('section').filter({ has: page.getByRole('heading', { name, exact: true }) });
const row = (page: Page, action: string, area?: string) =>
  (area ? group(page, area) : shortcutList(page)).locator('li').filter({ has: page.getByRole('button', { name: `Change Keys: ${action}`, exact: true }) });
const changeKeys = (page: Page, action: string, area?: string) => row(page, action, area).getByRole('button', { name: `Change Keys: ${action}`, exact: true });
const restoreDefault = (page: Page, action: string, area?: string) => row(page, action, area).getByRole('button', { name: `Restore Default: ${action}`, exact: true });
const restoreAll = (page: Page) => popup(page).getByRole('button', { name: 'Restore All', exact: true });
const confirmation = (page: Page) => page.getByRole('alertdialog', { name: 'Restore All Shortcuts' });
const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const mainArea = (page: Page) => page.getByRole('main');
const searchButton = (page: Page) => mainArea(page).locator('.session-header').getByRole('button', { name: 'Search', exact: true });
const terminal = (page: Page) => page.locator('.xterm-rows');
const terminalInput = (page: Page) => page.locator('.xterm-helper-textarea');
const searchBox = (page: Page) => page.getByRole('search', { name: 'Terminal search' });
const chooser = (page: Page) => page.getByRole('dialog', { name: 'New Claude Code Session' });
const hasFocusVisible = (locator: Locator) => locator.evaluate((el) => el.matches(':focus-visible'));

/** Keys of a row as `[badge]` texts joined like the row shows them, without its buttons and message. */
const keysOf = (locator: Locator) =>
  locator.evaluate((li) => {
    const clone = li.cloneNode(true) as HTMLElement;
    for (const el of clone.querySelectorAll('button, [role="alert"]')) el.remove();
    for (const badge of clone.querySelectorAll('.kbd-badge')) badge.textContent = `[${badge.textContent ?? ''}]`;
    for (const el of clone.querySelectorAll('*')) el.append(' ');
    return (clone.textContent ?? '').replace(/\s+/g, ' ').replace(/\]\s*\+\s*\[/g, ']+[').trim();
  });

async function loadPage(page: Page): Promise<void> {
  await page.goto('/');
  await expect(list(page)).toBeVisible();
  await expect(settingsButton(page)).toBeVisible();
}

async function startViaApi(request: APIRequestContext, name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  return folder;
}

async function openSession(page: Page, folder: string): Promise<void> {
  await entry(page, folder).getByTitle(folder, { exact: true }).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
  await expect(terminal(page)).toContainText('READY');
}

async function focusTerminal(page: Page): Promise<void> {
  await page.locator('.xterm-screen').click();
  await expect(terminalInput(page)).toBeFocused();
}

/** Alt+S opens the popup on the "Shortcuts" tab. */
async function openShortcuts(page: Page): Promise<void> {
  await page.keyboard.press('Alt+KeyS');
  await expect(shortcutList(page)).toBeVisible(ONE_SECOND);
}

/** Starts the editing of a row with the keyboard: Tab focus on "Change Keys", then Enter. */
async function editWithKeyboard(page: Page, action: string, area?: string): Promise<void> {
  await changeKeys(page, action, area).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(changeKeys(page, action, area)).toBeFocused();
  expect(await hasFocusVisible(changeKeys(page, action, area)), `focus ring on "Change Keys: ${action}"`).toBe(true);
  await page.keyboard.press('Enter');
  await expect(row(page, action, area)).toContainText(EDITING);
}

async function setKeys(page: Page, action: string, keys: string, area?: string): Promise<void> {
  await editWithKeyboard(page, action, area);
  await page.keyboard.press(keys);
  await expect(row(page, action, area)).not.toContainText(EDITING);
}

// plan-settings_dialog/REQ-26, REQ-27, REQ-37, REQ-38, REQ-40, REQ-41, REQ-42 — scenario "The user gives a shortcut new keys and uses them at once"
test('"Change Keys" on "Search" with Alt+K: the row, the tooltip and the terminal follow Alt+K after a reload, and no "k" reaches the CLI', async ({
  page,
  request,
}) => {
  const folder = await startViaApi(request, 'edit-search');
  await loadPage(page);
  await openSession(page, folder);
  await focusTerminal(page);

  await openShortcuts(page);
  await editWithKeyboard(page, 'Search', 'Terminal');
  await page.keyboard.press('Alt+KeyK');
  expect(await keysOf(row(page, 'Search', 'Terminal'))).toBe('Search [Alt]+[K]');
  await expect(changeKeys(page, 'Search', 'Terminal')).toBeFocused();
  await expect(restoreDefault(page, 'Search', 'Terminal')).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(popup(page)).toHaveCount(0);
  await expect(terminal(page), 'Alt+K or Enter reached the CLI').not.toContainText('IN:');

  await page.reload();
  await expect(list(page)).toBeVisible();
  await openSession(page, folder);
  await expect(searchButton(page)).toHaveAttribute('title', 'Search (Alt+K)');
  await openShortcuts(page);
  expect(await keysOf(row(page, 'Search', 'Terminal')), 'the key survives the reload').toBe('Search [Alt]+[K]');
  await page.keyboard.press('Escape');
  await expect(popup(page)).toHaveCount(0);

  await focusTerminal(page);
  await page.keyboard.press('Alt+KeyK');
  await expect(searchBox(page)).toBeVisible(ONE_SECOND);
  await expect(terminal(page), 'Alt+K reached the CLI').not.toContainText('IN:');
});

// plan-settings_dialog/REQ-26, REQ-37, REQ-38: a new key works at once, with no reload, and the old one does nothing
test('a new key for "Shortcut settings" and "New session dialog" works at once, in the tooltip too, and the old keys do nothing', async ({ page }) => {
  await loadPage(page);
  await openShortcuts(page);
  await setKeys(page, 'New session dialog', 'Alt+KeyK');
  await setKeys(page, 'Shortcut settings', 'Alt+KeyG');
  await page.keyboard.press('Escape');
  await expect(popup(page)).toHaveCount(0);

  await settingsButton(page).hover();
  await expect(settingsButton(page).locator('.vx-tooltip')).toHaveText('Settings (Alt+G)');
  await page.mouse.move(0, 0);

  await page.keyboard.press('Alt+KeyN');
  await page.keyboard.press('Alt+KeyS');
  await page.waitForTimeout(300);
  await expect(chooser(page), 'Alt+N is no longer a shortcut').toHaveCount(0);
  await expect(popup(page), 'Alt+S is no longer a shortcut').toHaveCount(0);

  await page.keyboard.press('Alt+KeyK');
  await expect(chooser(page)).toBeVisible(ONE_SECOND);
  await page.keyboard.press('Escape');
  await expect(chooser(page)).toHaveCount(0);
  await page.keyboard.press('Alt+KeyG');
  await expect(shortcutList(page)).toBeVisible(ONE_SECOND);
});

// plan-settings_dialog/REQ-28, REQ-29, REQ-30, REQ-31, REQ-32 — scenario "The client rejects a key that is already taken"
test('in the editing of "New session dialog", Alt+L, Shift+K and Alt+B are rejected with their reason and Alt+N stays', async ({ page }) => {
  await loadPage(page);
  await openShortcuts(page);
  await editWithKeyboard(page, 'New session dialog');
  const message = row(page, 'New session dialog').getByRole('alert');

  await page.keyboard.press('Alt+KeyL');
  await expect(message).toHaveText('Already used by Focus the list');
  await expect(row(page, 'New session dialog')).toContainText(EDITING);
  await expect(changeKeys(page, 'New session dialog')).toHaveAccessibleDescription('Already used by Focus the list');

  await page.keyboard.press('Shift+KeyK');
  await expect(message).toHaveText('Use Ctrl or Alt in the shortcut');
  await page.keyboard.press('Alt+KeyB');
  await expect(message).toHaveText('Used by Claude Code');
  await expect(row(page, 'New session dialog')).toContainText(EDITING);
  await expect(popup(page), 'the rejected keys did not close the popup').toBeVisible();

  await page.keyboard.press('Escape');
  expect(await keysOf(row(page, 'New session dialog'))).toBe('New session dialog [Alt]+[N]');
  expect(await page.evaluate(() => localStorage.getItem('ai-client.shortcuts')), 'nothing saved').toBeNull();
});

// plan-settings_dialog/REQ-33, REQ-39 — scenario "The user cancels an edit with Esc"
test('Esc in the editing of "Rename the open session" keeps Alt+E, and the popup stays open with no row for Enter or Esc', async ({ page }) => {
  await loadPage(page);
  await openShortcuts(page);
  await editWithKeyboard(page, 'Rename the open session');
  await page.keyboard.press('Escape');

  expect(await keysOf(row(page, 'Rename the open session'))).toBe('Rename the open session [Alt]+[E]');
  await expect(popup(page)).toBeVisible();
  await expect(changeKeys(page, 'Rename the open session')).toBeFocused();
  await expect(shortcutList(page).locator('.kbd-badge').filter({ hasText: /^(Enter|Esc)$/ })).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(popup(page), 'Esc out of the editing closes the popup').toHaveCount(0);
});

// plan-settings_dialog/REQ-34, REQ-35, REQ-36, REQ-42 — scenario "The user restores the default keys"
test('"Restore Default" on "Focus the list" gives back Alt+L, and "Restore All" after its confirmation gives every row its defaults', async ({ page }) => {
  await loadPage(page);
  await openShortcuts(page);
  await setKeys(page, 'Focus the list', 'Alt+KeyK', 'Navigation');
  await setKeys(page, 'Resume history dialog', 'Alt+KeyJ');
  expect(await keysOf(row(page, 'Focus the list', 'Navigation'))).toBe('Focus the list [Alt]+[K]');
  expect(await keysOf(row(page, 'Resume history dialog'))).toBe('Resume history dialog [Alt]+[J]');

  await restoreDefault(page, 'Focus the list', 'Navigation').focus();
  await page.keyboard.press('Enter');
  expect(await keysOf(row(page, 'Focus the list', 'Navigation'))).toBe('Focus the list [Alt]+[L]');
  await expect(restoreDefault(page, 'Focus the list', 'Navigation')).toBeDisabled();
  await expect(changeKeys(page, 'Focus the list', 'Navigation')).toBeFocused();

  await restoreAll(page).focus();
  await page.keyboard.press('Enter');
  await expect(confirmation(page)).toBeVisible();
  await expect(confirmation(page)).toContainText('Every shortcut goes back to its default keys.');
  await expect(confirmation(page).getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(confirmation(page)).toHaveCount(0);
  await expect(popup(page), 'Esc on the confirmation keeps the settings popup').toBeVisible();
  expect(await keysOf(row(page, 'Resume history dialog')), 'Cancel changes nothing').toBe('Resume history dialog [Alt]+[J]');

  await restoreAll(page).focus();
  await page.keyboard.press('Enter');
  await expect(confirmation(page).getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  const confirm = confirmation(page).getByRole('button', { name: 'Restore All', exact: true });
  for (let tabs = 0; tabs < 4 && !(await confirm.evaluate((el) => el === document.activeElement)); tabs++) await page.keyboard.press('Tab');
  await expect(confirm).toBeFocused();
  expect(await hasFocusVisible(confirm), 'focus ring on the primary action').toBe(true);
  await page.keyboard.press('Enter');
  await expect(confirmation(page)).toHaveCount(0);
  await expect(popup(page)).toBeVisible();
  expect(await keysOf(row(page, 'Resume history dialog'))).toBe('Resume history dialog [Alt]+[H]');
  expect(await keysOf(row(page, 'Focus the list', 'Navigation'))).toBe('Focus the list [Alt]+[L]');
  await expect(shortcutList(page).getByRole('button', { name: /^Restore Default: /, disabled: false })).toHaveCount(0);
});
