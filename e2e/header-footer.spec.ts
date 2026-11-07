// e2e of plan-session_list_width, batch header-footer: the lighter session header and the footer bar.
// The tests write the transcripts that Claude Code would write, so this spec runs in the claude-dir group.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { appendFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

type Box = { x: number; y: number; width: number; height: number };

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
// The external scanner reads the sessions folder every 2 seconds.
const SCAN = { timeout: 10_000 };
const TOLERANCE = 1;
const COST_TOOLTIP = 'Estimated cost at API list prices';

let projectsRoot: string;
const createdIds: string[] = [];
const cleanup: { process?: ChildProcess; files: string[] }[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-header-footer-'));
  await mkdir(SESSIONS_DIR, { recursive: true });
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const { process, files } of cleanup.splice(0)) {
    process?.kill('SIGKILL');
    for (const file of files) await rm(file, { force: true });
  }
});

test.afterAll(async () => {
  await rm(projectsRoot, { recursive: true, force: true });
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).locator('.session-entry').filter({ has: page.getByTitle(folder, { exact: true }) });
const mainArea = (page: Page) => page.getByRole('main');
const header = (page: Page) => mainArea(page).locator('header');
const footer = (page: Page) => mainArea(page).locator('footer');
const place = (page: Page, folder: string) => footer(page).getByTitle(folder, { exact: true });
const contextChip = (page: Page) => footer(page).locator('.session-figure-context');
const tokensChip = (page: Page) => footer(page).locator('.session-figure-tokens');
const costChip = (page: Page) => footer(page).locator('.session-figure-cost');
const zoomControls = (page: Page) => footer(page).getByRole('group', { name: 'Terminal text size' });
const tooltip = (page: Page) => page.getByRole('tooltip');
/** The label of the session in `folder`, as the session list gives it. */
async function labelOf(request: APIRequestContext, folder: string, external = false): Promise<string> {
  const summaries = (await (await request.get('/api/sessions')).json()) as { folder: string; label: string; external?: boolean }[];
  const summary = summaries.find((s) => s.folder === folder && Boolean(s.external) === external);
  expect(summary, 'the session is listed').toBeDefined();
  return summary!.label;
}
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const near = (actual: number, expected: number, what: string) => expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(TOLERANCE);

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
}

/** The computed colour of a theme variable, e.g. `--rose-400`. */
const colourOf = (page: Page, variable: string) =>
  page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, variable);

/** Resizes the window until the main area is `width` px wide. */
async function mainAreaWidth(page: Page, width: number): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const shown = (await box(mainArea(page))).width;
    if (Math.abs(shown - width) <= 0.5) return;
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: Math.round(viewport.width - (shown - width)), height: viewport.height });
  }
  near((await box(mainArea(page))).width, width, 'main area width');
}

/** The element in `target`, itself included, whose text is cut with an ellipsis. */
const isCutWithEllipsis = (target: Locator) =>
  target.evaluate((root) =>
    [root, ...root.querySelectorAll('*')].some((el) => getComputedStyle(el).textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth),
  );

let nextKey = 0;
interface Parts {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}
const response = (parts: Parts) => {
  nextKey += 1;
  return {
    type: 'assistant',
    uuid: crypto.randomUUID(),
    isSidechain: false,
    message: {
      id: `msg_e2e_header_footer_${Date.now()}_${nextKey}`,
      model: 'claude-haiku-5-5',
      role: 'assistant',
      content: [{ type: 'text', text: 'Done.' }],
      usage: { input_tokens: parts.input, output_tokens: parts.output, cache_creation_input_tokens: parts.cacheWrite, cache_read_input_tokens: parts.cacheRead },
    },
  };
};
const userText = (text: string) => ({ type: 'user', isSidechain: false, message: { role: 'user', content: text } });
// 45,200 tokens of context of a 200k window, 47,200 tokens in all.
const SOME_RESPONSES = { input: 2_200, output: 2_000, cacheWrite: 3_000, cacheRead: 40_000 };

async function newFolder(name: string): Promise<string> {
  return mkdtemp(path.join(projectsRoot, `${name}-`));
}

/** Appends lines to the main transcript of a Claude Code session, as Claude Code does while it works. */
async function transcript(folder: string, claudeSessionId: string): Promise<(...entries: object[]) => Promise<void>> {
  const file = path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'), `${claudeSessionId}.jsonl`);
  await mkdir(path.dirname(file), { recursive: true });
  cleanup.push({ files: [file] });
  return (...entries) => appendFile(file, entries.map((e) => `${JSON.stringify(e)}\n`).join(''));
}

