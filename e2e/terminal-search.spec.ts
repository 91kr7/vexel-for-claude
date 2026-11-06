// e2e of plan-terminal_addons, batch search. The fake CLI echoes each typed line as `LINE:<text>` and prints 400 rows on COUNT.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-search-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const mainArea = (page: Page) => page.getByRole('main');
const panel = (page: Page) => mainArea(page).getByRole('region', { name: /^Terminal/ });
const terminal = (page: Page) => page.locator('.xterm-rows');
const terminalInput = (page: Page) => page.locator('.xterm-helper-textarea');
const searchBox = (page: Page) => page.getByRole('search', { name: 'Terminal search' });
const field = (page: Page) => searchBox(page).getByRole('textbox', { name: 'Search in terminal' });
const count = (page: Page) => searchBox(page).getByRole('status');
const control = (page: Page, name: string) => searchBox(page).getByRole('button', { name, exact: true });

async function newFolder(name: string): Promise<string> {
  const folder = path.join(await mkdtemp(path.join(projectsRoot, 't-')), name);
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

async function openFromList(page: Page, folder: string, shown = `CWD:${folder}`): Promise<void> {
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText(shown);
}

type Highlight = { text: string; background: string };

/** The runs of visible terminal text on a background of their own, in screen order. */
const highlights = (page: Page): Promise<Highlight[]> =>
  terminal(page).evaluate((element) => {
    const runs: Highlight[] = [];
    for (const row of [...element.children].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)) {
      let run: Highlight | null = null;
      for (const span of row.querySelectorAll('span')) {
        const background = getComputedStyle(span).backgroundColor;
        if (/^rgba\(.*, 0\)$|^transparent$/.test(background)) {
          run = null;
        } else if (run && run.background === background) {
          run.text += span.textContent ?? '';
        } else {
          run = { text: span.textContent ?? '', background };
          runs.push(run);
        }
      }
    }
    return runs;
  });

/** The outline colours of the search decorations drawn on screen: the current match is the one with an outline. */
const outlines = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll('.xterm-decoration')]
      .map((element) => getComputedStyle(element))
      .filter((style) => style.display !== 'none' && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0)
      .map((style) => `${style.outlineWidth} ${style.outlineColor}`),
  );

/** The two matches of the first row are highlighted, the first one as the current match. */
async function expectFirstRowHighlighted(page: Page): Promise<void> {
  const matchBg = await computedColour(page, 'var(--term-match-bg)');
  await expect.poll(async () => (await highlights(page)).map(({ text }) => text)).toEqual(['Error', 'error']);
  const [current, other] = await highlights(page);
  expect(other!.background).toBe(matchBg);
  expect(current!.background).not.toBe(matchBg);
  await expect.poll(async () => (await outlines(page)).length).toBe(1);
}

/** The visible terminal rows from top to bottom, without the empty ones. The renderer reuses row elements, so the DOM order is not the screen order. */
const rows = (page: Page) =>
  terminal(page).evaluate((element) =>
    [...element.children]
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      .map((row) => row.textContent?.trim() ?? '')
      .filter(Boolean),
  );

/** Types a line in the terminal, as the user would. */
async function typeLine(page: Page, line: string): Promise<void> {
  await page.keyboard.type(line);
  await page.keyboard.press('Enter');
}

/**
 * Opens a session whose scrollback holds three "error" matches above the visible screen:
 * two on the row "LINE:Error one, error two", one on the row "LINE:ERROR three" 400 rows below.
 */
