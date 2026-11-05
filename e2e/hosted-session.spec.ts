// e2e of plan-claude_sessions_client-ui_redesign-material3_mock, batch hosted-session: header, terminal panel and hint row as board "Sessione ospitata".
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

const list = (page: Page) => page.getByRole('region', { name: 'Elenco sessioni' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const mainArea = (page: Page) => page.getByRole('main');
const header = (page: Page) => mainArea(page).locator('header');
const panel = (page: Page) => mainArea(page).getByRole('region', { name: /^Terminale/ });
const hintRow = (page: Page) => mainArea(page).locator('.session-hint-row');
const hint = (page: Page) => hintRow(page).locator('span').filter({ has: page.locator('kbd') });
const snackbar = (page: Page) => page.getByRole('status').filter({ hasText: 'richiede il tuo input' });
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

/** The box inside the padding. */
async function contentBox(locator: Locator): Promise<Box> {
  const b = await box(locator);
  const s = await styles(locator, ['padding-top', 'padding-right', 'padding-bottom', 'padding-left']);
  const [top, right, bottom, left] = Object.values(s).map(parseFloat) as [number, number, number, number];
  return { x: b.x + left, y: b.y + top, width: b.width - left - right, height: b.height - top - bottom };
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
  test.describe(`board "Sessione ospitata", ${colorScheme} theme`, () => {
    test.use({ colorScheme, viewport: { width: 1440, height: 900 } });

    // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-29, REQ-32, REQ-33, REQ-34 — scenario "The user works in a hosted session laid out as the board"
    test('at 1440 x 900 the header, the terminal panel and the hint row match the board', async ({ page, request }) => {
      await showOnlyOwnSessions(page);
      const folder = await startBillingApi(request);
      const waitingId = await startViaApi(request, await newFolder('web-dashboard'));
      await page.goto('/');
      await openFromList(page, folder);
      await postHook(request, waitingId, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
      await expect(snackbar(page)).toBeVisible();
      await page.mouse.move(0, 0);
      const colour = (token: string) => computedColour(page, `var(${token})`);
      const main = await contentBox(mainArea(page));

      // header: one row, gap 16, padding 8 8 8 4, no background and no border; 48 px avatar, text block of 30 + 20 px
      const head = header(page);
      expect(await styles(head, ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'column-gap', 'background-color', 'border-top-width'])).toEqual({
        'padding-top': '8px', 'padding-right': '8px', 'padding-bottom': '8px', 'padding-left': '4px', 'column-gap': '16px',
        'background-color': 'rgba(0, 0, 0, 0)', 'border-top-width': '0px',
      });
      const headBox = await box(head);
      near(headBox.y, main.y, 'header top');
      near(headBox.x, main.x, 'header left');
      near(headBox.width, main.width, 'header width');
      near(headBox.height, 66, 'header height');

      const avatar = head.locator('.avatar');
      await expect(avatar).toHaveText('BA');
      const avatarBox = await box(avatar);
      near(avatarBox.width, 48, 'avatar width');
      near(avatarBox.height, 48, 'avatar height');
      near(avatarBox.x, headBox.x + 4, 'avatar left');
      // The board draws the round primary avatar; the app picks primary (round, 16 px) or teal (square, 12 px) from the folder path.
      const round = await avatar.evaluate((el) => el.classList.contains('avatar-primary'));
      expect(await styles(avatar, ['border-top-left-radius', 'font-size', 'line-height', 'font-weight'])).toEqual({
        'border-top-left-radius': round ? '16px' : '12px', 'font-size': '16px', 'line-height': '24px', 'font-weight': '500',
      });

      const title = head.getByRole('heading', { level: 2 });
      await expect(title).toHaveText('billing-api');
      expect(await styles(title, ['font-size', 'line-height', 'font-weight', 'margin-top', 'margin-bottom', 'color'])).toEqual({
        'font-size': '22px', 'line-height': '28px', 'font-weight': '500', 'margin-top': '0px', 'margin-bottom': '0px', color: await colour('--on-surface'),
      });
      const titleBox = await box(title);
      near(titleBox.x, avatarBox.x + avatarBox.width + 16, 'gap avatar to text block');

      const chip = head.locator('.state-chip');
      await expect(chip).toHaveText('In attesa');
      const chipBox = await box(chip);
      near(chipBox.height, 30, 'chip height (28 px plus the 1 px border)');
      near(chipBox.x, titleBox.x + titleBox.width + 10, 'gap h2 to chip');
      near(chipBox.y + chipBox.height / 2, titleBox.y + titleBox.height / 2, 'chip centred on the h2');
      const outlineVariant = await colour('--outline-variant');
      expect(await styles(chip, [
        'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-top-style',
        'border-top-color', 'border-left-color', 'color', 'border-top-left-radius', 'padding-left', 'padding-right', 'column-gap',
        'font-size', 'line-height', 'font-weight',
      ])).toEqual({
        'border-top-width': '1px', 'border-right-width': '1px', 'border-bottom-width': '1px', 'border-left-width': '1px', 'border-top-style': 'solid',
        'border-top-color': outlineVariant, 'border-left-color': outlineVariant, color: await colour('--on-surface-variant'),
        'border-top-left-radius': '8px', 'padding-left': '8px', 'padding-right': '10px', 'column-gap': '6px',
        'font-size': '14px', 'line-height': '20px', 'font-weight': '500',
      });
      const chipIcon = await box(chip.locator('svg'));
      near(chipIcon.width, 16, 'chip icon width');
      near(chipIcon.height, 16, 'chip icon height');

      const line = head.getByText(`${LABEL} · ${folder}`, { exact: true });
      await expect(line).toBeVisible();
      expect(await styles(line, ['font-size', 'line-height', 'letter-spacing', 'color', 'white-space', 'text-overflow', 'margin-top', 'margin-bottom'])).toEqual({
        'font-size': '14px', 'line-height': '20px', 'letter-spacing': '0.25px', color: await colour('--on-surface-variant'),
        'white-space': 'nowrap', 'text-overflow': 'ellipsis', 'margin-top': '0px', 'margin-bottom': '0px',
      });
      const lineBox = await box(line);
      near(lineBox.y, chipBox.y + chipBox.height, 'line right below the name row');
      near(lineBox.x, titleBox.x, 'line aligned with the h2');

      // actions: outlined "Interrompi" then tonal error "Termina", 8 px apart, at the right edge inside the padding
      const interrupt = button(page, 'Interrompi');
      const stop = button(page, 'Termina');
      const interruptBox = await box(interrupt);
      const stopBox = await box(stop);
      near(stopBox.x, interruptBox.x + interruptBox.width + 8, 'gap between the actions');
      near(stopBox.x + stopBox.width, headBox.x + headBox.width - 8, 'actions at the right edge');
      expect(await styles(interrupt, [
        'background-color', 'border-top-width', 'border-top-style', 'border-top-color', 'color',
        'border-top-left-radius', 'padding-left', 'padding-right', 'column-gap', 'font-size', 'line-height', 'font-weight',
      ])).toEqual({
        'background-color': 'rgba(0, 0, 0, 0)', 'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': await colour('--outline'),
        color: await colour('--on-surface-variant'), 'border-top-left-radius': '20px', 'padding-left': '16px', 'padding-right': '20px',
        'column-gap': '8px', 'font-size': '14px', 'line-height': '20px', 'font-weight': '500',
      });
      // The board .btn is 40 px high with no box-sizing rule, so the 1 px border of "Interrompi" adds to it.
      expect.soft(await interrupt.evaluate((el) => el.clientHeight), '"Interrompi" is 40 px high inside its border').toBe(40);
      expect(await styles(stop, [
        'background-color', 'border-top-width', 'color', 'border-top-left-radius', 'padding-left', 'padding-right', 'column-gap', 'font-size', 'line-height', 'font-weight',
      ])).toEqual({
        'background-color': await colour('--error-container'), 'border-top-width': '0px', color: await colour('--on-error-container'),
        'border-top-left-radius': '20px', 'padding-left': '16px', 'padding-right': '20px', 'column-gap': '8px',
        'font-size': '14px', 'line-height': '20px', 'font-weight': '500',
      });
      near(stopBox.height, 40, '"Termina" height');
      for (const action of [interrupt, stop]) {
        const icon = await box(action.locator('svg'));
        near(icon.width, 20, 'action icon width');
        near(icon.height, 20, 'action icon height');
      }

      // the terminal panel: 28 px radius, terminal colours, padding 24 28, 12 px below the header
      const term = panel(page);
      await expect(term).toHaveAccessibleName('Terminale di billing-api');
      expect(await styles(term, ['border-top-left-radius', 'border-bottom-right-radius', 'background-color', 'color', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left'])).toEqual({
        'border-top-left-radius': '28px', 'border-bottom-right-radius': '28px', 'background-color': await colour('--term-bg'), color: await colour('--term-fg'),
        'padding-top': '24px', 'padding-right': '28px', 'padding-bottom': '24px', 'padding-left': '28px',
      });
      const termBox = await box(term);
      near(termBox.y, headBox.y + headBox.height + 12, 'panel top');
      near(termBox.x, main.x, 'panel left');
      near(termBox.width, main.width, 'panel width');

      // the hint row: 48 px, padding 0 8, under the panel, down to the bottom of the main area
      const row = hintRow(page);
      const rowBox = await box(row);
      near(rowBox.y, termBox.y + termBox.height + 12, 'hint row top');
      near(rowBox.height, 48, 'hint row height');
      near(rowBox.y + rowBox.height, main.y + main.height, 'hint row bottom');
      near(rowBox.x, main.x, 'hint row left');
      near(rowBox.width, main.width, 'hint row width');
      expect(await styles(row, ['padding-left', 'padding-right'])).toEqual({ 'padding-left': '8px', 'padding-right': '8px' });

      const hintText = hint(page);
      expect((await hintText.innerText()).replace(/\s+/g, ' ').replace(/ ?\+ ?/g, '+').trim()).toBe("Ctrl+Maiusc+L torna all'elenco");
      expect(await styles(hintText, ['font-size', 'line-height', 'letter-spacing', 'color', 'column-gap'])).toEqual({
        'font-size': '12px', 'line-height': '16px', 'letter-spacing': '0.4px', color: await colour('--on-surface-variant'), 'column-gap': '8px',
      });
      near((await box(hintText)).x, rowBox.x + 8, 'hint left');
      const keys = hintText.locator('kbd');
      await expect(keys).toHaveText(['Ctrl', 'Maiusc', 'L']);
      const uiFont = await style(hintText, 'font-family');
      for (const key of await keys.all()) {
        expect(await styles(key, [
          'font-size', 'line-height', 'font-weight', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
          'border-top-left-radius', 'background-color', 'color', 'font-family',
        ])).toEqual({
          'font-size': '12px', 'line-height': '16px', 'font-weight': '500', 'padding-top': '2px', 'padding-right': '8px', 'padding-bottom': '2px', 'padding-left': '8px',
          'border-top-left-radius': '6px', 'background-color': await colour('--sc-high'), color: await colour('--on-surface'), 'font-family': uiFont,
        });
      }

      // the snackbar sits at the right of the hint row
      const bar = row.getByRole('status').filter({ hasText: 'richiede il tuo input' });
      await expect(bar).toHaveText(/web-dashboard richiede il tuo input/);
      const barBox = await box(bar);
      near(barBox.x + barBox.width, rowBox.x + rowBox.width - 8, 'snackbar right edge');
      near(barBox.y + barBox.height / 2, rowBox.y + rowBox.height / 2, 'snackbar centred in the row');
      expect(barBox.x).toBeGreaterThan((await box(hintText)).x + (await box(hintText)).width);
    });
  });
}

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-30 — scenario "The user interrupts Claude's turn from the header"
test('"Interrompi" on a working session sends Esc to the terminal and gives it the focus', async ({ page, request }) => {
  const folder = await newFolder('turno-in-corso');
  await startViaApi(request, folder);
  await page.goto('/');
  await openFromList(page, folder);
  await page.locator('.xterm-screen').click();
  await page.keyboard.type('WORK');
  await page.keyboard.press('Enter');
  await expect(header(page).locator('.state-chip')).toHaveText('Lavora');
  await expect(terminal(page)).toContainText('TICK1');

  await button(page, 'Interrompi').click();

  await expect(terminal(page)).toContainText('IN:1b');
  await expect(terminalInput(page)).toBeFocused();
  await page.keyboard.type('z');
  await expect(terminal(page)).toContainText('IN:7a');
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-31 — scenario "The user sees no stop actions on an ended session"
test('a session whose process has ended shows its header without "Interrompi" and "Termina"', async ({ page, request }) => {
  const folder = await newFolder('finita');
  await startViaApi(request, folder);
  await page.goto('/');
  await openFromList(page, folder);
  await expect(button(page, 'Interrompi')).toBeVisible();
  await expect(button(page, 'Termina')).toBeVisible();
  await page.locator('.xterm-screen').click();
  await page.keyboard.type('/exit');
  await page.keyboard.press('Enter');

  await expect(header(page).locator('.state-chip')).toHaveText('Terminata');
  await expect(header(page).getByRole('heading', { level: 2 })).toHaveText('finita');
  await expect(header(page).getByRole('button', { name: 'Interrompi' })).toHaveCount(0);
  await expect(header(page).getByRole('button', { name: 'Termina' })).toHaveCount(0);
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

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-33; SessionView G1: the hinted key works, and the snackbar never resizes the panel
test('the hint key moves the focus to the list, and a snackbar in the hint row does not change the panel size', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await showOnlyOwnSessions(page);
  const folder = await newFolder('suggerimento');
  await startViaApi(request, folder);
  const waitingId = await startViaApi(request, await newFolder('attende-input'));
  await page.goto('/');
  await openFromList(page, folder);
  await expect(hint(page)).toBeVisible();
  const before = await box(panel(page));
  near((await box(hintRow(page))).height, 48, 'hint row height without snackbar');

  await postHook(request, waitingId, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  await expect(hintRow(page).getByRole('status').filter({ hasText: 'richiede il tuo input' })).toBeVisible();
  near((await box(hintRow(page))).height, 48, 'hint row height with snackbar');
  expect(await box(panel(page))).toEqual(before);

  await page.locator('.xterm-screen').click();
  await page.keyboard.press('Control+Shift+L');
  await expect(entry(page, folder)).toBeFocused();
});

// SessionView "Shows": the hint is never cut; the snackbar stays on one row and cuts its text
test('at 1280 px a long snackbar stays on one row with an ellipsis, and the hint stays whole', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await showOnlyOwnSessions(page);
  const folder = await newFolder('stretta');
  await startViaApi(request, folder);
  const waitingId = await startViaApi(request, await newFolder(`progetto-${'con-un-nome-molto-lungo-'.repeat(5)}fine`));
  await page.goto('/');
  await openFromList(page, folder);
  await postHook(request, waitingId, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  const bar = hintRow(page).getByRole('status').filter({ hasText: 'richiede il tuo input' });
  await expect(bar).toBeVisible();

  const rowBox = await box(hintRow(page));
  near(rowBox.height, 48, 'hint row height');
  const hintBox = await box(hint(page));
  expect(await hint(page).evaluate((el) => el.scrollWidth <= el.clientWidth), 'hint not cut').toBe(true);
  expect(hintBox.y).toBeGreaterThanOrEqual(rowBox.y - TOLERANCE);
  const barBox = await box(bar);
  expect(barBox.x).toBeGreaterThanOrEqual(hintBox.x + hintBox.width);
  expect(barBox.x + barBox.width).toBeLessThanOrEqual(rowBox.x + rowBox.width + TOLERANCE);
  expect(barBox.height).toBeLessThanOrEqual(48);
  const cut = await bar.evaluate((el) =>
    [...el.querySelectorAll('*')].some((child) => getComputedStyle(child).textOverflow === 'ellipsis' && child.scrollWidth > child.clientWidth),
  );
  expect(cut, 'the snackbar text is cut with an ellipsis').toBe(true);
});

// AppLayout "Shows": with no session open the snackbar floats at the bottom right of the main area
test('with no session open the snackbar floats at the bottom right of the main area', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await showOnlyOwnSessions(page);
  const waiting = await newFolder('nessuna-aperta');
  const waitingId = await startViaApi(request, waiting);
  await page.goto('/');
  await expect(entry(page, waiting)).toBeVisible();
  await postHook(request, waitingId, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  await expect(snackbar(page)).toBeVisible();

  await expect(hintRow(page)).toHaveCount(0);
  const main = await box(mainArea(page));
  const bar = await box(snackbar(page));
  near(main.x + main.width - (bar.x + bar.width), 24, 'gap to the right edge of the main area');
  near(main.y + main.height - (bar.y + bar.height), 16, 'gap to the bottom edge of the main area');
});