async function hookEvent(request: APIRequestContext, id: string, event: Record<string, string>): Promise<void> {
  expect((await request.post(`/api/sessions/${id}/hook-events`, { data: event })).status()).toBe(204);
}

/** A hosted session with the given transcript lines; `working` leaves it in its first turn, otherwise it is idle. */
async function hosted(request: APIRequestContext, folder: string, prompt: string, entries: object[], options: { working?: boolean } = {}): Promise<string> {
  const claudeSessionId = crypto.randomUUID();
  const write = await transcript(folder, claudeSessionId);
  if (entries.length > 0) await write(userText(prompt), ...entries);
  const started = await request.post('/api/sessions', { data: { path: folder } });
  expect(started.status()).toBe(201);
  const { id } = (await started.json()) as { id: string };
  createdIds.push(id);
  await hookEvent(request, id, { hook_event_name: 'UserPromptSubmit', prompt, session_id: claudeSessionId });
  if (!options.working) await hookEvent(request, id, { hook_event_name: 'Stop', session_id: claudeSessionId });
  return id;
}

/** Simulates Claude Code at work in another terminal: a live process, its `sessions/<pid>.json` and the `<pid>.<hash>.key` FIFO. */
async function runInTerminal(sessionId: string, folder: string): Promise<void> {
  const process = spawn('sleep', ['300'], { stdio: 'ignore' });
  const pid = process.pid ?? 0;
  const key = path.join(SESSIONS_DIR, `${pid}.5a6b7c8d.key`);
  const file = path.join(SESSIONS_DIR, `${pid}.json`);
  cleanup.push({ process, files: [key, file] });
  execFileSync('mkfifo', [key]);
  await writeFile(file, JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status: 'busy', updatedAt: Date.now() }));
}

/** The header keeps one 40 px row: every item inside it, side by side, with no overlap. */
async function expectOneRow(page: Page, items: Locator[]): Promise<void> {
  const head = await box(header(page));
  near(head.height, 40, 'header height');
  const boxes = (await Promise.all(items.map((item) => box(item)))).sort((a, b) => a.x - b.x);
  for (const [n, item] of boxes.entries()) {
    expect(item.y, `item ${n} below the header top`).toBeGreaterThanOrEqual(head.y - TOLERANCE);
    expect(item.y + item.height, `item ${n} above the header bottom`).toBeLessThanOrEqual(head.y + head.height + TOLERANCE);
    expect(item.x, `item ${n} inside the header`).toBeGreaterThanOrEqual(head.x - TOLERANCE);
    expect(item.x + item.width, `item ${n} inside the header`).toBeLessThanOrEqual(head.x + head.width + TOLERANCE);
    const next = boxes[n + 1];
    if (next) expect(item.x + item.width, `item ${n} does not overlap the next one`).toBeLessThanOrEqual(next.x + TOLERANCE);
  }
}

