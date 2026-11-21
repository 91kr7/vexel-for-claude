// e2e of plan-settings_dialog, batches settings-popup and shortcuts-section: the settings button, the "Settings" popup and its tabs, and the top bar without switches.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { cardOf } from './settings';

const LIST_WIDTH_KEY = 'ai-client.list-width';
const SESSION_COUNT = 16;

let projectsRoot: string;
const createdIds: string[] = [];

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

// The page shows only the sessions of the running test: other specs leave theirs on the server.
test.beforeEach(async ({ page }) => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-settings-'));
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

const topBar = (page: Page) => page.getByRole('banner');
const listPanel = (page: Page) => page.getByRole('region', { name: 'Session List' });
const sessionList = (page: Page) => page.locator('.session-list');
const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const settingsButton = (page: Page) => rail(page).getByRole('button', { name: 'Settings', exact: true });
const popup = (page: Page) => page.getByRole('dialog', { name: 'Settings', exact: true });
const tab = (page: Page, name: string) => popup(page).getByRole('tab', { name, exact: true });
const radio = (page: Page, name: string) => popup(page).getByRole('radio', { name, exact: true });
const chooser = (page: Page) => page.getByRole('dialog', { name: 'New Claude Code Session' });
const anyDialog = (page: Page) => page.locator('[role="dialog"], [role="alertdialog"]');
const terminal = (page: Page) => page.locator('.xterm-rows');
const rootMark = (page: Page, name: 'data-theme' | 'data-look') => page.locator('html').getAttribute(name);
const hasFocusVisible = (locator: Locator) => locator.evaluate((element) => element.matches(':focus-visible'));
const outlineOf = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).outlineStyle);

async function startSessions(request: APIRequestContext, count: number): Promise<{ id: string; folder: string }[]> {
  const started: { id: string; folder: string }[] = [];
  for (let index = 0; index < count; index++) {
    const folder = path.join(projectsRoot, `project-${String(index).padStart(2, '0')}`);
    await mkdir(folder);
    const response = await request.post('/api/sessions', { data: { path: folder } });
    expect(response.status()).toBe(201);
    const { id } = (await response.json()) as { id: string };
    createdIds.push(id);
    started.push({ id, folder });
  }
  return started;
}

async function stateOf(request: APIRequestContext, id: string): Promise<string | undefined> {
  const sessions = (await (await request.get('/api/sessions')).json()) as { id: string; state: string }[];
  return sessions.find((session) => session.id === id)?.state;
}

async function loadPage(page: Page, listWidth?: number): Promise<void> {
  if (listWidth !== undefined) {
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LIST_WIDTH_KEY, String(listWidth)] as const);
  }
  await page.goto('/');
  await expect(listPanel(page)).toBeVisible();
}

const box = async (locator: Locator) => (await locator.boundingBox())!;

// plan-settings_dialog/REQ-1: at the bottom of the rail, below its other buttons, and not in the list panel
async function expectButtonAtRailBottom(page: Page): Promise<void> {
  const button = settingsButton(page);
  await expect(button).toBeVisible();
  await expect(listPanel(page).getByRole('button', { name: 'Settings', exact: true })).toHaveCount(0);
  const names = await rail(page)
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((element) => element.getAttribute('aria-label') ?? element.textContent?.trim() ?? ''));
  expect(names.at(-1), `rail buttons: ${names.join(', ')}`).toBe('Settings');
  const railBox = await box(rail(page));
  const buttonBox = await box(button);
  const resume = await box(rail(page).getByRole('button', { name: 'Resume', exact: true }));
  expect(buttonBox.y, 'below "Resume"').toBeGreaterThan(resume.y + resume.height);
  expect(railBox.y + railBox.height - (buttonBox.y + buttonBox.height), 'at the bottom of the rail').toBeLessThan(24);
  expect(buttonBox.y - (resume.y + resume.height), 'apart from the top group').toBeGreaterThan(24);
}

