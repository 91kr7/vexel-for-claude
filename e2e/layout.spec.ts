// e2e of plan-claude_sessions_client-ui_redesign, batch layout. The server runs the fake CLI (playwright.config.ts).
/// <reference lib="dom" />
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-layout-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

const sidebar = (page: Page) => page.getByRole('complementary');
const mainArea = (page: Page) => page.getByRole('main');
const list = (page: Page) => page.getByRole('navigation', { name: 'Elenco sessioni' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ hasText: folder });
const counter = (page: Page) => sidebar(page).getByRole('status').filter({ hasText: 'Richiede input:' });
const chooser = (page: Page) => page.getByRole('form', { name: 'Scegli la cartella del progetto' });
const pathField = (page: Page) => page.getByRole('textbox', { name: 'Cartella del progetto', exact: true });
const resumeDialog = (page: Page) => page.getByRole('dialog', { name: 'Riprendi sessione' });
const terminal = (page: Page) => page.locator('.xterm-rows');
const button = (scope: Locator, name: string) => scope.getByRole('button', { name, exact: true });
const emptyTitle = (page: Page) => mainArea(page).getByText('Nessuna sessione aperta.', { exact: true });
const emptyHint = (page: Page) => mainArea(page).getByText('Avvia una nuova sessione o riprendine una passata.', { exact: true });

async function makeFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  return folder;
}

async function startViaApi(request: APIRequestContext, folder: string): Promise<void> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  createdIds.push(((await response.json()) as { id: string }).id);
}

async function openFromList(page: Page, folder: string): Promise<void> {
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText('READY');
}

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
}

function overlaps(a: Box, b: Box): boolean {
  const tol = 0.5;
  return a.x + a.width - tol > b.x && b.x + b.width - tol > a.x && a.y + a.height - tol > b.y && b.y + b.height - tol > a.y;
}

async function expectNoOverlap(named: Record<string, Locator>): Promise<void> {
  const boxes = await Promise.all(Object.entries(named).map(async ([n, l]) => [n, await box(l)] as const));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const [na, a] = boxes[i]!;
      const [nb, b] = boxes[j]!;
      expect(overlaps(a, b), `${na} overlaps ${nb}`).toBe(false);
    }
  }
}

