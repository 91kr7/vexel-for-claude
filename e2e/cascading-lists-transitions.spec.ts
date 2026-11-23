// e2e of plan-ui_transitions, batch cascading-lists: the session and project lists enter in cascade when they first show;
// new sessions slide in, removed ones fade out, and refresh or search play nothing.
// The cascade tests answer /api/sessions and /api/past-sessions with fixed lists; the slide and fade test runs real hosted sessions.
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

// A route handler can still wait on the server when a test ends: its error then must not fail the test.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

interface ItemFrame {
  key: string;
  cascade: boolean;
  delay: number;
  entering: boolean;
  leaving: boolean;
  opacity: number;
}
interface Frame {
  t: number;
  items: ItemFrame[];
}

const CASCADE_MAX_MS = 600;
// Slack for the frame clock of a headless browser.
const FRAME_SLACK_MS = 120;
const LONG_LIST = 15;

let testRoot: string;
const createdIds: string[] = [];

test.beforeEach(async () => {
  testRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-cascade-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  await rm(testRoot, { recursive: true, force: true });
});

const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const railButton = (page: Page, name: string) => rail(page).getByRole('button', { name, exact: true });
const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const item = (page: Page, folder: string) => list(page).locator('li').filter({ has: page.getByTitle(folder, { exact: true }) });
const searchField = (page: Page) => list(page).getByRole('textbox', { name: 'Search projects', exact: true });
const projectRows = (page: Page) => list(page).locator('.project-row');

/** Records, at each frame, the items of the session list or of the project list: motion classes, delay and opacity. */
function installItemWatcher(): void {
  const store = window as unknown as { __frames: Frame[] };
  store.__frames = [];
  const keyOf = (li: Element) =>
    li.querySelector('.project-row-path')?.textContent ?? li.querySelector('[title^="/"]')?.getAttribute('title') ?? '';
  const tick = () => {
    const found = [...document.querySelectorAll<HTMLElement>('.session-list li, li:has(> .project-row)')];
    if (found.length > 0) {
      store.__frames.push({
        t: performance.now(),
        items: found.map((li) => ({
          key: keyOf(li),
          cascade: li.classList.contains('cascade-item'),
          delay: Number.parseFloat(li.style.getPropertyValue('--cascade-delay')),
          entering: li.classList.contains('is-entering'),
          leaving: li.classList.contains('is-leaving'),
          opacity: Number(getComputedStyle(li).opacity),
        })),
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const frames = (page: Page) => page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames);
const resetFrames = (page: Page) => page.evaluate(() => ((window as unknown as { __frames: Frame[] }).__frames = []));
const enterMs = (page: Page) => page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--motion-duration-enter')));

const fakeFolder = (index: number) => `/home/dev/cascade-${String(index).padStart(2, '0')}`;
const fakeSessions = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `cascade-${index}`,
    folder: fakeFolder(index),
    label: `Cascade ${index}`,
    state: 'idle',
    lastActivity: new Date(Date.now() - index * 60_000).toISOString(),
  }));

/** The page sees only the given sessions, and no live update. */
async function fixedSessions(page: Page, count: number): Promise<void> {
  await page.route(
    (url) => url.pathname === '/api/sessions',
    (route) => (route.request().method() === 'GET' ? route.fulfill({ json: fakeSessions(count) }) : route.fallback()),
  );
  await page.routeWebSocket(/\/api\/sessions\/events$/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((message) => {
      const frame = JSON.parse(String(message)) as { type?: string };
      if (frame.type !== 'session' && frame.type !== 'session-removed') ws.send(message);
    });
  });
}

/** The page sees only the sessions started in the folder of the current test. */
async function ownSessions(page: Page): Promise<void> {
  const own = (session: { folder?: unknown } | undefined) => typeof session?.folder === 'string' && session.folder.startsWith(testRoot + path.sep);
  await page.route(
    (url) => url.pathname === '/api/sessions',
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      const sessions = (await response.json()) as { folder?: unknown }[];
      await route.fulfill({ response, json: sessions.filter(own) });
    },
  );
  await page.routeWebSocket(/\/api\/sessions\/events$/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((message) => {
      const frame = JSON.parse(String(message)) as { type?: string; session?: { folder?: unknown } };
      if (frame.type !== 'session' || own(frame.session)) ws.send(message);
    });
  });
}

