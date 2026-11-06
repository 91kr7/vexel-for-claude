// e2e of plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order, batch fixed-order.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

let projectsRoot: string;
const createdIds: string[] = [];

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await postHook(request, id, { hook_event_name: 'Stop' });
});

// Other tests start sessions on the same server: the page shows only the sessions of the running test.
test.beforeEach(async ({ page }) => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-order-'));
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

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const terminal = (page: Page) => page.locator('.xterm-rows');
const pathField = (page: Page) => page.getByRole('textbox', { name: 'Working Directory Path', exact: true });

/** The folder names of one group, top to bottom; empty when the group is not shown. */
async function groupOrder(page: Page, title: string): Promise<string[]> {
  const heading = list(page).getByRole('heading', { level: 2, name: title, exact: true });
  if ((await heading.count()) === 0) return [];
  const titles = await heading
    .locator('xpath=following-sibling::ul[1]')
    .locator('[title]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('title') ?? ''));
  return titles.filter((title) => title.startsWith(projectsRoot + path.sep)).map((folder) => path.basename(folder));
}

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

async function startViaUi(page: Page, folder: string): Promise<void> {
  await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('button', { name: 'New Claude Code Session' }).click();
  await pathField(page).fill(folder);
  const started = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/sessions' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Start Session' }).click();
  const { id } = (await (await started).json()) as { id: string };
  createdIds.push(id);
  await expect(terminal(page)).toContainText('READY');
}

async function open(page: Page, folder: string): Promise<void> {
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
  await expect(terminal(page)).toContainText('READY');
}

async function typeLine(page: Page, text: string): Promise<void> {
  await page.locator('.xterm-screen').click();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

/** Starts the folders oldest first, so that the first one has the least recent activity. */
async function startInOrder(request: APIRequestContext, folders: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const folder of folders) ids.push(await startViaApi(request, folder));
  return ids;
}

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-1
test('sessions keep their place while they work', async ({ page, request }) => {
  const [a, b, c] = [await newFolder('keep-a'), await newFolder('keep-b'), await newFolder('keep-c')];
  const [, bId] = await startInOrder(request, [c, b, a]);
  await page.goto('/');
  await expect.poll(() => groupOrder(page, 'Running'), 'first load is in latest-activity order').toEqual(['keep-a', 'keep-b', 'keep-c']);

  await open(page, c);
  await typeLine(page, 'TURN');
  await expect(entry(page, c)).toContainText('Running');
  expect(await groupOrder(page, 'Running'), 'while C works').toEqual(['keep-a', 'keep-b', 'keep-c']);
  await expect(terminal(page)).toContainText('TURN-DONE');
  await expect(entry(page, c)).toContainText('Idle');
  expect(await groupOrder(page, 'Running'), 'after C stops').toEqual(['keep-a', 'keep-b', 'keep-c']);

  await postHook(request, bId ?? '', { hook_event_name: 'UserPromptSubmit', prompt: 'Another message' });
  await expect(entry(page, b)).toContainText('Another message');
  expect(await groupOrder(page, 'Running'), 'after activity on B').toEqual(['keep-a', 'keep-b', 'keep-c']);
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-2
test('a new session appears at the end of its group', async ({ page, request }) => {
  const [a, b, c] = [await newFolder('new-a'), await newFolder('new-b'), await newFolder('new-c')];
  await startInOrder(request, [c, b, a]);
  await page.goto('/');
  await expect.poll(() => groupOrder(page, 'Running')).toEqual(['new-a', 'new-b', 'new-c']);

  await startViaUi(page, await newFolder('new-d'));

  await expect(entry(page, path.join(projectsRoot, 'new-d'))).toBeVisible();
  await expect.poll(() => groupOrder(page, 'Running')).toEqual(['new-a', 'new-b', 'new-c', 'new-d']);
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-3, REQ-4, REQ-5
test('a session that changes group goes to the end of the new group, and the order survives a reload', async ({ page, request }) => {
  const [a, b, c, e] = [await newFolder('move-a'), await newFolder('move-b'), await newFolder('move-c'), await newFolder('move-e')];
  const [eId, , bId] = await startInOrder(request, [e, c, b, a]);
  await postHook(request, eId ?? '', { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  await page.goto('/');
  await expect.poll(() => groupOrder(page, 'Needs Input')).toEqual(['move-e']);
  await expect.poll(() => groupOrder(page, 'Running')).toEqual(['move-a', 'move-b', 'move-c']);

  await open(page, b);
  await typeLine(page, 'PERM');
  await expect(terminal(page)).toContainText('PERMISSION?(y/n)');
  await expect(entry(page, b)).toContainText('Needs Input');
  await expect.poll(() => groupOrder(page, 'Needs Input'), 'B goes after E').toEqual(['move-e', 'move-b']);
  await expect.poll(() => groupOrder(page, 'Running'), 'A and C keep their relative order').toEqual(['move-a', 'move-c']);

  await page.keyboard.type('y');
  await expect(terminal(page)).toContainText('ANSWER:y');
  await expect(entry(page, b)).toContainText('Idle');
  await expect.poll(() => groupOrder(page, 'Running'), 'B comes back at the end').toEqual(['move-a', 'move-c', 'move-b']);
  await expect.poll(() => groupOrder(page, 'Needs Input')).toEqual(['move-e']);
  await expect
    .poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('ai-client.session-order') ?? '{}') as { running?: string[] }).running?.at(-1)))
    .toBe(bId);

  await page.reload();
  await expect(entry(page, b)).toContainText('Idle');
  await expect.poll(() => groupOrder(page, 'Running'), 'after the reload, with the latest activity on B').toEqual(['move-a', 'move-c', 'move-b']);
  await expect.poll(() => groupOrder(page, 'Needs Input')).toEqual(['move-e']);
});
