// e2e of plan-claude_sessions_client-ui_redesign-material3_mock, batch external-session: the external view as board "Sessione esterna".
// The external entries and their conversation sockets are mocked, so each test controls the items and when they arrive.
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, type WebSocketRoute, expect, test } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };
type Item = Record<string, unknown>;

// Rounding of fractional layout sizes.
const TOLERANCE = 1;
// At 1440 px the board list (flex 1 1 340px) gets 1/1000 of the 444 px left by the flex bases; main (flex 999 1 560px) the rest.
const LIST_WIDTH = 340 + 444 / 1000;
const CONVERSATION = /\/api\/external-sessions\/[^/]+\/conversation$/;
const isItemRequest = (url: URL) => /\/api\/external-sessions\/[^/]+\/items$/.test(url.pathname);

// Board paths of the icons this view draws.
const TERMINAL = ['M12 19h8', 'm4 17 6-6-6-6'];
const PENCIL = ['M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z'];
const CHECK = ['M20 6 9 17l-5-5'];
const CIRCLE_X = ['m15 9-6 6', 'm9 9 6 6'].sort();
const CHEVRON_RIGHT = ['m9 18 6-6-6-6'];
const CHEVRON_DOWN = ['m6 9 6 6 6-6'];
const ARROW_DOWN = ['M12 5v14', 'm19 12-7 7-7-7'].sort();
const LOG_IN = ['M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4', 'm10 17 5-5-5-5', 'M15 12H3'].sort();
const LOCK = ['M7 11V7a5 5 0 0 1 10 0v4'];

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-external-board-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

test.afterAll(async () => {
  await rm(projectsRoot, { recursive: true, force: true });
});

