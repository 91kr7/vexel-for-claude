// e2e of plan-terminal_overflow and plan-terminal_clip, batch terminal-width. Each check prints a ruler from the fake CLI (e2e/terminal-width.ts).
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';
import { currentView, pageSettled } from './motion';
import { type RulerReading, expectLastColumnWhole, expectRightWidth, readRuler, sendLine } from './terminal-width';

// Full Chromium draws glyph advances with fractions, as Electron does; the headless shell rounds them and hides the cut.
test.use({ channel: 'chromium' });

const SIZE_KEY = 'ai-client.terminal-font-size';

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-width-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

test.afterAll(async () => {
  await rm(projectsRoot, { recursive: true, force: true });
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const terminalRows = (page: Page) => currentView(page).locator('.xterm-rows');
const panel = (page: Page) => currentView(page).getByRole('region', { name: /^Terminal/ });
const edge = (page: Page) => page.getByRole('separator', { name: 'Resize Session List' });
const gitExplorerButton = (page: Page) => currentView(page).getByRole('button', { name: 'Git Explorer', exact: true });
const gitExplorer = (page: Page) => currentView(page).getByRole('region', { name: 'Git Explorer' });
const defaultSizeButton = (page: Page) => currentView(page).locator('footer').getByRole('button', { name: /^Default text size \(\d+ px\)$/ });
const smallerButton = (page: Page) => currentView(page).locator('footer').getByRole('button', { name: 'Smaller text', exact: true });
const largerButton = (page: Page) => currentView(page).locator('footer').getByRole('button', { name: 'Larger text', exact: true });

async function newFolder(name: string, { git = false } = {}): Promise<string> {
  const folder = path.join(await mkdtemp(path.join(projectsRoot, 't-')), name);
  await mkdir(folder);
  if (git) execFileSync('git', ['init', '-q'], { cwd: folder });
  return folder;
}

async function startSession(request: APIRequestContext, folder: string): Promise<string> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  return id;
}

async function openFromList(page: Page, folder: string): Promise<void> {
  await entry(page, folder).getByTitle(folder, { exact: true }).click();
  await expect(terminalRows(page)).toContainText(`CWD:${folder}`);
  await expect(terminalRows(page)).toContainText('READY');
  await pageSettled(page);
}

interface SentResize {
  url: string;
  cols: number;
  rows: number;
}

/** Records the `resize` frames that the page sends on its session connections; call it before the page loads. */
function recordResizes(page: Page): SentResize[] {
  const sent: SentResize[] = [];
  page.on('websocket', (socket) => {
    if (!socket.url().includes('/attach')) return;
    socket.on('framesent', ({ payload }) => {
      if (typeof payload !== 'string') return;
      const frame = JSON.parse(payload) as { type?: string; cols?: number; rows?: number };
      if (frame.type === 'resize') sent.push({ url: socket.url(), cols: frame.cols!, rows: frame.rows! });
    });
  });
  return sent;
}

const sentFor = (sent: SentResize[], sessionId: string, from = 0) => sent.slice(from).filter((frame) => frame.url.includes(`/api/sessions/${sessionId}/attach`));

/** Plays every animation and transition of the page at `rate`, so a change can land in the middle of one. */
async function playbackRate(page: Page, rate: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: rate });
}

const plays = (page: Page, selector: string) =>
  page.evaluate(
    (watched) => [...document.querySelectorAll(watched)].some((element) => element.getAnimations().some((animation) => animation.playState === 'running')),
    selector,
  );

const panelWidth = (page: Page) => panel(page).evaluate((element) => element.getBoundingClientRect().width);

async function terminalTextSize(page: Page): Promise<number> {
  return terminalRows(page).evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
}

async function expectTextSize(page: Page, size: number): Promise<void> {
  await expect.poll(() => terminalTextSize(page)).toBe(size);
  await expect(defaultSizeButton(page)).toHaveText(`${size} px`);
}

