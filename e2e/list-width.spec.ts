// e2e of plan-session_list_width, batch list-width. The server runs the fake CLI (playwright.config.ts),
// which prints `SIZE:<cols>x<rows>` at start and `WINCH:<cols>x<rows>` when the pty is resized.
/// <reference lib="dom" />
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };

const KEY = 'ai-client.list-width';

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-list-width-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

// The page shows only the sessions of this file: other spec files, and earlier runs on a reused server, add entries.
test.beforeEach(async ({ page }) => {
  const own = (session: { folder?: unknown } | undefined) => typeof session?.folder === 'string' && session.folder.startsWith(projectsRoot + path.sep);
  await page.route(
    (url) => url.pathname === '/api/sessions',
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      await route.fulfill({ response, json: ((await response.json()) as { folder?: unknown }[]).filter(own) });
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

test.use({ viewport: { width: 1440, height: 900 } });

const panel = (page: Page) => page.getByRole('region', { name: 'Session List' });
const edge = (page: Page) => page.getByRole('separator', { name: 'Resize Session List' });
const mainArea = (page: Page) => page.getByRole('main');
const entry = (page: Page, folder: string) => panel(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const terminal = (page: Page) => page.locator('.xterm-rows');

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
}

const panelWidth = async (page: Page) => (await box(panel(page))).width;
const savedWidth = (page: Page) => page.evaluate((key) => localStorage.getItem(key), KEY);

/** The panel width one animation frame after the last event: what the user sees. */
const widthNextFrame = (page: Page) =>
  panel(page).evaluate((el) => new Promise<number>((resolve) => requestAnimationFrame(() => resolve(el.getBoundingClientRect().width))));

async function saveWidthBeforeLoad(page: Page, width: number): Promise<void> {
  await page.addInitScript(([key, value]) => localStorage.setItem(key!, value!), [KEY, String(width)]);
}

async function openPage(page: Page): Promise<void> {
  await page.goto('/');
  await expect(edge(page)).toBeVisible();
}

/** Presses the primary button on the middle of the edge, moves the pointer by `dx` in `steps` moves, and releases it. */
async function dragEdge(page: Page, dx: number, options: { steps?: number; onMove?: (moved: number) => Promise<void>; release?: boolean } = {}): Promise<void> {
  const { steps = 5, onMove, release = true } = options;
  const b = await box(edge(page));
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const moved = Math.round((dx * i) / steps);
    await page.mouse.move(x + moved, y);
    await onMove?.(moved);
  }
  if (release) await page.mouse.up();
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

/** Whether the edge, or one of its pseudo-elements, draws the accent colour as a visible fill, border or shadow. */
async function showsAccentLine(page: Page): Promise<boolean> {
  const accent = await computedColour(page, 'var(--accent-primary)');
  return edge(page).evaluate((el, colour) => {
    return [null, '::before', '::after'].some((pseudo) => {
      const s = getComputedStyle(el, pseudo);
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
      if (pseudo && s.content === 'none') return false;
      const border = (['Top', 'Right', 'Bottom', 'Left'] as const).some(
        (side) => s.getPropertyValue(`border-${side.toLowerCase()}-style`) !== 'none' && parseFloat(s.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 && s.getPropertyValue(`border-${side.toLowerCase()}-color`) === colour,
      );
      return s.backgroundColor === colour || s.boxShadow.includes(colour) || border;
    });
  }, accent);
}

/** Whether the edge draws the focus ring colour as an outline or a box-shadow. */
async function showsRing(page: Page): Promise<boolean> {
  const ring = await computedColour(page, 'var(--color-focus-ring)');
  return edge(page).evaluate((el, ringColour) => {
    const s = getComputedStyle(el);
    const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor === ringColour;
    return outline || s.boxShadow.includes(ringColour);
  }, ring);
}

/** Presses Tab until the edge has the focus; returns the elements focused on the way. */
async function tabToEdge(page: Page, maxPresses = 40): Promise<string[]> {
  const passed: string[] = [];
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press('Tab');
    const here = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        isEdge: el?.getAttribute('role') === 'separator',
        inPanel: !!el?.closest('[aria-label="Session List"]'),
        name: `${el?.tagName.toLowerCase()} ${el?.getAttribute('aria-label') ?? el?.textContent?.trim().slice(0, 30) ?? ''}`,
      };
    });
    if (here.isEdge) return passed;
    passed.push(`${here.inPanel ? 'panel' : 'outside'}: ${here.name}`);
  }
  throw new Error('Tab never reached the edge');
}

let folderCount = 0;
async function startSession(request: APIRequestContext, name = `project-${++folderCount}`): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder, { recursive: true });
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  createdIds.push(((await response.json()) as { id: string }).id);
  return folder;
}