async function fixedProjects(page: Page, names: string[]): Promise<string[]> {
  const folders = names.map((name) => `/home/dev/projects/${name}`);
  await page.route(
    (url) => url.pathname === '/api/past-sessions',
    (route) =>
      route.fulfill({
        json: folders.map((folder, index) => ({
          folder,
          available: true,
          sessions: [{ id: `past-${index}`, label: 'Label', lastActivity: new Date(Date.now() - index * 3_600_000).toISOString(), runningElsewhere: false }],
        })),
      }),
  );
  return folders;
}

async function startHosted(request: APIRequestContext, name: string): Promise<{ id: string; folder: string }> {
  const folder = path.join(testRoot, name);
  await mkdir(folder);
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  return { id, folder };
}

async function stateOf(request: APIRequestContext, id: string): Promise<string | undefined> {
  const sessions = (await (await request.get('/api/sessions')).json()) as { id: string; state: string }[];
  return sessions.find((s) => s.id === id)?.state;
}

/** Checks a cascade recorded from its first frame: every item in it, growing delays, done within the cascade limit. */
async function expectCascade(page: Page, recorded: Frame[], count: number): Promise<void> {
  const first = recorded.find((frame) => frame.items.length >= count);
  expect(first, 'the list shows').toBeDefined();
  expect(
    first!.items.filter((entry) => entry.cascade).map((entry) => entry.key),
    'every item of the first appearance enters in cascade',
  ).toEqual(first!.items.map((entry) => entry.key));
  const delays = first!.items.map((entry) => entry.delay);
  expect(delays[0]).toBe(0);
  for (let index = 1; index < delays.length; index++) expect(delays[index]!, `delay of item ${index}`).toBeGreaterThan(delays[index - 1]!);
  const enter = await enterMs(page);
  expect(delays.at(-1)! + enter, 'the last item ends within the cascade limit').toBeLessThanOrEqual(CASCADE_MAX_MS);
  expect(first!.items.at(-1)!.opacity, 'the last item is not on screen yet at the start').toBeLessThan(1);
  const settled = recorded.find((frame) => frame.t > first!.t && frame.items.every((entry) => entry.opacity === 1));
  expect(settled, 'every item reaches full opacity').toBeDefined();
  expect(settled!.t - first!.t, 'the whole cascade ends within the limit').toBeLessThanOrEqual(CASCADE_MAX_MS + FRAME_SLACK_MS);
}

// plan-ui_transitions/REQ-16, REQ-22 — scenario "the session list enters in cascade"
test('the session list enters in cascade at app start and the last entry is on screen within the cascade limit', async ({ page }) => {
  await fixedSessions(page, LONG_LIST);
  await page.addInitScript(installItemWatcher);
  await page.goto('/');
  await expect(list(page).locator('li')).toHaveCount(LONG_LIST);
  await page.waitForTimeout(CASCADE_MAX_MS * 2);
  await expectCascade(page, await frames(page), LONG_LIST);
  await expect(list(page).locator('.cascade-item')).toHaveCount(0);
});

// plan-ui_transitions/REQ-16: the list enters again each time the Sessions view shows
test('the session list enters in cascade again when the Sessions view shows', async ({ page }) => {
  await fixedSessions(page, 6);
  await page.addInitScript(installItemWatcher);
  await page.goto('/');
  await expect(list(page).locator('li')).toHaveCount(6);
  await page.waitForTimeout(CASCADE_MAX_MS * 2);
  await railButton(page, 'Projects').click();
  await expect(list(page).locator('.session-list')).toHaveCount(0);
  await resetFrames(page);
  await railButton(page, 'Sessions').click();
  await expect(list(page).locator('.session-list li')).toHaveCount(6);
  await page.waitForTimeout(CASCADE_MAX_MS * 2);
  await expectCascade(page, await frames(page), 6);
});

