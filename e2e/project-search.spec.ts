// e2e of plan-project_list_actions, batch project-search. The server runs the fake CLI and reads the fixture Claude Code folder E2E_CLAUDE_DIR.
// The search has no REST API: these tests are the REQ-level tests of the batch.
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

// Texts the tests type: the random root of the project folders must not contain them.
const SEARCHED = ['v', 'ap', 'zzz'];

let projectsRoot: string;
const startedIds: string[] = [];

test.beforeEach(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await mkdir(path.join(E2E_CLAUDE_DIR, 'projects'), { recursive: true });
  for (;;) {
    projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-project-search-'));
    if (!SEARCHED.some((text) => projectsRoot.toLowerCase().includes(text))) break;
    await rm(projectsRoot, { recursive: true, force: true });
  }
});

test.afterEach(async ({ request }) => {
  for (const id of startedIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  await rm(projectsRoot, { recursive: true, force: true });
});

test.afterAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
});

const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const railButton = (page: Page, name: string) => rail(page).getByRole('button', { name, exact: true });
const panel = (page: Page) => page.getByRole('region', { name: 'Session List' });
const searchField = (page: Page) => panel(page).getByRole('textbox', { name: 'Search projects', exact: true });
const clearButton = (page: Page) => panel(page).getByRole('button', { name: 'Clear Search', exact: true });
const rows = (page: Page) => panel(page).locator('.project-row');
const row = (page: Page, folder: string) => rows(page).filter({ has: page.getByTitle(folder, { exact: true }) });
const item = (page: Page, folder: string) => panel(page).locator('li').filter({ has: page.getByTitle(folder, { exact: true }) });
const shownFolders = (page: Page) => rows(page).evaluateAll((els) => els.map((el) => el.querySelector('[title^="/"]')?.getAttribute('title')));
const nameDialog = (page: Page) => page.getByRole('dialog', { name: 'New session' });
const isStartRequest = (r: { url(): string; method(): string }) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/sessions';

/** Writes a session as Claude Code leaves it, and creates its folder. `name` may hold subfolders. */
async function project(name: string, modified?: Date): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder, { recursive: true });
  const id = `${name.replaceAll('/', '-')}-session`;
  const dir = path.join(E2E_CLAUDE_DIR, 'projects', folder.replaceAll('/', '-'));
  await mkdir(dir, { recursive: true });
  const common = { cwd: folder, sessionId: id, isSidechain: false };
  const lines = [
    { ...common, type: 'user', message: { role: 'user', content: `Work in ${name}` } },
    { ...common, type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] } },
  ];
  const file = path.join(dir, `${id}.jsonl`);
  await writeFile(file, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  if (modified) await utimes(file, modified, modified);
  return folder;
}

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

async function openProjects(page: Page): Promise<void> {
  const loaded = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/past-sessions');
  await railButton(page, 'Projects').click();
  await loaded;
}

/** Three projects, one of them in `work/Vexel-Client`, with the list open. */
async function smallList(page: Page) {
  const vexel = await project('work/Vexel-Client', hoursAgo(1));
  const billing = await project('billing', hoursAgo(2));
  const docs = await project('docs', hoursAgo(3));
  await page.goto('/');
  await openProjects(page);
  await expect(rows(page)).toHaveCount(3);
  return { vexel, billing, docs, all: [vexel, billing, docs] };
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

/** Whether the focused element draws the focus ring colour as an outline or a box-shadow. */
async function focusedShowsRing(page: Page): Promise<boolean> {
  const ring = await computedColour(page, 'var(--color-focus-ring)');
  return page.evaluate((ringColour) => {
    const el = document.activeElement;
    if (!el) return false;
    const s = getComputedStyle(el);
    const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor === ringColour;
    return outline || s.boxShadow.includes(ringColour);
  }, ring);
}

/** Counts the list loads and the project requests the page sends from now on. */
function projectRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (r) => {
    const { pathname } = new URL(r.url());
    if (pathname === '/api/past-sessions' || pathname.startsWith('/api/projects')) seen.push(pathname);
  });
  return seen;
}

