// e2e of plan-claude_sessions_client-ui_redesign-material3_mock, batch external-session, brought to the Studio conversation of
// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark.
// The external entries and their conversation sockets are mocked, so each test controls the items and when they arrive.
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, type WebSocketRoute, expect, test } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };
type Item = Record<string, unknown>;

// Rounding of fractional layout sizes.
const TOLERANCE = 1;
const CONVERSATION = /\/api\/external-sessions\/[^/]+\/conversation$/;
const isItemRequest = (url: URL) => /\/api\/external-sessions\/[^/]+\/items$/.test(url.pathname);

// Lucide paths of the icons this view draws.
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

/** A sample conversation: a user question, Claude replies and three tool cards. */
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

test.describe('Studio layout', () => {
  test.use({ viewport: { width: 1440, height: 900 }, timezoneId: 'UTC' });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-22, REQ-36, REQ-37, REQ-39, REQ-53, ConversationView "Description" — scenario "The external session shows messages and tool cards in the Studio style"
  test('at 1440 x 900 the subbar is 40 px, and the entries sit in a centred column of at most 896 px, 16 px apart, with the tool cards under the text', async ({ page }) => {
    const folder = path.join(projectsRoot, 'board', 'mobile-app');
    const connection = await showSessions(page, [externalEntry('board-mobile-app', folder, 'i test del checkout falliscono su Android', 'working')]);
    await serveItems(page, { 300: EDIT_INPUT, 400: EDIT_OUTPUT });
    await page.goto('/');
    await entry(page, folder).click();
    send(await connection(), boardItems());
    await expect(articles(page)).toHaveCount(7);
    await page.mouse.move(0, 0);

    const mainBox = await box(mainArea(page));
    near(mainBox.x, 52 + 224, 'main left');
    near(mainBox.width, 1440 - 52 - 224, 'main width');

    // the subbar: across the main area, 40 px high, the "Riprendi qui" button at its right
    const headBox = await box(header(page));
    near(headBox.x, mainBox.x, 'header left');
    near(headBox.y, mainBox.y, 'header top');
    near(headBox.width, mainBox.width, 'header width');
    near(headBox.height, 40, 'header height');
    const resume = header(page).getByRole('button', { name: 'Riprendi qui', exact: true });
    const resumeBox = await box(resume);
    near(resumeBox.height, 32, '"Riprendi qui" height');
    expect.soft(await paths(resume.locator('svg'))).toEqual(LOG_IN);
    near((await box(resume.locator('svg'))).width, 14, '"Riprendi qui" icon width');
    const lock = header(page).getByText('Sola lettura', { exact: true }).locator('svg');
    expect.soft(await paths(lock)).toEqual(LOCK);
    near((await box(lock)).width, 12, 'lock icon width');
    expect(resumeBox.x + resumeBox.width).toBeLessThanOrEqual(headBox.x + headBox.width);
    await expect(header(page).locator('.avatar')).toHaveCount(0);

    // no rounded panel: the content scrolls on the canvas at 75 %, over the dot grid
    const area = await box(scroller(page));
    expect.soft(await styles(scroller(page), ['border-top-left-radius'])).toEqual({ 'border-top-left-radius': '0px' });

    // the centred column: at most 896 px, inside 24 px of padding, entries 16 px apart
    const first = await box(articles(page).first());
    const second = await box(articles(page).nth(1));
    expect(first.width).toBeLessThanOrEqual(896 + TOLERANCE);
    near(first.x + first.width / 2, area.x + area.width / 2, 'column centred in the content area');
    near(first.y, area.y + 24, 'first entry 24 px under the top');
    near(second.y, first.y + first.height + 16, 'entries 16 px apart');

    // messages on the left with their 24 px avatar; the tool card lines up with the message text (36 px in)
    const userBox = await box(article(page, 'Utente'));
    const claudeBox = await box(article(page, 'Claude').first());
    near(userBox.x, claudeBox.x, 'user and Claude messages both on the left');
    const card = await box(article(page, 'Strumento: Edit'));
    near(card.x, claudeBox.x + 36, 'tool card 36 px from the left of the column');
    const cards = article(page, 'Strumento: Bash');
    const bashFirst = await box(cards.first());
    const editBox = await box(article(page, 'Strumento: Edit'));
    expect(editBox.y).toBeGreaterThan(bashFirst.y);
  });
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-40, plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-39: one card per call and result, no icon, its outcome and its content
test('a call and its result form one card with its name chip and outcome, and no icon; opening it loads the full input and output once', async ({ page }) => {
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
  // no tool icon: the name chip identifies the tool
  for (const name of names) await expect(toggle(card(name)).locator('svg'), name).toHaveCount(0);
  for (const name of names) await expect(toggle(card(name)).getByText(name, { exact: true })).toBeVisible();

  // outcome: "Fatto ▾" once the result arrived, "▾" alone before
  await expect(toggle(card('Read'))).toContainText('Fatto ▾');
  for (const name of ['Bash', 'Write', 'MultiEdit', 'NotebookEdit', 'Grep']) {
    await expect(toggle(card(name))).not.toContainText(/Fatto|Fallito/);
    await expect(toggle(card(name))).toContainText('▾');
  }
  await expect(card('Risultato')).toContainText('Risultato');

  // all closed; the summary stays on one line, cut, with the full text as tooltip
  for (const article of await articles(page).all()) {
    await expect(toggle(article)).toHaveAttribute('aria-expanded', 'false');
    await expect(article.locator('pre')).toHaveCount(0);
  }
  const grepSummary = toggle(card('Grep')).getByText(longSummary, { exact: true });
  await expect(grepSummary).toHaveAttribute('title', longSummary);
  expect(await grepSummary.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap');
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
  await expect(toggle(card('Bash'))).toContainText('Fallito ▾');
  await expect(articles(page)).toHaveCount(7);
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

    // The text of a message, without its avatar ("T" or "✦") and its name line ("Tu" or "Claude", then the time).
    const textOf = async (message: Locator) =>
      (await message.innerText())
        .trim()
        .replace(/^(?:T|✦)\s*/, '')
        .replace(/^(?:Tu|Claude)\s*(?:(?:\d\d\/\d\d\/\d{4} )?\d\d:\d\d)?\s*/, '');
    const bubbles = article(page, 'Utente');
    await expect(bubbles).toHaveCount(4);
    await expect(bubbles.nth(0)).toContainText(`${day}/${month}/${year} 08:05`);
    for (const index of [1, 2]) await expect(bubbles.nth(index)).not.toContainText(/\d\d:\d\d/);
    expect(await textOf(bubbles.nth(1))).toBe('Senza orario');
    expect(await textOf(bubbles.nth(2))).toBe('Orario non valido');
    expect(await textOf(bubbles.nth(3))).toBe('riga uno\nriga due');
    // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-36: the time sits on the name line, before the text
    const timeBox = await box(bubbles.nth(3).getByText('09:30', { exact: true }));
    const textBox = await box(bubbles.nth(3).getByText(/riga uno/));
    expect(timeBox.y + timeBox.height).toBeLessThanOrEqual(textBox.y + TOLERANCE);

    const messages = article(page, 'Claude');
    await expect(messages.nth(0).locator('code')).toHaveText(['npm ci', 'npm test']);
    expect(await textOf(messages.nth(0))).toBe('Usa npm ci e poi npm test.\nSeconda riga.');
    await expect(messages.nth(1).locator('code')).toHaveCount(0);
    expect(await textOf(messages.nth(1))).toBe('Un apice `aperto\nchiuso` su due righe');
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

  // the content ends inside the 24 px padding of the column
  const panelBox = await box(scroller(page));
  const lastBox = await box(articles(page).last());
  near(lastBox.y + lastBox.height, panelBox.y + panelBox.height - 24, 'last entry 24 px above the content bottom');

  // scrolled up: two new messages do not move the view and show "2 nuovi messaggi"
  await scrollTo(page, 'top');
  send(socket, [claude('Nuovo uno'), user('Nuovo due')]);
  await expect(articles(page)).toHaveCount(42);
  const button = newMessages(page);
  await expect(button).toHaveText('2 nuovi messaggi');
  expect(await scroller(page).evaluate((el) => el.scrollTop)).toBe(0);
  await expect(articles(page).last()).not.toBeInViewport();

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-41: the glass button with the arrow-down icon, centred, 20 px from the bottom
  const buttonBox = await box(button);
  near(buttonBox.x + buttonBox.width / 2, panelBox.x + panelBox.width / 2, 'button centred in the content area');
  near(buttonBox.y + buttonBox.height, panelBox.y + panelBox.height - 20, 'button 20 px from the content bottom');
  expect.soft(await styles(button, ['background-color', 'border-top-left-radius', 'padding-top', 'padding-left', 'font-size'])).toEqual({
    'background-color': await computed(page, 'color', 'var(--bg-glass)'), 'border-top-left-radius': '8px', 'padding-top': '8px', 'padding-left': '14px', 'font-size': '12px',
  });
  expect.soft(await paths(button.locator('svg'))).toEqual(ARROW_DOWN);
  near((await box(button.locator('svg'))).width, 14, 'button icon width');

  // the button and the panel float: scrolling the content moves neither
  await scrollTo(page, 300);
  expect(await box(button)).toEqual(buttonBox);
  expect(await box(scroller(page))).toEqual(panelBox);
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

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-42: with an external session open, the snackbar sits at the bottom right of the window
test('with an external session open, the needs-input snackbar sits 20 px from the bottom right of the window', async ({ page, request }) => {
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

  const bar = await box(snackbar(page));
  near(1440 - (bar.x + bar.width), 20, 'gap to the right edge of the window');
  near(900 - (bar.y + bar.height), 20, 'gap to the bottom edge of the window');
  await expect(view(page)).toBeVisible();
});