// plan-ui_transitions/REQ-26: the entries take clicks during the cascade
test('an entry opens its session when clicked during the cascade', async ({ page }) => {
  await fixedSessions(page, LONG_LIST);
  await page.goto('/');
  await expect(list(page).locator('li')).toHaveCount(LONG_LIST);
  // The Sessions view shown again plays the cascade.
  await railButton(page, 'Projects').click();
  await railButton(page, 'Sessions').click();
  const last = item(page, fakeFolder(LONG_LIST - 1));
  await expect(last).toHaveClass(/\bcascade-item\b/);
  await last.locator('.session-entry').click({ force: true });
  await expect(last.locator('.session-entry')).toHaveAttribute('aria-current', 'true');
});

// plan-ui_transitions/REQ-26, REQ-28, REQ-30: a drag started during the cascade shows its feedback at once
test('an entry dragged during the cascade is dimmed at once', async ({ page }) => {
  // A long cascade leaves time to drag before it ends.
  await page.addInitScript(() => {
    document.documentElement.style.setProperty('--motion-duration-enter', '1500ms');
    document.documentElement.style.setProperty('--motion-cascade-max', '3000ms');
  });
  await fixedSessions(page, 4);
  await page.goto('/');
  const dragged = item(page, fakeFolder(2));
  await expect(dragged).toHaveClass(/\bcascade-item\b/);
  const box = (await dragged.locator('.session-entry').boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 24, box.y + box.height / 2 + 4, { steps: 2 });
  await expect(dragged).toHaveClass(/\bdragging\b/);
  await expect(dragged).toHaveClass(/\bcascade-item\b/);
  expect(await dragged.evaluate((li) => getComputedStyle(li).opacity), 'the dragged entry is dimmed to 40 %').toBe('0.4');
  await page.mouse.up();
});

// plan-ui_transitions/REQ-25: reduced motion → no cascade
test('the session list shows at once with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fixedSessions(page, 6);
  await page.addInitScript(installItemWatcher);
  await page.goto('/');
  await expect(list(page).locator('li')).toHaveCount(6);
  const recorded = await frames(page);
  expect(recorded.flatMap((frame) => frame.items).some((entry) => entry.cascade || entry.opacity < 1)).toBe(false);
});

// plan-ui_transitions/REQ-18, REQ-19, REQ-20, REQ-26 — scenario "new sessions slide in and removed ones fade out"
test('a new session slides in, a dismissed one fades out with no click, and the others play nothing', async ({ page, request }) => {
  await ownSessions(page);
  const kept = await startHosted(request, 'kept');
  const ended = await startHosted(request, 'ended');
  expect((await request.post(`/api/sessions/${ended.id}/stop`)).ok()).toBe(true);
  await expect.poll(() => stateOf(request, ended.id)).toBe('ended');

  await page.addInitScript(installItemWatcher);
  await page.goto('/');
  await expect(item(page, kept.folder)).toHaveCount(1);
  await expect(item(page, ended.folder)).toHaveCount(1);
  await expect(list(page).locator('.cascade-item')).toHaveCount(0, { timeout: CASCADE_MAX_MS * 3 });

  // REQ-18: the new entry slides in; the other entries do not play the cascade again (REQ-20)
  await resetFrames(page);
  const added = await startHosted(request, 'added');
  await expect(item(page, added.folder)).toHaveCount(1);
  await page.waitForTimeout(CASCADE_MAX_MS);
  let recorded = (await frames(page)).flatMap((frame) => frame.items);
  const addedFrames = recorded.filter((entry) => entry.key === added.folder);
  expect(addedFrames.some((entry) => entry.entering), 'the new entry gets is-entering').toBe(true);
  expect(addedFrames.some((entry) => entry.opacity < 1), 'the new entry fades in').toBe(true);
  expect(recorded.some((entry) => entry.cascade), 'no cascade after the appearance').toBe(false);
  expect(recorded.filter((entry) => entry.key !== added.folder).some((entry) => entry.entering || entry.leaving)).toBe(false);
  await expect(item(page, added.folder)).not.toHaveClass(/\bis-entering\b/);

  // REQ-19: "Dismiss" fades the entry out; a longer exit leaves time to check it takes no click (REQ-26)
  await page.evaluate(() => document.documentElement.style.setProperty('--motion-duration-exit', '1500ms'));
  await resetFrames(page);
  const leaving = item(page, ended.folder);
  const box = (await leaving.locator('.session-entry').boundingBox())!;
  await leaving.hover();
  await leaving.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(leaving).toHaveClass(/\bis-leaving\b/);
  await expect(leaving).toHaveAttribute('aria-hidden', 'true');
  const hit = await page.evaluate(
    ({ x, y, folder }) => {
      const target = [...document.querySelectorAll('.session-list li')].find((li) => li.querySelector(`[title="${folder}"]`) !== null);
      const under = document.elementFromPoint(x, y);
      return target !== undefined && under !== null && target.contains(under);
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2, folder: ended.folder },
  );
  expect(hit, 'the leaving entry takes no pointer').toBe(false);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(leaving.locator('.session-entry')).not.toHaveAttribute('aria-current', 'true');
  await expect(leaving).toHaveCount(0, { timeout: 15_000 });
  recorded = (await frames(page)).flatMap((frame) => frame.items);
  const leavingOpacities = recorded.filter((entry) => entry.key === ended.folder && entry.leaving).map((entry) => entry.opacity);
  expect(Math.min(...leavingOpacities), 'the dismissed entry fades').toBeLessThan(1);
  expect(recorded.filter((entry) => entry.key !== ended.folder).some((entry) => entry.cascade || entry.entering || entry.leaving)).toBe(false);
  await expect(item(page, kept.folder)).toHaveCount(1);
});