const terminalRows = (page: Page) =>
  terminal(page).evaluate((element) =>
    [...element.children]
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      .map((row) => row.textContent?.trim() ?? '')
      .filter(Boolean),
  );

/** The columns of the last `SIZE:` or `WINCH:` report of the CLI. */
async function reportedColumns(page: Page): Promise<number | undefined> {
  const report = (await terminalRows(page)).filter((row) => /^(SIZE|WINCH):\d+x\d+$/.test(row)).at(-1);
  return report ? Number(report.match(/:(\d+)x/)![1]) : undefined;
}

/** Columns that fit the terminal screen, from the width of one character of the READY row. */
const screenColumns = (page: Page) =>
  page.evaluate(() => {
    const screen = document.querySelector('.xterm-screen')!.getBoundingClientRect();
    const ready = [...document.querySelector('.xterm-rows')!.children].find((row) => row.textContent?.trim() === 'READY')!;
    const node = document.createTreeWalker(ready, NodeFilter.SHOW_TEXT).nextNode()!;
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 5);
    return Math.round(screen.width / (range.getBoundingClientRect().width / 5));
  });

/** REQ-10 checks on one entry: every text stays on one row, nothing sticks out of the entry, and a cut text ends with an ellipsis. */
async function expectEntryFits(page: Page, folder: string): Promise<void> {
  const report = await entry(page, folder).evaluate((root) => {
    const limit = root.getBoundingClientRect();
    const wrapped: string[] = [];
    const outside: string[] = [];
    const cutWithoutEllipsis: string[] = [];
    for (const el of root.querySelectorAll<HTMLElement>('*')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const s = getComputedStyle(el);
      const ownText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim() !== '');
      const label = `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent?.trim().slice(0, 30)}"`;
      // Entry texts are at most 18 px high on one line: a second row makes them at least 30 px.
      if (ownText && r.height > 24) wrapped.push(`${label} ${r.height}px`);
      if (ownText && el.scrollWidth > el.clientWidth + 1 && s.textOverflow !== 'ellipsis') cutWithoutEllipsis.push(label);
      let left = r.left;
      let right = r.right;
      for (let a = el.parentElement; a && a !== root.parentElement; a = a.parentElement) {
        if (getComputedStyle(a).overflowX !== 'visible') {
          const ar = a.getBoundingClientRect();
          left = Math.max(left, ar.left);
          right = Math.min(right, ar.right);
        }
      }
      if (right > left && (left < limit.left - 1 || right > limit.right + 1)) outside.push(`${label} [${left.toFixed(0)}, ${right.toFixed(0)}]`);
    }
    return { wrapped, outside, cutWithoutEllipsis };
  });
  expect(report.wrapped, 'texts that wrap to a second row').toEqual([]);
  expect(report.outside, 'content outside the entry').toEqual([]);
  expect(report.cutWithoutEllipsis, 'texts cut without an ellipsis').toEqual([]);
}

/** Whether the folder name of the entry is cut with an ellipsis. */
const folderNameCut = (page: Page, folder: string) =>
  entry(page, folder)
    .getByTitle(folder, { exact: true })
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return el.scrollWidth > el.clientWidth && s.textOverflow === 'ellipsis' && s.whiteSpace === 'nowrap';
    });

