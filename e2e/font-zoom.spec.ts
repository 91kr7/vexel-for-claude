// e2e of plan-terminal_addons, batch font-zoom. The fake CLI echoes each key as `IN:<hex>`, each line as `LINE:<text>`,
// and prints `WINCH:<cols>x<rows>` when the pty is resized.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';

const SIZE_KEY = 'ai-client.terminal-font-size';

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-zoom-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const mainArea = (page: Page) => page.getByRole('main');
const subbar = (page: Page) => mainArea(page).locator('header');
const panel = (page: Page) => mainArea(page).getByRole('region', { name: /^Terminal/ });
const terminal = (page: Page) => page.locator('.xterm-rows');
const terminalInput = (page: Page) => page.locator('.xterm-helper-textarea');
const zoomGroup = (page: Page) => subbar(page).getByRole('group', { name: 'Terminal text size' });
const smallerButton = (page: Page) => zoomGroup(page).getByRole('button', { name: 'Smaller text', exact: true });
const defaultButton = (page: Page) => zoomGroup(page).getByRole('button', { name: /^Default text size \(\d+ px\)$/ });
const largerButton = (page: Page) => zoomGroup(page).getByRole('button', { name: 'Larger text', exact: true });

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

async function openFromList(page: Page, folder: string): Promise<void> {
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
  await expect(terminal(page)).toContainText('READY');
}

/** Starts a session, opens it and gives the terminal the keyboard focus. */
async function focusedSession(page: Page, request: APIRequestContext, name = 'zoom'): Promise<string> {
  const folder = await newFolder(name);
  await startViaApi(request, folder);
  await page.goto('/');
  await openFromList(page, folder);
  await page.locator('.xterm-screen').click();
  await expect(terminalInput(page)).toBeFocused();
  return folder;
}

/** The text size the terminal draws with, in px. */
const terminalTextSize = (page: Page) => terminal(page).evaluate((element) => parseFloat(getComputedStyle(element).fontSize));

/** The terminal text and the default size button both show `size` px. */
async function expectSize(page: Page, size: number): Promise<void> {
  await expect.poll(() => terminalTextSize(page)).toBe(size);
  await expect(defaultButton(page)).toHaveText(`${size} px`);
  await expect(defaultButton(page)).toHaveAccessibleName(`Default text size (${size} px)`);
}

/** The visible terminal rows from top to bottom, without the empty ones. */
const rows = (page: Page) =>
  terminal(page).evaluate((element) =>
    [...element.children]
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      .map((row) => row.textContent?.trim() ?? '')
      .filter(Boolean),
  );

/** What the CLI received after READY, without the resize reports. */
async function receivedAfterReady(page: Page): Promise<string[]> {
  const shown = await rows(page);
  return shown.slice(shown.indexOf('READY') + 1).filter((row) => !row.startsWith('WINCH:'));
}

async function typeLine(page: Page, line: string): Promise<void> {
  await page.keyboard.type(line);
  await page.keyboard.press('Enter');
}

/** The grid the terminal shows, measured on screen: columns from the width of one character, rows from the row elements. */
const shownGrid = (page: Page) =>
  page.evaluate(() => {
    const screen = document.querySelector('.xterm-screen')!.getBoundingClientRect();
    const rowElements = [...document.querySelector('.xterm-rows')!.children];
    const ready = rowElements.find((row) => row.textContent?.trim() === 'READY')!;
    const node = document.createTreeWalker(ready, NodeFilter.SHOW_TEXT).nextNode()!;
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 5);
    const charWidth = range.getBoundingClientRect().width / 5;
    return { cols: Math.round(screen.width / charWidth), rows: rowElements.length, charWidth, rowHeight: screen.height / rowElements.length };
  });

/** The last `WINCH:<cols>x<rows>` report of the CLI. */
async function lastWinch(page: Page): Promise<{ cols: number; rows: number } | undefined> {
  const report = (await rows(page)).filter((row) => row.startsWith('WINCH:')).at(-1);
  const match = report?.match(/^WINCH:(\d+)x(\d+)$/);
  return match ? { cols: Number(match[1]), rows: Number(match[2]) } : undefined;
}

/** The space inside the panel padding and border, and the box of the terminal screen. */
const panelFit = (page: Page) =>
  page.evaluate(() => {
    const region = document.querySelector('main [role="region"]')!;
    const style = getComputedStyle(region);
    const box = region.getBoundingClientRect();
    const insetX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const insetY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const screen = document.querySelector('.xterm-screen')!.getBoundingClientRect();
    return { innerWidth: box.width - insetX, innerHeight: box.height - insetY, width: screen.width, height: screen.height };
  });

