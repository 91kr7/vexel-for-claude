// e2e of plan-ui_transitions, batch session-switch: the main area cross-fades from the old view to the new one
// when the open session changes; the terminals keep their state and size, and the last selection wins.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';
import { presses, recordPresses } from './motion';

// A route handler can still wait on the server when a test ends: its error then must not fail the test.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

interface Layer {
  leaving: boolean;
  entering: boolean;
  opacity: number;
  marks: string[];
}
interface Frame {
  t: number;
  layers: Layer[];
}
interface Resize {
  t: number;
  url: string;
  cols: number;
  rows: number;
}
interface Socket {
  url: string;
  openedAt: number;
  closedAt?: number;
}

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
const SLOW_MS = 1500;

let projectsRoot: string;
const createdIds: string[] = [];
const sleepers: ChildProcess[] = [];
const fixtureFiles: string[] = [];

test.beforeAll(async () => {
  await mkdir(SESSIONS_DIR, { recursive: true });
  projectsRoot = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-switch-')));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const sleeper of sleepers.splice(0)) sleeper.kill('SIGKILL');
  for (const file of fixtureFiles.splice(0)) await rm(file, { recursive: true, force: true });
});

test.afterAll(async () => {
  await rm(projectsRoot, { recursive: true, force: true });
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const mainArea = (page: Page) => page.getByRole('main');
const layers = (page: Page) => mainArea(page).locator('.main-view');
const leavingLayer = (page: Page) => mainArea(page).locator('.main-view.is-leaving');
// The footer of a session view shows its folder, even when the terminal has scrolled its first rows away.
const layerOf = (page: Page, folder: string) => layers(page).filter({ hasText: folder });
const emptyTitle = (page: Page) => mainArea(page).getByText('No open session.', { exact: true });

async function newFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  return folder;
}

async function startHosted(request: APIRequestContext, folder: string): Promise<string> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  return id;
}

/** Starts one hosted session per name; gives the folders and their ids. */
async function hostedSessions(request: APIRequestContext, names: string[]): Promise<{ folders: string[]; ids: string[] }> {
  const folders: string[] = [];
  const ids: string[] = [];
  for (const name of names) {
    const folder = await newFolder(name);
    folders.push(folder);
    ids.push(await startHosted(request, folder));
  }
  return { folders, ids };
}

/** Records the terminal connections and every `resize` they send, with their times. */
function recordSockets(page: Page): { sockets: Socket[]; resizes: Resize[] } {
  const sockets: Socket[] = [];
  const resizes: Resize[] = [];
  page.on('websocket', (socket) => {
    if (!socket.url().endsWith('/attach')) return;
    const record: Socket = { url: socket.url(), openedAt: Date.now() };
    sockets.push(record);
    socket.on('close', () => {
      record.closedAt = Date.now();
    });
    socket.on('framesent', (frame) => {
      if (typeof frame.payload !== 'string') return;
      try {
        const message = JSON.parse(frame.payload) as { type?: string; cols?: number; rows?: number };
        if (message.type === 'resize') resizes.push({ t: Date.now(), url: socket.url(), cols: Number(message.cols), rows: Number(message.rows) });
      } catch {
        // not JSON: not a resize
      }
    });
  });
  return { sockets, resizes };
}

const ofSession = <T extends { url: string }>(items: T[], id: string) => items.filter((item) => item.url.includes(`/api/sessions/${encodeURIComponent(id)}/attach`));

async function openHosted(page: Page, folder: string): Promise<void> {
  await entry(page, folder).getByTitle(folder, { exact: true }).click();
  await expect(layerOf(page, folder)).toContainText('READY');
  // The fit at connection and the fade of the open settle before the test starts counting.
  await expect(layers(page)).toHaveCount(1, { timeout: 15_000 });
  await page.waitForTimeout(500);
}