test.describe('List panel width', () => {
  // plan-session_list_width/REQ-7, REQ-6: no saved width → 224 px, and opening the page saves nothing
  test('with no saved width the list panel is 224 px wide and nothing is saved', async ({ page }) => {
    await openPage(page);
    expect(await panelWidth(page)).toBeCloseTo(224, 0);
    expect(await savedWidth(page)).toBeNull();
  });

  // plan-session_list_width/REQ-12: separator with an accessible name, value and limits
  test('the edge is a separator named "Resize Session List" with the shown width and the window limits', async ({ page }) => {
    await saveWidthBeforeLoad(page, 300);
    await openPage(page);
    await expect(edge(page)).toHaveAttribute('aria-valuenow', '300');
    await expect(edge(page)).toHaveAttribute('aria-valuemin', '180');
    await expect(edge(page)).toHaveAttribute('aria-valuemax', '480');
    const e = await box(edge(page));
    const p = await box(panel(page));
    expect(Math.abs(e.x + e.width / 2 - (p.x + p.width)), 'edge centred on the right border of the panel').toBeLessThanOrEqual(1.5);
  });

  // plan-session_list_width/REQ-2: hover shows the resize cursor and the accent line
  test('on hover the edge shows the resize cursor and the accent line', async ({ page }) => {
    await openPage(page);
    expect(await showsAccentLine(page), 'no accent line before hover').toBe(false);
    await edge(page).hover();
    expect(await edge(page).evaluate((el) => getComputedStyle(el).cursor)).toBe('col-resize');
    await expect.poll(() => showsAccentLine(page), { message: 'accent line on hover' }).toBe(true);
  });

  // plan-session_list_width/REQ-1, REQ-2, REQ-6, REQ-8, REQ-9, REQ-14 — scenario "The user makes the list wider and finds the same width after a reload"
  test('a drag follows the pointer, saves the width once at the end, and a reload shows it from the first frame', async ({ page }) => {
    // Every width the panel takes from its first appearance in the page, reload included.
    await page.addInitScript(() => {
      const seen: number[] = [];
      (window as unknown as { listWidths: number[] }).listWidths = seen;
      const watch = new MutationObserver(() => {
        const el = document.querySelector('[aria-label="Session List"]');
        if (!el) return;
        watch.disconnect();
        seen.push(el.getBoundingClientRect().width);
        new ResizeObserver((entries) => entries.forEach((e) => seen.push(e.borderBoxSize[0]!.inlineSize))).observe(el);
      });
      watch.observe(document, { childList: true, subtree: true });
    });
    await openPage(page);
    expect(await panelWidth(page)).toBeCloseTo(224, 0);

    await dragEdge(page, 100, {
      release: false,
      onMove: async (moved) => {
        expect(await widthNextFrame(page), `panel follows the pointer after ${moved} px`).toBeCloseTo(224 + moved, 0);
        expect(await savedWidth(page), 'nothing saved during the drag').toBeNull();
      },
    });
    await expect.poll(() => showsAccentLine(page), { message: 'accent line while dragging' }).toBe(true);
    await page.mouse.up();

    expect(await panelWidth(page)).toBeCloseTo(324, 0);
    expect(await savedWidth(page)).toBe('324');
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? ''), 'the drag selects no text').toBe('');

    await page.reload();
    await expect(edge(page)).toBeVisible();
    expect(await panelWidth(page)).toBeCloseTo(324, 0);
    const widths = await page.evaluate(() => (window as unknown as { listWidths: number[] }).listWidths);
    expect(widths.length, 'the panel was measured').toBeGreaterThan(0);
    for (const width of widths) expect(width, `every width since the first frame: ${widths.join(', ')}`).toBeCloseTo(324, 0);
  });

  // ListPanelEdge "Actions": a press and release with no width change saves nothing
  test('a press and release with no move saves nothing', async ({ page }) => {
    await openPage(page);
    await dragEdge(page, 0, { steps: 1 });
    expect(await panelWidth(page)).toBeCloseTo(224, 0);
    expect(await savedWidth(page)).toBeNull();
  });

  // plan-session_list_width/REQ-3, REQ-7, REQ-10 — scenario "The narrowest list keeps its entries readable"
  test('a drag far to the left stops at 180 px and the entries keep their lines, cut with an ellipsis', async ({ page, request }) => {
    const folder = await startSession(request, 'a-very-long-project-folder-name-that-never-fits-in-a-narrow-list');
    await openPage(page);
    await expect(entry(page, folder)).toBeVisible();
    expect(await panelWidth(page)).toBeCloseTo(224, 0);

    await dragEdge(page, -300);
    expect(await panelWidth(page)).toBeCloseTo(180, 0);
    await expect(edge(page)).toHaveAttribute('aria-valuenow', '180');
    expect(await savedWidth(page)).toBe('180');

    await expectEntryFits(page, folder);
    expect(await folderNameCut(page, folder), 'the folder name ends with an ellipsis').toBe(true);
  });

  // plan-session_list_width/REQ-3, REQ-10: the widest list
  test('a drag far to the right stops at 480 px and the entries still fit', async ({ page, request }) => {
    const folder = await startSession(request, 'another-very-long-project-folder-name-that-may-not-fit-even-in-the-widest-list-panel');
    await openPage(page);
    await expect(entry(page, folder)).toBeVisible();

    await dragEdge(page, 600);
    expect(await panelWidth(page)).toBeCloseTo(480, 0);
    expect(await savedWidth(page)).toBe('480');
    await expectEntryFits(page, folder);
  });

  // plan-session_list_width/REQ-4: a drag never takes the main area under 700 px
  test('in a 1100 px window a drag stops where the main area keeps 700 px', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await openPage(page);
    await expect(edge(page)).toHaveAttribute('aria-valuemax', '348');
    await dragEdge(page, 400);
    expect(await panelWidth(page)).toBeCloseTo(348, 0);
    expect((await box(mainArea(page))).width).toBeCloseTo(700, 0);
    expect(await savedWidth(page)).toBe('348');
  });

  // plan-session_list_width/REQ-4, REQ-5, REQ-6 — scenario "A narrow window makes the list narrower, but keeps the saved width"
  test('a narrow window shows the list narrower and keeps the saved width', async ({ page }) => {
    await saveWidthBeforeLoad(page, 480);
    await openPage(page);
    expect(await panelWidth(page)).toBeCloseTo(480, 0);

    await page.setViewportSize({ width: 1100, height: 900 });
    await expect.poll(() => panelWidth(page)).toBeCloseTo(348, 0);
    expect((await box(mainArea(page))).width, 'main area keeps 700 px').toBeCloseTo(700, 0);
    await expect(edge(page)).toHaveAttribute('aria-valuemax', '348');
    expect(await savedWidth(page)).toBe('480');

    await page.setViewportSize({ width: 900, height: 900 });
    await expect.poll(() => panelWidth(page), { message: 'the 180 px minimum wins' }).toBeCloseTo(180, 0);
    expect(await savedWidth(page)).toBe('480');

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect.poll(() => panelWidth(page)).toBeCloseTo(480, 0);
    expect(await savedWidth(page)).toBe('480');
  });

  // plan-session_list_width/REQ-2, REQ-3, REQ-12, REQ-13 — scenario "The user changes the width with the keyboard"
  test('Tab reaches the edge with a visible focus, and the Right arrow stops at 480 px', async ({ page }) => {
    await saveWidthBeforeLoad(page, 470);
    await openPage(page);
    await tabToEdge(page);
    await expect(edge(page)).toBeFocused();
    expect(await edge(page).evaluate((el) => el.matches(':focus-visible')), 'keyboard focus').toBe(true);
    expect(await showsRing(page), 'focus ring').toBe(true);
    await expect.poll(() => showsAccentLine(page), { message: 'accent line on focus' }).toBe(true);

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await panelWidth(page)).toBeCloseTo(480, 0);
    await expect(edge(page)).toHaveAttribute('aria-valuenow', '480');
    expect(await savedWidth(page)).toBe('480');

    await page.keyboard.press('ArrowLeft');
    expect(await panelWidth(page)).toBeCloseTo(464, 0);
    expect(await savedWidth(page)).toBe('464');
  });

  // plan-session_list_width/REQ-3, REQ-13: the Left arrow stops at 180 px
  test('the Left arrow moves by 16 px and stops at 180 px', async ({ page }) => {
    await saveWidthBeforeLoad(page, 200);
    await openPage(page);
    await edge(page).focus();
    await page.keyboard.press('ArrowLeft');
    expect(await panelWidth(page)).toBeCloseTo(184, 0);
    expect(await savedWidth(page)).toBe('184');
    await page.keyboard.press('ArrowLeft');
    expect(await panelWidth(page)).toBeCloseTo(180, 0);
    expect(await savedWidth(page)).toBe('180');
    await page.keyboard.press('ArrowLeft');
    expect(await panelWidth(page)).toBeCloseTo(180, 0);
  });

  // plan-session_list_width/REQ-4, REQ-13: the Right arrow stops at the window maximum
  test('in a 1100 px window the Right arrow stops at 348 px', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await saveWidthBeforeLoad(page, 340);
    await openPage(page);
    await edge(page).focus();
    await page.keyboard.press('ArrowRight');
    expect(await panelWidth(page)).toBeCloseTo(348, 0);
    expect(await savedWidth(page)).toBe('348');
  });

  // ListPanelEdge "Actions": Tab reaches the edge after the list entries
  test('Tab reaches the edge right after the list entries', async ({ page, request }) => {
    const folder = await startSession(request);
    await openPage(page);
    await entry(page, folder).focus();
    const passed = await tabToEdge(page, 10);
    expect(passed.filter((step) => step.startsWith('outside')), 'no stop outside the list panel before the edge').toEqual([]);
  });

  // plan-session_list_width/REQ-11, REQ-1 — the terminal fills the narrower main area and Claude Code gets the new columns
  test('after a drag the terminal of the open session fits the main area again and the CLI gets the new columns', async ({ page, request }) => {
    const folder = await startSession(request);
    await openPage(page);
    await entry(page, folder).click();
    await expect(terminal(page)).toContainText('READY');
    await expect.poll(() => reportedColumns(page)).toBeDefined();
    const before = (await reportedColumns(page))!;

    await dragEdge(page, 100);
    expect(await panelWidth(page)).toBeCloseTo(324, 0);

    await expect.poll(() => reportedColumns(page), { message: 'the CLI gets fewer columns' }).toBeLessThan(before);
    await expect.poll(async () => (await reportedColumns(page)) === (await screenColumns(page)), { message: 'reported columns match the screen' }).toBe(true);
    const screen = await box(page.locator('.xterm-screen'));
    const main = await box(mainArea(page));
    expect(screen.x, 'terminal starts inside the main area').toBeGreaterThanOrEqual(main.x - 0.5);
    expect(screen.x + screen.width, 'terminal ends inside the main area').toBeLessThanOrEqual(main.x + main.width + 0.5);
  });
});
