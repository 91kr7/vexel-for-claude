// e2e of plan-terminal_addons, batch file-drop. A stub `window.desktopBridge` plays the desktop app and gives each dropped
// file a path by its name. The fake CLI echoes each input chunk as `IN:<hex>` and each line ended by Enter as `LINE:<text>`.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';

const NOTICE = 'Paths can be dropped only in the desktop app.';
/** Path of each dropped file, by file name. An empty path means the file has none. */
const DESKTOP_PATHS: Record<string, string> = {
  'shot.png': '/home/me/shot.png',
  'My Docs': '/home/me/My Docs',
  'made-by-page': '',
};

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-drop-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

const hex = (text: string) => Buffer.from(text, 'utf8').toString('hex');
const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const mainArea = (page: Page) => page.getByRole('main');
const panel = (page: Page) => mainArea(page).getByRole('region', { name: /^Terminal/ });
const terminal = (page: Page) => page.locator('.xterm-rows');
const terminalInput = (page: Page) => page.locator('.xterm-helper-textarea');
const dropTarget = (page: Page) => page.locator('.xterm-screen');
const notice = (page: Page) => panel(page).getByRole('status').filter({ hasText: NOTICE });

async function installDesktopBridge(page: Page): Promise<void> {
  await page.addInitScript((paths) => {
    Object.assign(window, {
      desktopBridge: {
        reportOpenSession: () => {},
        onOpenSession: () => () => {},
        getPathForFile: (file: File) => paths[file.name] ?? '',
      },
    });
  }, DESKTOP_PATHS);
}

/** Opens a new hosted session and waits for the fake CLI. */
async function openSession(page: Page, request: APIRequestContext, name: string): Promise<string> {
  const folder = path.join(await mkdtemp(path.join(projectsRoot, 't-')), name);
  await mkdir(folder);
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  createdIds.push(((await response.json()) as { id: string }).id);
  await page.goto('/');
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
  await expect(terminal(page)).toContainText('READY');
  return folder;
}

async function typeLine(page: Page, line: string): Promise<void> {
  await dropTarget(page).click();
  await page.keyboard.type(line);
  await page.keyboard.press('Enter');
}

type DragData = { files?: string[]; text?: string };

/** Dispatches one drag event on `target`, carrying files made by the page or text. Returns whether its default was prevented. */
const drag = (target: Locator, type: 'dragenter' | 'dragover' | 'dragleave' | 'drop', data: DragData) =>
  target.evaluate(
    (element, { type, files, text }) => {
      const transfer = new DataTransfer();
      for (const name of files ?? []) transfer.items.add(new File(['x'], name));
      if (text !== undefined) transfer.setData('text/plain', text);
      const event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    },
    { type, files: data.files, text: data.text },
  );

/** Everything the terminal shows after READY, rows joined, without the resize echoes. */
const receivedAfterReady = (page: Page) =>
  terminal(page).evaluate((element) => {
    const rows = [...element.children]
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      .map((row) => row.textContent?.trim() ?? '')
      .filter(Boolean);
    return rows
      .slice(rows.indexOf('READY') + 1)
      .filter((row) => !row.startsWith('WINCH:'))
      .join('');
  });

// Scenario "The user drops files on the terminal in the desktop app"
test('REQ-46, REQ-47, REQ-48, REQ-49, REQ-51: in the desktop app a file drag shows the drop state, and the drop pastes the quoted paths with no Enter', async ({ page, request }) => {
  await installDesktopBridge(page);
  const folder = await openSession(page, request, 'drop-desktop');
  await entry(page, folder).focus();

  // REQ-51: the panel accepts the drop while files are dragged over it, and stops when the drag leaves.
  await drag(dropTarget(page), 'dragenter', { files: ['shot.png'] });
  expect(await drag(dropTarget(page), 'dragover', { files: ['shot.png'] })).toBe(true);
  await expect(panel(page)).toHaveClass(/\bdrop-target\b/);
  await drag(panel(page), 'dragleave', { files: ['shot.png'] });
  await expect(panel(page)).not.toHaveClass(/\bdrop-target\b/);

  await drag(dropTarget(page), 'dragover', { files: ['shot.png', 'My Docs', 'made-by-page'] });
  await expect(panel(page)).toHaveClass(/\bdrop-target\b/);
  expect(await drag(dropTarget(page), 'drop', { files: ['shot.png', 'My Docs', 'made-by-page'] })).toBe(true);
  await expect(panel(page)).not.toHaveClass(/\bdrop-target\b/);

  // REQ-46, REQ-48, REQ-49: the paths in drop order, quoted where needed, one space after each; a file with no path is left out.
  const pasted = "/home/me/shot.png '/home/me/My Docs' ";
  await expect(terminal(page)).toContainText(`IN:${hex(pasted)}`);
  await expect(terminalInput(page)).toBeFocused();
  // REQ-47: no Enter, so the CLI got one chunk and no line.
  await page.waitForTimeout(500);
  expect(await receivedAfterReady(page)).toBe(`IN:${hex(pasted)}`);
  await expect(notice(page)).toHaveCount(0);
});