// Scenario "The terminal has the right width after a reload and a switch"
test('REQ-1, REQ-2, REQ-3, REQ-4, REQ-5: right width at the first display, after a reload and when the cross-fade of a switch ends', async ({
  page,
  request,
  baseURL,
}) => {
  const first = await newFolder('first');
  const second = await newFolder('second');
  const firstId = await startSession(request, first);
  const secondId = await startSession(request, second);
  await page.goto('/');

  await openFromList(page, first);
  await expectRightWidth(page, baseURL!, firstId, 'first display');

  await page.reload();
  await openFromList(page, first);
  await expectRightWidth(page, baseURL!, firstId, 'first display after a reload');

  await openFromList(page, second);
  await expectRightWidth(page, baseURL!, secondId, 'end of the cross-fade to the other session');
  await openFromList(page, first);
  await expectRightWidth(page, baseURL!, firstId, 'end of the cross-fade back');
});

// Requirements, assumption "Reduced motion (REQ-5)"
test('REQ-5: with reduced motion a switch shows the selected session at the right width', async ({ page, request, baseURL }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const first = await newFolder('first');
  const second = await newFolder('second');
  await startSession(request, first);
  const secondId = await startSession(request, second);
  await page.goto('/');
  await openFromList(page, first);

  await openFromList(page, second);
  await expectRightWidth(page, baseURL!, secondId, 'switch with reduced motion');
});