/** Records, at each frame, the main-view layers: their phase, opacity and which marks they show. */
function installLayerWatcher(): void {
  const store = window as unknown as { __frames: Frame[]; __marks: string[] };
  store.__frames = [];
  store.__marks ??= [];
  const tick = () => {
    const found = [...document.querySelectorAll<HTMLElement>('main .main-view')];
    store.__frames.push({
      t: performance.now(),
      layers: found.map((layer) => ({
        leaving: layer.classList.contains('is-leaving'),
        entering: layer.classList.contains('is-entering'),
        opacity: Number(getComputedStyle(layer).opacity),
        marks: store.__marks.filter((mark) => (layer.textContent ?? '').includes(mark)),
      })),
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function watchLayers(page: Page, marks: string[]): Promise<void> {
  await page.evaluate((list) => {
    (window as unknown as { __marks: string[] }).__marks = list;
  }, marks);
  await page.evaluate(installLayerWatcher);
}

const frames = (page: Page) => page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames);

/** Makes the fade long enough to observe and to act during it. */
async function slowMotion(page: Page): Promise<void> {
  await page.evaluate((ms) => {
    document.documentElement.style.setProperty('--motion-duration-enter', `${ms}ms`);
    document.documentElement.style.setProperty('--motion-duration-exit', `${ms}ms`);
  }, SLOW_MS);
}

/** Puts a marker on the terminal element of a layer, to tell later whether the same element is still there. */
const tagTerminal = (page: Page, folder: string, tag: string) =>
  layerOf(page, folder)
    .locator('.xterm')
    .evaluate((element, value) => {
      element.setAttribute('data-test-tag', value);
    }, tag);

/** The text of the first row the terminal of a layer shows: it follows the scroll position. */
const firstVisibleRow = (page: Page, folder: string) => layerOf(page, folder).locator('.xterm-rows > div').first().textContent();

/** The rows the terminal of a layer shows. */
const shownRows = (page: Page, folder: string) => layerOf(page, folder).locator('.xterm-rows > div').count();

/** The fade is a cross-fade: the leaving layer goes from opaque to clear while the entering one goes from clear to opaque. */
function expectCrossFade(all: Frame[], from: string, to: string): void {
  const both = all.filter((frame) => frame.layers.length === 2);
  expect(both.length, 'frames with both views on screen').toBeGreaterThan(5);
  const leaving = both.map((frame) => frame.layers.find((layer) => layer.leaving));
  const entering = both.map((frame) => frame.layers.find((layer) => !layer.leaving));
  expect(leaving.every((layer) => layer?.marks.includes(from) && !layer.marks.includes(to)), 'the leaving layer is the old view').toBe(true);
  // The new view gets its text when its content arrives, so only some frames show it.
  expect(entering.every((layer) => layer !== undefined && !layer.marks.includes(from)), 'the entering layer never shows the old view').toBe(true);
  expect(entering.some((layer) => layer?.marks.includes(to)), 'the entering layer is the new view').toBe(true);
  const out = leaving.map((layer) => layer!.opacity);
  const into = entering.map((layer) => layer!.opacity);
  expect(out[0], 'the old view starts opaque').toBeGreaterThan(0.7);
  expect(out[out.length - 1], 'the old view ends clear').toBeLessThan(0.3);
  expect(into[0], 'the new view starts clear').toBeLessThan(0.3);
  expect(into[into.length - 1], 'the new view ends opaque').toBeGreaterThan(0.7);
  for (let i = 1; i < out.length; i++) expect(out[i], 'the old view only fades out').toBeLessThanOrEqual(out[i - 1]! + 0.01);
  for (let i = 1; i < into.length; i++) expect(into[i], 'the new view only fades in').toBeGreaterThanOrEqual(into[i - 1]! - 0.01);
}

test.describe('cross-fade between hosted sessions', () => {
  // plan-ui_transitions/REQ-10, REQ-12, REQ-13 — scenario "switching session cross-fades the main area"
  test('A fades out while B fades in; neither terminal resizes during the fade and B shows its text at the size of the main area', async ({ page, request }) => {
    const { folders, ids } = await hostedSessions(request, ['fade-a', 'fade-b']);
    const [a, b] = folders as [string, string];
    const [idA, idB] = ids as [string, string];
    const { sockets, resizes } = recordSockets(page);
    await page.goto('/');
    await openHosted(page, a);
    const sizeA = ofSession(resizes, idA).at(-1);
    expect(sizeA, 'A sent its size when it connected').toBeDefined();
    await slowMotion(page);
    await watchLayers(page, [`CWD:${a}`, `CWD:${b}`]);

    const clickedAt = Date.now();
    await entry(page, b).getByTitle(b, { exact: true }).click();
    await expect(layers(page), 'both views share the main area during the fade').toHaveCount(2);
    await expect(layerOf(page, b)).toContainText('READY');
    await expect(layers(page), 'the old view goes when the fade ends').toHaveCount(1, { timeout: SLOW_MS + 1000 });
    await page.waitForTimeout(500);

    expectCrossFade(await frames(page), `CWD:${a}`, `CWD:${b}`);
    await expect(mainArea(page)).toContainText(`CWD:${b}`);
    await expect(mainArea(page), 'no text of A stays').not.toContainText(`CWD:${a}`);

    // REQ-12: one connection per session, and the leaving view keeps its own until the fade ends.
    expect(ofSession(sockets, idA), 'A has one connection').toHaveLength(1);
    expect(ofSession(sockets, idB), 'B has one connection').toHaveLength(1);
    const closedA = ofSession(sockets, idA)[0]!.closedAt;
    expect(closedA, 'A closes its connection when its view goes').toBeDefined();
    expect(closedA! - clickedAt, 'A keeps its connection during the fade').toBeGreaterThanOrEqual(SLOW_MS - 200);

    // REQ-12, REQ-13: no resize from A after the click; B sends the size of the main area once, when it connects.
    expect(ofSession(resizes, idA).filter((resize) => resize.t >= clickedAt), 'A sends no resize during the fade').toEqual([]);
    const fromB = ofSession(resizes, idB);
    expect(fromB, 'B sends one resize, at connection; the fit at the end of the fade changes nothing').toHaveLength(1);
    expect({ cols: fromB[0]!.cols, rows: fromB[0]!.rows }, 'B has the size of the main area, as A had').toEqual({ cols: sizeA!.cols, rows: sizeA!.rows });
    expect(await shownRows(page, b), 'B shows as many rows as it told the pty').toBe(sizeA!.rows);
  });

  // plan-ui_transitions/REQ-11, REQ-28 — scenario "a third selection during the fade wins"
  test('a click on C during the fade from A to B leaves only C, with no fade and no text of A or B', async ({ page, request }) => {
    const { folders } = await hostedSessions(request, ['third-a', 'third-b', 'third-c']);
    const [a, b, c] = folders as [string, string, string];
    await page.goto('/');
    await openHosted(page, a);
    await slowMotion(page);
    await recordPresses(page, 'main .main-view.is-leaving');
    await watchLayers(page, [`CWD:${a}`, `CWD:${b}`, `CWD:${c}`]);

    await entry(page, b).getByTitle(b, { exact: true }).click();
    await expect(leavingLayer(page)).toHaveCount(1);
    await entry(page, c).getByTitle(c, { exact: true }).click();

    await expect(layers(page), 'only one view').toHaveCount(1);
    // On the page clock: the runner's round trips are not part of the app's time.
    const press = (await presses(page)).at(-1);
    expect(press?.during, 'the click on C lands during the fade').toBe(true);
    const after = (await frames(page)).filter((frame) => frame.t >= press!.t);
    const gone = after.find((frame) => frame.layers.length === 1);
    expect(gone, 'one view after the click').toBeDefined();
    expect(gone!.t - press!.t, 'the old views went at once, not at the end of a fade').toBeLessThan(SLOW_MS / 2);
    const rest = after.filter((frame) => frame.t >= gone!.t);
    expect(
      rest.filter((frame) => frame.layers.length !== 1 || frame.layers[0]!.entering || frame.layers[0]!.leaving || frame.layers[0]!.opacity < 1),
      'C shows at once, opaque, with no fade',
    ).toEqual([]);
    await expect(layers(page)).not.toHaveClass(/is-(entering|leaving)/);
    await expect(layers(page), 'C shows at once, opaque').toHaveCSS('opacity', '1');
    await expect(layerOf(page, c)).toContainText('READY');
    await expect(entry(page, c)).toHaveAttribute('aria-current', 'true');
    await page.waitForTimeout(SLOW_MS + 300);
    await expect(layers(page)).toHaveCount(1);
    await expect(mainArea(page)).toContainText(`CWD:${c}`);
    await expect(mainArea(page), 'no text of A').not.toContainText(`CWD:${a}`);
    await expect(mainArea(page), 'no text of B').not.toContainText(`CWD:${b}`);
  });

  // plan-ui_transitions/REQ-12, REQ-28: going back to the leaving session during the fade keeps its view, its connection and its scroll position
  test('a click back on A during the fade keeps the same terminal of A, its connection and its scroll position', async ({ page, request }) => {
    const { folders, ids } = await hostedSessions(request, ['back-a', 'back-b']);
    const [a, b] = folders as [string, string];
    const [idA] = ids as [string, string];
    const { sockets, resizes } = recordSockets(page);
    await page.goto('/');
    await openHosted(page, a);
    await layerOf(page, a).locator('.xterm-screen').click();
    await page.keyboard.type('COUNT');
    await page.keyboard.press('Enter');
    await expect(layerOf(page, a)).toContainText('L00400', { timeout: 20_000 });
    await page.waitForTimeout(500);
    const screen = await layerOf(page, a).locator('.xterm-screen').boundingBox();
    await page.mouse.move(screen!.x + screen!.width / 2, screen!.y + screen!.height / 2);
    await page.waitForTimeout(300);
    const bottomRow = await firstVisibleRow(page, a);
    await page.mouse.wheel(0, -2000);
    await page.waitForTimeout(300);
    const scrolledRow = await firstVisibleRow(page, a);
    expect(scrolledRow, 'A is scrolled up').not.toBe(bottomRow);
    await tagTerminal(page, a, 'kept');
    await slowMotion(page);
    const resizesBefore = ofSession(resizes, idA).length;
    await recordPresses(page, 'main .main-view.is-leaving');

    await entry(page, b).getByTitle(b, { exact: true }).click();
    await expect(layerOf(page, a)).toHaveClass(/is-leaving/);
    await entry(page, a).getByTitle(a, { exact: true }).click();
    expect((await presses(page)).at(-1)?.during, 'the click on A lands during the fade').toBe(true);

    await expect(layers(page), 'only A').toHaveCount(1, { timeout: SLOW_MS + 1000 });
    await page.waitForTimeout(SLOW_MS + 300);
    await expect(layers(page)).toHaveCount(1);
    await expect(layerOf(page, a)).toHaveCount(1);
    await expect(mainArea(page), 'no text of B').not.toContainText(b);
    await expect(layerOf(page, a).locator('.xterm[data-test-tag="kept"]'), 'the same terminal element of A').toHaveCount(1);
    await expect(layerOf(page, a)).not.toHaveAttribute('aria-hidden', 'true');
    expect(ofSession(sockets, idA), 'no new connection of A').toHaveLength(1);
    expect(ofSession(sockets, idA)[0]!.closedAt, 'A kept its connection').toBeUndefined();
    expect(ofSession(resizes, idA).length, 'A sent no resize').toBe(resizesBefore);
    expect(await firstVisibleRow(page, a), 'A keeps its scroll position').toBe(scrolledRow);
  });

  // plan-ui_transitions/REQ-12: after the fade, a session the user goes back to shows its text and the input it received
  test('going back to A after the fade shows its text and the input typed in it', async ({ page, request }) => {
    const { folders } = await hostedSessions(request, ['return-a', 'return-b']);
    const [a, b] = folders as [string, string];
    await page.goto('/');
    await openHosted(page, a);
    await layerOf(page, a).locator('.xterm-screen').click();
    await page.keyboard.type('hello');
    await page.keyboard.press('Enter');
    await expect(layerOf(page, a)).toContainText('LINE:hello');

    await openHosted(page, b);
    await openHosted(page, a);
    await expect(layerOf(page, a)).toContainText('LINE:hello');
    await expect(mainArea(page)).not.toContainText(`CWD:${b}`);
  });

  // plan-ui_transitions/REQ-26 and the app-layout spec: the leaving view takes no input and loses the focus
  test('during the fade the leaving view is hidden from assistive technology, inert, lets the pointer through and holds no focus', async ({ page, request }) => {
    const { folders } = await hostedSessions(request, ['inert-a', 'inert-b']);
    const [a, b] = folders as [string, string];
    await page.goto('/');
    await openHosted(page, a);
    await layerOf(page, a).locator('.xterm-screen').click();
    await expect(layerOf(page, a).locator('.xterm-helper-textarea')).toBeFocused();
    await slowMotion(page);

    await entry(page, b).getByTitle(b, { exact: true }).click();
    const leaving = leavingLayer(page);
    await expect(leaving).toHaveCount(1);
    await expect(leaving).toContainText(`CWD:${a}`);
    await expect(leaving).toHaveAttribute('aria-hidden', 'true');
    expect(await leaving.evaluate((element) => (element as HTMLElement).inert), 'inert').toBe(true);
    expect(await leaving.evaluate((element) => element.contains(document.activeElement)), 'the leaving view holds no focus').toBe(false);
    const passes = await leaving.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return top === null || !element.contains(top);
    });
    expect(passes, 'the leaving view takes no pointer input').toBe(true);
    const sizes = await layers(page).evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect()).map(({ x, y, width, height }) => ({ x, y, width, height })));
    expect(sizes, 'both views').toHaveLength(2);
    expect(sizes[0], 'both views in the same place and at the same size').toEqual(sizes[1]);
  });

  // plan-ui_transitions/REQ-10 and the app-layout spec: a change from the empty state is covered too
  test('opening a session from the empty state cross-fades from the empty state to the session', async ({ page, request }) => {
    const { folders } = await hostedSessions(request, ['empty-a']);
    const [a] = folders as [string];
    await page.goto('/');
    await expect(emptyTitle(page)).toBeVisible();
    await page.waitForTimeout(300);
    await slowMotion(page);
    await watchLayers(page, ['No open session.', `CWD:${a}`]);

    await entry(page, a).getByTitle(a, { exact: true }).click();
    await expect(layerOf(page, a)).toContainText('READY');
    await expect(layers(page)).toHaveCount(1, { timeout: SLOW_MS + 1000 });
    await page.waitForTimeout(300);
    expectCrossFade(await frames(page), 'No open session.', `CWD:${a}`);
    await expect(emptyTitle(page)).toHaveCount(0);
  });

  // plan-ui_transitions/REQ-10 and the app-layout spec: no cross-fade at page load
  test('no view fades when the page loads', async ({ page }) => {
    await page.addInitScript(installLayerWatcher);
    await page.goto('/');
    await expect(emptyTitle(page)).toBeVisible();
    await page.waitForTimeout(500);
    const all = await frames(page);
    expect(all.length).toBeGreaterThan(0);
    expect(all.filter((frame) => frame.layers.some((layer) => layer.entering || layer.leaving || layer.opacity < 1)), 'no fade at load').toEqual([]);
  });

  // plan-ui_transitions/REQ-10 with reduced motion (REQ-25): the new view replaces the old one at once
  test('with reduced motion the new session replaces the old one at once, with no fade', async ({ page, request }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { folders } = await hostedSessions(request, ['reduced-a', 'reduced-b']);
    const [a, b] = folders as [string, string];
    await page.goto('/');
    await openHosted(page, a);
    await watchLayers(page, [`CWD:${a}`, `CWD:${b}`]);

    await entry(page, b).getByTitle(b, { exact: true }).click();
    await expect(layerOf(page, b)).toContainText('READY');
    await page.waitForTimeout(300);
    const all = await frames(page);
    expect(all.filter((frame) => frame.layers.length > 1), 'never two views').toEqual([]);
    expect(all.filter((frame) => frame.layers.some((layer) => layer.leaving)), 'no leaving phase').toEqual([]);
    await expect(mainArea(page)).not.toContainText(`CWD:${a}`);
  });
});