// plan-ui_transitions/REQ-17, REQ-22 — scenario "the project list enters in cascade, but search does not replay it"
test('the project list enters in cascade each time the Projects view shows', async ({ page }) => {
  const folders = await fixedProjects(page, ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']);
  await page.addInitScript(installItemWatcher);
  await page.goto('/');
  await page.waitForTimeout(CASCADE_MAX_MS * 2);
  await resetFrames(page);
  await railButton(page, 'Projects').click();
  await expect(projectRows(page)).toHaveCount(folders.length);
  await page.waitForTimeout(CASCADE_MAX_MS * 2);
  await expectCascade(page, (await frames(page)).map((frame) => ({ ...frame, items: frame.items.filter((entry) => entry.key.startsWith('/home/dev/projects/')) })), folders.length);

  await railButton(page, 'Sessions').click();
  await expect(projectRows(page)).toHaveCount(0);
  await railButton(page, 'Projects').click();
  await expect(list(page).locator('li').filter({ has: page.locator('.project-row') }).first()).toHaveClass(/\bcascade-item\b/);
});

// plan-ui_transitions/REQ-21, REQ-26 — scenario "the project list enters in cascade, but search does not replay it"
test('typing in the search filters the project rows at once, ends the cascade and never replays it', async ({ page }) => {
  await fixedProjects(page, ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']);
  await page.addInitScript(installItemWatcher);
  await page.goto('/');
  await railButton(page, 'Projects').click();
  await expect(projectRows(page)).toHaveCount(6);
  await resetFrames(page);
  // typed while the cascade still plays
  await searchField(page).pressSequentially('ha', { delay: 0 });
  await expect(projectRows(page)).toHaveCount(2);
  await expect(list(page).locator('.cascade-item')).toHaveCount(0);
  await page.waitForTimeout(CASCADE_MAX_MS);
  await resetFrames(page);
  await searchField(page).fill('');
  await expect(projectRows(page)).toHaveCount(6);
  await searchField(page).fill('e');
  await page.getByRole('button', { name: 'Clear Search', exact: true }).click();
  await expect(projectRows(page)).toHaveCount(6);
  await page.waitForTimeout(CASCADE_MAX_MS);
  const recorded = (await frames(page)).flatMap((frame) => frame.items);
  expect(recorded.some((entry) => entry.cascade), 'no cascade after a search change').toBe(false);
  expect(recorded.some((entry) => entry.opacity < 1), 'the rows update at once').toBe(false);
});