// plan-terminal_overflow/REQ-6 in the browser: the rounding of the fit is checked at every width over one cell
test('REQ-6: right width at main area widths 1 px apart over more than one cell, and after larger window changes', async ({ page, request, baseURL }) => {
  test.slow();
  const folder = await newFolder('widths');
  const id = await startSession(request, folder);
  await page.setViewportSize({ width: 1000, height: 720 });
  await page.goto('/');
  await openFromList(page, folder);
  const { cellWidth } = await expectRightWidth(page, baseURL!, id, 'width 1000');

  for (let width = 1001; width <= 1001 + Math.ceil(cellWidth) + 1; width++) {
    await page.setViewportSize({ width, height: 720 });
    await expectRightWidth(page, baseURL!, id, `width ${width}`);
  }
  for (const size of [
    { width: 1600, height: 900 },
    { width: 860, height: 560 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(size);
    await expectRightWidth(page, baseURL!, id, `window ${size.width}x${size.height}`);
  }
});

// SessionView spec, "Actions": cross-fade of a switch; plan-terminal_overflow/REQ-5, REQ-6
test('REQ-5, REQ-6: a window resize during the cross-fade of a switch leaves the new session at the right width', async ({ page, request, baseURL }) => {
  const first = await newFolder('first');
  const second = await newFolder('second');
  await startSession(request, first);
  const secondId = await startSession(request, second);
  await page.goto('/');
  await openFromList(page, first);

  await playbackRate(page, 0.05);
  await entry(page, second).getByTitle(second, { exact: true }).click();
  await expect.poll(() => plays(page, 'main .main-view'), { message: 'the cross-fade plays' }).toBe(true);
  await page.setViewportSize({ width: 1060, height: 680 });
  expect(await plays(page, 'main .main-view'), 'the window changed during the cross-fade').toBe(true);
  await expect(terminalRows(page)).toContainText('READY');
  await pageSettled(page);

  await expectRightWidth(page, baseURL!, secondId, 'end of a cross-fade with a window resize');
});

// Scenario "The terminal follows the list edge and the Git Explorer", first change; plan-terminal_overflow/REQ-7 and REQ-9 (arrow keys)
test('REQ-7, REQ-9: the list panel edge, dragged or moved with the arrow keys, leaves the terminal at the right width', async ({ page, request, baseURL }) => {
  const folder = await newFolder('edge');
  const id = await startSession(request, folder);
  await page.goto('/');
  await openFromList(page, folder);
  const before = await expectRightWidth(page, baseURL!, id, 'before the drag');

  const box = (await edge(page).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 6; step++) await page.mouse.move(x + step * 20, y);
  await page.mouse.up();
  const dragged = await expectRightWidth(page, baseURL!, id, 'after a drag of the edge to the right');
  expect(dragged.cols, 'the terminal is narrower after the drag').toBeLessThan(before.cols);

  await edge(page).focus();
  await page.keyboard.press('ArrowRight');
  const right = await expectRightWidth(page, baseURL!, id, 'after Right arrow on the edge');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  const left = await expectRightWidth(page, baseURL!, id, 'after Left arrow twice on the edge');
  expect(left.cols, 'the terminal is wider after Left arrow twice').toBeGreaterThan(right.cols);
});

// Scenario "The terminal follows the list edge and the Git Explorer", second change; SessionView spec, "Actions": one resize at the end of the slide
test('REQ-9: opening and closing the Git Explorer leaves the terminal at the right width, with one resize per slide', async ({ page, request, baseURL }) => {
  const folder = await newFolder('repo', { git: true });
  const id = await startSession(request, folder);
  const sent = recordResizes(page);
  await page.goto('/');
  await openFromList(page, folder);
  const before = await expectRightWidth(page, baseURL!, id, 'before the Git Explorer opens');

  let from = sent.length;
  await gitExplorerButton(page).click();
  await expect(gitExplorer(page)).toBeVisible();
  await pageSettled(page);
  const opened = await expectRightWidth(page, baseURL!, id, 'Git Explorer open');
  expect(opened.cols, 'the terminal is narrower with the Git Explorer open').toBeLessThan(before.cols);
  expect(sentFor(sent, id, from), 'one resize for the slide in').toEqual([expect.objectContaining({ cols: opened.cols, rows: opened.rows })]);

  from = sent.length;
  await gitExplorerButton(page).click();
  await expect(gitExplorer(page)).toHaveCount(0);
  await pageSettled(page);
  const closed = await expectRightWidth(page, baseURL!, id, 'Git Explorer closed');
  expect(closed.cols, 'the terminal gets its columns back').toBe(before.cols);
  expect(sentFor(sent, id, from), 'one resize for the slide out').toEqual([expect.objectContaining({ cols: closed.cols, rows: closed.rows })]);
});

// SessionView spec, "Actions": a fit skipped during the Git Explorer slide runs once at its end; plan-terminal_overflow/REQ-6, REQ-9
test('REQ-6, REQ-9: a window resize during the Git Explorer slide leaves the terminal at the right width, with one resize', async ({
  page,
  request,
  baseURL,
}) => {
  const folder = await newFolder('repo', { git: true });
  const id = await startSession(request, folder);
  const sent = recordResizes(page);
  await page.goto('/');
  await openFromList(page, folder);
  await expectRightWidth(page, baseURL!, id, 'before the Git Explorer opens');

  await playbackRate(page, 0.05);
  const from = sent.length;
  await gitExplorerButton(page).click();
  await expect.poll(() => plays(page, 'main .git-explorer-panel'), { message: 'the Git Explorer slides' }).toBe(true);
  await page.setViewportSize({ width: 1180, height: 700 });
  expect(await plays(page, 'main .git-explorer-panel'), 'the window changed during the slide').toBe(true);
  await pageSettled(page);

  const reading = await expectRightWidth(page, baseURL!, id, 'end of the slide with a window resize');
  expect(sentFor(sent, id, from), 'one resize at the end of the slide').toEqual([expect.objectContaining({ cols: reading.cols, rows: reading.rows })]);
});

// SessionView spec, "Actions": another CSS transition of the main view; plan-terminal_overflow/REQ-9
test('REQ-9: a size change while a CSS transition of the main view runs gets the right width when the transition ends, with one resize', async ({
  page,
  request,
  baseURL,
}) => {
  const folder = await newFolder('transition');
  const id = await startSession(request, folder);
  const sent = recordResizes(page);
  await page.goto('/');
  await openFromList(page, folder);
  await expectRightWidth(page, baseURL!, id, 'before the transitions');

  await page.addStyleTag({ content: 'main .main-view { transition: padding-right 1.5s linear, outline-color 3s linear !important; }' });
  const widthBefore = await panelWidth(page);
  let from = sent.length;
  await currentView(page).evaluate((view) => {
    (view as HTMLElement).style.paddingRight = '160px';
  });
  await expect.poll(() => plays(page, 'main .main-view'), { message: 'the padding transition plays' }).toBe(true);
  await pageSettled(page);
  expect(await panelWidth(page), 'the transition made the panel narrower').toBeLessThan(widthBefore - 100);
  const narrowed = await expectRightWidth(page, baseURL!, id, 'end of a transition that narrows the panel');
  expect(sentFor(sent, id, from), 'one resize at the end of the transition').toEqual([expect.objectContaining({ cols: narrowed.cols, rows: narrowed.rows })]);

  from = sent.length;
  await currentView(page).evaluate((view) => {
    (view as HTMLElement).style.outlineColor = 'rgb(1, 2, 3)';
  });
  await expect.poll(() => plays(page, 'main .main-view'), { message: 'the outline transition plays' }).toBe(true);
  await page.setViewportSize({ width: 1100, height: 650 });
  expect(await plays(page, 'main .main-view'), 'the window changed during the transition').toBe(true);
  await pageSettled(page);
  const resized = await expectRightWidth(page, baseURL!, id, 'end of a transition during a window resize');
  expect(sentFor(sent, id, from), 'one resize at the end of the transition').toEqual([expect.objectContaining({ cols: resized.cols, rows: resized.rows })]);
});

// Scenario "The terminal follows the text size"; plan-terminal_overflow/REQ-8 over the whole size range
test('REQ-8: right width at every text size from 8 to 32 px', async ({ page, request, baseURL }) => {
  test.slow();
  await page.addInitScript(([key]) => localStorage.setItem(key!, '12'), [SIZE_KEY]);
  const folder = await newFolder('sizes');
  const id = await startSession(request, folder);
  await page.goto('/');
  await openFromList(page, folder);
  await currentView(page).locator('.xterm-screen').click();
  await page.keyboard.press('Control+Equal');
  await page.keyboard.press('Control+Equal');
  await page.keyboard.press('Control+Equal');
  await expectTextSize(page, 15);
  await expectRightWidth(page, baseURL!, id, 'text at 15 px after Ctrl+= three times');

  for (let size = 14; size >= 8; size--) {
    await smallerButton(page).click();
    await expectTextSize(page, size);
  }
  await expectRightWidth(page, baseURL!, id, 'text at 8 px');
  for (let size = 9; size <= 32; size++) {
    await largerButton(page).click();
    await expectTextSize(page, size);
    await expectRightWidth(page, baseURL!, id, `text at ${size} px`);
  }
});

// SessionView spec, "Actions": a new cell size at the same panel size; plan-terminal_overflow/REQ-9
test('REQ-9: a new device pixel ratio at the same window size leaves the terminal at the right width', async ({ page, request, baseURL }) => {
  test.slow();
  const folder = await newFolder('ratio');
  const id = await startSession(request, folder);
  await page.setViewportSize({ width: 1200, height: 720 });
  await page.goto('/');
  await openFromList(page, folder);
  await expectRightWidth(page, baseURL!, id, 'ratio 1');
  const cdp = await page.context().newCDPSession(page);
  const emulate = (width: number, deviceScaleFactor: number) =>
    cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 720, deviceScaleFactor, mobile: false });

  for (const ratio of [1.25, 1.5, 2, 1.75, 1]) {
    await emulate(1200, ratio);
    await expect.poll(() => page.evaluate(() => window.devicePixelRatio)).toBe(ratio);
    expect(await page.evaluate(() => window.innerWidth), 'the window keeps its size').toBe(1200);
    await expectRightWidth(page, baseURL!, id, `ratio ${ratio}`);
  }

  await emulate(1200, 1.25);
  const { cellWidth } = await expectRightWidth(page, baseURL!, id, 'ratio 1.25, width 1200');
  for (let width = 1201; width <= 1201 + Math.ceil(cellWidth) + 1; width++) {
    await emulate(width, 1.25);
    await expectRightWidth(page, baseURL!, id, `ratio 1.25, width ${width}`);
  }
});