test.describe('typing right after a switch', () => {
  // The page shows only the sessions of this test, so the position shortcuts reach them.
  test.beforeEach(async ({ page }) => {
    const own = (session: { folder?: unknown } | undefined) => typeof session?.folder === 'string' && session.folder.startsWith(projectsRoot + path.sep);
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
  });

  // plan-ui_transitions/REQ-12, REQ-26, REQ-33 — scenario "typing right after a switch reaches the new session"
  test('text typed at once after opening B with its shortcut reaches B, and A does not receive it', async ({ page, request }) => {
    const { folders } = await hostedSessions(request, ['type-a', 'type-b']);
    await page.goto('/');
    for (const folder of folders) await expect(entry(page, folder)).toBeVisible();
    const order = await list(page)
      .locator(`[title^="${projectsRoot}${path.sep}"]`)
      .evaluateAll((elements) => [...new Set(elements.map((el) => el.getAttribute('title') ?? ''))]);
    const [first, second] = order as [string, string];
    await openHosted(page, first);
    await layerOf(page, first).locator('.xterm-screen').click();
    await slowMotion(page);

    await page.keyboard.press('Alt+Digit2');
    await page.keyboard.type('zq');
    await expect(leavingLayer(page), 'the fade is still playing while the user types').toHaveCount(1);

    await expect(layerOf(page, second).locator('.xterm-helper-textarea'), 'the new terminal takes the focus').toBeFocused();
    await page.waitForTimeout(SLOW_MS);
    await expect(layerOf(page, second), 'B received "z" then "q"').toContainText(/IN:7a(71|[\s\S]*IN:71)/, { timeout: 15_000 });
    await expect(layers(page)).toHaveCount(1, { timeout: SLOW_MS + 1000 });

    await openHosted(page, first);
    await expect(layerOf(page, first), 'A did not receive the text').not.toContainText('IN:');
  });
});