/** The size and text size of the client parts outside the terminal. */
const clientFrame = (page: Page) =>
  page.evaluate(() =>
    ['.top-bar', '[aria-label="Session List"]', 'main header', 'main header button'].map((selector) => {
      const element = document.querySelector(selector)!;
      const box = element.getBoundingClientRect();
      return { selector, width: box.width, height: box.height, fontSize: getComputedStyle(element).fontSize };
    }),
  );

/** Records every keydown of the page, to read later whether its default was prevented. */
async function recordKeys(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: KeyboardEvent[] = [];
    (window as unknown as { zoomKeys: KeyboardEvent[] }).zoomKeys = seen;
    window.addEventListener('keydown', (event) => seen.push(event), true);
  });
}

const preventedKeys = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { zoomKeys: KeyboardEvent[] }).zoomKeys.filter((event) => event.ctrlKey && !['Control', 'Shift'].includes(event.key))
      .map((event) => [event.key, event.defaultPrevented]),
  );

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

// Scenario "The user makes the terminal text larger"
test('REQ-32, REQ-37, REQ-39, REQ-42, REQ-43: Ctrl+= makes only the terminal text 1 px larger, refits it, sends the new grid and nothing else to the CLI', async ({ page, request }) => {
  await recordKeys(page);
  const other = await newFolder('other');
  await startViaApi(request, other);
  await focusedSession(page, request);
  await expectSize(page, 12);
  const frame = await clientFrame(page);
  const before = await shownGrid(page);

  await page.keyboard.press('Control+Equal');
  await expectSize(page, 13);

  // REQ-42: the terminal fills the panel again, with fewer columns, and the CLI gets the grid the terminal shows.
  await expect.poll(async () => (await shownGrid(page)).cols).toBeLessThan(before.cols);
  const after = await shownGrid(page);
  await expect.poll(() => lastWinch(page)).toEqual({ cols: after.cols, rows: after.rows });
  const fit = await panelFit(page);
  expect(fit.width).toBeLessThanOrEqual(fit.innerWidth + 0.5);
  // The fit leaves room for the scrollbar, so less than one character plus a scrollbar stays free.
  expect(fit.innerWidth - fit.width).toBeLessThan(after.charWidth + 24);
  expect(fit.height).toBeLessThanOrEqual(fit.innerHeight + 0.5);
  expect(fit.innerHeight - fit.height).toBeLessThan(after.rowHeight);

  // REQ-39: the rest of the client keeps its size.
  expect(await clientFrame(page)).toEqual(frame);

  // REQ-32: Ctrl++ makes it larger too.
  await page.keyboard.press('Control+Shift+Equal');
  await expectSize(page, 14);

  // REQ-37: nothing reached the CLI, and the browser page zoom was prevented.
  await typeLine(page, 'Z');
  await expect(terminal(page)).toContainText('LINE:Z');
  expect(await receivedAfterReady(page)).toEqual(['IN:5a', 'IN:0d', 'LINE:Z']);
  expect(await preventedKeys(page)).toEqual([
    ['=', true],
    ['+', true],
  ]);

  // REQ-43: the session opened next shows the same size.
  await openFromList(page, other);
  await expectSize(page, 14);
});

// Scenario "The user makes the text smaller and restores it"
test('REQ-33, REQ-34, REQ-37: Ctrl+- makes the text 1 px smaller, Ctrl+0 restores 12 px, and the CLI receives neither', async ({ page, request }) => {
  await recordKeys(page);
  await page.addInitScript(([key]) => localStorage.setItem(key!, '14'), [SIZE_KEY]);
  await focusedSession(page, request);
  await expectSize(page, 14);

  await page.keyboard.press('Control+Minus');
  await expectSize(page, 13);
  await page.keyboard.press('Control+Digit0');
  await expectSize(page, 12);

  await typeLine(page, 'Z');
  await expect(terminal(page)).toContainText('LINE:Z');
  expect(await receivedAfterReady(page)).toEqual(['IN:5a', 'IN:0d', 'LINE:Z']);
  expect(await preventedKeys(page)).toEqual([
    ['-', true],
    ['0', true],
  ]);
});

