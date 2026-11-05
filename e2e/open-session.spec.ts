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

const list = (page: Page) => page.getByRole('region', { name: 'Elenco sessioni' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const mainArea = (page: Page) => page.getByRole('main');
const header = (page: Page) => mainArea(page).locator('.session-header');
const panel = (page: Page) => mainArea(page).getByRole('region', { name: /^Terminale/ });
const terminalBox = (page: Page) => panel(page).locator('.session-terminal');
const hintRow = (page: Page) => mainArea(page).locator('.session-hint-row');
// SessionView: 12 px gap between header, panel and hint row; the hint row is 48 px high.
const GAP = 12;
const HINT_ROW_HEIGHT = 48;
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

/** The box inside the padding: AppLayout gives the main area its own padding. */
async function contentBox(locator: Locator): Promise<Box> {
  const b = await box(locator);
  const pad = await locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(parseFloat);
  });
  const [top, right, bottom, left] = pad as [number, number, number, number];
  return { x: b.x + left, y: b.y + top, width: b.width - left - right, height: b.height - top - bottom };
}

/** The panel and the hint row fill the main area below the header, and the terminal fills the panel inside its padding. */
async function expectPanelAndHintFillMainBelowHeader(page: Page): Promise<void> {
  const main = await contentBox(mainArea(page));
  const head = await box(header(page));
  const term = await box(panel(page));
  const hint = await box(hintRow(page));
  expect(Math.abs(head.y - main.y)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(term.y - (head.y + head.height + GAP))).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(term.x - main.x)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(term.width - main.width)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(hint.y - (term.y + term.height + GAP))).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(hint.height - HINT_ROW_HEIGHT)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(hint.x - main.x)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(hint.width - main.width)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(hint.y + hint.height - (main.y + main.height))).toBeLessThanOrEqual(TOLERANCE);
  const inside = await contentBox(panel(page));
  const xterm = await box(terminalBox(page));
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(xterm[key] - inside[key]), key).toBeLessThanOrEqual(TOLERANCE);
}

/** SessionHeader: the h2 is the folder name and the line is "<label> · <folder>". */
async function expectHeaderOf(page: Page, folder: string, label: string, state: string): Promise<void> {
  await expect(header(page).getByRole('heading', { level: 2 })).toHaveText(path.basename(folder), ONE_SECOND);
  await expect(header(page)).toContainText(state, ONE_SECOND);
  await expect(header(page).getByText(`${label} · ${folder}`, { exact: true })).toBeVisible(ONE_SECOND);
  await expect(header(page).getByRole('button', { name: 'Interrompi' })).toBeVisible(ONE_SECOND);
  await expect(header(page).getByRole('button', { name: 'Termina' })).toBeVisible(ONE_SECOND);
}

// plan-claude_sessions_client-ui_redesign/REQ-17, REQ-18, REQ-24 — scenario "The user works in a hosted session under its header".
// A new session has the folder name as label (SessionStateTracker).
test('with 10 sessions, opening and switching a hosted session shows its header and terminal within one second', async ({ page, request }) => {
  const folders: string[] = [];
  for (let i = 1; i <= 10; i += 1) folders.push(await makeFolder(`progetto-${String(i).padStart(2, '0')}`));
  for (const folder of folders) await startViaApi(request, folder);
  const [first = '', second = ''] = [folders[3], folders[8]];

  await page.goto('/');
  await expect(list(page).getByRole('button').filter({ has: page.locator(`[title^="${projectsRoot}"]`) })).toHaveCount(10);

  await entry(page, first).click();
  await expectHeaderOf(page, first, path.basename(first), 'In attesa');
  await expect(terminal(page)).toContainText(`CWD:${first}`, ONE_SECOND);
  await expectPanelAndHintFillMainBelowHeader(page);

  await entry(page, second).click();
  await expectHeaderOf(page, second, path.basename(second), 'In attesa');
  await expect(terminal(page)).toContainText(`CWD:${second}`, ONE_SECOND);
  await expect(terminal(page)).not.toContainText(`CWD:${first}`);
});

// plan-claude_sessions_client-ui_redesign/REQ-18 (batch hosted-session decision: panel and hint row fill the area)
test('the terminal panel and the hint row fill the main area below the header after the window changes size', async ({ page, request }) => {
  const folder = await makeFolder('ridimensiona');
  await startViaApi(request, folder);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText('READY');
  await expectPanelAndHintFillMainBelowHeader(page);
  const rowsBefore = await terminal(page).locator(':scope > div').count();

  await page.setViewportSize({ width: 1000, height: 600 });
  await expect.poll(async () => terminal(page).locator(':scope > div').count()).toBeLessThan(rowsBefore);
  await expectPanelAndHintFillMainBelowHeader(page);
});

// plan-claude_sessions_client-ui_redesign/REQ-17: long text is cut, the actions stay in the header
test('a long line is cut with an ellipsis and its full text as tooltip, and the actions stay visible', async ({ page, request }) => {
  const folder = await makeFolder(path.join(...Array.from({ length: 6 }, (_, i) => `una-cartella-dal-nome-molto-lungo-${i}`)));
  await startViaApi(request, folder);
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto('/');
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText('READY');

  const folderText = header(page).getByTitle(`${path.basename(folder)} · ${folder}`, { exact: true });
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
