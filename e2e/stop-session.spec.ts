// e2e of plan-claude_sessions_client, batch stop-session.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, type Request, expect, test } from '@playwright/test';

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-stop-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

const list = (page: Page) => page.getByRole('navigation', { name: 'Elenco sessioni' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ hasText: folder });
const terminal = (page: Page) => page.locator('.xterm-rows');
const stopButton = (page: Page) => page.getByRole('button', { name: 'Termina', exact: true }).first();
const confirmation = (page: Page) =>
  page.getByRole('alertdialog').or(page.getByRole('dialog')).filter({ hasText: 'Terminare la sessione?' });

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

async function openSession(page: Page, request: APIRequestContext, name: string): Promise<{ id: string; folder: string }> {
  const folder = await newFolder(name);
  const id = await startViaApi(request, folder);
  await page.goto('/');
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText('READY');
  return { id, folder };
}

async function typeLine(page: Page, text: string): Promise<void> {
  await page.locator('.xterm-screen').click();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

function recordStopRequests(page: Page, id: string): Request[] {
  const requests: Request[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === `/api/sessions/${id}/stop`) requests.push(r);
  });
  return requests;
}

async function lastTick(page: Page): Promise<number> {
  const text = (await terminal(page).textContent()) ?? '';
  return Math.max(0, ...[...text.matchAll(/TICK(\d+)/g)].map((m) => Number(m[1])));
}

// plan-claude_sessions_client/REQ-23
test('the user stops an idle session', async ({ page, request }) => {
  const { id, folder } = await openSession(page, request, 'idle');
  await expect(entry(page, folder)).toContainText('In attesa');
  const stops = recordStopRequests(page, id);

  await stopButton(page).click();

  await expect(confirmation(page)).toHaveCount(0);
  await expect(entry(page, folder)).toContainText('Terminata');
  expect(stops.map((r) => [r.method(), r.postData()])).toEqual([['POST', null]]);
  await expect(page.getByRole('button', { name: 'Termina', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Interrompi' })).toBeVisible();
});

// plan-claude_sessions_client/REQ-23
test('a session that needs input stops at once', async ({ page, request }) => {
  const { id, folder } = await openSession(page, request, 'needs-input');
  await typeLine(page, 'PERM');
  await expect(entry(page, folder)).toContainText('Richiede input');
  const stops = recordStopRequests(page, id);

  await stopButton(page).click();

  await expect(confirmation(page)).toHaveCount(0);
  await expect(entry(page, folder)).toContainText('Terminata');
  expect(stops).toHaveLength(1);
});

// plan-claude_sessions_client/REQ-24
test('stopping a working session asks for confirmation; "Annulla" keeps it working', async ({ page, request }) => {
  const { id, folder } = await openSession(page, request, 'working-cancel');
  await typeLine(page, 'WORK');
  await expect(entry(page, folder)).toContainText('In lavorazione');
  const stops = recordStopRequests(page, id);

  await stopButton(page).click();

  await expect(confirmation(page)).toBeVisible();
  await expect(confirmation(page).getByRole('button', { name: 'Annulla' })).toBeFocused();
  await expect(confirmation(page).getByRole('button', { name: 'Termina', exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  expect(stops, 'no stop request before the confirmation').toHaveLength(0);

  await confirmation(page).getByRole('button', { name: 'Annulla' }).click();

  await expect(confirmation(page)).toHaveCount(0);
  const tick = await lastTick(page);
  await expect.poll(() => lastTick(page)).toBeGreaterThan(tick + 2);
  await expect(entry(page, folder)).toContainText('In lavorazione');
  expect(stops, 'no stop request after "Annulla"').toHaveLength(0);
  await expect(stopButton(page)).toBeVisible();
});

// plan-claude_sessions_client/REQ-23, REQ-24
test('confirming the stop of a working session ends it', async ({ page, request }) => {
  const { id, folder } = await openSession(page, request, 'working-confirm');
  await typeLine(page, 'WORK');
  await expect(entry(page, folder)).toContainText('In lavorazione');
  const stops = recordStopRequests(page, id);

  await stopButton(page).click();
  await confirmation(page).getByRole('button', { name: 'Termina', exact: true }).click();

  await expect(confirmation(page)).toHaveCount(0);
  await expect(entry(page, folder)).toContainText('Terminata');
  expect(stops.map((r) => [r.method(), r.postData()])).toEqual([['POST', null]]);
  await expect(page.getByRole('button', { name: 'Termina', exact: true })).toHaveCount(0);
});

// plan-claude_sessions_client/REQ-24, StopSessionButton: the button disappears also while the confirmation is open
test('the confirmation disappears when the session ends meanwhile', async ({ page, request }) => {
  const { id, folder } = await openSession(page, request, 'ends-while-confirming');
  await typeLine(page, 'WORK');
  await expect(entry(page, folder)).toContainText('In lavorazione');
  await stopButton(page).click();
  await expect(confirmation(page)).toBeVisible();

  expect((await request.post(`/api/sessions/${id}/stop`)).status()).toBe(202);

  await expect(entry(page, folder)).toContainText('Terminata');
  await expect(confirmation(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Termina', exact: true })).toHaveCount(0);
});

// plan-claude_sessions_client/REQ-23, plan-claude_sessions_client-ui_redesign/REQ-30: a failed stop only shows its error
test('a failed stop request shows its error and changes nothing else', async ({ page, request }) => {
  const { id, folder } = await openSession(page, request, 'failed-stop');
  const failed = page.waitForResponse((r) => new URL(r.url()).pathname === `/api/sessions/${id}/stop`);
  await page.route(`**/api/sessions/${id}/stop`, (route) => route.fulfill({ status: 500, body: '' }));
  const entryBefore = await entry(page, folder).innerText();

  await stopButton(page).click();
  expect((await failed).status()).toBe(500);
  await page.waitForTimeout(800);

  await expect(stopButton(page)).toBeVisible();
  await expect(confirmation(page)).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveText(['Terminazione della sessione non riuscita.']);
  await expect(stopButton(page)).toBeEnabled();
  expect(await entry(page, folder).innerText()).toBe(entryBefore);
  await expect(terminal(page)).not.toContainText('[Sessione disconnessa]');
});

// plan-claude_sessions_client/REQ-23, SessionView: a change of state does not reconnect the terminal
test('a state change of the open session keeps its terminal connection', async ({ page, request }) => {
  const folder = await newFolder('no-reconnect');
  const id = await startViaApi(request, folder);
  const attaches: string[] = [];
  page.on('websocket', (ws) => {
    if (ws.url().includes(`/api/sessions/${id}/attach`)) attaches.push(ws.url());
  });
  await page.goto('/');
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText('READY');

  await typeLine(page, 'TURN');
  await expect(entry(page, folder)).toContainText('In lavorazione');
  await expect(terminal(page)).toContainText('TURN-DONE');
  await expect(entry(page, folder)).toContainText('In attesa');

  expect(attaches).toHaveLength(1);
  await expect(terminal(page)).not.toContainText('[Sessione disconnessa]');
});