// Requirements, assumption "Keyboard layouts": on an Italian keyboard Ctrl+Shift+0 produces "=" and makes the text larger
test('REQ-32: the produced character decides, so Ctrl+Shift with a key that produces "=" makes the text larger', async ({ page, request }) => {
  await focusedSession(page, request);
  const cdp = await page.context().newCDPSession(page);
  const ctrlShift = 2 | 8;
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers: ctrlShift, key: '=', code: 'Digit0', windowsVirtualKeyCode: 48 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: ctrlShift, key: '=', code: 'Digit0', windowsVirtualKeyCode: 48 });
  await expectSize(page, 13);
});

// Scenario "The user reaches the largest size with the controls"
test('REQ-35, REQ-40, REQ-41, REQ-45: the controls work with Tab and Enter, show the focus, and stop at 32 px', async ({ page, request }) => {
  await page.addInitScript(([key]) => localStorage.setItem(key!, '31'), [SIZE_KEY]);
  await focusedSession(page, request);
  await expectSize(page, 31);

  await subbar(page).getByRole('button', { name: 'Search', exact: true }).focus();
  for (const control of [smallerButton, defaultButton, largerButton]) {
    await page.keyboard.press('Tab');
    await expect(control(page)).toBeFocused();
    await expect.poll(() => showsRing(page, control(page))).toBe(true);
  }
  await page.keyboard.press('Enter');
  await expectSize(page, 32);
  await expect(largerButton(page)).toBeDisabled();
  await expect(smallerButton(page)).toBeEnabled();

  // REQ-40: a disabled "larger" does nothing, and Ctrl+= in the terminal stops at 32 px.
  await largerButton(page).click({ force: true });
  await page.locator('.xterm-screen').click();
  await page.keyboard.press('Control+Equal');
  await page.waitForTimeout(300);
  await expectSize(page, 32);
});

// plan-terminal_addons/REQ-35, REQ-40, REQ-41: the other controls, and the lower limit
test('REQ-35, REQ-40, REQ-41, REQ-45: "Smaller text" stops at 8 px, Space activates a control, the default size button restores 12 px', async ({ page, request }) => {
  await focusedSession(page, request);
  await expectSize(page, 12);

  for (let size = 11; size >= 8; size -= 1) {
    await smallerButton(page).click();
    await expectSize(page, size);
  }
  await expect(smallerButton(page)).toBeDisabled();
  await expect(largerButton(page)).toBeEnabled();
  await page.locator('.xterm-screen').click();
  await page.keyboard.press('Control+Minus');
  await page.waitForTimeout(300);
  await expectSize(page, 8);

  await largerButton(page).focus();
  await page.keyboard.press('Space');
  await expectSize(page, 9);
  await defaultButton(page).click();
  await expectSize(page, 12);
  await expect(smallerButton(page)).toBeEnabled();
});

// Scenario "The client keeps the size after a reload"
test('REQ-44: the size chosen survives a reload of the page', async ({ page, request }) => {
  const folder = await focusedSession(page, request);
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('Control+Equal');
  await expectSize(page, 16);

  await page.reload();
  await openFromList(page, folder);
  await expectSize(page, 16);
});

// Scenario "The zoom keys leave other keys alone"
test('REQ-36, REQ-38: outside the terminal the zoom keys change nothing, and in the terminal Ctrl+Shift+- still sends undo to the CLI', async ({ page, request }) => {
  const folder = await focusedSession(page, request);
  await expectSize(page, 12);

  await page.keyboard.press('Control+Shift+L');
  await expect(entry(page, folder)).toBeFocused();
  await page.keyboard.press('Control+Equal');
  await page.keyboard.press('Control+Minus');
  await page.waitForTimeout(300);
  await expectSize(page, 12);

  await page.locator('.xterm-screen').click();
  await expect(terminalInput(page)).toBeFocused();
  await page.keyboard.press('Control+Shift+Minus');
  // Ctrl+_ is the control character 0x1f.
  await expect(terminal(page)).toContainText('IN:1f');
  await expectSize(page, 12);
});

// Decision "Ended sessions"
test('REQ-35, REQ-42: zoom also works on the terminal of an ended session', async ({ page, request }) => {
  await focusedSession(page, request);
  await typeLine(page, '/exit');
  await expect(subbar(page).getByText('Ended', { exact: true })).toBeVisible();

  await largerButton(page).click();
  await expectSize(page, 13);
  const fit = await panelFit(page);
  expect(fit.width).toBeLessThanOrEqual(fit.innerWidth + 0.5);
  expect(fit.height).toBeLessThanOrEqual(fit.innerHeight + 0.5);
});