// plan-project_list_actions/REQ-1, REQ-2, REQ-3, REQ-9, REQ-10, REQ-11 — scenario "the user finds a project by typing part of its path"
test('with 300 projects, Tab to "Search projects" and "vexel" filter the rows at each letter, by the next frame', async ({ page }) => {
  test.setTimeout(90_000);
  const folders = [await project('work/Vexel-Client', hoursAgo(1))];
  for (let i = 0; i < 250; i += 1) folders.push(await project(`service-${i}`));
  for (let i = 0; i < 30; i += 1) folders.push(await project(`river-${i}`));
  for (let i = 0; i < 15; i += 1) folders.push(await project(`vex-${i}`));
  for (let i = 0; i < 4; i += 1) folders.push(await project(`old/VEXEL-${i}`));
  await page.goto('/');
  await openProjects(page);
  await expect(rows(page)).toHaveCount(folders.length);
  const fullList = await shownFolders(page);

  // The bar sits above the rows, in English, empty, with no "Clear Search".
  await expect(searchField(page)).toHaveAttribute('placeholder', 'Search projects');
  await expect(searchField(page)).toHaveValue('');
  await expect(clearButton(page)).toHaveCount(0);
  const fieldBox = (await searchField(page).boundingBox())!;
  const firstRowBox = (await rows(page).first().boundingBox())!;
  expect(fieldBox.y + fieldBox.height).toBeLessThanOrEqual(firstRowBox.y + 0.5);

  // A new opening puts the focus on the first row; the field is right before it in the tab order.
  await railButton(page, 'Sessions').click();
  await openProjects(page);
  await expect(rows(page).first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(searchField(page)).toBeFocused();
  expect(await focusedShowsRing(page), 'focus ring on "Search projects"').toBe(true);

  await page.evaluate(() => {
    const field = document.querySelector('input[aria-label="Search projects"]')!;
    const log: { ms: number; rows: number }[] = [];
    (window as unknown as { searchLog: typeof log }).searchLog = log;
    field.addEventListener('input', () => {
      const start = performance.now();
      requestAnimationFrame(() => log.push({ ms: performance.now() - start, rows: document.querySelectorAll('.project-row').length }));
    });
  });
  const requests = projectRequests(page);
  const expected: number[] = [];
  for (const letter of 'vexel') {
    await page.keyboard.press(letter);
    const typed = await searchField(page).inputValue();
    expected.push(folders.filter((folder) => folder.toLowerCase().includes(typed)).length);
    await expect(rows(page)).toHaveCount(expected.at(-1)!);
  }
  expect(expected, 'each letter narrows the list').toEqual([300, 50, 20, 5, 5]);
  const log = await page.evaluate(() => (window as unknown as { searchLog: { ms: number; rows: number }[] }).searchLog);
  expect(log.map((entry) => entry.rows), 'the rows are updated by the next frame after each letter').toEqual(expected);
  for (const entry of log) expect(entry.ms, 'no visible delay').toBeLessThan(100);
  expect(await shownFolders(page), 'the matches, in the order of the full list').toEqual(fullList.filter((folder) => folder!.toLowerCase().includes('vexel')));
  expect(requests, 'the search sends no request').toEqual([]);
});

// plan-project_list_actions/REQ-4 — scenario "the filtered list keeps the favorites at the top"
test('with "api" favorite, "ap" shows api, app, apex in the order of the full list', async ({ page }) => {
  const web = await project('dev/web', hoursAgo(1));
  const app = await project('dev/app', hoursAgo(2));
  const apex = await project('dev/apex', hoursAgo(3));
  const api = await project('dev/api', hoursAgo(4));
  await page.goto('/');
  await openProjects(page);
  await expect(rows(page)).toHaveCount(4);
  await row(page, api).hover();
  await item(page, api).getByRole('button', { name: 'Mark as Favorite', exact: true }).click();
  await expect.poll(() => shownFolders(page)).toEqual([api, web, app, apex]);

  await searchField(page).click();
  await page.keyboard.type('ap');
  await expect.poll(() => shownFolders(page)).toEqual([api, app, apex]);
  await expect(row(page, api).getByRole('img', { name: 'Favorite', exact: true })).toBeVisible();
});

// plan-project_list_actions/REQ-5 — scenario "no project matches"
test('"zzz" shows the empty state No projects match "zzz" and keeps the search bar', async ({ page }) => {
  await smallList(page);
  await searchField(page).click();
  await page.keyboard.type('zzz');
  await expect(rows(page)).toHaveCount(0);
  await expect(panel(page)).toContainText('No projects match "zzz"');
  await expect(searchField(page)).toBeVisible();
  await expect(searchField(page)).toHaveValue('zzz');
  await expect(clearButton(page)).toBeVisible();
});

// plan-project_list_actions/REQ-6, REQ-9 — scenario "the user clears the search"
test('"Clear Search" empties the field, focuses it and brings back the full list, by mouse and by keyboard', async ({ page }) => {
  const { vexel, all } = await smallList(page);
  await searchField(page).click();
  await page.keyboard.type('vexel');
  await expect.poll(() => shownFolders(page)).toEqual([vexel]);
  await expect(clearButton(page)).toHaveAttribute('title', 'Clear Search');

  await clearButton(page).click();
  await expect(searchField(page)).toHaveValue('');
  await expect(searchField(page)).toBeFocused();
  await expect(clearButton(page)).toHaveCount(0);
  await expect.poll(() => shownFolders(page)).toEqual(all);

  // Keyboard: Tab from the field reaches "Clear Search", with the focus ring; Enter clears.
  await page.keyboard.type('VEXEL');
  await expect.poll(() => shownFolders(page)).toEqual([vexel]);
  await page.keyboard.press('Tab');
  await expect(clearButton(page)).toBeFocused();
  expect(await focusedShowsRing(page), 'focus ring on "Clear Search"').toBe(true);
  await page.keyboard.press('Enter');
  await expect(searchField(page)).toHaveValue('');
  await expect(searchField(page)).toBeFocused();
  await expect.poll(() => shownFolders(page)).toEqual(all);
  // With no "Clear Search", Tab goes from the field to the first row.
  await page.keyboard.press('Tab');
  await expect(row(page, vexel)).toBeFocused();
});

// plan-project_list_actions/REQ-7 — scenario "the search starts empty at each opening"
test('the search is empty after "Sessions" then "Projects", and after a new press of "Projects" in the Projects view', async ({ page }) => {
  const { all } = await smallList(page);
  await searchField(page).click();
  await page.keyboard.type('vexel');
  await expect(rows(page)).toHaveCount(1);

  await railButton(page, 'Sessions').click();
  await expect(searchField(page)).toHaveCount(0);
  await openProjects(page);
  await expect(searchField(page)).toHaveValue('');
  await expect.poll(() => shownFolders(page)).toEqual(all);

  await searchField(page).click();
  await page.keyboard.type('zzz');
  await expect(rows(page)).toHaveCount(0);
  await openProjects(page);
  await expect(searchField(page)).toHaveValue('');
  await expect.poll(() => shownFolders(page)).toEqual(all);
});

// plan-project_list_actions/REQ-8 — scenario "the user starts a session from a filtered list"
test('choosing the project of a filtered list and "Start Session" starts a session in its folder', async ({ page, request }) => {
  const { vexel } = await smallList(page);
  const bodies: unknown[] = [];
  page.on('request', (r) => {
    if (isStartRequest(r)) bodies.push(r.postDataJSON());
  });
  page.on('response', async (r) => {
    if (isStartRequest(r.request()) && r.status() === 201) startedIds.push(((await r.json()) as { id: string }).id);
  });
  await searchField(page).click();
  await page.keyboard.type('vexel');
  await expect.poll(() => shownFolders(page)).toEqual([vexel]);

  await row(page, vexel).click();
  await expect(nameDialog(page)).toBeVisible();
  await nameDialog(page).getByRole('textbox', { name: 'Session name' }).fill('Filtered start');
  await nameDialog(page).getByRole('button', { name: 'Start Session', exact: true }).click();
  await expect(nameDialog(page)).toHaveCount(0);
  expect(bodies).toEqual([{ path: vexel, name: 'Filtered start' }]);
  await expect(page.getByRole('main').locator('.session-header')).toContainText('Filtered start');
  await expect
    .poll(async () => ((await (await request.get('/api/sessions')).json()) as { folder?: string; label: string }[]).filter((s) => s.folder === vexel).map((s) => s.label))
    .toEqual(['Filtered start']);
});
