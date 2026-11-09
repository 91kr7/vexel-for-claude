// e2e of plan-claude_sessions_client, batch backend-reconnection.
// The e2e server cannot restart under the page, so the tests simulate the backend going away and coming back:
// the list request and the events socket are mocked, and the session sockets are refused, closed or passed to the real server.
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, type WebSocketRoute, expect, test } from '@playwright/test';

type Item = Record<string, unknown>;
interface Summary {
  id: string;
  folder: string;
  label: string;
  state: 'working' | 'needs_input' | 'idle' | 'ended';
  lastActivity: string;
  external?: true;
}

const LOST_SERVER = 'Connection to the server lost. Reload the page.';
const LOST_SESSION = 'Connection to the session lost.';
const EVENTS = /\/api\/sessions\/events$/;
const ATTACH = /\/api\/sessions\/[^/]+\/attach$/;
const CONVERSATION = /\/api\/external-sessions\/[^/]+\/conversation$/;
// plan-claude_sessions_client/REQ-47
const RECOVERY_MS = 5000;

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-reconnection-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

test.afterAll(async () => {
  await rm(projectsRoot, { recursive: true, force: true });
});

const mainArea = (page: Page) => page.getByRole('main');
const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const listError = (page: Page) => list(page).getByRole('alert');
const sessionError = (page: Page) => mainArea(page).getByRole('alert');
const counter = (page: Page) => list(page).getByRole('status').filter({ hasText: /needs? input/ });
const header = (page: Page) => mainArea(page).locator('.session-header');
const terminal = (page: Page) => page.locator('.xterm-rows');
const view = (page: Page) => page.locator('.conversation-view');
const articles = (page: Page) => view(page).getByRole('article');
const scroller = (page: Page) => view(page).locator('.conversation-items');
const newMessages = (page: Page) => view(page).getByRole('button', { name: /^(?:1 new message|\d+ new messages)$/ });
const occurrences = async (page: Page, text: string) => ((await terminal(page).textContent()) ?? '').split(text).length - 1;

const summary = (id: string, state: Summary['state'] = 'idle', extra: Partial<Summary> = {}): Summary => ({
  id,
  folder: `/tmp/reconnection/${id}`,
  label: `Label ${id}`,
  state,
  lastActivity: new Date().toISOString(),
  ...extra,
});

const user = (text: string): Item => ({ kind: 'user', text });
const claude = (text: string): Item => ({ kind: 'assistant', text });
const send = (socket: WebSocketRoute, items: Item[]) => socket.send(JSON.stringify({ type: 'items', items }));

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

interface FakeBackend {
  /** The session list the next list request gets. */
  sessions: Summary[];
  /** Events sockets the page opened so far, failed attempts included. */
  connections(): number;
  /** The backend stops: open events sockets close, list requests and new sockets are refused. */
  stop(): Promise<void>;
  /** The backend is reachable again. */
  start(): void;
}

/** Mocks the session list and the events socket of the page. */
async function fakeBackend(page: Page, sessions: Summary[]): Promise<FakeBackend> {
  let reachable = true;
  let connections = 0;
  const open: WebSocketRoute[] = [];
  const backend: FakeBackend = {
    sessions,
    connections: () => connections,
    stop: async () => {
      reachable = false;
      for (const ws of open.splice(0)) await ws.close({ code: 1001, reason: 'server stopped' });
    },
    start: () => {
      reachable = true;
    },
  };
  await page.route(
    (url) => url.pathname === '/api/sessions',
    (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      if (!reachable) return route.abort('connectionrefused');
      return route.fulfill({ json: backend.sessions });
    },
  );
  await page.routeWebSocket(EVENTS, (ws) => {
    connections += 1;
    if (reachable) open.push(ws);
    else void ws.close({ code: 1011 });
  });
  return backend;
}

/** Records the session sockets: `mode` decides how each new one is answered. Returns the messages the page sent on each one. */
async function routeAttach(page: Page) {
  const state = {
    mode: 'server' as 'server' | 'refuse' | 4404 | 1000,
    sockets: [] as WebSocketRoute[],
    sent: [] as string[][],
  };
  await page.routeWebSocket(ATTACH, (ws) => {
    state.sockets.push(ws);
    const messages: string[] = [];
    state.sent.push(messages);
    if (state.mode === 'refuse') return void ws.close({ code: 1011 });
    if (state.mode !== 'server') return void ws.close({ code: state.mode });
    const server = ws.connectToServer();
    ws.onMessage((message) => {
      messages.push(String(message));
      server.send(message);
    });
  });
  return state;
}

