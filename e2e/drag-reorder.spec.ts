// e2e of plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order, batch drag-reorder.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

let projectsRoot: string;
const createdIds: string[] = [];

// Ended sessions answer 404 to hooks: the status is not checked here.
test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/hook-events`, { data: { hook_event_name: 'Stop' } });
});

// Other tests start sessions on the same server: the page shows only the sessions of the running test.
test.beforeEach(async ({ page }) => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-drag-'));
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
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) }).first();
const item = (page: Page, folder: string) => list(page).locator('li').filter({ has: page.getByTitle(folder, { exact: true }) });
const groupHeading = (page: Page, title: string) => list(page).getByRole('heading', { level: 2, name: title, exact: true });
const terminal = (page: Page) => page.locator('.xterm-rows');

/** The folder names of one group, top to bottom; empty when the group is not shown. */
async function groupOrder(page: Page, title: string): Promise<string[]> {
  const heading = groupHeading(page, title);
  if ((await heading.count()) === 0) return [];
  const titles = await heading
    .locator('xpath=following-sibling::ul[1]')
    .locator('[title]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('title') ?? ''));
  return titles.filter((title) => title.startsWith(projectsRoot + path.sep)).map((folder) => path.basename(folder));
}

/**
 * Every 2 px `--accent-primary` line as wide as the entries, named by the gap it sits in:
 * "above X" before the first entry, "between X and Y", "below X" after the last entry.
 */
async function dropLines(page: Page): Promise<string[]> {
  return list(page)
    .locator('li')
    .evaluateAll((items, root) => {
      const probe = document.createElement('div');
      probe.style.backgroundColor = 'var(--accent-primary)';
      document.body.append(probe);
      const accent = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const name = (li: Element) => {
        const folder = [...li.querySelectorAll('[title]')].map((el) => el.getAttribute('title') ?? '').find((t) => t.startsWith(root)) ?? '?';
        return folder.slice(root.length);
      };
      const found: string[] = [];
      for (const li of items) {
        const box = li.getBoundingClientRect();
        for (const side of ['before', 'after']) {
          const style = getComputedStyle(li, `::${side}`);
          if (style.content === 'none' || style.display === 'none' || style.position !== 'absolute') continue;
          if (style.height !== '2px' || style.backgroundColor !== accent) continue;
          const top = style.top !== 'auto' ? box.top + parseFloat(style.top) : box.bottom - parseFloat(style.bottom) - 2;
          const siblings = [...(li.parentElement?.children ?? [])];
          const prev = siblings.filter((el) => Math.abs(el.getBoundingClientRect().bottom - top) < 1).at(0);
          const next = siblings.filter((el) => Math.abs(el.getBoundingClientRect().top - (top + 2)) < 1).at(0);
          const where = prev && next ? `between ${name(prev)} and ${name(next)}` : next ? `above ${name(next)}` : prev ? `below ${name(prev)}` : 'not in a gap';
          const wide = Math.abs(parseFloat(style.width) - box.width) < 1;
          found.push(wide ? where : `${where} (not as wide as the entry)`);
        }
      }
      return found;
    }, projectsRoot + path.sep);
}

const opacityOf = (page: Page, folder: string) => item(page, folder).evaluate((li) => getComputedStyle(li).opacity);

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

/** Starts the folders oldest first; the first list shows them in reverse, the latest first. */
async function startInOrder(request: APIRequestContext, folders: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const folder of folders) ids.push(await startViaApi(request, folder));
  return ids;
}

/** Starts A, B, C and loads the page with "Running" showing A, B, C. */
async function runningABC(page: Page, request: APIRequestContext, prefix: string) {
  const [a, b, c] = [await newFolder(`${prefix}-a`), await newFolder(`${prefix}-b`), await newFolder(`${prefix}-c`)];
  const [cId, bId, aId] = await startInOrder(request, [c, b, a]);
  await page.goto('/');
  await expect.poll(() => groupOrder(page, 'Running')).toEqual([`${prefix}-a`, `${prefix}-b`, `${prefix}-c`]);
  return { a, b, c, aId: aId ?? '', bId: bId ?? '', cId: cId ?? '' };
}

type Half = 'upper' | 'lower';

async function pointAt(page: Page, folder: string, half: Half): Promise<{ x: number; y: number }> {
  const box = await item(page, folder).boundingBox();
  if (!box) throw new Error(`no entry for ${folder}`);
  return { x: box.x + box.width / 2, y: box.y + box.height * (half === 'upper' ? 0.25 : 0.75) };
}

/** Presses the mouse on the entry of `folder` and moves it a little, so that the drag starts. */
async function startDrag(page: Page, folder: string): Promise<void> {
  const box = await entry(page, folder).boundingBox();
  if (!box) throw new Error(`no entry for ${folder}`);
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 24, box.y + box.height / 2 + 4, { steps: 2 });
}

// A browser repeats dragover while the pointer rests; Playwright sends one per move, so a last 1 px move stands for that.
async function dragOver(page: Page, folder: string, half: Half): Promise<void> {
  const { x, y } = await pointAt(page, folder, half);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.move(x + 1, y);
}

async function dragAndDrop(page: Page, source: string, target: string, half: Half): Promise<void> {
  await startDrag(page, source);
  await dragOver(page, target, half);
  await page.mouse.up();
}

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-6, REQ-10
test('the user moves a session to the top with drag and drop, with a line where it lands', async ({ page, request }) => {
  const { a, c } = await runningABC(page, request, 'top');

  await startDrag(page, c);
  await dragOver(page, a, 'upper');
  await expect.poll(() => dropLines(page), 'a line above A while dragging').toEqual(['above top-a']);
  expect(await opacityOf(page, c), 'C dimmed while dragged').toBe('0.4');

  await page.mouse.up();

  await expect.poll(() => groupOrder(page, 'Running')).toEqual(['top-c', 'top-a', 'top-b']);
  await expect.poll(() => dropLines(page), 'no line after the drop').toEqual([]);
  expect(await opacityOf(page, c), 'C no longer dimmed').toBe('1');
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-10: the lower half means "after it"
test('over the lower half of an entry the line shows below it', async ({ page, request }) => {
  const { a, b } = await runningABC(page, request, 'below');

  await startDrag(page, a);
  await dragOver(page, b, 'lower');
  await expect.poll(() => dropLines(page)).toEqual(['between below-b and below-c']);
  await dragOver(page, b, 'upper');
  await expect.poll(() => dropLines(page), 'the line follows the pointer').toEqual(['between below-a and below-b']);
  await dragOver(page, b, 'lower');
  await expect.poll(() => dropLines(page)).toEqual(['between below-b and below-c']);
  await page.mouse.up();

  await expect.poll(() => groupOrder(page, 'Running')).toEqual(['below-b', 'below-a', 'below-c']);
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-6: landing places from the session-list spec
test('a drop down the list lands at the place of the line, and a drop next to the own place changes nothing', async ({ page, request }) => {
  const { a, b, c } = await runningABC(page, request, 'place');

  await dragAndDrop(page, a, c, 'lower');
  await expect.poll(() => groupOrder(page, 'Running'), 'A after C').toEqual(['place-b', 'place-c', 'place-a']);

  await dragAndDrop(page, c, b, 'lower');
  await page.waitForTimeout(300);
  expect(await groupOrder(page, 'Running'), 'C on the lower half of B, right above C').toEqual(['place-b', 'place-c', 'place-a']);

  await dragAndDrop(page, c, a, 'upper');
  await page.waitForTimeout(300);
  expect(await groupOrder(page, 'Running'), 'C on the upper half of A, right below C').toEqual(['place-b', 'place-c', 'place-a']);

  await dragAndDrop(page, c, c, 'upper');
  await page.waitForTimeout(300);
  expect(await groupOrder(page, 'Running'), 'C on its own entry').toEqual(['place-b', 'place-c', 'place-a']);
  await expect.poll(() => dropLines(page)).toEqual([]);
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-6: a drop on the own group's heading uses the line shown
test('a drop on the heading of the own group lands at the line shown', async ({ page, request }) => {
  const { a, c } = await runningABC(page, request, 'heading');

  await startDrag(page, c);
  await dragOver(page, a, 'upper');
  await expect.poll(() => dropLines(page)).toEqual(['above heading-a']);
  const box = await groupHeading(page, 'Running').boundingBox();
  if (!box) throw new Error('no Running heading');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();

  await expect.poll(() => groupOrder(page, 'Running')).toEqual(['heading-c', 'heading-a', 'heading-b']);
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-6: the hosted needs-input card is draggable too
test('the user moves a needs-input card inside its group', async ({ page, request }) => {
  const [e, f] = [await newFolder('card-e'), await newFolder('card-f')];
  const [eId, fId] = await startInOrder(request, [e, f]);
  await postHook(request, eId ?? '', { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  await postHook(request, fId ?? '', { hook_event_name: 'PermissionRequest', tool_name: 'Read' });
  await page.goto('/');
  await expect.poll(() => groupOrder(page, 'Needs Input'), 'first load in latest-activity order').toEqual(['card-f', 'card-e']);

  await startDrag(page, e);
  await dragOver(page, f, 'upper');
  await expect.poll(() => dropLines(page)).toEqual(['above card-f']);
  expect(await opacityOf(page, e)).toBe('0.4');
  await page.mouse.up();

  await expect.poll(() => groupOrder(page, 'Needs Input')).toEqual(['card-e', 'card-f']);
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-9
test('the order set by the user survives a reload, and a click still opens a session', async ({ page, request }) => {
  const { a, c } = await runningABC(page, request, 'reload');
  await dragAndDrop(page, c, a, 'upper');
  await expect.poll(() => groupOrder(page, 'Running')).toEqual(['reload-c', 'reload-a', 'reload-b']);

  await page.reload();

  await expect.poll(() => groupOrder(page, 'Running')).toEqual(['reload-c', 'reload-a', 'reload-b']);

  await entry(page, a).click();
  await expect(terminal(page)).toContainText(`CWD:${a}`);
  expect(await groupOrder(page, 'Running')).toEqual(['reload-c', 'reload-a', 'reload-b']);
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-7, REQ-10
test('a drop on another group or outside the list changes nothing', async ({ page, request }) => {
  const f = await newFolder('other-f');
  const fId = await startViaApi(request, f);
  const stopped = await request.post(`/api/sessions/${fId}/stop`);
  expect(stopped.status()).toBe(202);
  const { a, b } = await runningABC(page, request, 'other');
  await expect.poll(() => groupOrder(page, 'Ended')).toEqual(['other-f']);

  await startDrag(page, b);
  await dragOver(page, a, 'upper');
  await expect.poll(() => dropLines(page)).toEqual(['above other-a']);
  await dragOver(page, f, 'upper');
  await expect.poll(() => dropLines(page), 'no line over "Ended"').toEqual([]);
  await dragOver(page, f, 'lower');
  expect(await dropLines(page)).toEqual([]);
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(await groupOrder(page, 'Running'), 'drop on F').toEqual(['other-a', 'other-b', 'other-c']);
  expect(await groupOrder(page, 'Ended')).toEqual(['other-f']);
  expect(await opacityOf(page, b), 'B no longer dimmed').toBe('1');

  await startDrag(page, b);
  await dragOver(page, a, 'upper');
  await expect.poll(() => dropLines(page)).toEqual(['above other-a']);
  const panel = await list(page).boundingBox();
  if (!panel) throw new Error('no Session List');
  await page.mouse.move(panel.x + panel.width + 200, panel.y + 200, { steps: 5 });
  await expect.poll(() => dropLines(page), 'no line outside the list').toEqual([]);
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(await groupOrder(page, 'Running'), 'drop outside the list').toEqual(['other-a', 'other-b', 'other-c']);
  expect(await opacityOf(page, b)).toBe('1');
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-8
test('a session that changes group during the drag is not moved', async ({ page, request }) => {
  const e = await newFolder('switch-e');
  await postHook(request, await startViaApi(request, e), { hook_event_name: 'PermissionRequest', tool_name: 'Read' });
  const { a, b, bId } = await runningABC(page, request, 'switch');
  await expect.poll(() => groupOrder(page, 'Needs Input')).toEqual(['switch-e']);

  await startDrag(page, b);
  await dragOver(page, a, 'upper');
  await expect.poll(() => dropLines(page)).toEqual(['above switch-a']);

  await postHook(request, bId, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  await expect.poll(() => groupOrder(page, 'Needs Input'), 'B moves to "Needs Input" during the drag').toEqual(['switch-e', 'switch-b']);
  await expect.poll(() => dropLines(page), 'the line disappears when B leaves its group').toEqual([]);
  expect(await opacityOf(page, b), 'B no longer dimmed').toBe('1');

  await dragOver(page, a, 'lower');
  await dragOver(page, a, 'upper');
  expect(await dropLines(page), 'no line over the old group').toEqual([]);
  await page.mouse.up();
  await page.waitForTimeout(300);

  expect(await groupOrder(page, 'Running')).toEqual(['switch-a', 'switch-c']);
  expect(await groupOrder(page, 'Needs Input'), 'B at the end of "Needs Input"').toEqual(['switch-e', 'switch-b']);
});
