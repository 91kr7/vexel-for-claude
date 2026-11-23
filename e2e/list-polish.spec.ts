// e2e of plan-dark_blue_theme, batch list-polish: REQ-49 and REQ-52. Expected values come from the REQs and the specs
// ListStyles, SessionList, ProjectList and SessionHeader. REQ-50 and REQ-53 (card line 3) are in session-cards.spec.ts.
// It writes projects into the e2e Claude Code folder, so it runs in the claude-dir group.
/// <reference lib="dom" />
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, type WebSocketRoute, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

// A route handler can still wait on the server when a test ends: its error then must not fail the test.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

type Box = { x: number; y: number; width: number; height: number };

// Headless Chromium hides scrollbars by default; the gap to a shown scrollbar needs them drawn.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

let projectsRoot: string;
const createdIds: string[] = [];
const claudeProjectDirs: string[] = [];

test.beforeEach(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-list-polish-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const dir of claudeProjectDirs.splice(0)) await rm(dir, { recursive: true, force: true });
  await rm(projectsRoot, { recursive: true, force: true });
});

const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const panel = (page: Page) => page.getByRole('region', { name: 'Session List' });
const mainArea = (page: Page) => page.getByRole('main');
const header = (page: Page) => mainArea(page).locator('header').first();
const entry = (page: Page, folder: string) => panel(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const terminal = (page: Page) => page.locator('.xterm-rows');
const CONVERSATION = /\/api\/external-sessions\/[^/]+\/conversation$/;

/** Shows in the page only the sessions of this test, plus the given external entries. */
async function showOnly(page: Page, externals: object[] = []): Promise<() => Promise<WebSocketRoute>> {
  const own = (session: { folder?: unknown } | undefined) => typeof session?.folder === 'string' && session.folder.startsWith(projectsRoot + path.sep);
  await page.route(
    (url) => url.pathname === '/api/sessions',
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      const sessions = (await response.json()) as { folder?: unknown }[];
      await route.fulfill({ response, json: [...sessions.filter(own), ...externals] });
    },
  );
  await page.routeWebSocket(/\/api\/sessions\/events$/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((message) => {
      const frame = JSON.parse(String(message)) as { type?: string; session?: { folder?: unknown } };
      if (frame.type !== 'session' || own(frame.session)) ws.send(message);
    });
  });
  let socket: WebSocketRoute | undefined;
  await page.routeWebSocket(CONVERSATION, (ws) => {
    socket = ws;
  });
  return async () => {
    await expect.poll(() => socket !== undefined, { message: 'conversation socket connected' }).toBe(true);
    return socket!;
  };
}

async function newFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder, { recursive: true });
  return folder;
}

async function startViaApi(request: APIRequestContext, folder: string): Promise<string> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  return id;
}

async function postHook(request: APIRequestContext, id: string, event: Record<string, string>): Promise<void> {
  const response = await request.post(`/api/sessions/${id}/hook-events`, { data: event });
  expect(response.status()).toBe(204);
}

/** Writes a Claude Code session file for a project folder, as the Projects view reads them. */
async function project(name: string): Promise<string> {
  const folder = await newFolder(name);
  const dir = path.join(E2E_CLAUDE_DIR, 'projects', folder.replaceAll('/', '-'));
  await mkdir(dir, { recursive: true });
  claudeProjectDirs.push(dir);
  const common = { cwd: folder, sessionId: `${name}-session`, isSidechain: false };
  const lines = [
    { ...common, type: 'user', message: { role: 'user', content: `Work in ${name}` } },
    { ...common, type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] } },
  ];
  const file = path.join(dir, `${name}-session.jsonl`);
  await writeFile(file, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  const now = new Date();
  await utimes(file, now, now);
  return folder;
}

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
}

