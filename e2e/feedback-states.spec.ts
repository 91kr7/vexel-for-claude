// e2e of plan-claude_sessions_client-ui_redesign, batch feedback-states.
/// <reference lib="dom" />
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, type Route, type WebSocketRoute, expect, test } from '@playwright/test';

type Rgba = [number, number, number, number];

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-feedback-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

test.afterAll(async () => {
  await rm(projectsRoot, { recursive: true, force: true });
});

const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const mainArea = (page: Page) => page.getByRole('main');
const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, text: string) => list(page).getByRole('button').filter({ has: page.getByTitle(text, { exact: true }) });
const header = (page: Page) => mainArea(page).locator('.session-header');
const terminal = (page: Page) => page.locator('.xterm-rows');
const button = (scope: Locator, name: string) => scope.getByRole('button', { name, exact: true });
const loading = (scope: Locator) => scope.getByRole('status').filter({ hasText: 'Loading…' });
const chooser = (page: Page) => page.getByRole('dialog', { name: 'New Claude Code Session' });
const pathField = (page: Page) => page.getByRole('textbox', { name: 'Working Directory Path', exact: true });
const history = (page: Page) => page.getByRole('dialog', { name: 'Resume Session' });
const warning = (page: Page) => page.getByRole('alertdialog', { name: 'Session Running in a Terminal' });

const LOST_SERVER = 'Connection to the server lost. Reload the page.';
const ATTACH = /\/api\/sessions\/[^/]+\/attach$/;
const EVENTS = /\/api\/sessions\/events$/;
const CONVERSATION = /\/api\/external-sessions\/[^/]+\/conversation$/;

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

async function openSession(page: Page, request: APIRequestContext, name: string): Promise<{ id: string; folder: string }> {
  const folder = await newFolder(name);
  const id = await startViaApi(request, folder);
  await page.goto('/');
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText('READY');
  return { id, folder };
}

/** Holds the matching requests until `release` runs, then lets them go to the server or answers with `answer`. */
async function hold(page: Page, url: string | RegExp, method: string): Promise<{ seen: () => number; release: (answer?: (route: Route) => Promise<void>) => void }> {
  let seen = 0;
  let release: (answer?: (route: Route) => Promise<void>) => void = () => {};
  const released = new Promise<((route: Route) => Promise<void>) | undefined>((resolve) => (release = resolve));
  await page.route(url, async (route) => {
    if (route.request().method() !== method) return route.fallback();
    seen += 1;
    const answer = await released;
    await (answer ? answer(route) : route.continue());
  });
  return { seen: () => seen, release: (answer) => release(answer) };
}

const fail = (status: number, error = 'internal') => (route: Route) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error }) });

const isBusy = async (target: Locator) => {
  await expect(target).toBeDisabled();
  await expect(target).toHaveAttribute('aria-busy', 'true');
};

const isNotBusy = async (target: Locator) => {
  await expect(target).toBeEnabled();
  await expect(target).not.toHaveAttribute('aria-busy', 'true');
};

/** Resolves any CSS colour to opaque sRGB over white, through a canvas. */
function resolved(page: Page, css: string): Promise<Rgba> {
  return page.evaluate((colour) => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    ctx.canvas.width = ctx.canvas.height = 1;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data] as Rgba;
  }, css);
}

const token = (page: Page, name: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Text colour of the element and the first non-transparent background from it up to the root. */
function colours(target: Locator): Promise<{ text: string; icon: string; background: string }> {
  return target.evaluate((el) => {
    let background = 'rgb(255, 255, 255)';
    for (let node: Element | null = el; node; node = node.parentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
        background = bg;
        break;
      }
    }
    const svg = el.querySelector('svg');
    return { text: getComputedStyle(el).color, icon: svg ? getComputedStyle(svg).color : '', background };
  });
}

/** Icon in `iconToken`, text in `textToken` when given, and the text at AA contrast on its background. */
async function expectLook(page: Page, target: Locator, iconToken: string, textToken?: string): Promise<void> {
  const look = await colours(target);
  expect(await resolved(page, look.icon), `icon in ${iconToken}`).toEqual(await resolved(page, await token(page, iconToken)));
  if (textToken) expect(await resolved(page, look.text), `text in ${textToken}`).toEqual(await resolved(page, await token(page, textToken)));
  const ratio = contrast(await resolved(page, look.text), await resolved(page, look.background));
  expect(ratio, `contrast of the text on ${look.background}`).toBeGreaterThanOrEqual(4.5);
}