test.describe('settings button', () => {
  // plan-settings_dialog/REQ-1
  test('sits at the bottom of the navigation rail, below "Resume", and not in the list panel, in the "Sessions" and in the "Projects" view', async ({ page, request }) => {
    await startSessions(request, 2);
    await loadPage(page);
    await expectButtonAtRailBottom(page);
    await rail(page).getByRole('button', { name: 'Projects', exact: true }).click();
    await expect(page.locator('.project-list')).toBeVisible();
    await expectButtonAtRailBottom(page);
  });

  // plan-settings_dialog/REQ-2: visible at the narrowest and widest list panel
  for (const width of [180, 480]) {
    test(`stays visible with a list panel ${width} px wide`, async ({ page }) => {
      await loadPage(page, width);
      expect((await box(listPanel(page))).width).toBeCloseTo(width, 0);
      await expect(settingsButton(page)).toBeInViewport({ ratio: 1 });
    });
  }

  // plan-settings_dialog/REQ-2: visible at every window height
  for (const height of [720, 400, 260]) {
    test(`stays inside a window ${height} px high`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height });
      await loadPage(page);
      await expect(settingsButton(page)).toBeInViewport({ ratio: 1 });
      const buttonBox = await box(settingsButton(page));
      expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(height);
    });
  }

  // plan-settings_dialog/REQ-2: the button does not move while the session list scrolls
  test('keeps its place while the session list scrolls', async ({ page, request }) => {
    await startSessions(request, SESSION_COUNT);
    await loadPage(page);
    await expect(sessionList(page).getByRole('listitem')).toHaveCount(SESSION_COUNT);
    expect(await sessionList(page).evaluate((element) => element.scrollHeight > element.clientHeight), 'the list overflows').toBe(true);
    const before = await box(settingsButton(page));
    await sessionList(page).evaluate((element) => (element.scrollTop = element.scrollHeight));
    expect(await sessionList(page).evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await box(settingsButton(page))).toEqual(before);
    await expect(settingsButton(page)).toBeInViewport({ ratio: 1 });
  });

  // plan-settings_dialog/REQ-3: name "Settings", the rail tooltip "Settings (Alt+S)" on hover, opens a dialog
  test('is named "Settings", shows the tooltip "Settings (Alt+S)" on hover and announces a dialog', async ({ page }) => {
    await loadPage(page);
    await expect(settingsButton(page)).toHaveAccessibleName('Settings');
    await expect(settingsButton(page)).toHaveAttribute('aria-haspopup', 'dialog');
    const tooltip = settingsButton(page).locator('.vx-tooltip');
    await settingsButton(page).hover();
    await expect(tooltip).toHaveText('Settings (Alt+S)');
    await expect(tooltip).toBeVisible();
    await expect.poll(() => tooltip.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0.9);
  });

  // plan-settings_dialog/REQ-4, REQ-5, REQ-6, REQ-21, REQ-53: a click opens the modal popup on the "Appearance" menu
  test('a click opens the modal "Settings" popup on "Appearance", with the menus "Appearance", "Shortcuts", "Updates" and "Processes"', async ({ page }) => {
    await loadPage(page);
    await settingsButton(page).click();
    await expect(popup(page)).toBeVisible();
    await expect(popup(page)).toHaveAttribute('aria-modal', 'true');
    await expect(popup(page).getByRole('tablist', { name: 'Settings sections' }).getByRole('tab')).toHaveText(['Appearance', 'Shortcuts', 'Updates', 'Processes']);
    await expect(tab(page, 'Appearance')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, 'Appearance')).toBeFocused();
    await expect(popup(page).getByRole('group', { name: 'Theme' })).toBeVisible();
    await expect(popup(page).getByRole('group', { name: 'Window Look' })).toBeVisible();
    await expect(popup(page).getByRole('button', { name: 'Close', exact: true })).toBeVisible();
    await expect(popup(page).getByRole('button', { name: /^(Save|Cancel)$/ })).toHaveCount(0);
  });
});

// Scenario "The user changes the theme and the look from the settings"
// plan-settings_dialog/REQ-9, REQ-10, REQ-12, REQ-13, REQ-14, REQ-15, REQ-20
test('choosing "Light" and "Windows 11" restyles the whole client at once, keeps the popup open, the session and the list scroll', async ({ page, request }) => {
  const sessions = await startSessions(request, SESSION_COUNT);
  const opened = sessions[0]!;
  await loadPage(page);
  expect(await rootMark(page, 'data-theme')).toBe('dark');
  expect(await rootMark(page, 'data-look')).toBe('vexel');

  const entry = listPanel(page).getByRole('button').filter({ has: page.getByTitle(opened.folder, { exact: true }) });
  await entry.getByTitle(opened.folder, { exact: true }).click();
  await expect(terminal(page)).toBeVisible();
  await terminal(page).evaluate((element) => ((element as HTMLElement & { marked?: boolean }).marked = true));
  const stateBefore = await stateOf(request, opened.id);
  await sessionList(page).evaluate((element) => (element.scrollTop = 120));
  const scrollBefore = await sessionList(page).evaluate((element) => element.scrollTop);
  expect(scrollBefore).toBeGreaterThan(0);

  await settingsButton(page).click();
  await expect(popup(page)).toBeVisible();
  await expect(radio(page, 'Dark')).toBeChecked();
  await expect(radio(page, 'Light')).not.toBeChecked();
  // The frame's glass sits on its layer behind the content (WebEntry `.vx-popup-glass`).
  const glassOf = () => popup(page).evaluate((element) => getComputedStyle(element, '::before').backgroundColor);
  const darkBackground = await glassOf();

  // The colour dissolve applies the change a frame or two after the click.
  await cardOf(radio(page, 'Light')).click();
  await expect.poll(() => rootMark(page, 'data-theme')).toBe('light');
  await expect(radio(page, 'Light')).toBeChecked();
  expect(await glassOf(), 'the popup turns light').not.toBe(darkBackground);
  expect(await page.evaluate(() => localStorage.getItem('ai-client.theme'))).toBe('light');

  await expect(radio(page, 'macOS')).toBeChecked();
  const macBackground = await glassOf();
  await cardOf(radio(page, 'Windows 11')).click();
  await expect.poll(() => rootMark(page, 'data-look')).toBe('windows11');
  await expect(radio(page, 'Windows 11')).toBeChecked();
  expect(await glassOf(), 'the popup takes the Windows 11 look').not.toBe(macBackground);
  expect(await page.evaluate(() => localStorage.getItem('ai-client.look'))).toBe('windows11');
  // In the browser the Windows 11 look shows no window buttons.
  await expect(topBar(page).getByRole('button', { name: 'Minimize' })).toHaveCount(0);

  await expect(popup(page)).toBeVisible();
  await tab(page, 'Shortcuts').click();
  await tab(page, 'Appearance').click();
  await expect(radio(page, 'Light')).toBeChecked();

  await popup(page).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(popup(page)).toHaveCount(0);
  expect(await terminal(page).evaluate((element) => (element as HTMLElement & { marked?: boolean }).marked), 'the same terminal stays open').toBe(true);
  expect(await stateOf(request, opened.id)).toBe(stateBefore);
  expect(await sessionList(page).evaluate((element) => element.scrollTop)).toBe(scrollBefore);

  // The choices survive a reload.
  await page.reload();
  await expect(listPanel(page)).toBeVisible();
  expect(await rootMark(page, 'data-theme')).toBe('light');
  expect(await rootMark(page, 'data-look')).toBe('windows11');
});