/** The element of `scope` that scrolls vertically, with the position of its shown scrollbar. */
async function scrollArea(scope: Locator) {
  const area = await scope.evaluate((root) => {
    const all = [root, ...root.querySelectorAll('*')] as HTMLElement[];
    const el = all.find((n) => n.scrollHeight > n.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(n).overflowY));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const right = r.right - parseFloat(s.borderRightWidth);
    const bar = el.offsetWidth - el.clientWidth - parseFloat(s.borderLeftWidth) - parseFloat(s.borderRightWidth);
    return { scrollbarLeft: right - bar, scrollbarRight: right, scrollbarWidth: bar };
  });
  expect(area, 'the list scrolls').not.toBeNull();
  return area!;
}

const near = (actual: number, expected: number, what: string, tolerance = 1) =>
  expect(Math.abs(actual - expected), `${what}: ${actual} against ${expected}`).toBeLessThanOrEqual(tolerance);

// ---------------------------------------------------------------------------------------------------------------------
test.describe('scrollbar gap', () => {
  // REQ-49, ListStyles `.list-scroll`, SessionList — scenario "the scrollbar does not touch the cards"
  test('in the session list a shown scrollbar sits as far from the cards as the panel edge, and clear of the resize handle', async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 480 });
    await showOnly(page);
    const folders: string[] = [];
    for (let i = 0; i < 12; i++) folders.push(await newFolder(`gap-${String(i).padStart(2, '0')}`));
    for (const folder of folders) await startViaApi(request, folder);
    await page.goto('/');
    const first = entry(page, folders[0]!);
    await expect(first).toBeVisible();

    const bar = await scrollArea(panel(page));
    expect(bar.scrollbarWidth, 'a scrollbar shows').toBeGreaterThan(0);
    const panelBox = await box(panel(page));
    const card = await box(first);
    const leftGap = card.x - panelBox.x;
    expect(leftGap, 'the cards have a left gap').toBeGreaterThan(0);
    near(bar.scrollbarLeft - (card.x + card.width), leftGap, 'gap from the cards to the scrollbar equals the left gap');

    const handle = await box(page.getByRole('separator', { name: 'Resize Session List' }));
    expect(bar.scrollbarRight, 'the scrollbar ends before the resize handle').toBeLessThanOrEqual(handle.x + 0.5);
  });

  // REQ-49: a list with no scrollbar keeps its layout: the cards end 4 px before the title row
  test('with no scrollbar the session cards end 4 px before the right end of the title row', async ({ page, request }) => {
    await showOnly(page);
    const folder = await newFolder('no-scroll');
    await startViaApi(request, folder);
    await page.goto('/');
    const card = await box(entry(page, folder));
    const title = await box(panel(page).locator('.list-panel-title'));
    near(title.x + title.width - (card.x + card.width), 4, 'cards 4 px narrower than the title row');
    near(card.x, title.x, 'cards start where the title row starts');
  });

  // REQ-49, ProjectList — scenario "the scrollbar does not touch the cards", Projects part
  test('in the Projects list a shown scrollbar sits as far from the rows as the panel edge', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 480 });
    for (let i = 0; i < 14; i++) await project(`polish-project-${String(i).padStart(2, '0')}`);
    await page.goto('/');
    const loaded = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/past-sessions');
    await rail(page).getByRole('button', { name: 'Projects', exact: true }).click();
    await loaded;
    const rows = panel(page).locator('.project-row');
    await expect(rows.first()).toBeVisible();

    const bar = await scrollArea(panel(page));
    expect(bar.scrollbarWidth, 'a scrollbar shows').toBeGreaterThan(0);
    const panelBox = await box(panel(page));
    const card = await box(rows.first().locator('xpath=ancestor-or-self::*[contains(concat(" ", @class, " "), " list-card ")][1]'));
    const leftGap = card.x - panelBox.x;
    expect(leftGap).toBeGreaterThan(0);
    near(bar.scrollbarLeft - (card.x + card.width), leftGap, 'gap from the rows to the scrollbar equals the left gap');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('session header', () => {
  const LONG = 'refactor the whole billing module and then migrate every invoice table to the new schema without downtime please';

  /** Left-to-right order and cut state of the header parts. */
  async function headerParts(page: Page, state: string, line: string) {
    const h = header(page);
    const name = h.getByRole('heading', { level: 2 });
    const pill = h.getByText(state, { exact: true });
    const linePill = h.locator('.mono-chip').filter({ hasText: line.slice(0, 20) });
    await expect(pill).toBeVisible();
    await expect(linePill).toBeVisible();
    // Cut when the element, or the child that holds its text, overflows its box.
    const cut = (l: Locator) => l.evaluate((el) => [el, ...el.querySelectorAll('*')].some((n) => n.scrollWidth > n.clientWidth + 1));
    return { name: await box(name), pill: await box(pill), line: await box(linePill), pillCut: await cut(pill), lineCut: await cut(linePill), header: await box(h) };
  }

  // REQ-52, SessionHeader — scenario "the state pill follows the session name in the header"
  test('a working session shows name, "Running", then the line pill cut with "…", and the buttons on the right', async ({ page, request }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await showOnly(page);
    const folder = await newFolder('header-order');
    const id = await startViaApi(request, folder);
    await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt: LONG });
    await page.goto('/');
    await entry(page, folder).getByTitle(folder, { exact: true }).click();
    await expect(terminal(page)).toContainText(`CWD:${folder}`);

    const parts = await headerParts(page, 'Running', LONG);
    expect(parts.name.x, 'name first').toBeLessThan(parts.pill.x);
    expect(parts.name.x + parts.name.width, 'state pill after the name').toBeLessThanOrEqual(parts.pill.x + 0.5);
    expect(parts.pill.x + parts.pill.width, 'line pill after the state pill').toBeLessThanOrEqual(parts.line.x + 0.5);
    expect(parts.pillCut, 'the state pill is never cut').toBe(false);
    expect(parts.lineCut, 'the long line pill is cut').toBe(true);
    expect(
      await header(page)
        .locator('.mono-chip')
        .filter({ hasText: LONG.slice(0, 20) })
        .evaluate((el) => [el, ...el.querySelectorAll('*')].some((n) => getComputedStyle(n).textOverflow === 'ellipsis')),
      'cut with "…"',
    ).toBe(true);

    const terminate = header(page).getByRole('button', { name: 'Terminate', exact: true });
    const actions = await box(terminate);
    expect(actions.x, 'the actions sit right of the line pill').toBeGreaterThan(parts.line.x + parts.line.width);
    near(actions.x + actions.width, parts.header.x + parts.header.width - 16, 'the actions end at the right padding', 2);
    const middle = (b: Box) => b.y + b.height / 2;
    near(middle(parts.pill), middle(parts.name), 'one row', 3);
    near(parts.header.height, 44, '44 px header');
  });

  // REQ-52: an open external session shows its state pill in the same place; "Read-only" stays on the right
  test('an external session shows its state pill right after the name, and "Read-only" on the right', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    const external = { id: 'ext-polish-1', folder: '/srv/external/polish-app', label: LONG, state: 'working', lastActivity: new Date().toISOString(), external: true };
    await showOnly(page, [external]);
    await page.goto('/');
    await entry(page, external.folder).getByTitle(external.folder, { exact: true }).click();
    await expect(header(page).getByRole('heading', { level: 2 })).toHaveText('polish-app');

    const parts = await headerParts(page, 'Running', LONG);
    expect(parts.name.x + parts.name.width).toBeLessThanOrEqual(parts.pill.x + 0.5);
    expect(parts.pill.x + parts.pill.width).toBeLessThanOrEqual(parts.line.x + 0.5);
    expect(parts.pillCut).toBe(false);
    const readOnly = await box(header(page).getByText('Read-only', { exact: true }));
    expect(readOnly.x, '"Read-only" right of the line pill').toBeGreaterThan(parts.line.x + parts.line.width);
  });
});
