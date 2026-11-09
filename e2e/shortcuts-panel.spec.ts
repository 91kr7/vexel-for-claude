// e2e of plan-keyboard_shortcuts, batch shortcuts-panel: the shortcuts button, the shortcuts panel and the rules of every shortcut.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, type Request, expect, test } from '@playwright/test';

const ONE_SECOND = { timeout: 1000 };
const GROUPS = ['Navigation', 'Sessions', 'Terminal', 'General'];

let projectsRoot: string;
const createdIds: string[] = [];

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

// The page shows only the sessions of the running test: other specs and the earlier tests of this file leave theirs on the server.
test.beforeEach(async ({ page }) => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-shortcuts-panel-'));
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
const shortcutsButton = (page: Page) => banner(page).getByRole('button', { name: 'Keyboard Shortcuts', exact: true });
const themeSwitch = (page: Page) => banner(page).getByRole('button', { name: 'Dark theme', exact: true });
const newSessionButton = (page: Page) => banner(page).getByRole('button', { name: 'New Session', exact: true });
const shortcutsPanel = (page: Page) => page.getByRole('dialog', { name: 'Keyboard Shortcuts' });
const shortcutList = (page: Page) => shortcutsPanel(page).getByRole('region', { name: 'Shortcut List' });
const closeButton = (page: Page) => shortcutsPanel(page).getByRole('button', { name: 'Close', exact: true });
const escButton = (page: Page) => shortcutsPanel(page).getByRole('button', { name: 'Close (Esc)', exact: true });
const group = (page: Page, name: string) => shortcutsPanel(page).locator('section').filter({ has: page.getByRole('heading', { name, exact: true }) });
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
  await expect(themeSwitch(page)).toBeVisible();
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
        for (const el of clone.querySelectorAll('*')) el.append(' ');
        return (clone.textContent ?? '').replace(/\s+/g, ' ').replace(/\]\s*\+\s*\[/g, ']+[').trim();
      }),
    );

// plan-keyboard_shortcuts/REQ-22, REQ-23: the button sits right before the switch, 6 px apart, with its look, name and tooltip
test('the shortcuts button sits right before the switch, with the look of the switch, its name and its tooltip', async ({ page }) => {
  await loadPage(page);
  const names = await banner(page).getByRole('button').evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim()));
  expect(names.indexOf('Dark theme') - names.indexOf('Keyboard Shortcuts'), `buttons of the top bar: ${names.join(', ')}`).toBe(1);

  await expect(shortcutsButton(page)).toHaveAttribute('title', 'Keyboard Shortcuts (Alt+S)');
  await expect(shortcutsButton(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(shortcutsButton(page).locator('svg')).toBeVisible();

  const button = await shortcutsButton(page).boundingBox();
  const theme = await themeSwitch(page).boundingBox();
  expect(button && theme, 'both buttons are rendered').toBeTruthy();
  expect(theme!.x - (button!.x + button!.width)).toBeCloseTo(6, 0);
  expect(button!.width).toBeCloseTo(theme!.width, 0);
  expect(button!.height).toBeCloseTo(theme!.height, 0);
  expect(button!.y).toBeCloseTo(theme!.y, 0);

  await page.mouse.move(0, 500);
  const look = (locator: Locator) =>
    locator.evaluate((el) => {
      const s = getComputedStyle(el);
      return { background: s.backgroundColor, color: s.color, border: s.border, radius: s.borderRadius };
    });
  expect(await look(shortcutsButton(page))).toEqual(await look(themeSwitch(page)));
});

// plan-keyboard_shortcuts/REQ-22, REQ-24, REQ-26, REQ-27, REQ-32 — scenario "The user opens the shortcuts panel and finds every shortcut"
test('in the light theme a click opens the panel in light colours, with the four groups and every shortcut in badges', async ({ page }) => {
  await loadPage(page);
  await themeSwitch(page).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await shortcutsButton(page).click();
  await expect(shortcutsPanel(page)).toBeVisible(ONE_SECOND);
  await expect(shortcutsButton(page)).toHaveAttribute('aria-expanded', 'true');
  expect(await backgroundLuminance(shortcutsPanel(page)), 'light panel').toBeGreaterThan(0.6);

  await expect(shortcutList(page).getByRole('heading')).toHaveText(GROUPS);
  expect(await rowTexts(page, 'Navigation')).toEqual([
    '[Alt]+[L] Focus the list',
    '[Alt]+[C] Focus the main view',
    '[Alt]+[Up] / [Alt]+[Down] Previous / next session',
    '[Alt]+[1] … [Alt]+[9] Session at position 1 to 9',
    '[Alt]+[I] Next session that needs input',
  ]);
  expect(await rowTexts(page, 'Sessions')).toEqual([
    '[Alt]+[N] New session dialog',
    '[Alt]+[H] Resume history dialog',
    '[Alt]+[E] Rename the open session',
    '[Alt]+[R] "Resume" or "Resume Here" on the open session',
    '[Alt]+[Shift]+[Q] Stop the open hosted session',
    '[Alt]+[Shift]+[W] Dismiss the open ended session',
  ]);
  expect(await rowTexts(page, 'Terminal')).toEqual([
    '[Ctrl]+[Shift]+[F] Search',
    '[Ctrl]+[=] / [Ctrl]+[+] / [Ctrl]+[-] / [Ctrl]+[0] Larger / smaller / default text',
    '[Ctrl]+[Shift]+[L] Focus the list',
  ]);
  expect(await rowTexts(page, 'General')).toEqual(['[Alt]+[A] Light/Dark theme', '[Alt]+[S] Shortcuts panel']);
  await expect(shortcutsPanel(page).locator('.kbd-badge').first()).toBeVisible();
});

