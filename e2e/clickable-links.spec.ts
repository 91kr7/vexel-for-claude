// e2e of plan-terminal_addons, batch clickable-links. The fake CLI prints the links on the line command LINKS.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type Page, expect, test } from '@playwright/test';

// The addresses that `LINKS` prints (test-support/fake-claude.mjs). example.test never resolves: the tests answer it.
const SITE = 'https://example.test';
const PLAIN = `${SITE}/plain/page`;
const PAREN = `${SITE}/paren/x`;
const SOFT = `${SITE}/soft/${'a'.repeat(260)}`;
const HARD = `${SITE}/hard/${'b'.repeat(260)}`;
const DOCS = `${SITE}/docs/page`;

let project: string;

test.beforeAll(async () => {
  project = path.join(await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-')), 'links');
  await mkdir(project);
});

const terminal = (page: Page) => page.locator('.xterm-rows');
const tooltip = (page: Page) => page.getByRole('tooltip');

/** Starts a session, makes the fake CLI print the links and returns the client URL. */
async function showLinks(page: Page): Promise<string> {
  await page.context().route(`${SITE}/**`, (route) => route.fulfill({ contentType: 'text/plain', body: 'opened' }));
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('button', { name: 'New Claude Code Session' }).click();
  const pathField = page.getByRole('textbox', { name: 'Working Directory Path', exact: true });
  await expect(pathField).toHaveValue(os.homedir());
  await pathField.fill(project);
  await page.getByRole('button', { name: 'Start Session' }).click();
  await expect(terminal(page)).toContainText('READY');
  await page.locator('.xterm-screen').click();
  await page.keyboard.type('LINKS');
  await page.keyboard.press('Enter');
  await expect(terminal(page)).toContainText('LINKS-DONE');
  return page.url();
}

/** Centre of the character `column` (0-based) of the row `rowOffset` rows below the row that starts with `marker`. */
async function cell(page: Page, marker: string, rowOffset: number, column: number): Promise<{ x: number; y: number }> {
  return terminal(page).evaluate(
    (rows, [marker, rowOffset, column]) => {
      const all = [...rows.children];
      const start = all.findIndex((row) => row.textContent?.startsWith(marker as string));
      const row = all[start + (rowOffset as number)];
      if (start < 0 || !row) throw new Error(`no row ${marker}+${rowOffset}`);
      const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
      let offset = column as number;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const length = node.textContent?.length ?? 0;
        if (offset < length) {
          const range = document.createRange();
          range.setStart(node, offset);
          range.setEnd(node, offset + 1);
          const box = range.getBoundingClientRect();
          return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        }
        offset -= length;
      }
      throw new Error(`no column ${column} in row ${marker}+${rowOffset}`);
    },
    [marker, rowOffset, column] as const,
  );
}

/** The text under the hover underline (solid) now, all rows joined. xterm.js keeps a dashed underline on every OSC 8 text. */
const underlined = (page: Page) =>
  terminal(page).evaluate((rows) =>
    [...rows.querySelectorAll('span')]
      .filter((span) => getComputedStyle(span).textDecorationLine.includes('underline') && getComputedStyle(span).textDecorationStyle === 'solid')
      .map((span) => span.textContent)
      .join(''),
  );

const cursorAt = (page: Page, { x, y }: { x: number; y: number }) =>
  page.evaluate(([x, y]) => getComputedStyle(document.elementFromPoint(x, y)!).cursor, [x, y] as const);

async function ctrlClick(page: Page, point: { x: number; y: number }): Promise<void> {
  await page.keyboard.down('Control');
  await page.mouse.click(point.x, point.y);
  await page.keyboard.up('Control');
}

/** Ctrl+click on `point` (already hovered) and returns the URL of the tab it opens. */
async function openedBy(page: Page, point: { x: number; y: number }): Promise<string> {
  const opened = page.context().waitForEvent('page');
  await ctrlClick(page, point);
  const tab = await opened;
  await tab.waitForLoadState();
  const url = tab.url();
  await tab.close();
  return url;
}

/** Counts the tabs opened from now on. */
function countTabs(page: Page): () => number {
  let tabs = 0;
  page.context().on('page', () => (tabs += 1));
  return () => tabs;
}