async function sessionWithErrors(page: Page, request: APIRequestContext): Promise<string> {
  const folder = await newFolder('search');
  await startViaApi(request, folder);
  await page.goto('/');
  await openFromList(page, folder);
  await page.locator('.xterm-screen').click();
  await expect(terminalInput(page)).toBeFocused();
  await typeLine(page, 'Error one, error two');
  await typeLine(page, 'COUNT');
  await expect(terminal(page)).toContainText('COUNT-DONE');
  await typeLine(page, 'ERROR three');
  await typeLine(page, 'COUNT');
  await expect.poll(async () => (await rows(page)).join('\n')).toMatch(/L00400\nCOUNT-DONE$/);
  await expect(terminal(page)).not.toContainText('ERROR three');
  return folder;
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

/** Whether the element draws the focus ring colour as an outline or a box-shadow. */
async function showsRing(page: Page, target: Locator): Promise<boolean> {
  const ring = await computedColour(page, 'var(--color-focus-ring)');
  return target.evaluate((element, ringColour) => {
    const style = getComputedStyle(element);
    const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 && style.outlineColor === ringColour;
    return outline || style.boxShadow.includes(ringColour);
  }, ring);
}

function luminance(colour: string): number {
  const [r, g, b] = (colour.match(/[\d.]+/g) ?? []).slice(0, 3).map((value) => {
    const channel = Number(value) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

// Scenario "The user finds a word in the terminal scrollback"
test('REQ-14, REQ-17, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-26, REQ-28: Ctrl+Shift+F opens the box, typing finds every match in the scrollback and nothing reaches the CLI', async ({ page, request }) => {
  const folder = await sessionWithErrors(page, request);

  await page.keyboard.press('Control+Shift+F');
  await expect(searchBox(page)).toBeVisible();
  await expect(field(page)).toBeFocused();
  await expect(count(page)).toHaveText('');

  // TerminalSearchBox: top right of the panel, 8 px from its top and right edges.
  const panelBox = (await panel(page).boundingBox())!;
  const box = (await searchBox(page).boundingBox())!;
  expect(Math.abs(panelBox.x + panelBox.width - (box.x + box.width) - 8)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.y - panelBox.y - 8)).toBeLessThanOrEqual(1);

  // The count follows each key. "error tw" matches only the second word of the first row, which stays current for "error".
  await page.keyboard.type('error tw');
  await expect(count(page)).toHaveText('1 of 1');
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Backspace');
  await expect(count(page)).toHaveText('2 of 3');

  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await expect(count(page)).toHaveText('');
  await page.keyboard.type('error');
  await expect(count(page)).toHaveText('1 of 3');

  // The terminal scrolled back to the first row, and both of its matches are highlighted.
  await expect(terminal(page)).toContainText('LINE:Error one, error two');
  await expectFirstRowHighlighted(page);

  await page.keyboard.press('Escape');
  await expect(searchBox(page)).toHaveCount(0);
  await expect(terminalInput(page)).toBeFocused();
  await typeLine(page, 'Z');
  // The CLI line holds only "Z": no key typed in the box reached it.
  await expect(terminal(page)).toContainText('LINE:Z');
});

// A short buffer, so that every echo of the CLI stays on screen: the long one of sessionWithErrors sometimes drops its newest rows from the view.
test('REQ-17, REQ-28: Ctrl+Shift+F, the keys typed in the box and Esc send nothing to the CLI', async ({ page, request }) => {
  const folder = await newFolder('keys');
  await startViaApi(request, folder);
  await page.goto('/');
  await openFromList(page, folder);
  await expect(terminal(page)).toContainText('READY');
  await page.locator('.xterm-screen').click();

  await page.keyboard.press('Control+Shift+F');
  await expect(field(page)).toBeFocused();
  await page.keyboard.type('abc');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.press('Escape');
  await expect(searchBox(page)).toHaveCount(0);
  await expect(terminalInput(page)).toBeFocused();
  await page.keyboard.press('Control+Shift+F');
  await page.keyboard.press('Escape');
  await typeLine(page, 'Z');

  await expect(terminal(page)).toContainText('LINE:Z');
  const shown = await rows(page);
  // WINCH comes from the resize the view sends on connect.
  expect(shown.slice(shown.indexOf('READY') + 1).filter((row) => !row.startsWith('WINCH:'))).toEqual(['IN:5a', 'IN:0d', 'LINE:Z']);
});

// plan-terminal_addons/REQ-20: plain text, case ignored
test('REQ-20, REQ-26: the search ignores case and treats its text as plain text', async ({ page, request }) => {
  await sessionWithErrors(page, request);
  await page.keyboard.press('Control+Shift+F');

  await page.keyboard.type('ErRoR');
  await expect(count(page)).toHaveText('1 of 3');

  await page.keyboard.press('Control+A');
  await page.keyboard.type('err.r');
  await expect(count(page)).toHaveText('No results');
});

// Scenario "The user moves between the matches"
test('REQ-23, REQ-24, REQ-25, REQ-30: Enter, Shift+Enter and the controls move between the matches, wrap and scroll to each', async ({ page, request }) => {
  await sessionWithErrors(page, request);
  await page.keyboard.press('Control+Shift+F');
  await page.keyboard.type('error');
  await expect(count(page)).toHaveText('1 of 3');

  await page.keyboard.press('Enter');
  await expect(count(page)).toHaveText('2 of 3');
  await page.keyboard.press('Enter');
  await expect(count(page)).toHaveText('3 of 3');
  await expect(terminal(page)).toContainText('LINE:ERROR three');
  await expect(terminal(page)).not.toContainText('LINE:Error one');
  await expect.poll(async () => (await highlights(page)).map(({ text }) => text)).toEqual(['ERROR']);
  await expect.poll(async () => (await outlines(page)).length).toBe(1);

  await page.keyboard.press('Enter');
  await expect(count(page)).toHaveText('1 of 3');
  await expect(terminal(page)).toContainText('LINE:Error one, error two');
  await expect(terminal(page)).not.toContainText('LINE:ERROR three');

  await page.keyboard.press('Shift+Enter');
  await expect(count(page)).toHaveText('3 of 3');
  await expect(terminal(page)).toContainText('LINE:ERROR three');

  await control(page, 'Next match').click();
  await expect(count(page)).toHaveText('1 of 3');
  await expect(terminal(page)).toContainText('LINE:Error one, error two');

  // Tab order and the visible focus of each control.
  await field(page).focus();
  await page.keyboard.press('Tab');
  await expect(control(page, 'Previous match')).toBeFocused();
  await expect.poll(() => showsRing(page, control(page, 'Previous match'))).toBe(true);
  await page.keyboard.press('Enter');
  await expect(count(page)).toHaveText('3 of 3');
  await page.keyboard.press('Tab');
  await expect(control(page, 'Next match')).toBeFocused();
  await expect.poll(() => showsRing(page, control(page, 'Next match'))).toBe(true);
  await page.keyboard.press('Enter');
  await expect(count(page)).toHaveText('1 of 3');
  await page.keyboard.press('Tab');
  await expect(control(page, 'Close search')).toBeFocused();
  await expect.poll(() => showsRing(page, control(page, 'Close search'))).toBe(true);
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(field(page)).toBeFocused();
  await expect.poll(() => showsRing(page, field(page))).toBe(true);
  await expect.poll(() => showsRing(page, panel(page))).toBe(true);

  // Esc on a control closes the box too.
  await control(page, 'Next match').focus();
  await page.keyboard.press('Escape');
  await expect(searchBox(page)).toHaveCount(0);
  await expect(terminalInput(page)).toBeFocused();
});

// Scenario "The search finds nothing"
test('REQ-26: a text the terminal does not hold shows "No results" and highlights nothing', async ({ page, request }) => {
  await sessionWithErrors(page, request);
  await page.keyboard.press('Control+Shift+F');
  await page.keyboard.type('error');
  await expect(count(page)).toHaveText('1 of 3');
  await expectFirstRowHighlighted(page);

  await page.keyboard.press('Control+A');
  await page.keyboard.type('qwxzq');
  await expect(count(page)).toHaveText('No results');
  await expect.poll(() => highlights(page)).toEqual([]);
  await expect.poll(() => outlines(page)).toEqual([]);
  await expect(page.locator('.xterm-selection > div')).toHaveCount(0);
});

// Scenario "The user closes the search"
test('REQ-15, REQ-27, REQ-28: "Search" opens the box; Esc closes it, removes the highlights and the terminal takes the keys again', async ({ page, request }) => {
  await sessionWithErrors(page, request);
  await mainArea(page).locator('header').getByRole('button', { name: 'Search', exact: true }).click();
  await expect(searchBox(page)).toBeVisible();
  await expect(field(page)).toBeFocused();
  await page.keyboard.type('error');
  await expect(count(page)).toHaveText('1 of 3');
  await expectFirstRowHighlighted(page);

  // SessionView: opening the open search focuses the field and selects its text.
  await page.locator('.xterm-screen').click();
  await expect(terminalInput(page)).toBeFocused();
  await page.keyboard.press('Control+Shift+F');
  await expect(field(page)).toBeFocused();
  expect(await field(page).evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd])).toEqual([0, 5]);

  await page.keyboard.press('Escape');
  await expect(searchBox(page)).toHaveCount(0);
  await expect.poll(() => highlights(page)).toEqual([]);
  await expect.poll(() => outlines(page)).toEqual([]);
  await expect(page.locator('.xterm-selection > div')).toHaveCount(0);
  await expect(terminalInput(page)).toBeFocused();
  await typeLine(page, 'Z');
  // The CLI line holds only "Z": no key typed in the box reached it.
  await expect(terminal(page)).toContainText('LINE:Z');

  // "Close search" does the same, and the next opening starts empty.
  await page.keyboard.press('Control+Shift+F');
  await expect(field(page)).toHaveValue('');
  await page.keyboard.type('error');
  await expect(count(page)).toHaveText(/ of 3$/);
  await control(page, 'Close search').click();
  await expect(searchBox(page)).toHaveCount(0);
  await expect.poll(() => outlines(page)).toEqual([]);
  await expect(page.locator('.xterm-selection > div')).toHaveCount(0);
  await expect(terminalInput(page)).toBeFocused();
});

// Scenario "The user closes the search", last step
test('REQ-29: opening another session closes the box', async ({ page, request }) => {
  const other = await newFolder('other');
  await startViaApi(request, other);
  const folder = await sessionWithErrors(page, request);
  await page.keyboard.press('Control+Shift+F');
  await page.keyboard.type('error');
  await expect(count(page)).toHaveText('1 of 3');

  await openFromList(page, other);
  await expect(searchBox(page)).toHaveCount(0);

  await openFromList(page, folder, 'COUNT-DONE');
  await expect(searchBox(page)).toHaveCount(0);
  await mainArea(page).locator('header').getByRole('button', { name: 'Search', exact: true }).click();
  await expect(field(page)).toHaveValue('');
  await expect(count(page)).toHaveText('');
});

// Scenario "The search key works only in the terminal"
test('REQ-16, REQ-18: Ctrl+Shift+L still moves the focus to the list, and Ctrl+Shift+F there opens no box', async ({ page, request }) => {
  const folder = await sessionWithErrors(page, request);
  await page.keyboard.press('Control+Shift+L');
  await expect(entry(page, folder)).toBeFocused();

  await page.keyboard.press('Control+Shift+F');
  await page.waitForTimeout(500);
  await expect(searchBox(page)).toHaveCount(0);
  await expect(entry(page, folder)).toBeFocused();

  await page.locator('.xterm-screen').click();
  await page.keyboard.press('Control+Shift+L');
  await expect(entry(page, folder)).toBeFocused();
});

// Decision "Ended sessions"
test('the search works on the terminal of an ended session', async ({ page, request }) => {
  await sessionWithErrors(page, request);
  await typeLine(page, '/exit');
  await expect(mainArea(page).locator('header').getByText('Ended', { exact: true })).toBeVisible();

  await mainArea(page).locator('header').getByRole('button', { name: 'Search', exact: true }).click();
  await page.keyboard.type('error');
  await expect(count(page)).toHaveText('1 of 3');
  await expectFirstRowHighlighted(page);
});

for (const theme of ['dark', 'light'] as const) {
  test(`REQ-22, REQ-31: matches and the current match are distinct and readable on the terminal panel in the ${theme} theme`, async ({ page, request }) => {
    await page.addInitScript((chosen) => localStorage.setItem('ai-client.theme', chosen), theme);
    await sessionWithErrors(page, request);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.keyboard.press('Control+Shift+F');
    await page.keyboard.type('error');
    await expect(count(page)).toHaveText('1 of 3');
    await expectFirstRowHighlighted(page);

    const [termBg, termFg, matchBg, currentBorder] = await Promise.all(
      ['var(--term-bg)', 'var(--term-fg)', 'var(--term-match-bg)', 'var(--term-match-current-border)'].map((value) => computedColour(page, value)),
    );
    const [current] = await highlights(page);
    // The current match: a 1 px outline in its own colour, visible on the panel.
    expect(await outlines(page)).toEqual([`1px ${currentBorder}`]);
    expect(contrast(currentBorder, termBg)).toBeGreaterThanOrEqual(3);
    // The text stays readable on both highlights.
    const text = await terminal(page).evaluate((element) => getComputedStyle(element.querySelector('span')!).color);
    expect(text).toBe(termFg);
    expect(contrast(termFg, matchBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(termFg, current!.background)).toBeGreaterThanOrEqual(4.5);
  });
}