test.describe('Header and footer of an open session', () => {
  // plan-session_list_width/REQ-15, REQ-17, REQ-19, REQ-20, REQ-28, REQ-29 — scenario "The user reads the session details in the footer of a hosted session"
  test('a hosted session at 700 px shows a one-row header and the details in the footer', async ({ page, request }) => {
    const folder = await newFolder('billing-api');
    const label = 'Add the invoice export';
    await hosted(request, folder, label, [response(SOME_RESPONSES)]);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await mainAreaWidth(page, 700);
    await entry(page, folder).click();
    await page.mouse.move(0, 0);

    // The header: folder name, label, state, "Search", "Interrupt" and "Terminate", and nothing else.
    const name = path.basename(folder);
    await expect(header(page).getByRole('heading', { level: 2 })).toHaveText(name);
    await expect(header(page)).toHaveText(new RegExp(`^\\s*${name}\\s*${label}\\s*Idle\\s*■?\\s*Interrupt\\s*■?\\s*Terminate\\s*$`));
    await expect(header(page).getByRole('button')).toHaveText(['', /Interrupt/, /Terminate/]);
    await expect(header(page).getByRole('button').first()).toHaveAccessibleName('Search');
    await expectOneRow(page, [
      header(page).getByRole('heading', { level: 2 }),
      header(page).locator('.mono-chip').filter({ hasText: label }),
      header(page).getByText('Idle', { exact: true }),
      ...(await header(page).getByRole('button').all()),
    ]);

    // The footer: path, context, total tokens, cost, then the text size controls at the right end; no key hint.
    const foot = await box(footer(page));
    near(foot.height, 40, 'footer height');
    await expect(place(page, folder)).toHaveText(folder);
    await expect(contextChip(page)).toHaveText(/^\s*Context\s*45\.2k \/ 200k · 23%\s*$/);
    await expect(tokensChip(page)).toHaveText(/^\s*47\.2k tokens/);
    await expect(costChip(page)).toHaveText(/^\s*<?\$\d+\.\d\d\s*$/);
    await expect(costChip(page).getByTitle(COST_TOOLTIP, { exact: true })).toBeVisible();
    const order = [place(page, folder), contextChip(page), tokensChip(page), costChip(page), zoomControls(page)];
    const boxes = await Promise.all(order.map((item) => box(item)));
    for (const [n, item] of boxes.entries()) {
      near(item.y + item.height / 2, foot.y + foot.height / 2, `footer item ${n} on the footer row`);
      const next = boxes[n + 1];
      if (next) expect(item.x + item.width, `footer item ${n} before the next one`).toBeLessThanOrEqual(next.x + TOLERANCE);
    }
    const zoom = boxes[4]!;
    near(zoom.x + zoom.width, foot.x + foot.width - 16, 'text size controls at the right end');
    await expect(footer(page).locator('kbd')).toHaveCount(0);
    await expect(mainArea(page)).not.toContainText('back to the list');
  });

  // plan-session_list_width/REQ-23, REQ-24 — scenario "The user sees the token parts and the context warning in the footer"
  test('the token parts show on keyboard focus and on hover, and 92% of context shows in the error colour', async ({ page, request }) => {
    const folder = await newFolder('full-context');
    await hosted(request, folder, 'Explain the code', [response({ input: 4_000, output: 2_000, cacheWrite: 30_000, cacheRead: 150_000 })]);
    await page.goto('/');
    await entry(page, folder).click();
    await page.mouse.move(0, 0);
    await expect(tokensChip(page)).toHaveText(/^\s*186k tokens/);
    await expect(tooltip(page)).toBeHidden();

    // Tab order: the tokens total comes right before the text size controls.
    await zoomControls(page).getByRole('button').first().focus();
    await page.keyboard.press('Shift+Tab');
    await expect(tokensChip(page)).toBeFocused();
    await expect(tooltip(page)).toBeVisible();
    await expect(tooltip(page)).toHaveText(/^\s*Input\s*4k\s*Output\s*2k\s*Cache write\s*30k\s*Cache read\s*150k\s*$/);
    await expect(tokensChip(page)).toHaveAttribute('aria-describedby', (await tooltip(page).getAttribute('id'))!);
    near((await box(footer(page))).height, 40, 'footer height with the tooltip open');
    const chip = await box(tokensChip(page));
    const tip = await box(tooltip(page));
    expect(tip.y + tip.height, 'the tooltip sits above the chip').toBeLessThanOrEqual(chip.y + TOLERANCE);
    near(tip.x + tip.width, chip.x + chip.width, 'tooltip aligned to the right edge of the chip');
    await page.keyboard.press('Tab');
    await expect(tooltip(page)).toBeHidden();

    await tokensChip(page).hover();
    await expect(tooltip(page)).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(tooltip(page)).toBeHidden();

    const rose = await colourOf(page, '--rose-400');
    const value = contextChip(page).getByText(/92%/);
    await expect(value).toHaveText('184k / 200k · 92%');
    await expect(value).toHaveCSS('color', rose);
  });

  // plan-session_list_width/REQ-16, REQ-19, REQ-20, REQ-21 — scenario "The user opens an external session"
  test('an external session shows its label in the header and "Open in Another Terminal · " with the path and figures in the footer', async ({ page, request }) => {
    const folder = await newFolder('external');
    const sessionId = crypto.randomUUID();
    const write = await transcript(folder, sessionId);
    await write(userText('Explain the code'), response(SOME_RESPONSES));
    await runInTerminal(sessionId, folder);
    await page.goto('/');
    await entry(page, folder).click(SCAN);
    await page.mouse.move(0, 0);

    const name = path.basename(folder);
    const label = escaped(await labelOf(request, folder, true));
    await expect(header(page)).toHaveText(new RegExp(`^\\s*${name}\\s*${label}\\s*(Running|Needs Input|Idle)\\s*Read-only\\s*Resume Here\\s*$`));
    await expect(header(page)).not.toContainText('Open in Another Terminal');

    await expect(place(page, folder)).toHaveText(`Open in Another Terminal · ${folder}`);
    await expect(contextChip(page)).toHaveText(/^\s*Context\s*45\.2k \/ 200k · 23%\s*$/);
    await expect(tokensChip(page)).toHaveText(/^\s*47\.2k tokens/);
    await expect(costChip(page)).toHaveText(/^\s*<?\$\d+\.\d\d\s*$/);
    near((await box(footer(page))).height, 40, 'footer height');
    await expect(zoomControls(page)).toHaveCount(0);
  });

  // plan-session_list_width/REQ-17, REQ-18, REQ-25 — scenario "Long texts are cut, and their full text stays available"
  test('at 700 px a long label and a long path are cut with "…" and keep their full text', async ({ page, request }) => {
    const folder = path.join(await newFolder('long'), ...Array.from({ length: 6 }, (_, i) => `a-folder-with-a-very-long-name-${i}`));
    await mkdir(folder, { recursive: true });
    const prompt = `Refactor the payment module ${'and keep every invoice consistent '.repeat(6)}end`;
    await hosted(request, folder, prompt, [response(SOME_RESPONSES)]);
    const label = await labelOf(request, folder);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await mainAreaWidth(page, 700);
    await entry(page, folder).click();
    await page.mouse.move(0, 0);

    const line = header(page).locator('.mono-chip').filter({ hasText: label.slice(0, 30) });
    await expect(line).toHaveCount(1);
    expect(await isCutWithEllipsis(line), 'the label ends with "…"').toBe(true);
    await expectOneRow(page, [
      header(page).getByRole('heading', { level: 2 }),
      line,
      header(page).getByText('Idle', { exact: true }),
      ...(await header(page).getByRole('button').all()),
    ]);
    for (const action of await header(page).getByRole('button').all()) await expect(action).toBeInViewport({ ratio: 1 });

    // Hover shows the full label; pointer away hides it.
    await expect(tooltip(page)).toBeHidden();
    await line.hover();
    await expect(tooltip(page)).toBeVisible();
    await expect(tooltip(page)).toHaveText(label);
    await expect(line).toHaveAttribute('aria-describedby', (await tooltip(page).getAttribute('id'))!);
    near((await box(header(page))).height, 40, 'header height with the tooltip open');
    await page.mouse.move(0, 0);
    await expect(tooltip(page)).toBeHidden();

    // Keyboard focus shows it too: the label chip comes right before "Search".
    await header(page).getByRole('button', { name: 'Search' }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(line).toBeFocused();
    await expect(tooltip(page)).toHaveText(label);
    await page.keyboard.press('Tab');
    await expect(tooltip(page)).toBeHidden();

    // The path in the footer: cut with "…", the full path as tooltip, the figures whole.
    await expect(place(page, folder)).toHaveText(folder);
    expect(await isCutWithEllipsis(place(page, folder)), 'the path ends with "…"').toBe(true);
    near((await box(footer(page))).height, 40, 'footer height');
    for (const figure of [contextChip(page), tokensChip(page), costChip(page), zoomControls(page)]) {
      await expect(figure).toBeInViewport({ ratio: 1 });
      expect(await figure.evaluate((el) => el.scrollWidth <= el.clientWidth), 'figure not cut').toBe(true);
    }
  });

  // plan-session_list_width/REQ-26 — scenario "A new session shows no figures yet"
  test('a new session shows the path and no figures', async ({ page, request }) => {
    const folder = await newFolder('fresh');
    await hosted(request, folder, 'Explain the code', []);
    await page.goto('/');
    await entry(page, folder).click();
    await expect(place(page, folder)).toHaveText(folder);
    await page.waitForTimeout(1_500);
    await expect(contextChip(page)).toHaveCount(0);
    await expect(tokensChip(page)).toHaveCount(0);
    await expect(costChip(page)).toHaveCount(0);
    for (const zero of ['0%', 'tokens', '$']) await expect(footer(page)).not.toContainText(zero);
  });

  // plan-session_list_width/REQ-27 — scenario "An ended session keeps its last figures"
  test('a session terminated from the header keeps its figures in the footer', async ({ page, request }) => {
    const folder = await newFolder('ended');
    await hosted(request, folder, 'Explain the code', [response(SOME_RESPONSES)], { working: true });
    await page.goto('/');
    await entry(page, folder).click();
    await expect(contextChip(page)).toHaveText(/45\.2k \/ 200k · 23%/);
    await expect(tokensChip(page)).toHaveText(/^\s*47\.2k tokens/);
    const cost = (await costChip(page).innerText()).trim();
    expect(cost).toMatch(/^<?\$\d+\.\d\d$/);

    await header(page).getByRole('button', { name: 'Terminate' }).click();
    const confirmation = page.getByRole('alertdialog', { name: 'Terminate the Session?' });
    await confirmation.getByRole('button', { name: 'Terminate' }).click();
    await expect(header(page).getByText('Ended', { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_500);
    await expect(contextChip(page)).toHaveText(/45\.2k \/ 200k · 23%/);
    await expect(tokensChip(page)).toHaveText(/^\s*47\.2k tokens/);
    await expect(costChip(page)).toHaveText(cost);
  });
});

type Rgba = [number, number, number, number];
const rgbaOf = (css: string): Rgba => {
  const [r = 0, g = 0, b = 0, a = 1] = (css.match(/[\d.]+/g) ?? []).map(Number);
  return [r, g, b, a];
};
/** `top` painted over the opaque `below`. */
const over = ([r, g, b, a]: Rgba, below: Rgba): Rgba => [r * a + below[0] * (1 - a), g * a + below[1] * (1 - a), b * a + below[2] * (1 - a), 1];
const linear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgba) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
/** WCAG 2.2 contrast ratio of two opaque colours. */
const contrast = (one: Rgba, two: Rgba) => {
  const [hi, lo] = [luminance(one), luminance(two)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
/** OKLab coordinates of an opaque colour. */
const oklab = ([r, g, b]: Rgba): [number, number, number] => {
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
// OKLab distance: about 0.02 is the smallest visible difference; 0.05 makes two colours clearly apart.
const CLEARLY_APART = 0.05;
const distance = (one: Rgba, two: Rgba) => Math.hypot(...oklab(one).map((v, i) => v - oklab(two)[i]!));

const actionButton = (page: Page, name: string) => header(page).getByRole('button', { name, exact: true });
const statePill = (page: Page, name: string) => header(page).locator('.status-pill').filter({ hasText: name });
const style = (locator: Locator, property: string) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);

test.describe('Order and look of the header actions of a hosted session', () => {
  // plan-session_list_width/REQ-30, REQ-31, REQ-32, REQ-36 — scenario "The user finds "Search", the state, "Interrupt" and "Terminate" in this order"
  test('"Search", the state, "Interrupt" and "Terminate" show and take the focus in this order', async ({ page, request }) => {
    const folder = await newFolder('order');
    const label = 'Add the invoice export';
    await hosted(request, folder, label, [response(SOME_RESPONSES)], { working: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await entry(page, folder).click();
    await page.mouse.move(0, 0);

    const search = actionButton(page, 'Search');
    const interrupt = actionButton(page, 'Interrupt');
    const stop = actionButton(page, 'Terminate');
    const pill = statePill(page, 'Running');
    await expect(pill).toBeVisible();
    const xs = await Promise.all([search, pill, interrupt, stop].map(async (item) => (await box(item)).x));
    expect([...xs].sort((a, b) => a - b), 'Search, state, Interrupt, Terminate from left to right').toEqual(xs);
    await expectOneRow(page, [search, pill, interrupt, stop]);

    // Tab from the label chip: "Search", then "Interrupt", then "Terminate"; the state takes no focus.
    await header(page).locator('.mono-chip').filter({ hasText: label }).focus();
    for (const next of [search, interrupt, stop]) {
      await page.keyboard.press('Tab');
      await expect(next).toBeFocused();
    }

    // "Interrupt": orange pause icon and text, no "■".
    const orange = await colourOf(page, '--orange-400');
    await expect(interrupt).toHaveCSS('color', orange);
    await expect(interrupt).not.toContainText('■');
    const icon = interrupt.locator('svg');
    await expect(icon).toHaveCount(1);
    await expect(icon).toBeVisible();
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(await style(icon, 'stroke'), 'the icon is drawn in orange').toBe(orange);
    const iconBox = await box(icon);
    const textLeft = await interrupt.evaluate((el) => {
      const node = [...el.childNodes].find((child) => child.nodeType === Node.TEXT_NODE && child.textContent?.includes('Interrupt'));
      const range = document.createRange();
      range.selectNodeContents(node!);
      return range.getBoundingClientRect().x;
    });
    expect(iconBox.x + iconBox.width, 'the icon comes before the text').toBeLessThanOrEqual(textLeft + TOLERANCE);

    // "Terminate": the rose look of the stop button, with its "■".
    await expect(stop).toHaveCSS('background-color', await colourOf(page, '--rose-500-15'));
    await expect(stop).toHaveCSS('color', await colourOf(page, '--rose-400'));
    await expect(stop).toHaveCSS('border-top-color', await colourOf(page, '--rose-500-30'));
    await expect(stop.getByText('■', { exact: true })).toHaveAttribute('aria-hidden', 'true');
  });

  // plan-session_list_width/REQ-33 — scenario ""Interrupt" stops Claude's turn as before"
  test('"Interrupt" sends Esc, gives the focus to the terminal and keeps its name with no tooltip', async ({ page, request }) => {
    const folder = await newFolder('interrupt');
    await hosted(request, folder, 'Explain the code', [], { working: true });
    await page.goto('/');
    await entry(page, folder).click();
    const interrupt = actionButton(page, 'Interrupt');
    await expect(interrupt).toHaveAccessibleName('Interrupt');
    await expect(interrupt).toHaveText(/^\s*Interrupt\s*$/);

    await interrupt.click();
    await expect(page.locator('.xterm-rows')).toContainText('IN:1b');
    await expect(page.locator('.xterm-helper-textarea')).toBeFocused();

    await interrupt.hover();
    await page.waitForTimeout(1_000);
    await expect(interrupt).not.toHaveAttribute('title');
    await expect(tooltip(page)).toHaveCount(0);
  });

  // plan-session_list_width/REQ-34, REQ-35 — scenario "The orange of "Interrupt" stays apart from the amber of needs input"
  test('in both themes "Interrupt" is orange, readable on the header, and apart from the amber of needs input', async ({ page, request }) => {
    const folder = await newFolder('needs-input');
    const id = await hosted(request, folder, 'Explain the code', [], { working: true });
    await hookEvent(request, id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    await page.goto('/');
    await entry(page, folder).click();
    const interrupt = actionButton(page, 'Interrupt');
    const pill = statePill(page, 'Needs Input');
    await expect(pill).toBeVisible();

    for (const theme of ['dark', 'light'] as const) {
      if (theme === 'light') {
        await page.getByRole('banner').getByRole('button', { name: 'Dark theme', exact: true }).click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      }
      await page.mouse.move(0, 0);
      const orange = await colourOf(page, '--orange-400');
      await expect(interrupt, `${theme}: orange text`).toHaveCSS('color', orange);
      expect(await style(interrupt.locator('svg'), 'stroke'), `${theme}: orange icon`).toBe(orange);
      const amber = rgbaOf(await style(pill, 'color'));
      expect(distance(rgbaOf(orange), amber), `${theme}: orange apart from the amber state`).toBeGreaterThanOrEqual(CLEARLY_APART);

      const surface = rgbaOf(await style(header(page), 'background-color'));
      const restingFill = await colourOf(page, '--orange-500-15');
      await expect(interrupt, `${theme}: orange fill`).toHaveCSS('background-color', restingFill);
      await expect(interrupt, `${theme}: orange border`).toHaveCSS('border-top-color', await colourOf(page, '--orange-500-30'));
      const resting = over(rgbaOf(restingFill), surface);
      const hoverFill = await colourOf(page, '--orange-500-25');
      await interrupt.hover();
      await expect(interrupt, `${theme}: hover fill`).toHaveCSS('background-color', hoverFill);
      const hovered = over(rgbaOf(hoverFill), surface);
      for (const [where, background] of [['header', surface], ['button', resting], ['hovered button', hovered]] as const) {
        expect(contrast(rgbaOf(orange), background), `${theme}: icon on the ${where}`).toBeGreaterThanOrEqual(3);
        expect(contrast(rgbaOf(orange), background), `${theme}: text on the ${where}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
