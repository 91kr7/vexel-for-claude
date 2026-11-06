// e2e of plan-claude_sessions_client, batch session-list. The fake CLI fires the hooks of the server settings file.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-list-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await postHook(request, id, { hook_event_name: 'Stop' });
});

// Other spec files start sessions on the same server at the same time: the page shows only the sessions of this file.
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

const list = (page: Page) => page.getByRole('region', { name: 'Elenco sessioni' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const counter = (page: Page) => page.getByRole('region', { name: 'Elenco sessioni' }).getByRole('status').filter({ hasText: 'richiede input' });
const terminal = (page: Page) => page.locator('.xterm-rows');
const pathField = (page: Page) => page.getByRole('textbox', { name: 'Cartella del progetto', exact: true });
const RELATIVE_TIME = /^(ora|\d+ min fa)$/;

async function newFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
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

async function startViaUi(page: Page, folder: string): Promise<string> {
  await page.getByRole('navigation', { name: 'Navigazione principale' }).getByRole('button', { name: 'Nuova sessione' }).click();
  await expect(pathField(page)).toHaveValue(os.homedir());
  await pathField(page).fill(folder);
  const started = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/sessions' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Avvia sessione' }).click();
  const { id } = (await (await started).json()) as { id: string };
  createdIds.push(id);
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
  await expect(terminal(page)).toContainText('READY');
  return id;
}

async function typeLine(page: Page, text: string): Promise<void> {
  await page.locator('.xterm-screen').click();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

async function lastTick(page: Page): Promise<number> {
  const text = (await terminal(page).textContent()) ?? '';
  return Math.max(0, ...[...text.matchAll(/TICK(\d+)/g)].map((m) => Number(m[1])));
}

// plan-claude_sessions_client/REQ-11, REQ-12, REQ-13, REQ-14, REQ-16, REQ-17
test('the user sees which session needs input', async ({ page, request }) => {
  const busy = await newFolder('busy');
  const calm = await newFolder('calm');
  const asks = await newFolder('asks');
  const busyId = await startViaApi(request, busy);
  await startViaApi(request, calm);
  const asksId = await startViaApi(request, asks);
  await postHook(request, busyId, { hook_event_name: 'UserPromptSubmit', prompt: 'Analizza i log del server' });
  await postHook(request, asksId, { hook_event_name: 'UserPromptSubmit', prompt: 'Elimina la cartella build' });
  await postHook(request, asksId, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });

  await page.goto('/');

  for (const [folder, label, state] of [
    [busy, 'Analizza i log del server', 'Lavora'],
    [calm, 'calm', 'In attesa'],
    [asks, 'Elimina la cartella build', 'Richiede input'],
  ]) {
    await expect(entry(page, folder)).toContainText(path.basename(folder));
    await expect(entry(page, folder)).toContainText(label);
    await expect(entry(page, folder)).toContainText(state);
  }
  for (const folder of [busy, calm]) await expect(entry(page, folder).locator('time')).toHaveText(RELATIVE_TIME);
  await expect(entry(page, asks)).toHaveAccessibleDescription(/^Permesso per Bash · (ora|\d+ min fa)$/);
  await expect(list(page).getByRole('button').first().getByTitle(asks, { exact: true })).toBeVisible();
  await expect(entry(page, asks)).toHaveClass(/\bneeds-input\b/);
  await expect(entry(page, busy)).not.toHaveClass(/\bneeds-input\b/);
  await expect(entry(page, calm)).not.toHaveClass(/\bneeds-input\b/);
  await expect(counter(page)).toHaveText('1 richiede input');
});

// plan-claude_sessions_client/REQ-14, REQ-15
test('the list follows the state without a reload', async ({ page }) => {
  await page.goto('/');
  const folder = await newFolder('live');
  await startViaUi(page, folder);
  await expect(entry(page, folder)).toContainText('In attesa');
  await page.evaluate(() => ((globalThis as unknown as { notReloaded: boolean }).notReloaded = true));

  await typeLine(page, 'TURN');
  await expect(entry(page, folder)).toContainText('Lavora');
  await expect(terminal(page)).toContainText('TURN-DONE');
  await expect(entry(page, folder)).toContainText('In attesa');

  expect(await page.evaluate(() => (globalThis as unknown as { notReloaded?: boolean }).notReloaded)).toBe(true);
});

// plan-claude_sessions_client/REQ-14, REQ-15, REQ-17
test('the counter follows a permission request without a reload', async ({ page }) => {
  await page.goto('/');
  await expect(counter(page)).toHaveCount(0);
  const folder = await newFolder('permission');
  await startViaUi(page, folder);

  await typeLine(page, 'PERM');
  await expect(entry(page, folder)).toContainText('Richiede input');
  await expect(entry(page, folder)).toHaveClass(/\bneeds-input\b/);
  await expect(counter(page)).toHaveText('1 richiede input');

  await page.keyboard.type('y');
  await expect(terminal(page)).toContainText('ANSWER:y');
  await expect(entry(page, folder)).toContainText('In attesa');
  await expect(counter(page)).toHaveCount(0);
});