/** The animations of every element inside the target: name and duration. */
const animations = (target: Locator) =>
  target.evaluate((el) =>
    [el, ...el.querySelectorAll('*')].map((node) => {
      const style = getComputedStyle(node);
      return { name: style.animationName, duration: parseFloat(style.animationDuration), state: style.animationPlayState };
    }),
  );

/** Colours of the focus marks (visible outline or box-shadow) on the focused element and its ancestors, up to the body. */
const focusMarkColours = (page: Page) =>
  page.evaluate(() => {
    const found: string[] = [];
    for (let node: Element | null = document.activeElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) found.push(style.outlineColor);
      found.push(...(style.boxShadow.match(/(?:rgba?|oklch|oklab|color)\([^)]*\)/g) ?? []));
    }
    return found;
  });

async function hasFocusRing(page: Page): Promise<boolean> {
  const ring = await resolved(page, await token(page, '--color-focus-ring'));
  for (const colour of await focusMarkColours(page)) {
    if ((await resolved(page, colour)).every((c, i) => c === ring[i])) return true;
  }
  return false;
}

async function expectFocusMarked(page: Page, what: string): Promise<void> {
  await expect.poll(() => hasFocusRing(page), { message: `${what} shows the focus ring` }).toBe(true);
}

/** The path field marks the focus with the accent border (plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-46). */
async function expectFieldOutlined(page: Page): Promise<void> {
  const accent = await resolved(page, await token(page, '--accent-border'));
  await expect
    .poll(async () => resolved(page, await pathField(page).evaluate((el) => getComputedStyle(el).borderTopColor)), {
      message: 'the focused path field has the accent border',
    })
    .toEqual(accent);
}

async function pressUntilFocused(page: Page, target: Locator, key: 'Tab' | 'Shift+Tab' = 'Tab'): Promise<void> {
  for (let i = 0; i < 300; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press(key);
  }
  expect(await target.evaluate((el) => el === document.activeElement), `reached with ${key}`).toBe(true);
}

const terminalHasFocus = (page: Page) => page.evaluate(() => document.activeElement?.classList.contains('xterm-helper-textarea') ?? false);

async function openChooser(page: Page): Promise<void> {
  await button(rail(page), 'New Claude Code Session').click();
  await expect(chooser(page)).toBeVisible();
  await expect(pathField(page)).toHaveValue(os.homedir());
}

async function listFolder(page: Page, folder: string): Promise<void> {
  await pathField(page).fill(folder);
  await pathField(page).press('Enter');
  await expect(pathField(page)).toHaveValue(folder);
  await expect(loading(chooser(page))).toHaveCount(0);
}

const pastSessions = [
  { folder: '/tmp/feedback-past', sessions: [{ id: 'feedback-past-1', label: 'Prima sessione passata', lastActivity: '2026-11-04T09:00:00.000Z', runningElsewhere: false }] },
];

const externalEntry = {
  id: 'feedback-external-1',
  folder: '/tmp/feedback-external',
  label: 'Sessione esterna di prova',
  state: 'idle',
  lastActivity: new Date().toISOString(),
  external: true,
};

/** Adds one external entry to the session list the page loads, and routes its conversation socket to `onConversation`. */
async function withExternalEntry(page: Page, onConversation: (ws: WebSocketRoute) => void): Promise<void> {
  await page.route('**/api/sessions', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const sessions = (await response.json()) as object[];
    await route.fulfill({ response, json: [...sessions, externalEntry] });
  });
  await page.routeWebSocket(CONVERSATION, onConversation);
}