/** The bottom right corner of the terminal holds no link. */
async function leaveLinks(page: Page): Promise<void> {
  const box = (await terminal(page).boundingBox())!;
  await page.mouse.move(box.x + box.width - 5, box.y + box.height - 5);
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

test('REQ-1, REQ-3, REQ-8: the pointer over a web address underlines the address without the full stop and shows a hand', async ({ page }) => {
  await showLinks(page);
  const point = await cell(page, 'WEB:', 0, 12);
  await page.mouse.move(point.x, point.y);
  await expect.poll(() => underlined(page)).toBe(PLAIN);
  expect(await cursorAt(page, point)).toBe('pointer');
  await expect(tooltip(page)).toHaveCount(0);

  await leaveLinks(page);
  await expect.poll(() => underlined(page)).toBe('');
  expect(await cursorAt(page, point)).not.toBe('pointer');
});

test('REQ-5, REQ-10, REQ-11, REQ-8: Ctrl+click opens the address in a new tab and the client keeps the session', async ({ page }) => {
  const client = await showLinks(page);
  const plain = await cell(page, 'WEB:', 0, 12);
  await page.mouse.move(plain.x, plain.y);
  await expect.poll(() => underlined(page)).toBe(PLAIN);
  expect(await openedBy(page, plain)).toBe(PLAIN);

  const paren = await cell(page, 'PAREN:', 0, 10);
  await page.mouse.move(paren.x, paren.y);
  await expect.poll(() => underlined(page)).toBe(PAREN);
  expect(await openedBy(page, paren)).toBe(PAREN);

  expect(page.url()).toBe(client);
  await expect(terminal(page)).toContainText('LINKS-DONE');
});

test('REQ-7, REQ-8: an address broken over rows by the CLI opens in full, without the final full stop', async ({ page }) => {
  await showLinks(page);
  const point = await cell(page, 'HARD:', 1, 3);
  await page.mouse.move(point.x, point.y);
  await expect.poll(() => underlined(page)).toBe(HARD);
  expect(await openedBy(page, point)).toBe(HARD);
});

test('REQ-7, REQ-8: an address wrapped by the terminal opens in full, without the final full stop', async ({ page }) => {
  await showLinks(page);
  const point = await cell(page, 'SOFT:', 1, 3);
  await page.mouse.move(point.x, point.y);
  await expect.poll(() => underlined(page)).toBe(SOFT);
  expect(await openedBy(page, point)).toBe(SOFT);
});

test('REQ-6: a plain click on a link opens nothing, focuses the terminal and still selects text', async ({ page }) => {
  const client = await showLinks(page);
  const tabs = countTabs(page);
  const input = page.locator('.xterm-helper-textarea');
  await input.evaluate((element) => (element as HTMLElement).blur());
  await expect(input).not.toBeFocused();

  const point = await cell(page, 'WEB:', 0, 12);
  await page.mouse.move(point.x, point.y);
  await expect.poll(() => underlined(page)).toBe(PLAIN);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(1000);
  expect(tabs()).toBe(0);
  expect(page.url()).toBe(client);
  await expect(input).toBeFocused();
  await page.keyboard.type('q');
  await expect(terminal(page)).toContainText('IN:71');

  const from = await cell(page, 'WEB:', 0, 8);
  const to = await cell(page, 'WEB:', 0, 30);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('.xterm-selection > div').first()).toBeAttached();
  expect(tabs()).toBe(0);
});

test('REQ-2, REQ-4, REQ-5: a hyperlink shows its hidden address in a tooltip and opens with Ctrl+click', async ({ page }) => {
  await showLinks(page);
  const point = await cell(page, 'OSC8:', 0, 6);
  await page.mouse.move(point.x, point.y);
  await expect.poll(() => underlined(page)).toBe('docs');
  expect(await cursorAt(page, point)).toBe('pointer');
  await expect(tooltip(page)).toHaveText(DOCS);
  // SessionView spec: 12 px right of and below the pointer.
  const box = (await tooltip(page).boundingBox())!;
  expect(Math.abs(box.x - (point.x + 12))).toBeLessThanOrEqual(1);
  expect(Math.abs(box.y - (point.y + 12))).toBeLessThanOrEqual(1);

  await leaveLinks(page);
  await expect(tooltip(page)).toHaveCount(0);

  await page.mouse.move(point.x, point.y);
  await expect(tooltip(page)).toHaveText(DOCS);
  expect(await openedBy(page, point)).toBe(DOCS);
});

test('REQ-12: a hyperlink to a file: address is not a link and Ctrl+click opens nothing', async ({ page }) => {
  const client = await showLinks(page);
  const tabs = countTabs(page);
  const point = await cell(page, 'FILE:', 0, 7);
  await page.mouse.move(point.x, point.y);
  await page.waitForTimeout(500);
  expect(await underlined(page)).toBe('');
  expect(await cursorAt(page, point)).not.toBe('pointer');
  await expect(tooltip(page)).toHaveCount(0);

  await ctrlClick(page, point);
  await page.waitForTimeout(1000);
  expect(tabs()).toBe(0);
  expect(page.url()).toBe(client);
  await expect(terminal(page)).toContainText('LINKS-DONE');
});

for (const theme of ['dark', 'light'] as const) {
  test(`REQ-13: links and the address tooltip are readable on the terminal panel in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((chosen) => localStorage.setItem('ai-client.theme', chosen), theme);
    await showLinks(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    const point = await cell(page, 'OSC8:', 0, 6);
    await page.mouse.move(point.x, point.y);
    await expect.poll(() => underlined(page)).toBe('docs');
    const link = await terminal(page).evaluate((rows) => {
      const span = [...rows.querySelectorAll('span')].find((element) => getComputedStyle(element).textDecorationStyle === 'solid' && getComputedStyle(element).textDecorationLine.includes('underline'))!;
      let background = 'rgba(0, 0, 0, 0)';
      for (let element: Element | null = span; element && /rgba\(.*, 0\)|transparent/.test(background); element = element.parentElement) {
        background = getComputedStyle(element).backgroundColor;
      }
      const style = getComputedStyle(span);
      return { colour: style.color, underline: style.textDecorationColor, background };
    });
    expect(link.underline).toBe(link.colour);
    expect(contrast(link.colour, link.background)).toBeGreaterThanOrEqual(4.5);

    const shown = await tooltip(page).evaluate((element) => {
      const style = getComputedStyle(element);
      return { colour: style.color, background: style.backgroundColor };
    });
    expect(contrast(shown.colour, shown.background)).toBeGreaterThanOrEqual(4.5);
  });
}