// plan-claude_sessions_client/REQ-17, REQ-18, REQ-19, REQ-21
test('the user switches between sessions', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const folderA = await newFolder('switch-a');
  const folderB = await newFolder('switch-b');
  await startViaUi(page, folderA);
  await typeLine(page, 'WORK');
  await expect(terminal(page)).toContainText('TICK2');
  await startViaUi(page, folderB);
  await typeLine(page, 'PERM');
  await expect(terminal(page)).toContainText('PERMISSION?(y/n)');
  await expect(entry(page, folderB)).toContainText('Richiede input');

  await entry(page, folderA).click();
  await expect(terminal(page)).toContainText(`CWD:${folderA}`, { timeout: 1000 });
  await expect(terminal(page)).toContainText('LINE:WORK', { timeout: 1000 });
  await expect(terminal(page)).not.toContainText(`CWD:${folderB}`);
  await expect(entry(page, folderA)).toHaveAttribute('aria-current', 'true');
  await expect(counter(page)).toBeVisible();
  const tickBeforeLeaving = await lastTick(page);

  await entry(page, folderB).click();
  await expect(terminal(page)).toContainText(`CWD:${folderB}`, { timeout: 1000 });
  await expect(terminal(page)).toContainText('PERMISSION?(y/n)', { timeout: 1000 });
  await expect(terminal(page)).not.toContainText(`CWD:${folderA}`);
  await expect(terminal(page)).not.toContainText('TICK');
  await expect(counter(page)).toHaveText('1 richiede input');
  await page.waitForTimeout(1000);

  await entry(page, folderA).click();
  await expect(terminal(page)).toContainText(`CWD:${folderA}`, { timeout: 1000 });
  await expect.poll(() => lastTick(page)).toBeGreaterThan(tickBeforeLeaving + 2);
  await expect(entry(page, folderA)).toContainText('Lavora');

  await entry(page, folderB).click();
  await expect(terminal(page)).toContainText('PERMISSION?(y/n)', { timeout: 1000 });
  await page.locator('.xterm-screen').click();
  await page.keyboard.type('y');
  await expect(terminal(page)).toContainText('ANSWER:y');
});

// plan-claude_sessions_client/REQ-20
test('sessions survive a page reload', async ({ page }) => {
  await page.goto('/');
  const folder = await newFolder('reload');
  await startViaUi(page, folder);
  await typeLine(page, 'WORK');
  await expect(entry(page, folder)).toContainText('Lavora');
  await expect(terminal(page)).toContainText('TICK2');

  await page.reload();
  await expect(page.getByText('Nessuna sessione aperta.')).toBeVisible();
  await expect(entry(page, folder)).toContainText('Lavora');
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
  await expect(terminal(page)).toContainText('LINE:WORK');
  const shown = await lastTick(page);
  await expect.poll(() => lastTick(page)).toBeGreaterThan(shown);
});

// plan-claude_sessions_client/REQ-21, REQ-22
test('ten sessions at once', async ({ page, request }) => {
  const folders: string[] = [];
  const ids: string[] = [];
  for (let n = 1; n <= 10; n += 1) {
    const folder = await newFolder(`ten-${String(n).padStart(2, '0')}`);
    const id = await startViaApi(request, folder);
    await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt: `Compito numero ${n}` });
    folders.push(folder);
    ids.push(id);
  }
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.goto('/');

  for (const folder of folders) {
    await entry(page, folder).scrollIntoViewIfNeeded();
    await expect(entry(page, folder)).toBeVisible();
    await expect(entry(page, folder)).toContainText('Lavora');
  }
  const scrolls = await list(page).locator('.session-list').evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(scrolls, 'the list scrolls when its entries do not fit').toBe(true);
  await postHook(request, ids[4] ?? '', { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  await expect(counter(page)).toBeInViewport();

  for (const index of [2, 7, 0, 9]) {
    const folder = folders[index] ?? '';
    await entry(page, folder).scrollIntoViewIfNeeded();
    await entry(page, folder).click();
    await expect(terminal(page)).toContainText(`CWD:${folder}`, { timeout: 1000 });
    await expect(terminal(page)).toContainText('READY', { timeout: 1000 });
  }
});

// plan-claude_sessions_client/REQ-14
test('an ended session stays in the list', async ({ page }) => {
  await page.goto('/');
  const folder = await newFolder('ended');
  await startViaUi(page, folder);
  await typeLine(page, '/exit');
  await expect(entry(page, folder)).toContainText('Terminata');

  await page.reload();
  await expect(entry(page, folder)).toContainText('Terminata');
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText('BYE');
});
