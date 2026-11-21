// e2e of plan-popup_glass, batch termination-margins: the termination confirmations keep the spacing of the Dialog
// contract (header 12 × 16, body 16 with items 14 apart, footer 12 × 16 with buttons 8 apart) and nothing crosses
// their border. The process confirmation is only opened and cancelled: the e2e server is the instance it names.
/// <reference lib="dom" />
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { settingsButton, settingsPopup } from './settings';

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-termination-margins-'));
});

test.afterAll(async () => {
  await rm(projectsRoot, { recursive: true, force: true });
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const terminal = (page: Page) => page.locator('.xterm-rows');
const sessionConfirmation = (page: Page) => page.getByRole('alertdialog', { name: 'Terminate the Session?' });
const processConfirmation = (page: Page) => page.getByRole('alertdialog', { name: 'Terminate the Process?' });
const processRows = (page: Page) =>
  settingsPopup(page).getByRole('region', { name: 'Process List' }).getByRole('list', { name: 'Processes' }).getByRole('listitem');

interface Spacing {
  header: string;
  body: string;
  bodyGaps: number[];
  footer: string;
  buttonGaps: number[];
  buttonFont: string;
}

/** The spacing of a dialog frame, measured on the page: paddings of its three parts and the gaps between their items. */
const spacingOf = (frame: Locator): Promise<Spacing> =>
  frame.evaluate((el) => {
    const part = (selector: string) => {
      const node = el.querySelector<HTMLElement>(selector);
      if (!node) throw new Error(`no ${selector}`);
      return node;
    };
    const padding = (node: HTMLElement) => getComputedStyle(node).padding;
    const gaps = (items: Element[], vertical: boolean) => {
      const boxes = items.map((item) => item.getBoundingClientRect()).filter((box) => box.width > 0 && box.height > 0);
      return boxes.slice(1).map((box, i) => Math.round(vertical ? box.top - boxes[i]!.bottom : box.left - boxes[i]!.right));
    };
    const header = part('.dialog-header');
    const body = part('.dialog-body');
    const footer = part('.modal-actions');
    const buttons = [...footer.querySelectorAll('button')];
    return {
      header: padding(header),
      body: padding(body),
      bodyGaps: gaps([...body.children], true),
      footer: padding(footer),
      buttonGaps: gaps(buttons, false),
      buttonFont: getComputedStyle(buttons[0]!).fontSize,
    };
  });

/** Text and buttons of the frame closer than `min` px to its border box, or outside it, or cut by an overflow. */
const crossings = (frame: Locator, min = { x: 16, y: 12 }) =>
  frame.evaluate((el, { x, y }) => {
    const outer = el.getBoundingClientRect();
    const found: string[] = [];
    const check = (box: DOMRect, what: string) => {
      if (box.width === 0 || box.height === 0) return;
      const left = box.left - outer.left;
      const right = outer.right - box.right;
      const top = box.top - outer.top;
      const bottom = outer.bottom - box.bottom;
      if (left < x - 0.5 || right < x - 0.5 || top < y - 0.5 || bottom < y - 0.5)
        found.push(`${what}: left ${left.toFixed(1)}, right ${right.toFixed(1)}, top ${top.toFixed(1)}, bottom ${bottom.toFixed(1)}`);
    };
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      if (!text) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const box of range.getClientRects()) check(box, `text "${text.slice(0, 30)}"`);
    }
    for (const button of el.querySelectorAll('button')) check(button.getBoundingClientRect(), `button "${button.textContent?.trim()}"`);
    for (const node of el.querySelectorAll<HTMLElement>('*')) {
      if (node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).overflowX !== 'visible')
        found.push(`${node.className.toString()} cuts its text: ${node.scrollWidth} > ${node.clientWidth}`);
    }
    return found;
  }, min);

/** REQ-11: the Dialog contract spacing. */
function expectContractSpacing(spacing: Spacing, what: string): void {
  expect(spacing.header, `${what} header padding`).toBe('12px 16px');
  expect(spacing.body, `${what} body padding`).toBe('16px');
  for (const gap of spacing.bodyGaps) expect(gap, `${what} gap between body items`).toBe(14);
  expect(spacing.footer, `${what} footer padding`).toBe('12px 16px');
  expect(spacing.buttonGaps, `${what} gaps between footer buttons`).toEqual([8]);
}

async function openWorkingSession(page: Page, request: APIRequestContext, name: string): Promise<void> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  createdIds.push(((await response.json()) as { id: string }).id);
  await page.goto('/');
  await entry(page, folder).getByTitle(folder, { exact: true }).click();
  await expect(terminal(page)).toContainText('READY');
  await page.locator('.xterm-screen').click();
  await page.keyboard.type('WORK');
  await page.keyboard.press('Enter');
  await expect(entry(page, folder)).toContainText('Running');
}

