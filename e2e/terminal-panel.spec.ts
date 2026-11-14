// e2e of plan-ui_restyle, batch terminal: the terminal panel margin and its focus ring above the footer.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };

// Rounding of fractional layout sizes.
const TOLERANCE = 1;
const MARGIN = 16;

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-terminal-panel-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

test.use({ viewport: { width: 1440, height: 900 } });

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const mainArea = (page: Page) => page.getByRole('main');
const header = (page: Page) => mainArea(page).locator('header');
const panel = (page: Page) => mainArea(page).getByRole('region', { name: /^Terminal/ });
const footer = (page: Page) => mainArea(page).locator('footer');
const terminal = (page: Page) => page.locator('.xterm-rows');
const terminalInput = (page: Page) => page.locator('.xterm-helper-textarea');

async function startSession(request: APIRequestContext, name: string): Promise<string> {
  const folder = path.join(await mkdtemp(path.join(projectsRoot, 't-')), name);
  await mkdir(folder);
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  createdIds.push(((await response.json()) as { id: string }).id);
  return folder;
}

async function openSession(page: Page, request: APIRequestContext, name: string): Promise<void> {
  const folder = await startSession(request, name);
  await page.goto('/');
  await entry(page, folder).getByTitle(folder, { exact: true }).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
}

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
}

const near = (actual: number, expected: number, what: string) => expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(TOLERANCE);

/** How far the drawn focus ring reaches outside the panel's border box; 0 when no ring is drawn. */
const ringReach = (target: Locator) =>
  target.evaluate((el) => {
    const s = getComputedStyle(el);
    if (s.outlineStyle === 'none' || parseFloat(s.outlineWidth) <= 0) return 0;
    return parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset);
  });

// plan-ui_restyle/REQ-34
test('the terminal panel has a 16 px margin on all four sides', async ({ page, request }) => {
  await openSession(page, request, 'margine');
  const term = panel(page);

  expect(await term.evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.marginTop, s.marginRight, s.marginBottom, s.marginLeft];
  })).toEqual(['16px', '16px', '16px', '16px']);

  const main = await box(mainArea(page));
  const head = await box(header(page));
  const termBox = await box(term);
  const foot = await box(footer(page));
  near(termBox.y - (head.y + head.height), MARGIN, 'space above the panel');
  near(termBox.x - main.x, MARGIN, 'space left of the panel');
  near(main.x + main.width - (termBox.x + termBox.width), MARGIN, 'space right of the panel');
  near(foot.y - (termBox.y + termBox.height), MARGIN, 'space below the panel');
});

// plan-ui_restyle/REQ-34, plan-ui_restyle/REQ-35 — scenario "The terminal focus ring stays clear of the footer"
test('with the terminal focused, the focus ring of the panel does not reach the session footer', async ({ page, request }) => {
  await openSession(page, request, 'anello-footer');
  await page.locator('.xterm-screen').click();
  await expect(terminalInput(page)).toBeFocused();

  const term = panel(page);
  await expect.poll(() => ringReach(term), 'the panel draws its focus ring').toBeGreaterThan(0);
  const reach = await ringReach(term);
  const termBox = await box(term);
  const foot = await box(footer(page));
  const ringBottom = termBox.y + termBox.height + reach;
  expect(ringBottom, `ring bottom ${ringBottom} vs footer top ${foot.y}`).toBeLessThan(foot.y);
  near(foot.y - (termBox.y + termBox.height), MARGIN, 'space below the focused panel');
});