/** Samples, in the page, whether the scrollbar of the terminal shows. */
async function watchScrollbar(page: Page): Promise<void> {
  await panel(page).evaluate((element) => {
    const seen = new Set<string>();
    (window as unknown as { scrollbarStates: Set<string> }).scrollbarStates = seen;
    const bar = element.querySelector<HTMLElement>('.xterm-scrollable-element > .scrollbar.vertical');
    const sample = () => {
      if (!bar) return;
      seen.add(!bar.classList.contains('invisible') && parseFloat(getComputedStyle(bar).opacity) > 0 ? 'shown' : 'hidden');
    };
    setInterval(sample, 20);
  });
}

const scrollbarStates = (page: Page) => page.evaluate(() => [...(window as unknown as { scrollbarStates: Set<string> }).scrollbarStates].sort());

/** Scrolls the terminal with the wheel, a few lines per step, until `shows` holds. */
async function scrollUntil(page: Page, direction: 'up' | 'down', shows: () => Promise<boolean>, message: string): Promise<void> {
  const screen = (await currentView(page).locator('.xterm-screen').boundingBox())!;
  await page.mouse.move(screen.x + screen.width / 2, screen.y + screen.height / 2);
  await expect(async () => {
    for (let step = 0; step < 5; step++) await page.mouse.wheel(0, direction === 'up' ? -100 : 100);
    expect(await shows(), message).toBe(true);
  }).toPass({ timeout: 90_000, intervals: [50] });
}