async function markPage(page: Page): Promise<void> {
  await page.evaluate(() => ((window as unknown as { reconnectionMark?: number }).reconnectionMark = 1));
}

const pageWasNotReloaded = (page: Page) => page.evaluate(() => (window as unknown as { reconnectionMark?: number }).reconnectionMark === 1);

/** Waits for the list error to go, and returns how long it took. */
async function recoveryTime(page: Page): Promise<number> {
  const start = Date.now();
  await expect(listError(page)).toHaveCount(0, { timeout: RECOVERY_MS + 2000 });
  return Date.now() - start;
}

test.describe('session list', () => {
  // plan-claude_sessions_client/REQ-46, REQ-47, REQ-48
  test('keeps trying while the backend is away, then clears the error within 5 s and shows the data of the backend', async ({ page }) => {
    const backend = await fakeBackend(page, [summary('a'), summary('b', 'needs_input'), summary('e', 'working')]);
    await page.goto('/');
    await markPage(page);
    await expect(entry(page, '/tmp/reconnection/a')).toBeVisible();
    await expect(counter(page)).toHaveText('1 needs input');

    await backend.stop();
    await expect(listError(page)).toHaveText(LOST_SERVER);
    backend.sessions = [summary('b'), summary('c', 'needs_input'), summary('d', 'needs_input'), summary('e', 'ended')];
    await page.waitForTimeout(4500);
    expect(backend.connections(), 'new connection attempts while the backend is away').toBeGreaterThanOrEqual(3);
    await expect(listError(page)).toHaveText(LOST_SERVER);

    backend.start();

    expect(await recoveryTime(page)).toBeLessThan(RECOVERY_MS);
    await expect(entry(page, '/tmp/reconnection/a')).toHaveCount(0);
    for (const id of ['b', 'c', 'd', 'e']) await expect(entry(page, `/tmp/reconnection/${id}`)).toBeVisible();
    await expect(entry(page, '/tmp/reconnection/e')).toContainText('Ended');
    await expect(counter(page)).toHaveText('2 need input');
    expect(await pageWasNotReloaded(page), 'no reload of the page').toBe(true);
  });

  // plan-claude_sessions_client/REQ-46: a failed list load on reconnection is one more failed attempt
  test('keeps trying when the socket opens but the list does not load', async ({ page }) => {
    const backend = await fakeBackend(page, [summary('a')]);
    let failLoads = false;
    await page.route(
      (url) => url.pathname === '/api/sessions',
      (route) => (failLoads && route.request().method() === 'GET' ? route.fulfill({ status: 503, json: { error: 'unavailable' } }) : route.fallback()),
    );
    await page.goto('/');
    await expect(entry(page, '/tmp/reconnection/a')).toBeVisible();

    await backend.stop();
    backend.start();
    failLoads = true;
    await page.waitForTimeout(4500);
    await expect(listError(page)).toHaveText(LOST_SERVER);
    const attempts = backend.connections();
    expect(attempts).toBeGreaterThanOrEqual(3);

    failLoads = false;

    expect(await recoveryTime(page)).toBeLessThan(RECOVERY_MS);
    await expect(entry(page, '/tmp/reconnection/a')).toBeVisible();
  });

  // plan-claude_sessions_client/REQ-52
  test('shows the error at every disconnection and clears it at every return', async ({ page }) => {
    const backend = await fakeBackend(page, [summary('r0')]);
    await page.goto('/');
    await markPage(page);
    await expect(entry(page, '/tmp/reconnection/r0')).toBeVisible();

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      await backend.stop();
      await expect(listError(page)).toHaveText(LOST_SERVER);
      backend.sessions = [summary(`r${cycle}`)];
      await page.waitForTimeout(2500);
      backend.start();
      expect(await recoveryTime(page)).toBeLessThan(RECOVERY_MS);
      await expect(entry(page, `/tmp/reconnection/r${cycle}`)).toBeVisible();
      await expect(entry(page, `/tmp/reconnection/r${cycle - 1}`)).toHaveCount(0);
    }
    expect(await pageWasNotReloaded(page), 'no reload of the page').toBe(true);
  });
});