// plan-keyboard_shortcuts/REQ-32: in the dark theme the panel is dark
test('in the dark theme the panel opens in dark colours', async ({ page }) => {
  await loadPage(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await shortcutsButton(page).click();
  await expect(shortcutsPanel(page)).toBeVisible(ONE_SECOND);
  expect(await backgroundLuminance(shortcutsPanel(page)), 'dark panel').toBeLessThan(0.2);
});

// plan-keyboard_shortcuts/REQ-23, REQ-29, REQ-30 — scenario "The button shows its shortcut": a second click closes the panel and the focus comes back
test('a second click on the button closes the panel, and the focus goes back where it was', async ({ page }) => {
  await loadPage(page);
  await newSessionButton(page).focus();

  await shortcutsButton(page).click();
  await expect(shortcutsPanel(page)).toBeVisible(ONE_SECOND);
  await expect(closeButton(page)).toBeFocused();

  await shortcutsButton(page).click();
  await expect(shortcutsPanel(page)).toHaveCount(0, ONE_SECOND);
  await expect(shortcutsButton(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(newSessionButton(page), 'a mouse press on the button does not take the focus').toBeFocused();
  await expect(chooser(page)).toHaveCount(0);
});

// plan-keyboard_shortcuts/REQ-25, REQ-29, REQ-30, REQ-33: Alt+S opens and closes the panel; "Close", "[Esc]" and Enter on "Close" close it
test('Alt+S toggles the panel, "Close", "[Esc]" and Enter on "Close" close it, and the focus comes back each time', async ({ page }) => {
  await loadPage(page);
  await newSessionButton(page).focus();

  await page.keyboard.press('Alt+KeyS');
  await expect(shortcutsPanel(page)).toBeVisible(ONE_SECOND);
  await expect(closeButton(page)).toBeFocused();
  await page.keyboard.press('Alt+KeyS');
  await expect(shortcutsPanel(page)).toHaveCount(0, ONE_SECOND);
  await expect(newSessionButton(page)).toBeFocused();

  await page.keyboard.press('Alt+KeyS');
  await closeButton(page).click();
  await expect(shortcutsPanel(page)).toHaveCount(0);
  await expect(newSessionButton(page)).toBeFocused();

  await page.keyboard.press('Alt+KeyS');
  await escButton(page).click();
  await expect(shortcutsPanel(page)).toHaveCount(0);
  await expect(newSessionButton(page)).toBeFocused();

  await shortcutsButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(shortcutsPanel(page)).toBeVisible(ONE_SECOND);
  await expect(closeButton(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(shortcutsPanel(page)).toHaveCount(0);
  await expect(shortcutsButton(page)).toBeFocused();

  await page.keyboard.press('Space');
  await expect(shortcutsPanel(page)).toBeVisible(ONE_SECOND);
});

// plan-keyboard_shortcuts/REQ-33: visible focus, Tab stays among "[Esc]", the list and "Close", Enter adds nothing, the arrows scroll the list
test('the panel works with the keyboard: visible focus, Tab inside the panel, Enter adds nothing, the arrows scroll the list', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 420 });
  await loadPage(page);
  await page.keyboard.press('Alt+KeyS');
  await expect(closeButton(page)).toBeFocused();
  expect(await hasFocusVisible(closeButton(page)), 'focus ring on "Close"').toBe(true);

  await page.keyboard.press('Tab');
  await expect(escButton(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(shortcutList(page)).toBeFocused();
  expect(await hasFocusVisible(shortcutList(page)), 'focus ring on the list').toBe(true);
  await page.keyboard.press('Tab');
  await expect(closeButton(page)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(shortcutList(page)).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(shortcutsPanel(page), 'Enter on the list does not close the panel').toBeVisible();
  await expect(shortcutList(page)).toBeFocused();

  const overflow = await shortcutList(page).evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(overflow, 'the list does not fit a 420 px high window').toBe(true);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('PageDown');
  await expect.poll(() => shortcutList(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect(group(page, 'General').getByText('Shortcuts panel')).toBeInViewport();
  const panel = await shortcutsPanel(page).boundingBox();
  expect(panel!.y + panel!.height, 'the panel stays inside the window').toBeLessThanOrEqual(420);
});

// plan-keyboard_shortcuts/REQ-25, REQ-29, REQ-30, REQ-31, REQ-33, REQ-39, REQ-40, REQ-46 — scenario "The user opens and closes the panel without losing the session"
test('Alt+S over a working, scrolled-up terminal opens the panel, the session keeps working, and Esc gives the terminal its focus and scroll back', async ({
  page,
  request,
}) => {
  const { folder } = await openSession(page, request, 'panel-working');
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

  await page.keyboard.press('Alt+KeyS');
  await expect(shortcutsPanel(page)).toBeVisible(ONE_SECOND);
  await expect(closeButton(page)).toBeFocused();
  expect(await hasFocusVisible(closeButton(page)), 'focus ring on "Close"').toBe(true);

  await page.waitForTimeout(800);
  await expect(entry(page, folder), 'the session keeps working behind the panel').toContainText('Running');
  await expect(terminal(page), 'the terminal stays mounted under the panel').toHaveCount(1);
  expect(await page.locator('.xterm-screen').boundingBox(), 'the terminal keeps its size').toEqual(screen);
  expect(await firstRow(page), 'the terminal keeps its scroll position').toBe(row);

  await page.keyboard.press('Escape');
  await expect(shortcutsPanel(page)).toHaveCount(0, ONE_SECOND);
  await expect(terminalInput(page)).toBeFocused();
  expect(await firstRow(page), 'the scroll position is the same after the panel').toBe(row);
  expect(await inputChunks(page), 'Alt+S or Esc reached the CLI').toBe(typed);
  expect(actions, 'the panel changed no session').toEqual([]);
});

// plan-keyboard_shortcuts/REQ-39, REQ-40 — scenario "A client key never reaches Claude Code"
test('Alt+S then Esc at the prompt of an idle session type nothing in the CLI', async ({ page, request }) => {
  await openSession(page, request, 'panel-prompt');
  await focusTerminal(page);

  await page.keyboard.press('Alt+KeyS');
  await expect(shortcutsPanel(page)).toBeVisible(ONE_SECOND);
  await page.keyboard.press('Escape');
  await expect(shortcutsPanel(page)).toHaveCount(0);
  await expect(terminalInput(page)).toBeFocused();
  await page.waitForTimeout(300);
  await expect(terminal(page), 'Alt+S or Esc reached the CLI').not.toContainText('IN:');
});

// plan-keyboard_shortcuts/REQ-42: while the panel is open, every other shortcut does nothing
test('while the panel is open, Alt+N, Alt+H, Alt+A and Alt+Down do nothing', async ({ page, request }) => {
  const { folder } = await openSession(page, request, 'panel-blocks');
  const other = await newFolder('panel-blocks-other');
  await startViaApi(request, other);
  await expect(entry(page, other)).toBeVisible();

  await page.keyboard.press('Alt+KeyS');
  await expect(closeButton(page)).toBeFocused();
  for (const key of ['Alt+KeyN', 'Alt+KeyH', 'Alt+KeyA', 'Alt+ArrowDown', 'Alt+ArrowUp', 'Alt+Digit1', 'Alt+Digit2']) await page.keyboard.press(key);
  await page.waitForTimeout(300);

  await expect(chooser(page)).toHaveCount(0);
  await expect(history(page)).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(shortcutsPanel(page)).toBeVisible();
  await expect(closeButton(page)).toBeFocused();
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
  await expect(shortcutsPanel(page)).toHaveCount(0);
  await expect(history(page)).toBeVisible();
  expect(await focused()).toBe(before);
});

// plan-keyboard_shortcuts/REQ-28, REQ-44 — scenario "Every key of the panel works": a Terminal row of the panel opens the search box
test('Ctrl+Shift+F, listed in the Terminal group, opens the terminal search box', async ({ page, request }) => {
  await openSession(page, request, 'panel-search');
  await page.keyboard.press('Alt+KeyS');
  await expect(group(page, 'Terminal').locator('li').filter({ hasText: 'Search' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(shortcutsPanel(page)).toHaveCount(0);

  await focusTerminal(page);
  await page.keyboard.press('Control+Shift+KeyF');
  await expect(searchBox(page)).toBeVisible(ONE_SECOND);
  await expect(searchBox(page).getByRole('textbox', { name: 'Search in terminal' })).toBeFocused();
  await expect(terminal(page), 'Ctrl+Shift+F reached the CLI').not.toContainText('IN:');
});

// plan-keyboard_shortcuts/REQ-41 — scenario "A text field keeps its editing keys"
test('in the "Session Name" field, Ctrl+A then "api" leaves only "api"', async ({ page, request }) => {
  const { folder } = await openSession(page, request, 'panel-rename');
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