// REQ-50: Claude Code turns bracketed paste mode on, and a native terminal wraps a drop in the paste marks
test('REQ-50: when the CLI turned bracketed paste on, the dropped paths arrive wrapped in the paste marks', async ({ page, request }) => {
  await installDesktopBridge(page);
  await openSession(page, request, 'drop-bracketed');
  await typeLine(page, 'PASTE');
  await expect(terminal(page)).toContainText('PASTE-ON');

  await drag(dropTarget(page), 'drop', { files: ['My Docs'] });

  await expect(terminal(page)).toContainText(`IN:${hex("\x1b[200~'/home/me/My Docs' \x1b[201~")}`);
});

// SessionView: a drag that carries no files changes nothing
test('a drag of text over the terminal in the desktop app shows no drop state', async ({ page, request }) => {
  await installDesktopBridge(page);
  await openSession(page, request, 'drop-text-desktop');

  await drag(dropTarget(page), 'dragover', { text: '/home/me/shot.png' });

  await page.waitForTimeout(200);
  await expect(panel(page)).not.toHaveClass(/\bdrop-target\b/);
});

// SessionView: a drag that carries no files changes nothing
test('a drop of text on the terminal in the browser client shows no message', async ({ page, request }) => {
  await openSession(page, request, 'drop-text-browser');

  await drag(dropTarget(page), 'drop', { text: '/home/me/shot.png' });

  await page.waitForTimeout(300);
  await expect(notice(page)).toHaveCount(0);
});

// Scenario "A drop on an ended session inserts nothing"
test('REQ-52: on an ended session a file drag shows no drop state and the drop inserts nothing', async ({ page, request }) => {
  await installDesktopBridge(page);
  await openSession(page, request, 'drop-ended');
  await typeLine(page, '/exit');
  await expect(mainArea(page).locator('header').getByText('Ended', { exact: true })).toBeVisible();
  await expect(terminal(page)).toContainText('BYE');
  const before = await receivedAfterReady(page);

  await drag(dropTarget(page), 'dragover', { files: ['shot.png'] });
  await page.waitForTimeout(200);
  await expect(panel(page)).not.toHaveClass(/\bdrop-target\b/);
  await drag(dropTarget(page), 'drop', { files: ['shot.png'] });

  await page.waitForTimeout(500);
  expect(await receivedAfterReady(page)).toBe(before);
  await expect(notice(page)).toHaveCount(0);
});

// Scenario "A file dropped elsewhere in the window does not replace the client"
test('REQ-53: in the desktop app a file dragged and dropped on the session list has its default prevented', async ({ page }) => {
  await installDesktopBridge(page);
  await page.goto('/');
  await expect(list(page)).toBeVisible();

  expect(await drag(list(page), 'dragover', { files: ['shot.png'] })).toBe(true);
  expect(await drag(list(page), 'drop', { files: ['shot.png'] })).toBe(true);
  await expect(list(page)).toBeVisible();
});

// useDesktopBridge: no bridge, no drop guard
test('in the browser client the page sets no drop guard outside the terminal', async ({ page }) => {
  await page.goto('/');
  await expect(list(page)).toBeVisible();

  expect(await drag(list(page), 'dragover', { files: ['shot.png'] })).toBe(false);
  expect(await drag(list(page), 'drop', { files: ['shot.png'] })).toBe(false);
});

// Scenario "The browser client explains that it cannot take a drop"
test('REQ-54: in the browser client a drop on the terminal inserts nothing and shows the message for 4 seconds, restarted by a new drop', async ({ page, request }) => {
  await openSession(page, request, 'drop-browser');
  const before = await receivedAfterReady(page);

  // Gatekeeper decision "Browser drag": no drop state; the file drag is still kept from opening the file.
  expect(await drag(dropTarget(page), 'dragover', { files: ['shot.png'] })).toBe(true);
  await page.waitForTimeout(200);
  await expect(panel(page)).not.toHaveClass(/\bdrop-target\b/);

  expect(await drag(dropTarget(page), 'drop', { files: ['shot.png'] })).toBe(true);
  await expect(notice(page)).toBeVisible();
  const firstDrop = Date.now();

  // SessionView: bottom centre of the panel, and it does not take the pointer.
  const box = (await notice(page).boundingBox())!;
  const panelBox = (await panel(page).boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - (panelBox.x + panelBox.width / 2))).toBeLessThan(2);
  expect(box.y + box.height).toBeGreaterThan(panelBox.y + panelBox.height * 0.75);
  expect(box.y + box.height).toBeLessThanOrEqual(panelBox.y + panelBox.height);
  expect(await notice(page).evaluate((element) => getComputedStyle(element).pointerEvents)).toBe('none');

  // A new drop starts the 4 seconds again.
  await page.waitForTimeout(2500);
  await drag(dropTarget(page), 'drop', { files: ['shot.png'] });
  const secondDrop = Date.now();
  await page.waitForTimeout(4000 - (Date.now() - firstDrop) + 1000);
  await expect(notice(page)).toBeVisible();
  await expect(notice(page)).toBeHidden({ timeout: 4000 - (Date.now() - secondDrop) + 1500 });

  expect(await receivedAfterReady(page)).toBe(before);
});