test.describe('session list', () => {
  // plan-claude_sessions_client-ui_redesign/REQ-29, SessionList: "Loading…" in place of "No sessions." until the list arrives
  test('while the list loads it shows "Loading…", not "No sessions.", until the list arrives', async ({ page, request }) => {
    const folder = await newFolder('slow-list');
    await startViaApi(request, folder);
    const held = await hold(page, '**/api/sessions', 'GET');

    await page.goto('/');

    await expect(loading(list(page))).toBeVisible();
    await expect(list(page)).not.toContainText('No sessions.');
    await expect(list(page).getByRole('button')).toHaveCount(0);

    held.release();

    await expect(entry(page, folder)).toBeVisible();
    await expect(loading(list(page))).toHaveCount(0);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-30, SessionList: the events connection closes
  test('when the connection to the server is lost the list shows the error and keeps its entries', async ({ page, request }) => {
    const folder = await newFolder('lost-events');
    await startViaApi(request, folder);
    let events: WebSocketRoute | undefined;
    await page.routeWebSocket(EVENTS, (ws) => {
      events = ws;
      ws.connectToServer();
    });
    await page.goto('/');
    await expect(entry(page, folder)).toBeVisible();
    await expect(list(page).getByRole('alert')).toHaveCount(0);

    await events!.close({ code: 1001, reason: 'server stopped' });

    await expect(list(page).getByRole('alert')).toHaveText(LOST_SERVER);
    await expect(entry(page, folder)).toBeVisible();
  });

  // plan-claude_sessions_client-ui_redesign/REQ-30, SessionList: the list request fails
  test('when the list does not load the list shows the error and no "No sessions."', async ({ page }) => {
    await page.route('**/api/sessions', (route) => (route.request().method() === 'GET' ? fail(500)(route) : route.fallback()));

    await page.goto('/');

    await expect(list(page).getByRole('alert')).toHaveText(LOST_SERVER);
    await expect(list(page)).not.toContainText('No sessions.');
    await expect(loading(list(page))).toHaveCount(0);
  });
});

test.describe('open session', () => {
  // plan-claude_sessions_client-ui_redesign/REQ-29, SessionView: "Loading…" over the terminal until the first frame; clicks go through it
  test('the terminal shows "Loading…" until the snapshot arrives, and a click on it reaches the terminal', async ({ page, request }) => {
    const folder = await newFolder('slow-attach');
    await startViaApi(request, folder);
    const heldFrames: (string | Buffer)[] = [];
    let releaseFrames = () => {};
    await page.routeWebSocket(ATTACH, (ws) => {
      const server = ws.connectToServer();
      let holding = true;
      server.onMessage((message) => (holding ? heldFrames.push(message) : ws.send(message)));
      releaseFrames = () => {
        holding = false;
        for (const message of heldFrames.splice(0)) ws.send(message);
      };
    });
    await page.goto('/');
    await entry(page, folder).click();

    const indicator = loading(mainArea(page));
    await expect(indicator).toBeVisible();
    await expect(terminal(page)).not.toContainText('READY');
    const box = (await indicator.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => terminalHasFocus(page), { message: 'the click reached the terminal' }).toBe(true);

    releaseFrames();

    await expect(terminal(page)).toContainText('READY');
    await expect(indicator).toHaveCount(0);
  });

  for (const [code, message] of [
    [4404, 'The session no longer exists.'],
    [1011, 'Connection to the session lost.'],
    [1001, 'Connection to the session lost.'],
  ] as const) {
    // plan-claude_sessions_client-ui_redesign/REQ-30, SessionView: an error between the header and the terminal when the connection closes
    test(`a connection closed with code ${code} shows "${message}" between the header and the terminal`, async ({ page, request }) => {
      const folder = await newFolder(`closed-${code}`);
      await startViaApi(request, folder);
      let attach: WebSocketRoute | undefined;
      await page.routeWebSocket(ATTACH, (ws) => {
        attach = ws;
        ws.connectToServer();
      });
      await page.goto('/');
      await entry(page, folder).click();
      await expect(terminal(page)).toContainText('READY');
      await expect(mainArea(page).getByRole('alert')).toHaveCount(0);

      await attach!.close({ code });

      const alert = mainArea(page).getByRole('alert');
      await expect(alert).toHaveText(message);
      await expect(terminal(page)).toContainText('[Session disconnected]');
      await expect(loading(mainArea(page))).toHaveCount(0);
      const [headerBox, alertBox, terminalBox] = await Promise.all([header(page).boundingBox(), alert.boundingBox(), page.locator('.xterm').boundingBox()]);
      expect(alertBox!.y, 'the error is below the header').toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);
      expect(alertBox!.y + alertBox!.height, 'the error is above the terminal').toBeLessThanOrEqual(terminalBox!.y + 1);
    });
  }

  // plan-claude_sessions_client-ui_redesign/REQ-30, SessionView: a connection closed before the first frame stops the loading too
  test('a connection that closes before the snapshot shows its error in place of "Loading…"', async ({ page, request }) => {
    const folder = await newFolder('closed-before-snapshot');
    await startViaApi(request, folder);
    await page.routeWebSocket(ATTACH, (ws) => {
      setTimeout(() => void ws.close({ code: 4404 }), 500);
    });
    await page.goto('/');
    await entry(page, folder).click();

    await expect(mainArea(page).getByRole('alert')).toHaveText('The session no longer exists.');
    await expect(loading(mainArea(page))).toHaveCount(0);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-32, SessionView: a session whose process ends shows "Ended" and no error
  test('a session that ends by itself shows "Ended" and no error message', async ({ page, request }) => {
    const { folder } = await openSession(page, request, 'ends-by-itself');
    await page.locator('.xterm-screen').click();
    await page.keyboard.type('/exit');
    await page.keyboard.press('Enter');

    await expect(header(page)).toContainText('Ended');
    await expect(entry(page, folder)).toContainText('Ended');
    await page.waitForTimeout(500);
    await expect(mainArea(page).getByRole('alert')).toHaveCount(0);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-4, SessionView: Ctrl+Shift+L leaves the terminal for the open entry; Ctrl+L stays in the terminal
  test('Ctrl+Shift+L moves the focus to the open entry and sends nothing; Ctrl+L still reaches the session', async ({ page, request }) => {
    const { folder } = await openSession(page, request, 'leave-terminal');
    // The key has no on-screen hint since plan-session_list_width (assumption "Key hint").
    await expect(mainArea(page).locator('kbd')).toHaveCount(0);
    await page.locator('.xterm-screen').click();
    await expect.poll(() => terminalHasFocus(page)).toBe(true);

    await page.keyboard.press('Control+Shift+L');

    await expect(entry(page, folder)).toBeFocused();
    await expect(entry(page, folder)).toHaveAttribute('aria-current', 'true');
    await expectFocusMarked(page, 'the open entry');
    await page.waitForTimeout(500);
    await expect(terminal(page)).not.toContainText('IN:0c');

    await page.locator('.xterm-screen').click();
    await page.keyboard.press('Control+l');
    await expect(terminal(page)).toContainText('IN:0c');
    await expect.poll(() => terminalHasFocus(page)).toBe(true);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-4, AppLayout: with no list entry the focus goes to "New Claude Code Session" in the rail
  test('Ctrl+Shift+L with an empty list moves the focus to "New Claude Code Session" in the rail', async ({ page }) => {
    // The open session is never listed: since plan-session_list_improvements/REQ-7 a session that leaves the list closes.
    const folder = await newFolder('leave-without-entry');
    await page.route(
      (url) => url.pathname === '/api/sessions',
      async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        await route.fulfill({ response: await route.fetch(), json: [] });
      },
    );
    await page.routeWebSocket(EVENTS, (ws) => {
      ws.connectToServer().onMessage((message) => {
        if ((JSON.parse(String(message)) as { type?: string }).type !== 'session') ws.send(message);
      });
    });
    await page.goto('/');
    await button(rail(page), 'New Claude Code Session').click();
    // The field shows the current folder once the first listing is in: typing earlier races it.
    await expect(pathField(page)).toHaveValue(/^\//);
    await pathField(page).fill(folder);
    const started = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/sessions' && r.request().method() === 'POST');
    await button(chooser(page), 'Start Session').click();
    createdIds.push(((await (await started).json()) as { id: string }).id);
    await expect(terminal(page)).toContainText('READY');
    await expect(list(page).getByRole('button')).toHaveCount(0);
    await page.locator('.xterm-screen').click();

    await page.keyboard.press('Control+Shift+L');

    await expect(button(rail(page), 'New Claude Code Session')).toBeFocused();
  });

  // plan-claude_sessions_client-ui_redesign/REQ-5, SessionView: the terminal area shows the focus ring only while it has the focus
  test('the terminal area shows the focus ring while the terminal has the focus, and not after leaving it', async ({ page, request }) => {
    await openSession(page, request, 'terminal-ring');
    await page.locator('.xterm-screen').click();
    await expect.poll(() => terminalHasFocus(page)).toBe(true);
    await expectFocusMarked(page, 'the terminal');

    await page.keyboard.press('Control+Shift+L');
    await expect.poll(() => terminalHasFocus(page)).toBe(false);
    const ringOnTerminal = await page.locator('.xterm-helper-textarea').evaluate((textarea) => {
      const marks: string[] = [];
      for (let node: Element | null = textarea; node && node.tagName !== 'MAIN'; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) marks.push(style.outlineColor);
        if (style.boxShadow !== 'none') marks.push(style.boxShadow);
      }
      return marks;
    });
    expect(ringOnTerminal, 'no focus mark around the terminal once it lost the focus').toEqual([]);
  });
});

test.describe('stop', () => {
  // plan-claude_sessions_client-ui_redesign/REQ-31, REQ-32: the human acceptance scenario of the stop
  test('"Terminate" shows the stop in progress, then the header shows "Ended" and "Terminate" is gone', async ({ page, request }) => {
    const { id, folder } = await openSession(page, request, 'stop-progress');
    await expect(entry(page, folder)).toContainText('Idle');
    const held = await hold(page, `**/api/sessions/${id}/stop`, 'POST');

    await button(header(page), 'Terminate').click();

    await expect.poll(held.seen).toBe(1);
    await isBusy(button(header(page), 'Terminate'));

    held.release();

    await expect(header(page)).toContainText('Ended');
    await expect(button(page.locator('body'), 'Terminate')).toHaveCount(0);
  });

  // StopSessionButton: busy stays after a 2xx answer until the state is ended
  test('"Terminate" stays busy after the server accepts the stop, until the session has ended', async ({ page, request }) => {
    const { id } = await openSession(page, request, 'stop-accepted');
    await page.route(`**/api/sessions/${id}/stop`, (route) => route.fulfill({ status: 202, body: '' }));

    await button(header(page), 'Terminate').click();
    await page.waitForTimeout(800);

    await isBusy(button(header(page), 'Terminate'));
    await expect(header(page)).not.toContainText('Ended');

    await page.unroute(`**/api/sessions/${id}/stop`);
    expect((await request.post(`/api/sessions/${id}/stop`)).status()).toBe(202);

    await expect(header(page)).toContainText('Ended');
    await expect(button(page.locator('body'), 'Terminate')).toHaveCount(0);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-30, REQ-32, StopSessionButton: a failed stop, then the next request hides its message
  test('a failed stop shows its error next to an enabled "Terminate", and the next stop request hides it', async ({ page, request }) => {
    const { id } = await openSession(page, request, 'stop-failed');
    await page.route(`**/api/sessions/${id}/stop`, fail(500));

    await button(header(page), 'Terminate').click();

    await expect(header(page).getByRole('alert')).toHaveText('Could not terminate the session.');
    await isNotBusy(button(header(page), 'Terminate'));

    await page.unroute(`**/api/sessions/${id}/stop`);
    const held = await hold(page, `**/api/sessions/${id}/stop`, 'POST');
    await button(header(page), 'Terminate').click();
    await expect.poll(held.seen).toBe(1);

    await expect(mainArea(page).getByRole('alert')).toHaveCount(0);
    held.release();
    await expect(header(page)).toContainText('Ended');
  });

  // plan-claude_sessions_client-ui_redesign/REQ-30, StopSessionButton: a network error is a failed stop
  test('a stop request that does not reach the server shows the same error', async ({ page, request }) => {
    const { id } = await openSession(page, request, 'stop-network');
    await page.route(`**/api/sessions/${id}/stop`, (route) => route.abort());

    await button(header(page), 'Terminate').click();

    await expect(header(page).getByRole('alert')).toHaveText('Could not terminate the session.');
    await isNotBusy(button(header(page), 'Terminate'));
  });
});

test.describe('folder chooser', () => {
  // plan-claude_sessions_client-ui_redesign/REQ-30, REQ-32: the human acceptance scenario of a failed start
  test('a start in a folder that does not exist keeps the chooser open with "The folder does not exist." in the error look', async ({ page }) => {
    await page.goto('/');
    await openChooser(page);
    // The field shows the current folder once the first listing is in: typing earlier races it.
    await expect(pathField(page)).toHaveValue(/^\//);
    await pathField(page).fill(path.join(projectsRoot, 'missing'));

    await button(chooser(page), 'Start Session').click();

    const alert = chooser(page).getByRole('alert');
    await expect(alert).toHaveText('The folder does not exist.');
    await expect(chooser(page)).toBeVisible();
    await expect(alert.locator('svg')).toHaveCount(1);
    await expectLook(page, alert, '--color-error', '--color-error');
  });

  // plan-claude_sessions_client-ui_redesign/REQ-29, FolderChooser: "Loading…" under the list on every listing
  test('every folder listing shows "Loading…" under the list until it arrives', async ({ page }) => {
    const root = await newFolder('listing/root');
    await newFolder('listing/root/sub');
    await page.goto('/');
    const first = await hold(page, '**/api/folders**', 'GET');
    await button(rail(page), 'New Claude Code Session').click();
    await expect(loading(chooser(page))).toBeVisible();
    first.release();
    await expect(pathField(page)).toHaveValue(os.homedir());
    await expect(loading(chooser(page))).toHaveCount(0);
    await page.unroute('**/api/folders**');
    await listFolder(page, root);

    const second = await hold(page, '**/api/folders**', 'GET');
    await button(chooser(page), 'sub').click();

    const indicator = loading(chooser(page));
    await expect(indicator).toBeVisible();
    const [listBox, indicatorBox] = await Promise.all([chooser(page).getByRole('list').boundingBox(), indicator.boundingBox()]);
    expect(indicatorBox!.y, 'the indicator is under the list').toBeGreaterThanOrEqual(listBox!.y + listBox!.height - 1);
    second.release();
    await expect(pathField(page)).toHaveValue(path.join(root, 'sub'));
    await expect(indicator).toHaveCount(0);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-30, FolderChooser: any other listing failure
  test('a listing that fails for another reason shows "Could not read the folder."', async ({ page }) => {
    await page.route('**/api/folders**', fail(500));
    await page.goto('/');

    await button(rail(page), 'New Claude Code Session').click();

    await expect(chooser(page).getByRole('alert')).toHaveText('Could not read the folder.');
    await expect(chooser(page)).toBeVisible();
  });

  // plan-claude_sessions_client-ui_redesign/REQ-31, REQ-32, FolderChooser: the start in progress, then its failure
  test('"Start Session" is busy while the start runs; a failed start shows "Could not start the session." and enables it again', async ({ page }) => {
    const folder = await newFolder('start-busy');
    await page.goto('/');
    await openChooser(page);
    await listFolder(page, folder);
    const held = await hold(page, '**/api/sessions', 'POST');

    await button(chooser(page), 'Start Session').click();

    await expect.poll(held.seen).toBe(1);
    await isBusy(button(chooser(page), 'Start Session'));
    await expect(chooser(page).getByRole('alert')).toHaveCount(0);

    held.release(fail(500));

    await expect(chooser(page).getByRole('alert')).toHaveText('Could not start the session.');
    await isNotBusy(button(chooser(page), 'Start Session'));
    await expect(chooser(page)).toBeVisible();
    await expect(terminal(page)).toHaveCount(0);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-4, FolderChooser: the focus moves to the first entry when its folder button disappears
  test('opening a folder from the keyboard moves the focus to the first entry of the new list', async ({ page }) => {
    const root = await newFolder('keyboard-browse');
    await newFolder('keyboard-browse/inner');
    await page.goto('/');
    await openChooser(page);
    await listFolder(page, root);
    await pressUntilFocused(page, button(chooser(page), 'inner'));

    await page.keyboard.press('Enter');

    await expect(pathField(page)).toHaveValue(path.join(root, 'inner'));
    await expect(button(chooser(page), '..')).toBeFocused();
    await expectFocusMarked(page, 'the first entry');
  });
});

test.describe('resume history', () => {
  // plan-claude_sessions_client-ui_redesign/REQ-29, ResumeDialog: "Loading…" while the past sessions load
  test('shows "Loading…" while the past sessions load', async ({ page }) => {
    const held = await hold(page, '**/api/past-sessions', 'GET');
    await page.goto('/');

    await button(rail(page), 'Resume').click();

    await expect(loading(history(page))).toBeVisible();
    held.release((route) => route.fulfill({ json: [] }));
    await expect(history(page)).toContainText('No sessions to resume.');
    await expect(loading(history(page))).toHaveCount(0);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-30, ResumeDialog: any other failure of the loading
  test('a list that does not load shows "Could not load the past sessions."', async ({ page }) => {
    await page.route('**/api/past-sessions', fail(500));
    await page.goto('/');

    await button(rail(page), 'Resume').click();

    await expect(history(page).getByRole('alert')).toHaveText('Could not load the past sessions.');
    await expect(loading(history(page))).toHaveCount(0);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-31, REQ-32, ResumeDialog: the resume in progress, then its failure
  test('"Resume" is busy while the resume runs; a failed resume shows "Could not resume the session."', async ({ page }) => {
    await page.route('**/api/past-sessions', (route) => route.fulfill({ json: pastSessions }));
    await page.goto('/');
    await button(rail(page), 'Resume').click();
    await history(page).getByRole('radio', { name: 'Prima sessione passata', exact: true }).click();
    const held = await hold(page, '**/api/past-sessions/*/resume', 'POST');

    await button(history(page), 'Resume').click();

    await expect.poll(held.seen).toBe(1);
    await isBusy(button(history(page), 'Resume'));

    held.release(fail(500));

    await expect(history(page).getByRole('alert')).toHaveText('Could not resume the session.');
    await expect(history(page)).toBeVisible();
    await isNotBusy(button(history(page), 'Resume'));
  });
});

test.describe('external session', () => {
  // plan-claude_sessions_client-ui_redesign/REQ-29, ConversationView: "Loading…" before the first frame
  test('the conversation shows "Loading…" until its first frame', async ({ page }) => {
    let conversation: WebSocketRoute | undefined;
    await withExternalEntry(page, (ws) => (conversation = ws));
    await page.goto('/');
    await entry(page, externalEntry.label).click();

    await expect(loading(mainArea(page))).toBeVisible();
    conversation!.send(JSON.stringify({ type: 'items', items: [] }));

    await expect(mainArea(page)).toContainText('No messages.');
    await expect(loading(mainArea(page))).toHaveCount(0);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-30, ConversationView: the socket closes before the first frame
  test('a conversation that closes before its first frame shows "Conversation not available."', async ({ page }) => {
    await withExternalEntry(page, (ws) => void setTimeout(() => void ws.close({ code: 4404 }), 300));
    await page.goto('/');

    await entry(page, externalEntry.label).click();

    await expect(mainArea(page).getByRole('alert')).toHaveText('Conversation not available.');
    await expect(loading(mainArea(page))).toHaveCount(0);
  });

  for (const [status, error, message] of [
    [500, 'internal', 'Could not resume the session.'],
    [404, 'session_not_found', 'The session no longer exists.'],
  ] as const) {
    // plan-claude_sessions_client-ui_redesign/REQ-30, REQ-31, REQ-32, ResumeHereButton: progress, then the failure message
    test(`"Resume Here" is busy while the resume runs; a ${status} ${error} shows "${message}"`, async ({ page }) => {
      await withExternalEntry(page, (ws) => ws.send(JSON.stringify({ type: 'items', items: [] })));
      await page.goto('/');
      await entry(page, externalEntry.label).click();
      await expect(mainArea(page)).toContainText('No messages.');
      const held = await hold(page, `**/api/past-sessions/${externalEntry.id}/resume`, 'POST');

      await button(mainArea(page), 'Resume Here').click();
      await button(warning(page), 'Resume Anyway').click();

      await expect.poll(held.seen).toBe(1);
      await isBusy(button(mainArea(page), 'Resume Here'));

      held.release(fail(status, error));

      await expect(mainArea(page).getByRole('alert')).toHaveText(message);
      await isNotBusy(button(mainArea(page), 'Resume Here'));
    });
  }
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-50, REQ-51, AreaState: accent icon, AA text and a rotating icon
    test('the loading state has its icon in the accent, its text with AA contrast, and its icon rotates', async ({ page }) => {
      const held = await hold(page, '**/api/sessions', 'GET');
      await page.goto('/');
      const indicator = loading(list(page));
      await expect(indicator).toBeVisible();

      await expectLook(page, indicator, '--accent-primary');
      const running = (await animations(indicator)).filter((a) => a.name !== 'none' && a.duration > 0 && a.state === 'running');
      expect(running.length, 'an element of the indicator rotates').toBeGreaterThan(0);
      held.release();
    });

    // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-50, REQ-51: rose icon in the list error block, rose inline error in a dialog, AA contrast
    test('an error has the rose icon and AA contrast in the list panel, and is rose text in a dialog', async ({ page }) => {
      await page.route('**/api/sessions', (route) => (route.request().method() === 'GET' ? fail(500)(route) : route.fallback()));
      await page.goto('/');
      await expect(list(page).getByRole('alert')).toHaveText(LOST_SERVER);
      await expectLook(page, list(page).getByRole('alert'), '--color-error');

      await page.route('**/api/past-sessions', fail(500));
      await button(rail(page), 'Resume').click();
      await expect(history(page).getByRole('alert')).toBeVisible();
      await expectLook(page, history(page).getByRole('alert'), '--color-error', '--color-error');
    });

    // plan-claude_sessions_client-ui_redesign/REQ-4, REQ-5: the human acceptance scenario of the keyboard walk through the client
    test('every screen and dialog works with Tab, Enter and Esc, and the focused element is always marked', async ({ page }) => {
      const folder = await newFolder(`keyboard-walk-${scheme}`);
      // Only this walk's session in the list: other tests, and earlier runs on a reused server, add entries the Tab walk would cross.
      const own = (session: { folder?: unknown } | undefined) => session?.folder === folder;
      await page.route(
        (url) => url.pathname === '/api/sessions',
        async (route) => {
          if (route.request().method() !== 'GET') return route.fallback();
          const response = await route.fetch();
          await route.fulfill({ response, json: ((await response.json()) as { folder?: unknown }[]).filter(own) });
        },
      );
      await page.routeWebSocket(EVENTS, (ws) => {
        const server = ws.connectToServer();
        server.onMessage((message) => {
          const frame = JSON.parse(String(message)) as { type?: string; session?: { folder?: unknown } };
          if (frame.type !== 'session' || own(frame.session)) ws.send(message);
        });
      });
      await page.route('**/api/past-sessions', (route) => route.fulfill({ json: [] }));
      await page.goto('/');
      await expect(loading(list(page))).toHaveCount(0);

      await pressUntilFocused(page, button(rail(page), 'New Claude Code Session'));
      await expectFocusMarked(page, '"New Claude Code Session"');
      await page.keyboard.press('Enter');
      await expect(pathField(page)).toBeFocused();
      await expectFieldOutlined(page);
      await page.keyboard.press('Escape');
      await expect(chooser(page)).toHaveCount(0);
      await expect(button(rail(page), 'New Claude Code Session')).toBeFocused();
      await expectFocusMarked(page, '"New Claude Code Session" after Esc');

      await page.keyboard.press('Enter');
      await expect(pathField(page)).toBeFocused();
      // The field shows the current folder once the first listing is in: typing earlier races it.
      await expect(pathField(page)).toHaveValue(/^\//);
      await page.keyboard.press('Control+A');
      await page.keyboard.type(folder);
      await page.keyboard.press('Enter');
      await expect(pathField(page)).toHaveValue(folder);
      await expect(loading(chooser(page))).toHaveCount(0);
      await pressUntilFocused(page, button(chooser(page), 'Start Session'));
      await expectFocusMarked(page, '"Start Session"');
      const started = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/sessions' && r.request().method() === 'POST');
      await page.keyboard.press('Enter');
      createdIds.push(((await (await started).json()) as { id: string }).id);
      await expect(terminal(page)).toContainText('READY');
      await expect(entry(page, folder)).toContainText('Idle');

      await pressUntilFocused(page, page.locator('.xterm-helper-textarea'));
      await expectFocusMarked(page, 'the terminal');
      await page.keyboard.press('Control+Shift+L');
      await expect(entry(page, folder)).toBeFocused();
      await expectFocusMarked(page, 'the open entry');

      await pressUntilFocused(page, button(header(page), 'Interrupt'));
      await expectFocusMarked(page, '"Interrupt"');
      await pressUntilFocused(page, button(header(page), 'Terminate'));
      await expectFocusMarked(page, '"Terminate"');
      await page.keyboard.press('Enter');
      await expect(header(page)).toContainText('Ended');

      await pressUntilFocused(page, button(rail(page), 'Resume'), 'Shift+Tab');
      await expectFocusMarked(page, '"Resume"');
      await page.keyboard.press('Enter');
      await expect(history(page)).toContainText('No sessions to resume.');
      await expect.poll(() => history(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
      await pressUntilFocused(page, button(history(page), 'Cancel'));
      await expectFocusMarked(page, '"Cancel" in the resume history');
      await page.keyboard.press('Escape');
      await expect(history(page)).toHaveCount(0);
      await expect(button(rail(page), 'Resume')).toBeFocused();
    });
  });
}