const transcriptPath = (folder: string, id: string) => path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'), `${id}.jsonl`);

async function runExternal(sessionId: string, folder: string): Promise<void> {
  const file = transcriptPath(folder, sessionId);
  await mkdir(path.dirname(file), { recursive: true });
  const lines = [
    { type: 'user', cwd: folder, isSidechain: false, message: { role: 'user', content: 'Hello' } },
    { type: 'assistant', cwd: folder, isSidechain: false, message: { role: 'assistant', content: [{ type: 'text', text: 'Hi from outside' }] } },
  ];
  await writeFile(file, lines.map((line) => `${JSON.stringify(line)}\n`).join(''));
  fixtureFiles.push(path.dirname(file));
  const sleeper = spawn('sleep', ['300'], { stdio: 'ignore' });
  sleepers.push(sleeper);
  const pid = sleeper.pid ?? 0;
  const key = path.join(SESSIONS_DIR, `${pid}.5a6b7c8d.key`);
  execFileSync('mkfifo', [key]);
  const record = path.join(SESSIONS_DIR, `${pid}.json`);
  await writeFile(record, JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status: 'idle', updatedAt: Date.now() }));
  fixtureFiles.push(key, record);
}

test.describe('cross-fade to an external session', () => {
  // plan-ui_transitions/REQ-10, REQ-11: a hosted session cross-fades to the conversation of an external one
  test('the terminal of A fades out while the conversation fades in, and only the conversation stays', async ({ page, request }) => {
    const { folders } = await hostedSessions(request, ['ext-a']);
    const [a] = folders as [string];
    const outside = await newFolder('ext-x');
    await runExternal('9a1c2d3e-0000-4000-8000-000000000201', outside);
    await page.goto('/');
    await expect(entry(page, outside)).toBeVisible({ timeout: 20_000 });
    await openHosted(page, a);
    await slowMotion(page);
    await watchLayers(page, [`CWD:${a}`, 'Hi from outside']);

    await entry(page, outside).getByTitle(outside, { exact: true }).click();
    await expect(mainArea(page).locator('.conversation-view')).toContainText('Hi from outside');
    await expect(layers(page)).toHaveCount(1, { timeout: SLOW_MS + 1000 });
    await page.waitForTimeout(300);
    expectCrossFade(await frames(page), `CWD:${a}`, 'Hi from outside');
    await expect(mainArea(page)).not.toContainText(`CWD:${a}`);
  });
});