async function scrollToRuler(page: Page, tag: string): Promise<RulerReading> {
  await scrollUntil(page, 'up', async () => (await readRuler(page, tag)).rulerRow !== null, `the ruler ${tag} shows`);
  return readRuler(page, tag);
}

// Scenario "The last column stays visible beside the scrollbar"
test('REQ-2, REQ-10: scrolled up, the last column shows beside the scrollbar, and the columns stay while output arrives and the scrollbar shows and hides', async ({
  page,
  request,
  baseURL,
}) => {
  const folder = await newFolder('scroll');
  const id = await startSession(request, folder);
  const sent = recordResizes(page);
  await page.goto('/');
  await openFromList(page, folder);
  const settledWidth = await expectRightWidth(page, baseURL!, id, 'before the long output');
  const tag = 's0001';
  await sendLine(baseURL!, id, `RULER ${tag}`);
  await expect(terminalRows(page)).toContainText(`RULER-DONE ${tag} `);
  await sendLine(baseURL!, id, 'COUNT');
  await expect(terminalRows(page)).toContainText('COUNT-DONE');
  await watchScrollbar(page);
  const from = sent.length;

  const scrolled = await scrollToRuler(page, tag);
  expect(scrolled.scrollbar?.visible, 'the scrollbar shows after the scroll').toBe(true);
  expectLastColumnWhole(scrolled, 'REQ-2: scrolled up, beside the shown scrollbar');
  expect(scrolled.rulerRow, 'the ruler keeps its line break').toMatch(/^<s0001=+>$/);
  expect(scrolled.rulerRow!.length).toBe(settledWidth.cols);

  await sendLine(baseURL!, id, 'STREAM');
  await page.mouse.move(5, 5);
  await expect.poll(() => scrollbarStates(page), { message: 'the scrollbar hides when the pointer leaves' }).toEqual(['hidden', 'shown']);
  await scrollToRuler(page, tag);
  await scrollUntil(page, 'down', async () => (await terminalRows(page).textContent())!.includes('CHUNK5'), 'the last chunk of the output shows');

  expect(sentFor(sent, id, from), 'REQ-10: no resize while the panel and the cells keep their size').toEqual([]);
  const after = await expectRightWidth(page, baseURL!, id, 'after the output and the scrolling');
  expect(after.cols, 'REQ-10: the columns did not change').toBe(settledWidth.cols);
  expect((await scrollToRuler(page, tag)).rulerRow, 'REQ-10: the ruler keeps its line break').toMatch(/^<s0001=+>$/);
});

