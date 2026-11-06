// e2e of plan-claude_sessions_client-ui_redesign-material3_mock, batch hosted-session, brought to the Studio subbar, terminal panel and hint row
// of plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };

// Rounding of fractional layout sizes.
const TOLERANCE = 1;
const LABEL = "aggiungi la validazione dell'IBAN al form di pagamento";

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-hosted-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const mainArea = (page: Page) => page.getByRole('main');
const header = (page: Page) => mainArea(page).locator('header');
const panel = (page: Page) => mainArea(page).getByRole('region', { name: /^Terminal/ });
const hintRow = (page: Page) => mainArea(page).locator('.session-hint-row');
const hint = (page: Page) => hintRow(page).locator('span').filter({ has: page.locator('kbd') });
const statePill = (page: Page, name: string) => header(page).getByText(name, { exact: true });
const snackbar = (page: Page) => page.getByRole('status').filter({ hasText: 'needs your input' });
const terminal = (page: Page) => page.locator('.xterm-rows');
const terminalInput = (page: Page) => page.locator('.xterm-helper-textarea');
const button = (page: Page, name: string) => header(page).getByRole('button', { name, exact: true });

/** Shows in the page only the sessions of this file: other tests start sessions on the same server at the same time. */
async function showOnlyOwnSessions(page: Page): Promise<void> {
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
}

/** A new folder `<name>` in its own directory, so that tests can reuse the board folder names. */
async function newFolder(name: string): Promise<string> {
  const folder = path.join(await mkdtemp(path.join(projectsRoot, 't-')), name);
  await mkdir(folder);
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

/** The board sample session: "billing-api", idle, with its label. */
async function startBillingApi(request: APIRequestContext): Promise<string> {
  const folder = await newFolder('billing-api');
  const id = await startViaApi(request, folder);
  await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt: LABEL });
  await postHook(request, id, { hook_event_name: 'Stop' });
  return folder;
}

async function openFromList(page: Page, folder: string): Promise<void> {
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
}

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
}

const style = (target: Locator, property: string) => target.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);