const mainArea = (page: Page) => page.getByRole('main');
const list = (page: Page) => page.getByRole('region', { name: 'Elenco sessioni' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const view = (page: Page) => page.locator('.conversation-view');
const header = (page: Page) => view(page).locator('.session-header');
const panel = (page: Page) => view(page).locator('.conversation-panel');
const scroller = (page: Page) => view(page).locator('.conversation-items');
const articles = (page: Page) => view(page).getByRole('article');
const article = (page: Page, name: string) => view(page).getByRole('article', { name, exact: true });
const toggle = (card: Locator) => card.getByRole('button').first();
const newMessages = (page: Page) => view(page).getByRole('button', { name: /^(?:1 nuovo messaggio|\d+ nuovi messaggi)$/ });
const snackbar = (page: Page) => page.getByRole('status').filter({ hasText: 'richiede il tuo input' });

const todayAt = (time: string) => `${new Date().toISOString().slice(0, 10)}T${time}:00.000Z`;
const lines = (count: number, prefix = 'riga') => Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`).join('\n');
const user = (text: string, extra: Item = {}): Item => ({ kind: 'user', text, ...extra });
const claude = (text: string): Item => ({ kind: 'assistant', text });
const call = (id: string, name: string, summary: string, extra: Item = {}): Item => ({ kind: 'tool_call', name, summary, id, ...extra });
const result = (toolUseId: string, text: string, extra: Item = {}): Item => ({ kind: 'tool_result', text, truncated: false, toolUseId, ...extra });
const ref = (offset: number) => ({ ref: { offset, block: 0 } });

function externalEntry(id: string, folder: string, label: string, state = 'idle') {
  return { id, folder, label, state, lastActivity: new Date().toISOString(), external: true };
}

/**
 * Shows in the page only the sessions of this file plus the given external entries: other tests use the same server.
 * Returns the conversation socket of the opened external entry, once the page connects it.
 */
async function showSessions(page: Page, externals: object[]): Promise<() => Promise<WebSocketRoute>> {
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

const send = (socket: WebSocketRoute, items: Item[]) => socket.send(JSON.stringify({ type: 'items', items }));

/** Answers the full-content requests from `texts` by offset, after `delayMs`; returns the requested offsets. */
async function serveItems(page: Page, texts: Record<number, string>, delayMs = 0): Promise<number[]> {
  const requested: number[] = [];
  await page.route(isItemRequest, async (route) => {
    const offset = Number(new URL(route.request().url()).searchParams.get('offset'));
    requested.push(offset);
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const text = texts[offset];
    if (text === undefined) return route.fulfill({ status: 404, json: { error: 'item_not_found' } });
    return route.fulfill({ status: 200, json: { text } });
  });
  return requested;
}

async function newFolder(name: string): Promise<string> {
  const folder = path.join(await mkdtemp(path.join(projectsRoot, 't-')), name);
  await mkdir(folder);
  return folder;
}

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
}

async function styles(target: Locator, properties: string[]): Promise<Record<string, string>> {
  return target.evaluate((el, names) => {
    const s = getComputedStyle(el);
    return Object.fromEntries(names.map((p) => [p, s.getPropertyValue(p)]));
  }, properties);
}

async function computed(page: Page, property: 'color' | 'font-family', cssValue: string): Promise<string> {
  return page.evaluate(
    ([name, value]) => {
      const probe = document.createElement('div');
      probe.style.setProperty(name!, value!);
      document.body.append(probe);
      const out = getComputedStyle(probe).getPropertyValue(name!);
      probe.remove();
      return out;
    },
    [property, cssValue],
  );
}

/** The box inside the padding. */
async function contentBox(locator: Locator): Promise<Box> {
  const b = await box(locator);
  const s = await styles(locator, ['padding-top', 'padding-right', 'padding-bottom', 'padding-left']);
  const [top, right, bottom, left] = Object.values(s).map(parseFloat) as [number, number, number, number];
  return { x: b.x + left, y: b.y + top, width: b.width - left - right, height: b.height - top - bottom };
}

const near = (actual: number, expected: number, what: string) => expect.soft(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(TOLERANCE);
/** The path data of an icon, sorted: the order of the paths does not change the drawing. */
const paths = (icon: Locator) => icon.locator('path').evaluateAll((all) => all.map((p) => p.getAttribute('d') ?? '').sort());
const atEnd = (page: Page) => scroller(page).evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop <= 8);
const scrollTo = (page: Page, where: 'top' | 'end' | number) =>
  scroller(page).evaluate((el, target) => {
    el.scrollTop = target === 'top' ? 0 : target === 'end' ? el.scrollHeight : target;
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, where);

const FAIL_OUTPUT = 'FAIL src/screens/Checkout.test.tsx\n  ✕ renders total with Android font scale (48 ms)\n  Expected: "€ 1.234,50"\n  Received: "€ 1,234.50"';
const CHECKOUT = 'npm test -- src/screens/Checkout.test.tsx';
const EDIT_INPUT = JSON.stringify({ file_path: 'src/utils/formatPrice.ts', old_string: "'en-US'", new_string: "'it-IT'" }, null, 2);
const EDIT_OUTPUT = 'Il file src/utils/formatPrice.ts è stato aggiornato.';

/** The sample data of board "Sessione esterna". */
const boardItems = (): Item[] => [
  user('i test della schermata di checkout falliscono su Android, puoi capire perché?', { timestamp: todayAt('20:45') }),
  claude('Lancio la suite di checkout per vedere gli errori.'),
  call('t1', 'Bash', CHECKOUT, ref(100)),
  result('t1', FAIL_OUTPUT, { isError: true, ...ref(200) }),
  claude('Il formato valuta usa la locale del device invece di it-IT. Correggo `formatPrice`.'),
  call('t2', 'Edit', 'src/utils/formatPrice.ts', { moreInput: true, ...ref(300) }),
  result('t2', EDIT_OUTPUT, ref(400)),
  call('t3', 'Bash', CHECKOUT, ref(500)),
  result('t3', 'Tests: 14 passed, 14 total', ref(600)),
  claude('Tutti i 14 test passano. Il prezzo ora è formattato sempre in it-IT, indipendentemente dalla lingua del telefono.'),
];

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`board "Sessione esterna", ${colorScheme} theme`, () => {
    test.use({ colorScheme, viewport: { width: 1440, height: 900 }, timezoneId: 'UTC' });

    // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-35, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40, REQ-43 — scenario "The user reads an external session laid out as the board"
    test('at 1440 x 900 the header, the messages and the tool cards match the board', async ({ page }) => {
      const folder = path.join(projectsRoot, 'board', 'mobile-app');
      const connection = await showSessions(page, [externalEntry('board-mobile-app', folder, 'i test del checkout falliscono su Android', 'working')]);
      const requested = await serveItems(page, { 300: EDIT_INPUT, 400: EDIT_OUTPUT });
      await page.goto('/');
      await entry(page, folder).click();
      send(await connection(), boardItems());
      await expect(articles(page)).toHaveCount(7);
      const bashCards = article(page, 'Strumento: Bash');
      await toggle(bashCards.first()).click();
      await page.mouse.move(0, 0);

      const colour = (token: string) => computed(page, 'color', `var(${token})`);
      const monoFont = await computed(page, 'font-family', 'var(--font-mono)');
      const outlineVariant = await colour('--outline-variant');
      const mainBox = await box(mainArea(page));
      near(mainBox.x, 96 + LIST_WIDTH, 'main left');
      near(mainBox.width, 1440 - 96 - LIST_WIDTH, 'main width');
      const main = await contentBox(mainArea(page));

      // header: 66 px high (50 px avatar and text block, padding 8 8 8 4), across the main area
      const head = header(page);
      const headBox = await box(head);
      near(headBox.x, main.x, 'header left');
      near(headBox.y, main.y, 'header top');
      near(headBox.width, main.width, 'header width');
      near(headBox.height, 66, 'header height');

      // outlined terminal avatar: a 48 px content-box span with a 1 px border, so 50 px outside
      const avatar = head.locator('.avatar');
      const avatarBox = await box(avatar);
      near(avatarBox.width, 50, 'avatar width');
      near(avatarBox.height, 50, 'avatar height');
      near(avatarBox.x, headBox.x + 4, 'avatar left');
      near(avatarBox.y + avatarBox.height / 2, headBox.y + headBox.height / 2, 'avatar centred in the header');
      expect.soft(await styles(avatar, ['border-top-width', 'border-top-style', 'border-top-color', 'background-color', 'color'])).toEqual({
        'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': await colour('--outline'),
        'background-color': 'rgba(0, 0, 0, 0)', color: await colour('--on-surface-variant'),
      });
      const radius = await avatar.evaluate((el) => {
        const value = getComputedStyle(el).borderTopLeftRadius;
        return value.endsWith('%') ? (parseFloat(value) / 100) * el.getBoundingClientRect().width : parseFloat(value);
      });
      near(radius, 24, 'avatar radius');
      const avatarIcon = avatar.locator('svg');
      expect.soft(await paths(avatarIcon)).toEqual(TERMINAL);
      near((await box(avatarIcon)).width, 24, 'avatar icon width');
      near((await box(avatarIcon)).height, 24, 'avatar icon height');

      const title = head.getByRole('heading', { level: 2 });
      await expect(title).toHaveText('mobile-app');
      const titleBox = await box(title);
      near(titleBox.x, avatarBox.x + avatarBox.width + 16, 'gap avatar to text block');
      const stateChip = head.locator('.state-chip');
      await expect(stateChip).toHaveText('Lavora');
      const stateBox = await box(stateChip);
      near(stateBox.x, titleBox.x + titleBox.width + 10, 'gap h2 to state chip');

      // "Sola lettura": an outlined .label-l chip with the lock icon, 10 px after the state chip
      const readOnly = head.getByText('Sola lettura', { exact: true });
      const readOnlyBox = await box(readOnly);
      near(readOnlyBox.x, stateBox.x + stateBox.width + 10, 'gap state chip to "Sola lettura"');
      near(readOnlyBox.height, 30, '"Sola lettura" height (28 px plus the 1 px border)');
      near(readOnlyBox.y, headBox.y + 8, '"Sola lettura" top');
      expect.soft(await styles(readOnly, [
        'border-top-width', 'border-top-style', 'border-top-color', 'border-left-color', 'background-color', 'color', 'border-top-left-radius',
        'padding-left', 'padding-right', 'column-gap', 'font-size', 'line-height', 'font-weight', 'letter-spacing',
      ])).toEqual({
        'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': outlineVariant, 'border-left-color': outlineVariant,
        'background-color': 'rgba(0, 0, 0, 0)', color: await colour('--on-surface-variant'), 'border-top-left-radius': '8px',
        'padding-left': '8px', 'padding-right': '10px', 'column-gap': '6px', 'font-size': '14px', 'line-height': '20px', 'font-weight': '500', 'letter-spacing': '0.1px',
      });
      const lock = readOnly.locator('svg');
      expect.soft(await paths(lock)).toEqual(LOCK);
      near((await box(lock)).width, 16, 'lock icon width');

      // the line, with the full folder path, right under the name row
      const line = head.getByText(`Aperta in un altro terminale · ${folder}`, { exact: true });
      await expect(line).toBeVisible();
      const lineBox = await box(line);
      near(lineBox.x, titleBox.x, 'line aligned with the h2');
      near(lineBox.y, readOnlyBox.y + readOnlyBox.height, 'line under the name row');
      near(lineBox.height, 20, 'line height');
      expect.soft(await styles(line, ['font-size', 'line-height', 'letter-spacing', 'color'])).toEqual({
        'font-size': '14px', 'line-height': '20px', 'letter-spacing': '0.25px', color: await colour('--on-surface-variant'),
      });

      // "Riprendi qui": filled primary .btn with the log-in icon, at the right edge inside the padding
      const resume = head.getByRole('button', { name: 'Riprendi qui', exact: true });
      const resumeBox = await box(resume);
      near(resumeBox.height, 40, '"Riprendi qui" height');
      near(resumeBox.x + resumeBox.width, headBox.x + headBox.width - 8, '"Riprendi qui" at the right edge');
      near(resumeBox.y + resumeBox.height / 2, headBox.y + headBox.height / 2, '"Riprendi qui" centred in the header');
      expect.soft(await styles(resume, [
        'background-color', 'color', 'border-top-width', 'border-top-left-radius', 'padding-left', 'padding-right', 'column-gap',
        'font-size', 'line-height', 'font-weight', 'letter-spacing',
      ])).toEqual({
        'background-color': await colour('--primary'), color: await colour('--on-primary'), 'border-top-width': '0px', 'border-top-left-radius': '20px',
        'padding-left': '16px', 'padding-right': '20px', 'column-gap': '8px', 'font-size': '14px', 'line-height': '20px', 'font-weight': '500', 'letter-spacing': '0.1px',
      });
      expect.soft(await paths(resume.locator('svg'))).toEqual(LOG_IN);
      near((await box(resume.locator('svg'))).width, 20, '"Riprendi qui" icon width');

      // the content panel: 12 px under the header, down to the bottom of the main area, radius 28, --sc-low
      const panelBox = await box(panel(page));
      near(panelBox.x, main.x, 'panel left');
      near(panelBox.width, main.width, 'panel width');
      near(panelBox.y, headBox.y + headBox.height + 12, 'panel top');
      near(panelBox.y + panelBox.height, main.y + main.height, 'panel bottom');
      expect.soft(await styles(panel(page), ['border-top-left-radius', 'border-bottom-right-radius', 'background-color'])).toEqual({
        'border-top-left-radius': '28px', 'border-bottom-right-radius': '28px', 'background-color': await colour('--sc-low'),
      });
      await expect(newMessages(page)).toHaveCount(0);

      // the 760 px column, centred inside the 24 px side padding, its first entry 28 px from the top
      const firstClaude = article(page, 'Claude').first();
      const column = await box(firstClaude);
      near(column.width, 760, 'column width');
      near(column.x, panelBox.x + 24 + (panelBox.width - 48 - 760) / 2, 'column centred in the panel');

      // the user bubble: right, --primary, radius 20 20 4 20, padding 12 16, at most 80 % of the column plus padding
      const bubble = article(page, 'Utente');
      const bubbleBox = await box(bubble);
      near(bubbleBox.y, panelBox.y + 28, 'first entry 28 px under the panel top');
      near(bubbleBox.x + bubbleBox.width, column.x + column.width, 'bubble on the right of the column');
      expect(bubbleBox.width).toBeLessThanOrEqual(760 * 0.8 + 32 + TOLERANCE);
      expect.soft(await styles(bubble, [
        'background-color', 'color', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
        'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      ])).toEqual({
        'background-color': await colour('--primary'), color: await colour('--on-primary'),
        'border-top-left-radius': '20px', 'border-top-right-radius': '20px', 'border-bottom-right-radius': '4px', 'border-bottom-left-radius': '20px',
        'padding-top': '12px', 'padding-right': '16px', 'padding-bottom': '12px', 'padding-left': '16px',
      });
      const bubbleText = bubble.getByText('i test della schermata di checkout falliscono su Android, puoi capire perché?', { exact: true });
      expect.soft(await styles(bubbleText, ['font-size', 'line-height', 'letter-spacing'])).toEqual({ 'font-size': '16px', 'line-height': '24px', 'letter-spacing': '0.5px' });
      const time = bubble.getByText('20:45', { exact: true });
      expect.soft(await styles(time, ['font-size', 'line-height', 'letter-spacing', 'opacity', 'text-align'])).toEqual({
        'font-size': '12px', 'line-height': '16px', 'letter-spacing': '0.4px', opacity: '0.8', 'text-align': 'right',
      });
      const timeBox = await box(time);
      const textBox = await box(bubbleText);
      near(timeBox.y, textBox.y + textBox.height + 4, 'time 4 px under the text');
      near(timeBox.x + timeBox.width, bubbleBox.x + bubbleBox.width - 16, 'time aligned right');
      near(bubbleBox.y + bubbleBox.height, timeBox.y + timeBox.height + 12, 'bubble bottom padding');

      // Claude messages: the 28 px ember spark, then the .body-l text 12 px after it and 2 px lower
      for (const message of await article(page, 'Claude').all()) {
        const messageBox = await box(message);
        near(messageBox.x, column.x, 'Claude message on the left of the column');
        near(messageBox.width, 760, 'Claude message across the column');
        const spark = message.locator('svg');
        await expect(spark).toHaveCount(1);
        await expect(spark).toHaveClass(/\bspark\b/);
        const sparkBox = await box(spark);
        near(sparkBox.width, 28, 'spark width');
        near(sparkBox.height, 28, 'spark height');
        near(sparkBox.x, messageBox.x, 'spark left');
        near(sparkBox.y, messageBox.y, 'spark at the top');
        expect.soft(await styles(spark, ['fill'])).toEqual({ fill: await colour('--ember') });
        const text = spark.locator('xpath=following-sibling::*[1]');
        const textContent = await contentBox(text);
        near(textContent.x, sparkBox.x + 28 + 12, 'gap spark to text');
        near(textContent.y, messageBox.y + 2, 'text 2 px lower');
        expect.soft(await styles(text, ['font-size', 'line-height', 'letter-spacing', 'color'])).toEqual({
          'font-size': '16px', 'line-height': '24px', 'letter-spacing': '0.5px', color: await colour('--on-surface'),
        });
      }

      // inline code: a mono chip without the backticks
      const withCode = article(page, 'Claude').nth(1);
      await expect(withCode).toHaveText('Il formato valuta usa la locale del device invece di it-IT. Correggo formatPrice.');
      const code = withCode.getByText('formatPrice', { exact: true });
      expect.soft(await styles(code, [
        'font-family', 'font-size', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-top-left-radius', 'background-color',
      ])).toEqual({
        'font-family': monoFont, 'font-size': '14px', 'padding-top': '1px', 'padding-right': '6px', 'padding-bottom': '1px', 'padding-left': '6px',
        'border-top-left-radius': '6px', 'background-color': await colour('--sc-high'),
      });

      // tool cards: 40 px in, radius 16, --sc-lowest, 1 px --outline-variant border; the row is one 44 px button
      const cards = [bashCards.nth(0), article(page, 'Strumento: Edit'), bashCards.nth(1)];
      for (const card of cards) {
        const cardBox = await box(card);
        near(cardBox.x, column.x + 40, 'card 40 px from the left');
        near(cardBox.width, 720, 'card width');
        expect.soft(await styles(card, ['border-top-left-radius', 'border-bottom-right-radius', 'background-color', 'border-top-width', 'border-top-style', 'border-top-color'])).toEqual({
          'border-top-left-radius': '16px', 'border-bottom-right-radius': '16px', 'background-color': await colour('--sc-lowest'),
          'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': outlineVariant,
        });
        const row = toggle(card);
        const rowBox = await box(row);
        near(rowBox.x, cardBox.x + 1, 'row inside the border');
        near(rowBox.width, cardBox.width - 2, 'row width');
        near(rowBox.y, cardBox.y + 1, 'row top');
        near(rowBox.height, 44, 'row height (24 px chip plus padding)');
        expect.soft(await styles(row, ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'column-gap', 'background-color'])).toEqual({
          'padding-top': '10px', 'padding-right': '12px', 'padding-bottom': '10px', 'padding-left': '16px', 'column-gap': '12px', 'background-color': 'rgba(0, 0, 0, 0)',
        });
        const icons = row.locator('svg');
        const toolIcon = icons.first();
        const toolIconBox = await box(toolIcon);
        near(toolIconBox.x, rowBox.x + 16, 'tool icon left');
        near(toolIconBox.width, 20, 'tool icon width');
        expect.soft(await styles(toolIcon, ['color'])).toEqual({ color: await colour('--on-surface-variant') });
        const chevronBox = await box(icons.last());
        near(chevronBox.x + chevronBox.width, rowBox.x + rowBox.width - 12, 'chevron at the right');
      }

      // the open Bash card: terminal icon, name, mono summary, red "Fallito", chevron down, then the mono output
      const open = cards[0]!;
      const openRow = toggle(open);
      await expect(openRow).toHaveAttribute('aria-expanded', 'true');
      expect.soft(await paths(openRow.locator('svg').first())).toEqual(TERMINAL);
      expect.soft(await paths(openRow.locator('svg').last())).toEqual(CHEVRON_DOWN);
      const name = openRow.getByText('Bash', { exact: true });
      expect.soft(await styles(name, ['font-size', 'line-height', 'font-weight', 'letter-spacing', 'color'])).toEqual({
        'font-size': '14px', 'line-height': '20px', 'font-weight': '500', 'letter-spacing': '0.1px', color: await colour('--on-surface'),
      });
      near((await box(name)).x, (await box(openRow.locator('svg').first())).x + 20 + 12, 'gap icon to name');
      const summary = openRow.getByText(CHECKOUT, { exact: true });
      await expect(summary).toHaveAttribute('title', CHECKOUT);
      expect.soft(await styles(summary, ['font-family', 'font-size', 'line-height', 'letter-spacing', 'color', 'white-space', 'text-overflow', 'overflow-x'])).toEqual({
        'font-family': monoFont, 'font-size': '14px', 'line-height': '20px', 'letter-spacing': '0.25px', color: await colour('--on-surface-variant'),
        'white-space': 'nowrap', 'text-overflow': 'ellipsis', 'overflow-x': 'hidden',
      });
      const failed = openRow.getByText('Fallito', { exact: true });
      const chipStyle = ['height', 'border-top-left-radius', 'padding-left', 'padding-right', 'column-gap', 'font-size', 'line-height', 'font-weight', 'letter-spacing', 'background-color', 'color'];
      const chipLook = { height: '24px', 'border-top-left-radius': '8px', 'padding-left': '8px', 'padding-right': '10px', 'column-gap': '6px', 'font-size': '12px', 'line-height': '16px', 'font-weight': '500', 'letter-spacing': '0.5px' };
      expect.soft(await styles(failed, chipStyle)).toEqual({ ...chipLook, 'background-color': await colour('--error-container'), color: await colour('--on-error-container') });
      expect.soft(await paths(failed.locator('svg'))).toEqual(CIRCLE_X);
      near((await box(failed.locator('svg'))).width, 16, 'chip icon width');
      const failedBox = await box(failed);
      near(failedBox.x + failedBox.width, (await box(openRow.locator('svg').last())).x - 12, 'chip right before the chevron');
      const summaryBox = await box(summary);
      near(summaryBox.x + summaryBox.width, failedBox.x - 12, 'summary fills the row up to the chip');

      const output = open.locator('pre');
      await expect(output).toHaveText(FAIL_OUTPUT);
      const outputBox = await box(output);
      const openRowBox = await box(openRow);
      near(outputBox.y, openRowBox.y + openRowBox.height, 'output under the row');
      near(outputBox.x, openRowBox.x, 'output left');
      near(outputBox.width, openRowBox.width, 'output width');
      near((await box(open)).y + (await box(open)).height, outputBox.y + outputBox.height + 1, 'card ends with the output');
      expect.soft(await styles(output, [
        'font-family', 'font-size', 'line-height', 'letter-spacing', 'background-color', 'color', 'white-space', 'margin-top',
        'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-top-width', 'border-top-style', 'border-top-color',
      ])).toEqual({
        'font-family': monoFont, 'font-size': '12px', 'line-height': '16px', 'letter-spacing': '0.4px', 'background-color': await colour('--sc'), color: await colour('--on-surface'),
        'white-space': 'pre-wrap', 'margin-top': '0px', 'padding-top': '12px', 'padding-right': '16px', 'padding-bottom': '14px', 'padding-left': '48px',
        'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': outlineVariant,
      });

      // the closed cards: pencil for Edit, terminal for Bash, green "Fatto", chevron right, nothing below the row
      for (const [card, icon] of [[cards[1]!, PENCIL], [cards[2]!, TERMINAL]] as const) {
        const row = toggle(card);
        await expect(row).toHaveAttribute('aria-expanded', 'false');
        await expect(card.locator('pre')).toHaveCount(0);
        near((await box(card)).height, 46, 'closed card height');
        expect.soft(await paths(row.locator('svg').first())).toEqual(icon);
        expect.soft(await paths(row.locator('svg').last())).toEqual(CHEVRON_RIGHT);
        const done = row.getByText('Fatto', { exact: true });
        expect.soft(await styles(done, chipStyle)).toEqual({ ...chipLook, 'background-color': await colour('--ok-container'), color: await colour('--on-ok-container') });
        expect.soft(await paths(done.locator('svg'))).toEqual(CHECK);
      }

      // entries 16 px apart, two cards in a row 6 px apart
      const entries = await articles(page).all();
      const gaps: number[] = [];
      for (let i = 1; i < entries.length; i += 1) {
        const before = await box(entries[i - 1]!);
        gaps.push(Math.round((await box(entries[i]!)).y - (before.y + before.height)));
      }
      expect(gaps).toEqual([16, 16, 16, 16, 6, 16]);
      expect(requested).toEqual([]);

      // a click on a closed card opens it and shows its full input and output in mono
      await toggle(cards[1]!).click();
      await expect(toggle(cards[1]!)).toHaveAttribute('aria-expanded', 'true');
      await expect(cards[1]!.locator('pre')).toHaveText(`${EDIT_INPUT}\n\n${EDIT_OUTPUT}`);
      expect.soft(await paths(toggle(cards[1]!).locator('svg').last())).toEqual(CHEVRON_DOWN);
      expect.soft(await styles(cards[1]!.locator('pre'), ['font-family'])).toEqual({ 'font-family': monoFont });
    });
  });
}

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-39, REQ-40: one card per call and result, its icon, its outcome and its content
test('a call and its result form one card with the tool icon and its outcome; opening it loads the full input and output once', async ({ page }) => {
  const folder = await newFolder('schede');
  const connection = await showSessions(page, [externalEntry('cards-1', folder, 'Schede degli strumenti')]);
  const input = JSON.stringify({ command: 'npm run build', description: 'Compila' }, null, 2);
  const longSummary = `TODO ${'cerca in tutti i file del progetto '.repeat(3)}`.trim();
  const requested = await serveItems(page, { 10: input, 20: lines(9), 30: lines(7, 'glob') }, 600);
  await page.goto('/');
  await entry(page, folder).click();
  const socket = await connection();
  send(socket, [
    call('r1', 'Read', '/src/app.ts', ref(1)),
    call('b1', 'Bash', 'npm run build', { moreInput: true, ...ref(10) }),
    call('w1', 'Write', '/src/new.ts', ref(2)),
    call('m1', 'MultiEdit', '/src/a.ts', ref(3)),
    call('n1', 'NotebookEdit', '/nb.ipynb', ref(4)),
    call('g1', 'Grep', longSummary, ref(5)),
    result('r1', 'export const app = 1;', ref(6)),
    result('missing', 'senza chiamata', ref(7)),
  ]);

  await expect(articles(page)).toHaveCount(7);
  const names = ['Read', 'Bash', 'Write', 'MultiEdit', 'NotebookEdit', 'Grep', 'Risultato'];
  for (const [index, name] of names.entries()) await expect(articles(page).nth(index)).toHaveAccessibleName(`Strumento: ${name}`);
  const card = (name: string) => article(page, `Strumento: ${name}`);
  const toolIcon = (name: string) => paths(toggle(card(name)).locator('svg').first());

  // icons: Bash → terminal, the editing tools → pencil, any other tool and an orphan result → wrench
  expect(await toolIcon('Bash')).toEqual(TERMINAL);
  for (const name of ['Write', 'MultiEdit', 'NotebookEdit']) expect(await toolIcon(name)).toEqual(PENCIL);
  const wrench = await toolIcon('Read');
  expect(wrench).not.toEqual(TERMINAL);
  expect(wrench).not.toEqual(PENCIL);
  expect(await toolIcon('Grep')).toEqual(wrench);
  expect(await toolIcon('Risultato')).toEqual(wrench);

  // outcome: "Fatto" once the result arrived, no chip before
  await expect(toggle(card('Read'))).toContainText('Fatto');
  for (const name of ['Bash', 'Write', 'MultiEdit', 'NotebookEdit', 'Grep']) {
    await expect(toggle(card(name))).not.toContainText(/Fatto|Fallito/);
    await expect(toggle(card(name)).locator('svg')).toHaveCount(2);
  }
  await expect(card('Risultato')).toContainText('Risultato');

  // all closed; the summary stays on one line, cut, with the full text as tooltip
  for (const article of await articles(page).all()) {
    await expect(toggle(article)).toHaveAttribute('aria-expanded', 'false');
    await expect(article.locator('pre')).toHaveCount(0);
  }
  const grepSummary = toggle(card('Grep')).getByText(longSummary, { exact: true });
  await expect(grepSummary).toHaveAttribute('title', longSummary);
  near((await box(grepSummary)).height, 20, 'summary on one line');
  expect(await grepSummary.evaluate((el) => el.scrollWidth > el.clientWidth), 'summary cut').toBe(true);

  // opening a call with more input loads the input only: there is no result yet
  await toggle(card('Bash')).click();
  await expect(toggle(card('Bash'))).toHaveAttribute('aria-expanded', 'true');
  await expect(card('Bash').getByRole('status').filter({ hasText: 'Caricamento…' })).toBeVisible();
  await expect(card('Bash').locator('pre')).toHaveText(input);
  await expect(card('Bash').getByRole('status')).toHaveCount(0);
  expect(requested).toEqual([10]);
  await toggle(card('Bash')).click();
  await expect(card('Bash').locator('pre')).toHaveCount(0);

  // a cut, failed result joins the card in a later frame: still one card, now red "Fallito"
  send(socket, [result('b1', lines(5), { truncated: true, isError: true, ...ref(20) })]);
  await expect(toggle(card('Bash'))).toContainText('Fallito');
  await expect(articles(page)).toHaveCount(7);
  expect.soft(await paths(toggle(card('Bash')).getByText('Fallito', { exact: true }).locator('svg'))).toEqual(CIRCLE_X);
  expect(requested).toEqual([10]);

  // opening it loads only the full output; the cut text and "…" show until then
  await toggle(card('Bash')).click();
  await expect(card('Bash').locator('pre')).toHaveText(`${input}\n\n${lines(5)}\n…`);
  await expect(card('Bash').getByRole('status').filter({ hasText: 'Caricamento…' })).toBeVisible();
  await expect(card('Bash').locator('pre')).toHaveText(`${input}\n\n${lines(9)}`);
  expect(requested).toEqual([10, 20]);

  // later opens reuse the loaded parts
  await toggle(card('Bash')).click();
  await toggle(card('Bash')).click();
  await expect(card('Bash').locator('pre')).toHaveText(`${input}\n\n${lines(9)}`);
  expect(requested).toEqual([10, 20]);

  // a short result needs no request; a card with nothing to show has no block
  await toggle(card('Read')).click();
  await expect(card('Read').locator('pre')).toHaveText('export const app = 1;');
  await toggle(card('Write')).click();
  await expect(toggle(card('Write'))).toHaveAttribute('aria-expanded', 'true');
  await expect(card('Write').locator('pre')).toHaveCount(0);
  await toggle(card('Risultato')).click();
  await expect(card('Risultato').locator('pre')).toHaveText('senza chiamata');
  expect(requested).toEqual([10, 20]);

  // a card that is open when its cut result arrives loads the full output at once
  send(socket, [call('gl1', 'Glob', '**/*.ts', ref(8))]);
  await expect(articles(page)).toHaveCount(8);
  await toggle(card('Glob')).click();
  await expect(card('Glob').locator('pre')).toHaveCount(0);
  send(socket, [result('gl1', lines(5, 'glob'), { truncated: true, ...ref(30) })]);
  await expect(card('Glob').locator('pre')).toHaveText(lines(7, 'glob'));
  await expect(toggle(card('Glob'))).toContainText('Fatto');
  expect(requested).toEqual([10, 20, 30]);
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-36, REQ-37, REQ-38: the time of earlier days, line breaks and inline code
test.describe('message details', () => {
  test.use({ timezoneId: 'UTC' });

  test('user bubbles show the date on earlier days and no time without one; Claude text keeps its lines and shows inline code as chips', async ({ page }) => {
    const folder = await newFolder('messaggi');
    const connection = await showSessions(page, [externalEntry('messages-1', folder, 'Messaggi')]);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const [year, month, day] = yesterday.split('-');
    await page.goto('/');
    await entry(page, folder).click();
    send(await connection(), [
      user('Messaggio di ieri', { timestamp: `${yesterday}T08:05:00.000Z` }),
      user('Senza orario'),
      user('Orario non valido', { timestamp: 'ieri' }),
      user('riga uno\nriga due', { timestamp: todayAt('09:30') }),
      claude('Usa `npm ci` e poi `npm test`.\nSeconda riga.'),
      claude('Un apice `aperto\nchiuso` su due righe'),
    ]);

    const bubbles = article(page, 'Utente');
    await expect(bubbles).toHaveCount(4);
    await expect(bubbles.nth(0)).toContainText(`${day}/${month}/${year} 08:05`);
    for (const index of [1, 2]) await expect(bubbles.nth(index)).not.toContainText(/\d\d:\d\d/);
    expect((await bubbles.nth(1).innerText()).trim()).toBe('Senza orario');
    expect((await bubbles.nth(2).innerText()).trim()).toBe('Orario non valido');
    expect((await bubbles.nth(3).innerText()).replace(/\s*09:30$/, '')).toBe('riga uno\nriga due');

    const messages = article(page, 'Claude');
    await expect(messages.nth(0).locator('code')).toHaveText(['npm ci', 'npm test']);
    expect((await messages.nth(0).innerText()).trim()).toBe('Usa npm ci e poi npm test.\nSeconda riga.');
    await expect(messages.nth(1).locator('code')).toHaveCount(0);
    expect((await messages.nth(1).innerText()).trim()).toBe('Un apice `aperto\nchiuso` su due righe');
  });
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-41, REQ-42, REQ-43 — scenario "The user jumps to new messages"
test('new items while the user reads earlier content show "N nuovi messaggi" at the bottom centre; a click scrolls to the end', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const folder = await newFolder('nuovi');
  const connection = await showSessions(page, [externalEntry('new-1', folder, 'Nuovi messaggi')]);
  await page.goto('/');
  await entry(page, folder).click();
  const socket = await connection();
  send(socket, Array.from({ length: 20 }, (_, i) => [user(`Domanda ${i + 1}`), claude(`Risposta ${i + 1}\n${lines(3, 'dettaglio')}`)]).flat());
  await expect(articles(page)).toHaveCount(40);
  await expect(articles(page).last()).toBeInViewport();
  expect(await atEnd(page)).toBe(true);

  // the content ends 80 px above the panel bottom
  const panelBox = await box(panel(page));
  const lastBox = await box(articles(page).last());
  near(lastBox.y + lastBox.height, panelBox.y + panelBox.height - 80, 'last entry 80 px above the panel bottom');

  // scrolled up: two new messages do not move the view and show "2 nuovi messaggi"
  await scrollTo(page, 'top');
  send(socket, [claude('Nuovo uno'), user('Nuovo due')]);
  await expect(articles(page)).toHaveCount(42);
  const button = newMessages(page);
  await expect(button).toHaveText('2 nuovi messaggi');
  expect(await scroller(page).evaluate((el) => el.scrollTop)).toBe(0);
  await expect(articles(page).last()).not.toBeInViewport();

  // the board button: tonal .btn with the arrow-down icon, centred, 20 px from the panel bottom
  const colour = (token: string) => computed(page, 'color', `var(${token})`);
  const buttonBox = await box(button);
  near(buttonBox.x + buttonBox.width / 2, panelBox.x + panelBox.width / 2, 'button centred in the panel');
  near(buttonBox.y + buttonBox.height, panelBox.y + panelBox.height - 20, 'button 20 px from the panel bottom');
  near(buttonBox.height, 40, 'button height');
  expect.soft(await styles(button, [
    'background-color', 'color', 'border-top-width', 'border-top-left-radius', 'padding-left', 'padding-right', 'column-gap',
    'font-size', 'line-height', 'font-weight', 'letter-spacing',
  ])).toEqual({
    'background-color': await colour('--primary-container'), color: await colour('--on-primary-container'), 'border-top-width': '0px', 'border-top-left-radius': '20px',
    'padding-left': '16px', 'padding-right': '20px', 'column-gap': '8px', 'font-size': '14px', 'line-height': '20px', 'font-weight': '500', 'letter-spacing': '0.1px',
  });
  expect.soft(await styles(button, ['box-shadow'])).not.toEqual({ 'box-shadow': 'none' });
  expect.soft(await paths(button.locator('svg'))).toEqual(ARROW_DOWN);
  near((await box(button.locator('svg'))).width, 20, 'button icon width');

  // the button and the panel float: scrolling the content moves neither
  await scrollTo(page, 300);
  expect(await box(button)).toEqual(buttonBox);
  expect(await box(panel(page))).toEqual(panelBox);
  await scrollTo(page, 'top');

  // a tool card counts as one; its result joining it adds nothing
  send(socket, [call('c9', 'Bash', 'npm test', ref(1))]);
  await expect(button).toHaveText('3 nuovi messaggi');
  send(socket, [result('c9', 'ok', ref(2))]);
  await expect(toggle(article(page, 'Strumento: Bash'))).toContainText('Fatto');
  await expect(button).toHaveText('3 nuovi messaggi');
  await expect(articles(page)).toHaveCount(43);

  // the click scrolls to the end and hides the button
  await button.click();
  await expect(button).toHaveCount(0);
  await expect(article(page, 'Strumento: Bash')).toBeInViewport();
  await expect.poll(() => atEnd(page)).toBe(true);

  // at the end, new content follows and shows no button
  send(socket, [claude('In fondo')]);
  await expect(articles(page).last()).toContainText('In fondo');
  await expect(articles(page).last()).toBeInViewport();
  await expect(button).toHaveCount(0);
  await expect.poll(() => atEnd(page)).toBe(true);

  // one new message: singular text; scrolling to the end hides the button and resets N
  await scrollTo(page, 'top');
  send(socket, [claude('Un altro')]);
  await expect(button).toHaveText('1 nuovo messaggio');
  await scrollTo(page, 'end');
  await expect(button).toHaveCount(0);
  await scrollTo(page, 'top');
  send(socket, [claude('Ancora uno')]);
  await expect(button).toHaveText('1 nuovo messaggio');
});

async function startViaApi(request: APIRequestContext, folder: string): Promise<string> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  return id;
}

// AppLayout "Shows" (gatekeeper decision): with an external session open, the snackbar floats at the bottom right of the main area
test('with an external session open, the needs-input snackbar floats at the bottom right of the main area', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const folder = await newFolder('esterna-aperta');
  const connection = await showSessions(page, [externalEntry('snackbar-1', folder, 'Esterna aperta')]);
  const waitingId = await startViaApi(request, await newFolder('attende-input'));
  await page.goto('/');
  await entry(page, folder).click();
  send(await connection(), [user('Ciao'), claude('Ciao a te.')]);
  await expect(articles(page)).toHaveCount(2);

  const response = await request.post(`/api/sessions/${waitingId}/hook-events`, { data: { hook_event_name: 'PermissionRequest', tool_name: 'Bash' } });
  expect(response.status()).toBe(204);
  await expect(snackbar(page)).toHaveText(/attende-input richiede il tuo input/);

  const main = await box(mainArea(page));
  const bar = await box(snackbar(page));
  near(main.x + main.width - (bar.x + bar.width), 24, 'gap to the right edge of the main area');
  near(main.y + main.height - (bar.y + bar.height), 16, 'gap to the bottom edge of the main area');
  await expect(view(page)).toBeVisible();
});