/** Advance of one glyph of the terminal font, as the browser draws it. */
const glyphAdvance = (page: Page) =>
  terminalRows(page).evaluate((rows) => {
    const style = getComputedStyle(rows);
    const probe = document.createElement('span');
    Object.assign(probe.style, { position: 'absolute', whiteSpace: 'pre', fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight });
    probe.textContent = '>'.repeat(256);
    document.body.append(probe);
    const advance = probe.getBoundingClientRect().width / 256;
    probe.remove();
    return advance;
  });

// plan-terminal_clip/REQ-1, REQ-2: the cause the developer named, glyphs measured in whole pixels drawn wider than their cells
test('plan-terminal_clip REQ-1, REQ-2: with fractional glyph advances the row edge cuts neither the last character nor the box border, at 1280x800 and 1920x1200', async ({
  page,
  request,
  baseURL,
}) => {
  const folder = await newFolder('advance');
  const id = await startSession(request, folder);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await openFromList(page, folder);
  const advance = await glyphAdvance(page);
  expect(Number.isInteger(advance), `the browser draws the terminal font with a fractional advance (${advance} px), where the cut shows`).toBe(false);

  await expectRightWidth(page, baseURL!, id, 'window 1280x800');
  await page.setViewportSize({ width: 1920, height: 1200 });
  await expectRightWidth(page, baseURL!, id, 'window 1920x1200');
});

// plan-terminal_clip/REQ-3, REQ-9: a font file that arrives late
test('plan-terminal_clip REQ-3, REQ-9: the terminal has the right width when its font file arrives 3 s late', async ({ page, request, baseURL }) => {
  const folder = await newFolder('late-font');
  const id = await startSession(request, folder);
  let delayed = 0;
  await page.route('**/roboto-mono-*.woff2', async (route) => {
    delayed += 1;
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.continue();
  });
  await page.goto('/');
  await openFromList(page, folder);
  expect(delayed, 'the font file was delayed').toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => document.fonts.check('12px "Roboto Mono"')), { message: 'the font has loaded' }).toBe(true);

  await expectRightWidth(page, baseURL!, id, 'font arrived late');
});

for (const ratio of [1.25, 1.5, 1.75]) {
  test.describe(`device pixel ratio ${ratio}`, () => {
    test.use({ deviceScaleFactor: ratio });

    // Scenario "The last character stays whole at every text size"; plan-terminal_clip/REQ-7
    test(`plan-terminal_clip REQ-7: right width at every text size from 8 to 32 px, device pixel ratio ${ratio}`, async ({ page, request, baseURL }) => {
      test.slow();
      await page.addInitScript(([key]) => localStorage.setItem(key!, '12'), [SIZE_KEY]);
      const folder = await newFolder('ratio-sizes');
      const id = await startSession(request, folder);
      await page.goto('/');
      await openFromList(page, folder);
      expect(await page.evaluate(() => window.devicePixelRatio)).toBe(ratio);
      await expectRightWidth(page, baseURL!, id, 'text at 12 px');

      await currentView(page).locator('.xterm-screen').click();
      for (let size = 13; size <= 20; size++) {
        await page.keyboard.press('Control+Equal');
        await expectTextSize(page, size);
        await expectRightWidth(page, baseURL!, id, `text at ${size} px after Ctrl+=`);
      }
      for (let size = 21; size <= 32; size++) {
        await largerButton(page).click();
        await expectTextSize(page, size);
        await expectRightWidth(page, baseURL!, id, `text at ${size} px`);
      }
      await defaultSizeButton(page).click();
      await expectTextSize(page, 12);
      for (let size = 11; size >= 8; size--) {
        await smallerButton(page).click();
        await expectTextSize(page, size);
        await expectRightWidth(page, baseURL!, id, `text at ${size} px`);
      }
    });
  });
}

