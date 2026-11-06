// e2e of plan-claude_sessions_client, batch local-access. The server runs the fake CLI (playwright.config.ts).
// The page of another local server is faked on http://localhost:8080 with request routing.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

const OTHER_PAGE = 'http://localhost:8080/';
const hex = (text: string) => Buffer.from(text, 'utf8').toString('hex');

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const terminal = (page: Page) => page.locator('.xterm-rows');
const pathField = (page: Page) => page.getByRole('textbox', { name: 'Working Directory Path', exact: true });

async function newFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  return folder;
}

async function sessionIds(request: APIRequestContext): Promise<string[]> {
  const response = await request.get('/api/sessions');
  expect(response.status()).toBe(200);
  return ((await response.json()) as { id: string }[]).map((session) => session.id);
}

/** The fake page of another local server. Its console records the browser's network errors. */
async function openOtherPage(page: Page): Promise<{ other: Page; messages: string[] }> {
  // A routed page has no real address: without this grant Chromium's Local Network Access check, not the server, blocks its requests.
  await page.context().grantPermissions(['local-network-access'], { origin: OTHER_PAGE.slice(0, -1) });
  const other = await page.context().newPage();
  const messages: string[] = [];
  other.on('console', (message) => messages.push(message.text()));
  await other.route(`${OTHER_PAGE}**`, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Other local server</title>' }));
  await other.goto(OTHER_PAGE);
  return { other, messages };
}

/** Opens a WebSocket from inside `page`, sends `hello` if it opens, and reports what happened once it closes. */
function browserWebSocket(page: Page, url: string): Promise<{ opened: boolean; frames: string[] }> {
  return page.evaluate(
    (target) =>
      new Promise<{ opened: boolean; frames: string[] }>((resolve) => {
        const socket = new WebSocket(target);
        const result = { opened: false, frames: [] as string[] };
        socket.onopen = () => {
          result.opened = true;
          socket.send(JSON.stringify({ type: 'input', data: 'hello' }));
          setTimeout(() => socket.close(), 500);
        };
        socket.onmessage = (event) => result.frames.push(String(event.data));
        socket.onclose = () => resolve(result);
      }),
    url,
  );
}

// plan-claude_sessions_client/REQ-37, plan-claude_sessions_client/REQ-45
for (const name of ['localhost', '127.0.0.1']) {
  test(`the page opened on ${name} at the client port starts a session and types into it`, async ({ page, baseURL, request }) => {
    const port = new URL(baseURL!).port;
    const folder = await newFolder(`own-${name}`);
    await page.goto(`http://${name}:${port}/`);
    await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('button', { name: 'New Claude Code Session' }).click();
    await expect(pathField(page)).toHaveValue(os.homedir());
    await pathField(page).fill(folder);
    await page.getByRole('button', { name: 'Start Session' }).click();
    await expect(terminal(page)).toContainText(`CWD:${folder}`);
    await expect(terminal(page)).toContainText('READY');
    const sessions = (await (await request.get('/api/sessions')).json()) as { id: string; folder: string }[];
    createdIds.push(...sessions.filter((session) => session.folder === folder).map((session) => session.id));

    await page.locator('.xterm-screen').click();
    await page.keyboard.type('ping');
    await page.keyboard.press('Enter');
    await expect(terminal(page)).toContainText('LINE:ping');
    await expect(entry(page, folder)).toBeVisible();
  });
}

// plan-claude_sessions_client/REQ-39, plan-claude_sessions_client/REQ-43
test('a page of another local server cannot read or drive a session', async ({ page, baseURL, request }) => {
  const port = new URL(baseURL!).port;
  const folder = await newFolder('driven');
  const started = await request.post('/api/sessions', { data: { path: folder } });
  expect(started.status()).toBe(201);
  const id = ((await started.json()) as { id: string }).id;
  createdIds.push(id);
  await page.goto('/');
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText('READY');

  const { other, messages } = await openOtherPage(page);
  for (const url of [
    `ws://127.0.0.1:${port}/api/sessions/${id}/attach`,
    `ws://localhost:${port}/api/sessions/${id}/attach`,
    `ws://127.0.0.1:${port}/api/sessions/events`,
  ]) {
    expect(await browserWebSocket(other, url), url).toEqual({ opened: false, frames: [] });
    // The server itself refused the handshake.
    await expect.poll(() => messages.some((text) => text.includes(url) && text.includes('Unexpected response code: 403')), url).toBe(true);
  }

  await page.locator('.xterm-screen').click();
  await page.keyboard.type('probe');
  await page.keyboard.press('Enter');
  await expect(terminal(page)).toContainText('LINE:probe');
  await expect(terminal(page)).not.toContainText(`IN:${hex('hello')}`);
  await expect(terminal(page)).not.toContainText('LINE:hello');
});

// plan-claude_sessions_client/REQ-39, plan-claude_sessions_client/REQ-44
test('a page of another local server cannot start a session', async ({ page, baseURL, request }) => {
  const port = new URL(baseURL!).port;
  const folder = await newFolder('foreign-start');
  const before = await sessionIds(request);
  const { other } = await openOtherPage(page);
  // An opaque no-cors response hides its status from the page and from Playwright's events: read it from the browser's network log.
  const cdp = await other.context().newCDPSession(other);
  await cdp.send('Network.enable');
  const statuses: number[] = [];
  cdp.on('Network.responseReceived', (event) => {
    if (event.response.url.endsWith('/api/sessions')) statuses.push(event.response.status);
  });
  await other.evaluate(
    ({ url, body }) => fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'content-type': 'text/plain' }, body }).then(() => undefined, () => undefined),
    { url: `http://127.0.0.1:${port}/api/sessions`, body: JSON.stringify({ path: folder }) },
  );
  await expect.poll(() => statuses).toEqual([403]);
  expect(await sessionIds(request)).toEqual(before);
});