async function styles(target: Locator, properties: string[]): Promise<Record<string, string>> {
  return target.evaluate((el, list) => {
    const s = getComputedStyle(el);
    return Object.fromEntries(list.map((p) => [p, s.getPropertyValue(p)]));
  }, properties);
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

const near = (actual: number, expected: number, what: string) => expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(TOLERANCE);

/** Whether the element draws the focus ring colour as an outline or a box-shadow. */
async function showsRing(page: Page, target: Locator): Promise<boolean> {
  const ring = await computedColour(page, 'var(--color-focus-ring)');
  return target.evaluate((el, ringColour) => {
    const s = getComputedStyle(el);
    const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor === ringColour;
    return outline || s.boxShadow.includes(ringColour);
  }, ring);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`Studio hosted session, ${colorScheme} system theme`, () => {
    test.use({ colorScheme, viewport: { width: 1440, height: 900 } });

    // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-30, REQ-31, REQ-32, REQ-34, REQ-35, REQ-53 — scenario "The open hosted session uses the Studio subbar and terminal"
    test('at 1440 x 900 the subbar, the terminal panel and the hint row have the Studio layout', async ({ page, request }) => {
      await showOnlyOwnSessions(page);
      const folder = await startBillingApi(request);
      await page.goto('/');
      await openFromList(page, folder);
      await page.mouse.move(0, 0);
      const colour = (token: string) => computedColour(page, `var(${token})`);
      const mono = /^["']?Roboto Mono["']?/;
      const main = await box(mainArea(page));

      // subbar: 40 px with its bottom line, padding 0 16 (mock `h-10 px-4`), surface 1, subtle line below, across the main area, no avatar
      const head = header(page);
      expect(await styles(head, ['padding-top', 'padding-bottom', 'padding-right', 'padding-left', 'background-color', 'border-bottom-width', 'border-bottom-color'])).toEqual({
        'padding-top': '0px', 'padding-bottom': '0px', 'padding-right': '16px', 'padding-left': '16px',
        'background-color': await colour('--bg-surface-1'), 'border-bottom-width': '1px', 'border-bottom-color': await colour('--border-subtle'),
      });
      const headBox = await box(head);
      near(headBox.y, main.y, 'header top');
      near(headBox.x, main.x, 'header left');
      near(headBox.width, main.width, 'header width');
      expect(headBox.height, 'header height').toBeCloseTo(40, 0);
      await expect(head.locator('.avatar')).toHaveCount(0);

      // name, "/", mono path, the label chip
      const title = head.getByRole('heading', { level: 2 });
      await expect(title).toHaveText('billing-api');
      expect(await styles(title, ['font-size', 'font-weight', 'margin-top', 'margin-bottom'])).toEqual({
        'font-size': '12px', 'font-weight': '600', 'margin-top': '0px', 'margin-bottom': '0px',
      });
      const separator = head.getByText('/', { exact: true });
      await expect(separator).toHaveAttribute('aria-hidden', 'true');
      expect(await style(separator, 'color')).toBe(await colour('--text-muted'));
      const pathText = head.getByText(folder, { exact: true });
      expect(await styles(pathText, ['font-size', 'color'])).toEqual({ 'font-size': '11px', color: await colour('--text-secondary') });
      expect(await style(pathText, 'font-family')).toMatch(mono);
      const line = head.getByText(LABEL, { exact: true });
      expect(await styles(line, ['color', 'background-color', 'white-space', 'text-overflow'])).toEqual({
        color: await colour('--text-muted'), 'background-color': await colour('--bg-surface-2'), 'white-space': 'nowrap', 'text-overflow': 'ellipsis',
      });
      expect(await style(line, 'font-family')).toMatch(mono);
      const titleBox = await box(title);
      expect((await box(separator)).x).toBeGreaterThan(titleBox.x);
      expect((await box(pathText)).x).toBeGreaterThan((await box(separator)).x);
      expect((await box(line)).x).toBeGreaterThan((await box(pathText)).x);

      // the zinc pill of "Idle": its dot, then its name
      const pill = statePill(page, 'Idle');
      expect(await styles(pill, ['background-color', 'color', 'font-size', 'border-top-left-radius'])).toEqual({
        'background-color': 'rgba(113, 113, 122, 0.15)', color: 'rgb(161, 161, 170)', 'font-size': '11px', 'border-top-left-radius': '4px',
      });
      expect(await style(pill, 'font-family')).toMatch(mono);
      await expect(pill.locator('[aria-hidden="true"]')).toHaveCount(1);

      // actions: rose "Interrupt" then "Terminate", 8 px apart, at the right edge inside the padding
      const interrupt = button(page, 'Interrupt');
      const stop = button(page, 'Terminate');
      const interruptBox = await box(interrupt);
      const stopBox = await box(stop);
      near(stopBox.x, interruptBox.x + interruptBox.width + 8, 'gap between the actions');
      near(stopBox.x + stopBox.width, headBox.x + headBox.width - 16, 'actions at the right edge');
      for (const action of [interrupt, stop]) {
        expect(await styles(action, [
          'background-color', 'color', 'border-top-width', 'border-top-color', 'border-top-left-radius', 'padding-top', 'padding-left', 'font-size',
        ])).toEqual({
          'background-color': 'rgba(244, 63, 94, 0.15)', color: 'rgb(251, 113, 133)', 'border-top-width': '1px', 'border-top-color': 'rgba(244, 63, 94, 0.3)',
          'border-top-left-radius': '6px', 'padding-top': '4px', 'padding-left': '10px', 'font-size': '11px',
        });
        expect(await style(action, 'font-family')).toMatch(mono);
        await expect(action.getByText('■', { exact: true })).toHaveAttribute('aria-hidden', 'true');
      }

      // the terminal panel: canvas, subtle border, 8 px radius, padding 12, 16 px from the left, right and top
      const term = panel(page);
      await expect(term).toHaveAccessibleName('Terminal: billing-api');
      expect(await styles(term, ['border-top-left-radius', 'background-color', 'border-top-width', 'border-top-color', 'padding-top', 'padding-left'])).toEqual({
        'border-top-left-radius': '8px', 'background-color': await colour('--bg-canvas'), 'border-top-width': '1px', 'border-top-color': await colour('--border-subtle'),
        'padding-top': '12px', 'padding-left': '12px',
      });
      const termBox = await box(term);
      near(termBox.y, headBox.y + headBox.height + 16, 'panel top');
      near(termBox.x, main.x + 16, 'panel left');
      near(termBox.width, main.width - 32, 'panel width');

      // the hint row: 40 px, padding 0 16, under the panel, down to the bottom of the main area
      const row = hintRow(page);
      const rowBox = await box(row);
      near(rowBox.y, termBox.y + termBox.height, 'hint row top');
      near(rowBox.height, 40, 'hint row height');
      near(rowBox.y + rowBox.height, main.y + main.height, 'hint row bottom');
      near(rowBox.x, main.x, 'hint row left');
      near(rowBox.width, main.width, 'hint row width');
      expect(await styles(row, ['padding-left', 'padding-right'])).toEqual({ 'padding-left': '16px', 'padding-right': '16px' });

      const hintText = hint(page);
      expect((await hintText.innerText()).replace(/\s+/g, ' ').replace(/ ?\+ ?/g, '+').trim()).toBe("Ctrl+Shift+L back to the list");
      expect(await styles(hintText, ['font-size', 'color'])).toEqual({ 'font-size': '11px', color: await colour('--text-muted') });
      const keys = hintText.locator('kbd');
      await expect(keys).toHaveText(['Ctrl', 'Shift', 'L']);
      for (const key of await keys.all()) {
        expect(await styles(key, [
          'font-size', 'padding-top', 'padding-right', 'border-top-left-radius', 'background-color', 'border-top-color', 'color',
        ])).toEqual({
          'font-size': '10px', 'padding-top': '1px', 'padding-right': '5px', 'border-top-left-radius': '4px',
          'background-color': await colour('--bg-surface-3'), 'border-top-color': await colour('--border-subtle'), color: await colour('--text-muted'),
        });
        expect(await style(key, 'font-family')).toMatch(mono);
      }
    });
  });
}

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-30 — scenario "The user interrupts Claude's turn from the header"
test('"Interrupt" on a working session sends Esc to the terminal and gives it the focus', async ({ page, request }) => {
  const folder = await newFolder('turno-in-corso');
  await startViaApi(request, folder);
  await page.goto('/');
  await openFromList(page, folder);
  await page.locator('.xterm-screen').click();
  await page.keyboard.type('WORK');
  await page.keyboard.press('Enter');
  await expect(statePill(page, 'Running')).toBeVisible();
  await expect(terminal(page)).toContainText('TICK1');

  await button(page, 'Interrupt').click();

  await expect(terminal(page)).toContainText('IN:1b');
  await expect(terminalInput(page)).toBeFocused();
  await page.keyboard.type('z');
  await expect(terminal(page)).toContainText('IN:7a');
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-31 — scenario "The user sees no stop actions on an ended session"
test('a session whose process has ended shows its header without "Interrupt" and "Terminate"', async ({ page, request }) => {
  const folder = await newFolder('finita');
  await startViaApi(request, folder);
  await page.goto('/');
  await openFromList(page, folder);
  await expect(button(page, 'Interrupt')).toBeVisible();
  await expect(button(page, 'Terminate')).toBeVisible();
  await page.locator('.xterm-screen').click();
  await page.keyboard.type('/exit');
  await page.keyboard.press('Enter');

  await expect(statePill(page, 'Ended')).toBeVisible();
  await expect(header(page).getByRole('heading', { level: 2 })).toHaveText('finita');
  await expect(header(page).getByRole('button', { name: 'Interrupt' })).toHaveCount(0);
  await expect(header(page).getByRole('button', { name: 'Terminate' })).toHaveCount(0);
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-32; SessionView: the panel shows the focus ring while the terminal has the focus
test('the terminal panel shows the focus ring only while the terminal has the keyboard focus', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const folder = await newFolder('anello');
  await startViaApi(request, folder);
  await page.goto('/');
  await openFromList(page, folder);
  await page.locator('.xterm-screen').click();
  await expect(terminalInput(page)).toBeFocused();
  await expect.poll(() => showsRing(page, panel(page))).toBe(true);

  await page.keyboard.press('Control+Shift+L');
  await expect(entry(page, folder)).toBeFocused();
  await expect.poll(() => showsRing(page, panel(page))).toBe(false);
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-33, plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-42: the hinted key works, and the snackbar never resizes the panel
test('the hint key moves the focus to the list, and the snackbar outside the hint row does not change the panel size', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await showOnlyOwnSessions(page);
  const folder = await newFolder('suggerimento');
  await startViaApi(request, folder);
  const waitingId = await startViaApi(request, await newFolder('attende-input'));
  await page.goto('/');
  await openFromList(page, folder);
  await expect(hint(page)).toBeVisible();
  const before = await box(panel(page));
  near((await box(hintRow(page))).height, 40, 'hint row height without snackbar');

  await postHook(request, waitingId, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  await expect(snackbar(page)).toBeVisible();
  await expect(hintRow(page).getByRole('status')).toHaveCount(0);
  near((await box(hintRow(page))).height, 40, 'hint row height with snackbar');
  expect(await box(panel(page))).toEqual(before);

  await page.locator('.xterm-screen').click();
  await page.keyboard.press('Control+Shift+L');
  await expect(entry(page, folder)).toBeFocused();
});

// NeedsInputSnackbar "Rules": at 1280 px a long folder name wraps inside the window minus 40 px, and the hint stays whole
test('at 1280 px a long snackbar wraps within the window minus 40 px, and the hint stays whole', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await showOnlyOwnSessions(page);
  const folder = await newFolder('stretta');
  await startViaApi(request, folder);
  const waitingId = await startViaApi(request, await newFolder(`progetto-${'con-un-nome-molto-lungo-'.repeat(5)}fine`));
  await page.goto('/');
  await openFromList(page, folder);
  await postHook(request, waitingId, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  await expect(snackbar(page)).toBeVisible();

  const rowBox = await box(hintRow(page));
  near(rowBox.height, 40, 'hint row height');
  expect(await hint(page).evaluate((el) => el.scrollWidth <= el.clientWidth), 'hint not cut').toBe(true);
  const barBox = await box(snackbar(page));
  expect(barBox.width).toBeLessThanOrEqual(1280 - 40 + TOLERANCE);
  expect(barBox.x).toBeGreaterThanOrEqual(20 - TOLERANCE);
  near(1280 - (barBox.x + barBox.width), 20, 'gap to the right edge of the window');
  near(800 - (barBox.y + barBox.height), 20, 'gap to the bottom edge of the window');
  await expect(snackbar(page)).toContainText(`progetto-${'con-un-nome-molto-lungo-'.repeat(5)}fine`);
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-42: with no session open the snackbar sits 20 px from the bottom right of the window
test('with no session open the snackbar sits 20 px from the bottom right of the window', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await showOnlyOwnSessions(page);
  const waiting = await newFolder('nessuna-aperta');
  const waitingId = await startViaApi(request, waiting);
  await page.goto('/');
  await expect(entry(page, waiting)).toBeVisible();
  await postHook(request, waitingId, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  await expect(snackbar(page)).toBeVisible();

  await expect(hintRow(page)).toHaveCount(0);
  const bar = await box(snackbar(page));
  near(1440 - (bar.x + bar.width), 20, 'gap to the right edge of the window');
  near(900 - (bar.y + bar.height), 20, 'gap to the bottom edge of the window');
});