// plan-terminal_clip/REQ-3, REQ-12 in the browser: the window sizes of the desktop app start
for (const moment of ['while the session loads', 'just after its first display'] as const) {
  test(`plan-terminal_clip REQ-3, REQ-12: a session first shown at 1920x1200, with the window going to 1280x800 ${moment}, has the right width for 1280x800`, async ({
    page,
    request,
    baseURL,
  }) => {
    const folder = await newFolder('start');
    const id = await startSession(request, folder);
    const sent = recordResizes(page);
    await page.setViewportSize({ width: 1920, height: 1200 });
    await page.goto('/');

    await entry(page, folder).getByTitle(folder, { exact: true }).click();
    if (moment === 'just after its first display') await expect(terminalRows(page)).toContainText('READY');
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(terminalRows(page)).toContainText('READY');
    await pageSettled(page);

    const restored = await expectRightWidth(page, baseURL!, id, `window 1280x800 ${moment}`);
    expect(sentFor(sent, id).at(-1), 'REQ-2: the last resize gives Claude Code the restored size').toEqual(
      expect.objectContaining({ cols: restored.cols, rows: restored.rows }),
    );
  });
}

// Scenario "The terminal stays whole after a quick series of window sizes"; plan-terminal_clip/REQ-5, REQ-11
test('plan-terminal_clip REQ-5, REQ-11: after maximize and restore three times in quick succession the terminal has the right width for the final window', async ({
  page,
  request,
  baseURL,
}) => {
  const folder = await newFolder('burst');
  const id = await startSession(request, folder);
  const sent = recordResizes(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await openFromList(page, folder);
  const before = await expectRightWidth(page, baseURL!, id, 'before the series');

  for (let round = 0; round < 3; round++) {
    await page.setViewportSize({ width: 1920, height: 1200 });
    await page.setViewportSize({ width: 1280, height: 800 });
  }
  await pageSettled(page);
  const after = await expectRightWidth(page, baseURL!, id, 'after three maximize and restore');
  expect(after.cols, 'the terminal is back to its columns for 1280x800').toBe(before.cols);
  expect(sentFor(sent, id).at(-1), 'REQ-2: the last resize gives Claude Code the final size').toEqual(expect.objectContaining({ cols: after.cols, rows: after.rows }));
});

// plan-terminal_clip/REQ-11: the changes come faster than one frame
test('plan-terminal_clip REQ-11: after six window sizes sent at once the terminal has the right width for the final one', async ({ page, request, baseURL }) => {
  const folder = await newFolder('burst-frame');
  const id = await startSession(request, folder);
  const sent = recordResizes(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await openFromList(page, folder);
  await expectRightWidth(page, baseURL!, id, 'before the series');

  const cdp = await page.context().newCDPSession(page);
  const sizes = [
    { width: 1920, height: 1200 },
    { width: 1280, height: 800 },
    { width: 1600, height: 900 },
    { width: 1350, height: 800 },
    { width: 1920, height: 1200 },
    { width: 1366, height: 768 },
  ];
  await Promise.all(sizes.map((size) => cdp.send('Emulation.setDeviceMetricsOverride', { ...size, deviceScaleFactor: 1, mobile: false })));
  await expect.poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([1366, 768]);
  await pageSettled(page);

  const final = await expectRightWidth(page, baseURL!, id, 'final window 1366x768');
  expect(sentFor(sent, id).at(-1), 'REQ-2: the last resize gives Claude Code the final size').toEqual(expect.objectContaining({ cols: final.cols, rows: final.rows }));
});