test.describe('open hosted session', () => {
  async function openHosted(page: Page, request: APIRequestContext, name: string) {
    const folder = await newFolder(name);
    const id = await startViaApi(request, folder);
    const backend = await fakeBackend(page, [summary(id, 'idle', { folder, label: name })]);
    const attach = await routeAttach(page);
    await page.goto('/');
    await entry(page, folder).click();
    await expect(terminal(page)).toContainText('READY');
    return { id, folder, backend, attach };
  }

  // plan-claude_sessions_client/REQ-49: a dropped connection to a running backend comes back, and input works again
  test('attaches again after a dropped connection: the error goes, the snapshot replaces the terminal, input reaches the session', async ({ page, request }) => {
    const { attach } = await openHosted(page, request, 'dropped');

    attach.mode = 'refuse';
    await attach.sockets[0]!.close({ code: 1011 });
    await expect(sessionError(page)).toHaveText(LOST_SESSION);
    await expect(terminal(page)).toContainText('[Session disconnected]');
    await page.waitForTimeout(4500);
    expect(attach.sockets.length, 'new attach attempts while the connection is refused').toBeGreaterThanOrEqual(3);
    await expect(sessionError(page)).toHaveText(LOST_SESSION);
    expect(await occurrences(page, '[Session disconnected]'), 'failed attempts add no line').toBe(1);

    attach.mode = 'server';
    const start = Date.now();
    await expect(sessionError(page)).toHaveCount(0, { timeout: RECOVERY_MS + 2000 });
    expect(Date.now() - start).toBeLessThan(RECOVERY_MS);

    await expect(terminal(page)).toContainText('READY');
    await expect(terminal(page)).not.toContainText('[Session disconnected]');
    expect(await occurrences(page, 'READY'), 'the snapshot replaces the terminal content').toBe(1);
    const sent = attach.sent.at(-1)!;
    await expect.poll(() => sent.some((message) => (JSON.parse(message) as { type?: string }).type === 'resize'), { message: 'resize on the new socket' }).toBe(true);

    await page.locator('.xterm-screen').click();
    await page.keyboard.type('ping after reconnect');
    await page.keyboard.press('Enter');
    await expect(terminal(page)).toContainText('LINE:ping after reconnect');
    expect(sent.some((message) => (JSON.parse(message) as { type?: string }).type === 'input'), 'input on the new socket').toBe(true);
  });

  // plan-claude_sessions_client/REQ-49, REQ-52: a connection restored once drops and comes back again
  test('a restored connection that drops again shows the error again and attaches again', async ({ page, request }) => {
    const { attach } = await openHosted(page, request, 'dropped-twice');

    for (let cycle = 1; cycle <= 2; cycle += 1) {
      attach.mode = 'refuse';
      await attach.sockets.at(-1)!.close({ code: 1001 });
      await expect(sessionError(page)).toHaveText(LOST_SESSION);
      await expect(terminal(page)).toContainText('[Session disconnected]');
      attach.mode = 'server';
      await expect(sessionError(page)).toHaveCount(0, { timeout: RECOVERY_MS + 2000 });
      await expect(terminal(page)).toContainText('READY');
    }
  });

  for (const code of [4404, 1000] as const) {
    // plan-claude_sessions_client/REQ-51, SessionView "Reconnection": an attempt closed with 4404 or 1000 ends the attempts, with no error message
    test(`an attempt closed with ${code} ends the attempts, with no error message and the terminal content kept`, async ({ page, request }) => {
      const { attach } = await openHosted(page, request, `attempt-${code}`);

      attach.mode = 'refuse';
      await attach.sockets[0]!.close({ code: 1011 });
      await expect(sessionError(page)).toHaveText(LOST_SESSION);
      attach.mode = code;

      await expect(sessionError(page)).toHaveCount(0, { timeout: RECOVERY_MS + 2000 });
      const attempts = attach.sockets.length;
      await page.waitForTimeout(4500);
      expect(attach.sockets.length, 'no attempt after it').toBe(attempts);
      await expect(sessionError(page)).toHaveCount(0);
      await expect(terminal(page)).toContainText('READY');
    });
  }

  // plan-claude_sessions_client/REQ-51: the open hosted session ended while the backend was away
  test('the open session that the new backend no longer lists stays on screen as "Ended", with no error', async ({ page, request }) => {
    const { folder, backend, attach } = await openHosted(page, request, 'ended-meanwhile');

    attach.mode = 'refuse';
    await backend.stop();
    await attach.sockets[0]!.close({ code: 1001 });
    await expect(listError(page)).toHaveText(LOST_SERVER);
    await expect(sessionError(page)).toHaveText(LOST_SESSION);
    backend.sessions = [];
    attach.mode = 4404;

    backend.start();

    expect(await recoveryTime(page)).toBeLessThan(RECOVERY_MS);
    await expect(sessionError(page)).toHaveCount(0);
    await expect(header(page)).toContainText('Ended');
    await expect(page.getByRole('region', { name: `Terminal: ${path.basename(folder)}` })).toBeVisible();
    await expect(terminal(page)).toContainText('READY');
    await expect(entry(page, folder)).toHaveCount(0);
  });
});