async function openSessionConfirmation(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Terminate', exact: true }).first().click();
  const dialog = sessionConfirmation(page);
  await expect(dialog).toBeVisible();
  await expect(page.locator('.modal-backdrop.is-leaving')).toHaveCount(0);
  await dialog.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
  return dialog;
}

async function openProcessConfirmation(page: Page): Promise<Locator> {
  await page.goto('/');
  await expect(list(page)).toBeVisible();
  await settingsButton(page).click();
  await settingsPopup(page).getByRole('tab', { name: 'Processes', exact: true }).click();
  const own = processRows(page).filter({ hasText: 'This instance' });
  await expect(own).toHaveCount(1);
  await own.getByRole('button', { name: 'Terminate', exact: true }).click();
  const dialog = processConfirmation(page);
  await expect(dialog).toBeVisible();
  await dialog.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
  return dialog;
}

// plan-popup_glass/REQ-11, plan-popup_glass/REQ-12
test('"Terminate the Session?" has the dialog spacing and nothing crosses its border', async ({ page, request }) => {
  await openWorkingSession(page, request, 'working-margins');
  const dialog = await openSessionConfirmation(page);

  expectContractSpacing(await spacingOf(dialog), '"Terminate the Session?"');
  expect(await crossings(dialog)).toEqual([]);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

// plan-popup_glass/REQ-11: the header and footer of the termination popup match those of the Settings dialog
test('"Terminate the Session?" has the header and footer spacing of the Settings dialog', async ({ page, request }) => {
  await openWorkingSession(page, request, 'working-like-settings');
  const confirmation = await spacingOf(await openSessionConfirmation(page));
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);

  await settingsButton(page).click();
  await expect(settingsPopup(page)).toBeVisible();
  const settings = await spacingOf(settingsPopup(page));

  expect(confirmation.header).toBe(settings.header);
  expect(confirmation.footer).toBe(settings.footer);
  expect(confirmation.buttonFont).toBe(settings.buttonFont);
});

// plan-popup_glass/REQ-12: at a narrow window the frame narrows and the text wraps inside it
test('in a narrow window nothing of "Terminate the Session?" crosses its border', async ({ page, request }) => {
  // The session opens at the default size: at 360 px the terminal is too narrow to show its READY line.
  await openWorkingSession(page, request, 'working-narrow');
  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForFunction(() => window.innerWidth === 360 && document.documentElement.clientWidth <= 360);
  const dialog = await openSessionConfirmation(page);

  expect(await crossings(dialog)).toEqual([]);
  expectContractSpacing(await spacingOf(dialog), '"Terminate the Session?" at 360 px');
});

// plan-popup_glass/REQ-13
test('"Terminate the Process?" in Settings has the spacing of the termination popup and nothing crosses its border', async ({
  page,
  request,
}) => {
  await openWorkingSession(page, request, 'working-reference');
  const reference = await spacingOf(await openSessionConfirmation(page));
  await page.keyboard.press('Escape');

  const dialog = await openProcessConfirmation(page);
  const spacing = await spacingOf(dialog);

  expectContractSpacing(spacing, '"Terminate the Process?"');
  expect(spacing.header).toBe(reference.header);
  expect(spacing.body).toBe(reference.body);
  expect(spacing.footer).toBe(reference.footer);
  expect(spacing.buttonFont, 'footer button font').toBe(reference.buttonFont);
  expect(await crossings(dialog)).toEqual([]);
});

// plan-popup_glass/REQ-13, Dialog "Mount": the backdrop of the nested confirmation covers the whole window
test('the backdrop of "Terminate the Process?" covers the whole window', async ({ page }) => {
  const dialog = await openProcessConfirmation(page);
  const box = await dialog.locator('xpath=..').boundingBox();
  const viewport = page.viewportSize();

  expect(box).not.toBeNull();
  expect(Math.round(box!.x)).toBe(0);
  expect(Math.round(box!.y)).toBe(0);
  expect(Math.round(box!.width)).toBe(viewport!.width);
  expect(Math.round(box!.height)).toBe(viewport!.height);
});

// plan-popup_glass/REQ-13: at a narrow window the long text of the process confirmation wraps inside its border
test('in a narrow window nothing of "Terminate the Process?" crosses its border', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const dialog = await openProcessConfirmation(page);

  expect(await crossings(dialog)).toEqual([]);
  expectContractSpacing(await spacingOf(dialog), '"Terminate the Process?" at 360 px');
});

// Dialog "Stacked dialogs": Esc closes only the confirmation, Settings stays open on "Processes"
test('Esc closes "Terminate the Process?" and leaves Settings open', async ({ page }) => {
  await openProcessConfirmation(page);

  await page.keyboard.press('Escape');

  await expect(processConfirmation(page)).toHaveCount(0);
  await expect(settingsPopup(page)).toBeVisible();
  await expect(settingsPopup(page).getByRole('tab', { name: 'Processes', exact: true })).toHaveAttribute('aria-selected', 'true');
});