/** Elements whose visible part (after clipping by overflow ancestors) sticks out of the root horizontally. Terminal internals are skipped. */
function horizontalOverflow(root: Locator): Promise<string[]> {
  return root.evaluate((rootEl) => {
    const limit = rootEl.getBoundingClientRect();
    const out: string[] = [];
    for (const el of rootEl.querySelectorAll('*')) {
      if (el.closest('.xterm') && !el.classList.contains('xterm')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      let left = r.left;
      let right = r.right;
      for (let a = el.parentElement; a && a !== rootEl.parentElement; a = a.parentElement) {
        if (getComputedStyle(a).overflowX !== 'visible') {
          const ar = a.getBoundingClientRect();
          left = Math.max(left, ar.left);
          right = Math.min(right, ar.right);
        }
      }
      if (right <= left) continue;
      if (left < limit.left - 1 || right > limit.right + 1) {
        out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} [${left.toFixed(0)}, ${right.toFixed(0)}]`);
      }
    }
    return out;
  });
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const sizes = await page.evaluate(() => ({
    doc: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
    body: [document.body.scrollWidth, document.body.clientWidth],
  }));
  expect(sizes.doc[0], 'page scroll width').toBeLessThanOrEqual(sizes.doc[1]!);
  expect(sizes.body[0], 'body scroll width').toBeLessThanOrEqual(sizes.body[1]!);
}

/** REQ-10 checks for the current window: no horizontal scroll, sidebar and main side by side, nothing overlapping or sticking out. */
async function expectPageFits(page: Page, width: number): Promise<void> {
  await expectNoHorizontalScroll(page);
  const side = await box(sidebar(page));
  const main = await box(mainArea(page));
  expect(side.x, 'sidebar starts at the left edge').toBeGreaterThanOrEqual(-0.5);
  expect(side.x + side.width, 'sidebar ends before the main area').toBeLessThanOrEqual(main.x + 0.5);
  expect(main.x + main.width, 'main area ends inside the window').toBeLessThanOrEqual(width + 0.5);
  expect(await horizontalOverflow(sidebar(page)), 'sidebar content inside the sidebar').toEqual([]);
  expect(await horizontalOverflow(mainArea(page)), 'main content inside the main area').toEqual([]);
  await expectNoOverlap({
    title: sidebar(page).getByRole('heading', { name: 'Sessioni Claude' }),
    counter: counter(page),
    'sidebar Nuova sessione': button(sidebar(page), 'Nuova sessione'),
    'sidebar Riprendi sessione': button(sidebar(page), 'Riprendi sessione'),
    list: list(page),
  });
}

async function computedColour(page: Page, cssValue: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = value;
    document.body.append(probe);
    const colour = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return colour;
  }, cssValue);
}

async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let i = 0; i < 20; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  expect(await target.evaluate((el) => el === document.activeElement), 'reached with Tab').toBe(true);
}

// plan-claude_sessions_client-ui_redesign/REQ-9, EmptyState "Shows"
test('with no session open the main area shows the empty state with its icon, text and both actions', async ({ page }) => {
  await page.goto('/');
  await expect(emptyTitle(page)).toBeVisible();
  await expect(emptyHint(page)).toBeVisible();
  await expect(mainArea(page).locator('.xterm')).toHaveCount(0);

  const decorative = mainArea(page).locator('svg.icon:not(button svg)');
  await expect(decorative).toHaveCount(1);
  await expect(decorative).toBeVisible();
  await expect(decorative).toHaveAttribute('aria-hidden', 'true');

  for (const name of ['Nuova sessione', 'Riprendi sessione']) {
    const action = button(mainArea(page), name);
    await expect(action).toBeVisible();
    await expect(action.locator('svg.icon')).toHaveCount(1);
    await expect(action.locator('svg.icon')).toHaveAttribute('aria-hidden', 'true');
  }

  await page.mouse.move(0, 0);
  const primary = await computedColour(page, 'var(--color-primary)');
  const bg = (l: Locator) => l.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await bg(button(mainArea(page), 'Nuova sessione')), '"Nuova sessione" has the primary look').toBe(primary);
  expect(await bg(button(mainArea(page), 'Riprendi sessione')), '"Riprendi sessione" is not primary').not.toBe(primary);
});

// plan-claude_sessions_client-ui_redesign/REQ-9, REQ-1; AppLayout: "Nuova sessione" in the EmptyState opens FolderChooser
test('"Nuova sessione" in the empty state opens the folder chooser and the started session becomes the open one', async ({ page }) => {
  const folder = await makeFolder('from-empty-state');
  await page.goto('/');

  await button(mainArea(page), 'Nuova sessione').click();
  await expect(chooser(page)).toBeVisible();
  await expect(pathField(page)).toHaveValue(os.homedir());
  await page.getByRole('button', { name: 'Annulla' }).click();
  await expect(chooser(page)).toBeHidden();
  await expect(emptyTitle(page)).toBeVisible();

  await button(mainArea(page), 'Nuova sessione').click();
  await expect(pathField(page)).toHaveValue(os.homedir());
  await pathField(page).fill(folder);
  const started = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/sessions' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Avvia sessione' }).click();
  createdIds.push(((await (await started).json()) as { id: string }).id);
  await expect(chooser(page)).toBeHidden();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
  await expect(emptyTitle(page)).toBeHidden();
  await expect(entry(page, folder)).toHaveAttribute('aria-current', 'true');
});

// plan-claude_sessions_client-ui_redesign/REQ-9, REQ-4; AppLayout: "Riprendi sessione" in the EmptyState opens ResumeDialog
test('"Riprendi sessione" in the empty state opens the resume dialog; "Annulla" brings the empty state back', async ({ page }) => {
  await page.goto('/');
  await button(mainArea(page), 'Riprendi sessione').click();
  await expect(resumeDialog(page)).toBeVisible();
  await resumeDialog(page).getByRole('button', { name: 'Annulla', exact: true }).click();
  await expect(resumeDialog(page)).toBeHidden();
  await expect(emptyTitle(page)).toBeVisible();
});

// EmptyState rule: native buttons, reached with Tab and triggered with Enter or Space
test('the empty state buttons are reached with Tab and triggered with Enter and Space', async ({ page }) => {
  await page.goto('/');
  await expect(emptyTitle(page)).toBeVisible();
  await tabTo(page, button(mainArea(page), 'Nuova sessione'));
  await page.keyboard.press('Enter');
  await expect(chooser(page)).toBeVisible();

  await page.goto('/');
  await expect(emptyTitle(page)).toBeVisible();
  await tabTo(page, button(mainArea(page), 'Riprendi sessione'));
  await page.keyboard.press('Space');
  await expect(resumeDialog(page)).toBeVisible();
});

// AppLayout "Description": sidebar order, no header bar
test('the sidebar holds the title, the counter, "Nuova sessione", "Riprendi sessione" and then the list; there is no header bar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('banner')).toHaveCount(0);
  const items = [
    sidebar(page).getByRole('heading', { level: 1, name: 'Sessioni Claude' }),
    counter(page),
    button(sidebar(page), 'Nuova sessione'),
    button(sidebar(page), 'Riprendi sessione'),
    list(page),
  ];
  for (const item of items) await expect(item).toBeVisible();
  await expect(sidebar(page).locator('nav[aria-label="Elenco sessioni"]')).toHaveCount(1);

  const handles = await Promise.all(items.map((l) => l.elementHandle()));
  const inOrder = await page.evaluate(
    (els) => els.every((el, i) => i === 0 || !!(els[i - 1]!.compareDocumentPosition(el!) & Node.DOCUMENT_POSITION_FOLLOWING)),
    handles,
  );
  expect(inOrder, 'document order title, counter, Nuova, Riprendi, list').toBe(true);

  const listTop = (await box(list(page))).y;
  for (const item of items.slice(0, 4)) {
    const b = await box(item);
    expect(b.y + b.height, 'top items sit above the list').toBeLessThanOrEqual(listTop + 0.5);
  }
  const primary = await computedColour(page, 'var(--color-primary)');
  await page.mouse.move(0, 0);
  expect(await button(sidebar(page), 'Nuova sessione').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(primary);
});

// plan-claude_sessions_client-ui_redesign/REQ-8
test('the session list and the open session are visible side by side', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const first = await makeFolder('side-by-side-one');
  const second = await makeFolder('side-by-side-two');
  await startViaApi(request, first);
  await startViaApi(request, second);
  await page.goto('/');
  await openFromList(page, second);

  await expect(entry(page, first)).toBeVisible();
  await expect(entry(page, second)).toBeVisible();
  await expect(counter(page)).toBeVisible();
  await expect(mainArea(page).locator('.xterm')).toBeVisible();
  await expect(emptyTitle(page)).toBeHidden();

  const side = await box(sidebar(page));
  const term = await box(mainArea(page).locator('.xterm'));
  const listBox = await box(list(page));
  expect(side.x + side.width, 'list on the left of the session').toBeLessThanOrEqual(term.x + 0.5);
  expect(overlaps(listBox, term), 'list and session do not overlap').toBe(false);
  const sameRow = listBox.y < term.y + term.height && term.y < listBox.y + listBox.height;
  expect(sameRow, 'list and session share the same rows of the window').toBe(true);
  await expectNoHorizontalScroll(page);
});

// AppLayout: fixed-width sidebar, the main area takes the rest of the width
test('the sidebar keeps its width and the main area takes the rest of the window', async ({ page }) => {
  const widths: number[] = [];
  for (const width of [1280, 3840]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(emptyTitle(page)).toBeVisible();
    const side = await box(sidebar(page));
    const main = await box(mainArea(page));
    widths.push(side.width);
    expect(side.width + main.width, `sidebar + main fill ${width} px`).toBeCloseTo(width, 0);
  }
  expect(widths[1]).toBeCloseTo(widths[0]!, 0);
});

// plan-claude_sessions_client-ui_redesign/REQ-10
for (const width of [1280, 3840]) {
  test(`at ${width} px with no open session the page fits with no horizontal scroll and no overlap`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(emptyTitle(page)).toBeVisible();
    await expectPageFits(page, width);
    await expectNoOverlap({
      icon: mainArea(page).locator('svg.icon:not(button svg)'),
      title: emptyTitle(page),
      hint: emptyHint(page),
      'Nuova sessione': button(mainArea(page), 'Nuova sessione'),
      'Riprendi sessione': button(mainArea(page), 'Riprendi sessione'),
    });
  });

  test(`at ${width} px with an open session in a long folder path the page fits with no horizontal scroll and no overlap`, async ({ page, request }) => {
    const folder = await makeFolder(`w${width}-${'cartella-di-progetto-con-un-nome-molto-lungo-'.repeat(4)}fine`);
    await startViaApi(request, folder);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await openFromList(page, folder);
    await expectPageFits(page, width);
    await expectNoOverlap({
      Interrompi: button(mainArea(page), 'Interrompi'),
      Termina: button(mainArea(page), 'Termina'),
      terminal: mainArea(page).locator('.xterm'),
    });
    const side = await box(sidebar(page));
    const e = await box(entry(page, folder));
    expect(e.x + e.width, 'long entry stays inside the sidebar').toBeLessThanOrEqual(side.x + side.width + 0.5);
  });
}

// AppLayout rule: a sidebar title too long for its width is cut with an ellipsis
test('a sidebar title too long for the sidebar is cut with an ellipsis and overlaps nothing', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const title = sidebar(page).getByRole('heading', { level: 1 });
  await title.evaluate((el) => (el.textContent = 'Sessioni Claude '.repeat(12).trim()));
  const cut = await title.evaluate((el) => ({ overflowing: el.scrollWidth > el.clientWidth, textOverflow: getComputedStyle(el).textOverflow }));
  expect(cut).toEqual({ overflowing: true, textOverflow: 'ellipsis' });
  await expectPageFits(page, 1280);
});

// AppLayout rule: the top of the sidebar stays in place, only the SessionList scrolls
test('when the entries do not fit, only the list scrolls and the top of the sidebar stays in place', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  for (let i = 0; i < 12; i++) await startViaApi(request, await makeFolder(`scroll-${String(i).padStart(2, '0')}`));
  await page.goto('/');
  await expect(list(page).getByRole('button').filter({ hasText: 'scroll-' })).toHaveCount(12);

  const top = {
    title: sidebar(page).getByRole('heading', { name: 'Sessioni Claude' }),
    counter: counter(page),
    new: button(sidebar(page), 'Nuova sessione'),
    resume: button(sidebar(page), 'Riprendi sessione'),
  };
  const before = await Promise.all(Object.values(top).map(box));
  const lastEntry = list(page).getByRole('button').last();
  const lastBefore = await box(lastEntry);
  expect(lastBefore.y + lastBefore.height, 'the last entry starts below the window').toBeGreaterThan(600);

  const listBox = await box(list(page));
  await page.mouse.move(listBox.x + listBox.width / 2, listBox.y + listBox.height / 2);
  await page.mouse.wheel(0, 5000);
  await expect.poll(async () => (await box(lastEntry)).y, 'the list scrolls').toBeLessThan(lastBefore.y);
  const lastAfter = await box(lastEntry);
  expect(lastAfter.y + lastAfter.height, 'the last entry is reachable in the window').toBeLessThanOrEqual(600 + 0.5);

  const after = await Promise.all(Object.values(top).map(box));
  expect(after, 'the top of the sidebar does not move').toEqual(before);
  for (const b of after) expect(b.y, 'top items stay in the window').toBeGreaterThanOrEqual(0);
  expect(await page.evaluate(() => window.scrollY), 'the page itself does not scroll').toBe(0);
});