test.describe('open external session', () => {
  const external = summary('ext-reconnect', 'working', { folder: '/tmp/reconnection/external', label: 'External conversation', external: true });

  /** Mocks the conversation sockets: `mode` decides how each new one is answered; `serve` gets each served socket. */
  async function routeConversation(page: Page, serve: (ws: WebSocketRoute) => void) {
    const state = { mode: 'serve' as 'serve' | 'refuse' | 4404, sockets: [] as WebSocketRoute[] };
    await page.routeWebSocket(CONVERSATION, (ws) => {
      state.sockets.push(ws);
      if (state.mode === 'refuse') return void ws.close({ code: 1011 });
      if (state.mode === 4404) return void ws.close({ code: 4404 });
      serve(ws);
    });
    return state;
  }

  const history = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? user(`question ${i}\nwith a second line\nand a third`) : claude(`answer ${i}\nwith a second line\nand a third`)));

  // plan-claude_sessions_client/REQ-50
  test('opens a new socket after the drop: the conversation updates live again, with no entry twice and only new entries counted', async ({ page }) => {
    await fakeBackend(page, [external]);
    let frame: Item[] = history;
    const conversation = await routeConversation(page, (ws) => send(ws, frame));
    await page.goto('/');
    await entry(page, external.folder).click();
    await expect(articles(page)).toHaveCount(30);
    await scroller(page).evaluate((el) => (el.scrollTop = 0));

    conversation.mode = 'refuse';
    await conversation.sockets[0]!.close({ code: 1001 });
    await expect.poll(() => conversation.sockets.length, { message: 'attempts every 2 s', timeout: 6000 }).toBeGreaterThanOrEqual(3);
    await expect(view(page)).not.toContainText('Conversation not available.');
    await expect(view(page).getByRole('alert')).toHaveCount(0);
    await expect(articles(page)).toHaveCount(30);

    frame = [...history, user('typed while the backend was away'), claude('reply while the backend was away')];
    conversation.mode = 'serve';
    const start = Date.now();
    await expect(articles(page)).toHaveCount(32, { timeout: RECOVERY_MS + 2000 });
    expect(Date.now() - start).toBeLessThan(RECOVERY_MS);
    await expect(newMessages(page)).toHaveText('2 new messages');
    await expect(view(page).getByText('question 0', { exact: false })).toHaveCount(1);

    send(conversation.sockets.at(-1)!, [user('typed after the reconnection')]);
    await expect(articles(page)).toHaveCount(33);
    await expect(view(page).getByText('typed after the reconnection')).toHaveCount(1);
    await expect(newMessages(page)).toHaveText('3 new messages');
    await expect(view(page).getByRole('alert')).toHaveCount(0);
  });

  // plan-claude_sessions_client/REQ-50, REQ-51: an attempt closed with 4404 ends the attempts; the open session ended meanwhile shows as ended
  test('an attempt closed with 4404 ends the attempts; the items stay, and the session the new backend no longer lists shows "Ended"', async ({ page }) => {
    const backend = await fakeBackend(page, [external]);
    const conversation = await routeConversation(page, (ws) => send(ws, [user('first question'), claude('first answer')]));
    await page.goto('/');
    await entry(page, external.folder).click();
    await expect(articles(page)).toHaveCount(2);

    conversation.mode = 4404;
    await backend.stop();
    await conversation.sockets[0]!.close({ code: 1001 });
    await expect(listError(page)).toHaveText(LOST_SERVER);
    backend.sessions = [];
    backend.start();

    expect(await recoveryTime(page)).toBeLessThan(RECOVERY_MS);
    await expect.poll(() => conversation.sockets.length).toBe(2);
    await expect(header(page)).toContainText('Ended');
    await page.waitForTimeout(4500);
    expect(conversation.sockets.length, 'no attempt after the 4404').toBe(2);
    await expect(articles(page)).toHaveCount(2);
    await expect(view(page)).not.toContainText('Conversation not available.');
    await expect(view(page).getByRole('alert')).toHaveCount(0);
    await expect(entry(page, external.folder)).toHaveCount(0);
  });

  // ConversationView "Reconnection": a socket that closes before the first frame shows the error and is not tried again
  test('a socket that closes before the first frame shows "Conversation not available." and opens no other', async ({ page }) => {
    await fakeBackend(page, [external]);
    const conversation = await routeConversation(page, (ws) => void ws.close({ code: 1011 }));
    await page.goto('/');
    await entry(page, external.folder).click();

    await expect(view(page)).toContainText('Conversation not available.');
    await page.waitForTimeout(4500);
    expect(conversation.sockets.length).toBe(1);
  });
});