// Scenario "The user closes the settings and finds the focus where it was"
// plan-settings_dialog/REQ-7, REQ-8, REQ-11, REQ-19
test.describe('popup from the keyboard', () => {
  test('opens with Enter, every control has a visible focus, Alt+N, Alt+A and Alt+S do nothing, and Esc gives the focus back', async ({ page }) => {
    await loadPage(page);
    await settingsButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(popup(page)).toBeVisible();
    await expect(tab(page, 'Appearance')).toBeFocused();
    expect(await hasFocusVisible(tab(page, 'Appearance'))).toBe(true);
    expect(await outlineOf(tab(page, 'Appearance'))).not.toBe('none');

    await page.keyboard.press('ArrowDown');
    await expect(tab(page, 'Shortcuts')).toBeFocused();
    await expect(tab(page, 'Shortcuts')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowUp');
    await expect(tab(page, 'Appearance')).toBeFocused();
    await expect(tab(page, 'Appearance')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Tab');
    await expect(radio(page, 'Dark')).toBeFocused();
    expect(await hasFocusVisible(radio(page, 'Dark'))).toBe(true);
    expect(await outlineOf(cardOf(radio(page, 'Dark'))), 'the focus ring shows around the card').not.toBe('none');
    await page.keyboard.press('Tab');
    await expect(radio(page, 'macOS')).toBeFocused();
    expect(await outlineOf(cardOf(radio(page, 'macOS')))).not.toBe('none');
    await page.keyboard.press('ArrowDown');
    await expect(radio(page, 'Windows 11')).toBeChecked();
    expect(await rootMark(page, 'data-look')).toBe('windows11');

    await page.keyboard.press('Tab');
    const close = popup(page).getByRole('button', { name: 'Close', exact: true });
    await expect(close).toBeFocused();
    expect(await hasFocusVisible(close)).toBe(true);
    await page.keyboard.press('Tab');
    await expect(popup(page).getByRole('button', { name: 'Close (Esc)' })).toBeFocused();

    const theme = await rootMark(page, 'data-theme');
    await page.keyboard.press('Alt+KeyN');
    await page.keyboard.press('Alt+KeyA');
    await page.keyboard.press('Alt+KeyS');
    await expect(chooser(page)).toHaveCount(0);
    await expect(anyDialog(page)).toHaveCount(1);
    expect(await rootMark(page, 'data-theme'), 'Alt+A does nothing while the popup is open').toBe(theme);

    await page.keyboard.press('Escape');
    await expect(popup(page)).toHaveCount(0);
    await expect(settingsButton(page)).toBeFocused();
  });

  test('"[Esc]" closes the popup and gives the focus back to the settings button', async ({ page }) => {
    await loadPage(page);
    await settingsButton(page).click();
    await popup(page).getByRole('button', { name: 'Close (Esc)' }).click();
    await expect(popup(page)).toHaveCount(0);
    await expect(settingsButton(page)).toBeFocused();
  });
});

// Scenario "The top bar has no theme or look switch" (browser part; the drag area check runs in the Electron group)
// plan-settings_dialog/REQ-16, REQ-18, REQ-24
test('the top bar has no theme or look switch, and Alt+A still switches the theme', async ({ page }) => {
  await loadPage(page);
  await expect(topBar(page).getByRole('button', { name: 'Dark theme' })).toHaveCount(0);
  await expect(topBar(page).getByRole('button', { name: 'Windows 11 look' })).toHaveCount(0);
  const names = await topBar(page)
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? ''));
  expect(names).toEqual(['Plan Usage']);
  expect(await rootMark(page, 'data-theme')).toBe('dark');
  // plan-dark_blue_theme/REQ-34: from Dark the cycle goes Dark Blue, Light, Dark
  for (const theme of ['dark-blue', 'light', 'dark']) {
    await page.keyboard.press('Alt+KeyA');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  }
});
