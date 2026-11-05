// e2e of plan-claude_sessions_client-ui_redesign, batch open-session: the header and the terminal of a hosted session.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };

const ONE_SECOND = { timeout: 1000 };
// Rounding of fractional layout sizes.
const TOLERANCE = 1;

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-open-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

const list = (page: Page) => page.getByRole('navigation', { name: 'Elenco sessioni' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ hasText: folder });
const mainArea = (page: Page) => page.getByRole('main');
const header = (page: Page) => mainArea(page).locator('.session-header');
const terminalBox = (page: Page) => mainArea(page).locator('.session-terminal');
const terminal = (page: Page) => page.locator('.xterm-rows');

async function makeFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder, { recursive: true });
  return folder;
}

async function startViaApi(request: APIRequestContext, folder: string): Promise<void> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  createdIds.push(((await response.json()) as { id: string }).id);
}

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
}

async function expectTerminalFillsMainBelowHeader(page: Page): Promise<void> {
  const main = await box(mainArea(page));
  const head = await box(header(page));
  const term = await box(terminalBox(page));
  expect(Math.abs(head.y - main.y)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(term.y - (head.y + head.height))).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(term.x - main.x)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(term.width - main.width)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(term.y + term.height - (main.y + main.height))).toBeLessThanOrEqual(TOLERANCE);
}

async function expectHeaderOf(page: Page, folder: string, label: string, state: string): Promise<void> {
  await expect(header(page).getByRole('heading', { level: 2 })).toHaveText(label, ONE_SECOND);
  await expect(header(page)).toContainText(state, ONE_SECOND);
  await expect(header(page).getByText(folder, { exact: true })).toBeVisible(ONE_SECOND);
  await expect(header(page).getByRole('button', { name: 'Interrompi' })).toBeVisible(ONE_SECOND);
  await expect(header(page).getByRole('button', { name: 'Termina' })).toBeVisible(ONE_SECOND);
}

// plan-claude_sessions_client-ui_redesign/REQ-17, REQ-18, REQ-24 — scenario "The user works in a hosted session under its header"
test('with 10 sessions, opening and switching a hosted session shows its header and terminal within one second', async ({ page, request }) => {
  const folders: string[] = [];
  for (let i = 1; i <= 10; i += 1) folders.push(await makeFolder(`progetto-${String(i).padStart(2, '0')}`));
  for (const folder of folders) await startViaApi(request, folder);
  const [first = '', second = ''] = [folders[3], folders[8]];

  await page.goto('/');
  await expect(list(page).getByRole('button').filter({ hasText: projectsRoot })).toHaveCount(10);

  await entry(page, first).click();
  await expectHeaderOf(page, first, path.basename(first), 'In attesa');
  await expect(terminal(page)).toContainText(`CWD:${first}`, ONE_SECOND);
  await expectTerminalFillsMainBelowHeader(page);

  await entry(page, second).click();
  await expectHeaderOf(page, second, path.basename(second), 'In attesa');
  await expect(terminal(page)).toContainText(`CWD:${second}`, ONE_SECOND);
  await expect(terminal(page)).not.toContainText(`CWD:${first}`);
});

// plan-claude_sessions_client-ui_redesign/REQ-18: the terminal keeps filling the area when the window changes size
test('the terminal fills the main area below the header after the window changes size', async ({ page, request }) => {
  const folder = await makeFolder('ridimensiona');
  await startViaApi(request, folder);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText('READY');
  await expectTerminalFillsMainBelowHeader(page);
  const rowsBefore = await terminal(page).locator(':scope > div').count();

  await page.setViewportSize({ width: 1000, height: 600 });
  await expect.poll(async () => terminal(page).locator(':scope > div').count()).toBeLessThan(rowsBefore);
  await expectTerminalFillsMainBelowHeader(page);
});

// plan-claude_sessions_client-ui_redesign/REQ-17: long text is cut, the actions stay in the bar
test('a long folder is cut with an ellipsis and its full text as tooltip, and the actions stay visible', async ({ page, request }) => {
  const folder = await makeFolder(path.join(...Array.from({ length: 6 }, (_, i) => `una-cartella-dal-nome-molto-lungo-${i}`)));
  await startViaApi(request, folder);
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto('/');
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText('READY');

  const folderText = header(page).getByTitle(folder, { exact: true });
  await expect(folderText).toBeVisible();
  await expect(folderText).toHaveCSS('text-overflow', 'ellipsis');
  expect(await folderText.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const head = await box(header(page));
  for (const name of ['Interrompi', 'Termina']) {
    const action = await box(header(page).getByRole('button', { name }));
    expect(action.x).toBeGreaterThanOrEqual(head.x);
    expect(action.x + action.width).toBeLessThanOrEqual(head.x + head.width + TOLERANCE);
  }
});
