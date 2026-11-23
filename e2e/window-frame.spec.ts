// e2e of plan-dark_blue_theme, batch window-frame: title bar, rail, bottom bar and toast.
// The tests write the transcripts that Claude Code would write, so this spec runs in the claude-dir group.
/// <reference lib="dom" />
import { appendFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';
import { settingsButton } from './settings';
import { currentView, settled } from './motion';

// A route handler can still wait on the server when a test ends: its error then must not fail the test.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

type Theme = 'light' | 'dark';
const THEMES: Theme[] = ['dark', 'light'];
const TOLERANCE = 1;

let projectsRoot: string;
const createdIds: string[] = [];
const transcripts: string[] = [];

test.beforeEach(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-window-frame-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const file of transcripts.splice(0)) await rm(file, { force: true });
  await rm(projectsRoot, { recursive: true, force: true });
});

const topBar = (page: Page) => page.getByRole('banner');
const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const railButton = (page: Page, name: string) => rail(page).getByRole('button', { name, exact: true });
const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).locator('.session-entry').filter({ has: page.getByTitle(folder, { exact: true }) });
const footer = (page: Page) => currentView(page).locator('footer');
const contextChip = (page: Page) => footer(page).locator('.session-figure-context');
const contextFill = (page: Page) => contextChip(page).locator('.session-figure-context-fill');
const zoomGroup = (page: Page) => footer(page).getByRole('group', { name: 'Terminal text size' });
const terminal = (page: Page) => currentView(page).locator('.xterm-rows');
const toast = (page: Page) => page.getByRole('status').filter({ hasText: 'No session needs input' });
const snackbar = (page: Page) => page.getByRole('status').filter({ hasText: 'needs your input' });

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
}

const near = (actual: number, expected: number, what: string, tolerance = TOLERANCE) =>
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);

const style = (locator: Locator, property: string, pseudo?: string) =>
  locator.evaluate((el, [p, ps]) => getComputedStyle(el, ps ?? null).getPropertyValue(p as string), [property, pseudo] as const);

/** The colour the browser computes for a CSS colour value (e.g. `var(--role-accent)`). */
const colourOf = (page: Page, value: string) =>
  page.evaluate((v) => {
    const probe = document.createElement('span');
    probe.style.color = v;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, value);

async function openIn(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem('ai-client.theme', t), theme);
  await page.goto('/');
  if (theme === 'light') await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  else await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light');
  await expect(rail(page)).toBeVisible();
}

/** Shows in the page only the sessions of the running test: other specs start sessions on the same server. */
async function showOnlyOwnSessions(page: Page): Promise<void> {
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
}

async function newFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  return folder;
}

async function postHook(request: APIRequestContext, id: string, event: Record<string, string>): Promise<void> {
  expect((await request.post(`/api/sessions/${id}/hook-events`, { data: event })).status()).toBe(204);
}

async function startViaApi(request: APIRequestContext, folder: string): Promise<string> {
  const started = await request.post('/api/sessions', { data: { path: folder } });
  expect(started.status()).toBe(201);
  const { id } = (await started.json()) as { id: string };
  createdIds.push(id);
  return id;
}

/** An idle hosted session whose transcript holds one response with `context` tokens of context (200k window, Haiku). */
async function hostedWithContext(request: APIRequestContext, folder: string, context: number): Promise<string> {
  const claudeSessionId = crypto.randomUUID();
  const file = path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'), `${claudeSessionId}.jsonl`);
  await mkdir(path.dirname(file), { recursive: true });
  transcripts.push(file);
  const lines = [
    { type: 'user', isSidechain: false, message: { role: 'user', content: 'Work' } },
    {
      type: 'assistant',
      uuid: crypto.randomUUID(),
      isSidechain: false,
      message: {
        id: `msg_e2e_window_frame_${claudeSessionId}`,
        model: 'claude-haiku-5-5',
        role: 'assistant',
        content: [{ type: 'text', text: 'Done.' }],
        usage: { input_tokens: 2_000, output_tokens: 1_000, cache_creation_input_tokens: 3_000, cache_read_input_tokens: context - 5_000 },
      },
    },
  ];
  await appendFile(file, lines.map((line) => `${JSON.stringify(line)}\n`).join(''));
  const id = await startViaApi(request, folder);
  await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt: 'Work', session_id: claudeSessionId });
  await postHook(request, id, { hook_event_name: 'Stop', session_id: claudeSessionId });
  return id;
}

async function openSession(page: Page, folder: string): Promise<void> {
  await entry(page, folder).getByTitle(folder, { exact: true }).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
  await expect(footer(page)).toBeVisible();
}

/** A pill of the bottom bar: 5 px corners and a 1 px border. */
async function expectPill(locator: Locator, what: string): Promise<void> {
  expect(await style(locator, 'border-top-left-radius'), `${what}: 5 px corners`).toBe('5px');
  for (const side of ['top', 'right', 'bottom', 'left']) {
    expect(await style(locator, `border-${side}-width`), `${what}: 1 px ${side} border`).toBe('1px');
    expect(await style(locator, `border-${side}-style`), `${what}: ${side} border drawn`).not.toBe('none');
  }
}

/** A number of the bottom bar: monospace font and tabular figures. */
async function expectMonoTabular(locator: Locator, what: string): Promise<void> {
  expect(await style(locator, 'font-family'), `${what}: monospace font`).toMatch(/^["']?Roboto Mono["']?/);
  expect(await style(locator, 'font-variant-numeric'), `${what}: tabular figures`).toContain('tabular-nums');
}

for (const theme of THEMES) {
  // plan-dark_blue_theme/REQ-6 — scenario "the window frame takes the mock's layout"
  test(`${theme}: the title bar is 38 px high with the app identity on the left and "Plan Usage" on the right`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openIn(page, theme);
    const bar = await box(topBar(page));
    expect([bar.x, bar.y]).toEqual([0, 0]);
    near(bar.width, 1440, 'bar width');
    near(bar.height, 38, 'bar height', 0.5);
    near((await box(rail(page))).y, 38, 'the rail starts right under the bar', 0.5);
    expect(await style(topBar(page), 'background-color'), 'the title bar role surface').toBe(await colourOf(page, 'var(--role-chrome)'));

    const mark = await box(topBar(page).getByText('VX', { exact: true }));
    const brand = await box(topBar(page).getByText('Vexel', { exact: true }));
    const planUsage = await box(topBar(page).getByRole('button', { name: 'Plan Usage', exact: true }));
    expect(mark.x + mark.width, 'logo before the brand').toBeLessThanOrEqual(brand.x + TOLERANCE);
    expect(brand.x + brand.width, 'identity on the left half').toBeLessThan(720);
    expect(planUsage.x, '"Plan Usage" on the right half').toBeGreaterThan(720);
    for (const [what, b] of [['logo', mark], ['brand', brand], ['Plan Usage', planUsage]] as const) {
      expect(b.y, `${what} inside the bar`).toBeGreaterThanOrEqual(-TOLERANCE);
      expect(b.y + b.height, `${what} inside the bar`).toBeLessThanOrEqual(38 + TOLERANCE);
    }
  });

  // plan-dark_blue_theme/REQ-9
  test(`${theme}: the rail is 52 px wide, its buttons are 32 px squares with 8 px corners, and "Settings" sits at the bottom`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openIn(page, theme);
    const railBox = await box(rail(page));
    near(railBox.width, 52, 'rail width', 0.5);
    for (const name of ['New Claude Code Session', 'Sessions', 'Projects', 'Resume', 'Settings']) {
      const b = await box(railButton(page, name));
      near(b.width, 32, `${name}: width`, 0.5);
      near(b.height, 32, `${name}: height`, 0.5);
      expect(await style(railButton(page, name), 'border-top-left-radius'), `${name}: 8 px corners`).toBe('8px');
    }
    const settings = await box(settingsButton(page));
    const resume = await box(railButton(page, 'Resume'));
    expect(settings.y, '"Settings" below the top group').toBeGreaterThan(resume.y + resume.height + 100);
    expect(railBox.y + railBox.height - (settings.y + settings.height), '"Settings" at the bottom of the rail').toBeLessThanOrEqual(24);
  });

  // plan-dark_blue_theme/REQ-10
  test(`${theme}: "New Claude Code Session" is a square tinted with the accent, with an accent border and no gradient`, async ({ page }) => {
    await openIn(page, theme);
    const fab = railButton(page, 'New Claude Code Session');
    await page.mouse.move(700, 600);
    expect(await style(fab, 'background-image'), 'no gradient').toBe('none');
    await expect.poll(() => style(fab, 'background-color'), { message: 'accent at 20 %' }).toBe(
      await colourOf(page, 'color-mix(in srgb, var(--role-accent) 20%, transparent)'),
    );
    const accentBorder = await colourOf(page, 'var(--role-accent-border)');
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(await style(fab, `border-${side}-width`), `1 px ${side} border`).toBe('1px');
      expect(await style(fab, `border-${side}-color`), `accent ${side} border`).toBe(accentBorder);
    }
    expect(await style(fab, 'color'), 'plus icon in the accent').toBe(await colourOf(page, 'var(--role-accent)'));
    await fab.hover();
    await expect.poll(() => style(fab, 'background-color'), { message: 'accent at 30 % on hover' }).toBe(
      await colourOf(page, 'color-mix(in srgb, var(--role-accent) 30%, transparent)'),
    );
  });
}

/** The 3 px bar of a rail button: a pseudo-element 3 px wide, with its place in the page. */
function activeBarOf(button: Locator) {
  return button.evaluate((el) => {
    for (const pseudo of ['::before', '::after']) {
      const p = getComputedStyle(el, pseudo);
      if (p.content === 'none' || p.display === 'none' || Math.abs(parseFloat(p.width) - 3) > 0.1) continue;
      const r = el.getBoundingClientRect();
      const left = p.position === 'absolute' && getComputedStyle(el).position !== 'static' ? r.left + el.clientLeft + parseFloat(p.left) : NaN;
      return {
        left,
        height: parseFloat(p.height),
        background: p.backgroundColor,
        shadow: p.boxShadow,
        rightRadius: parseFloat(p.borderTopRightRadius),
        leftRadius: parseFloat(p.borderTopLeftRadius),
      };
    }
    return null;
  });
}

// plan-dark_blue_theme/REQ-11 — scenario "the window frame takes the mock's layout": the accent bar on "Sessions"
for (const theme of THEMES) {
  test(`${theme}: the active rail item shows a 3 px accent bar on the rail's left edge with a soft glow, and only the active one`, async ({ page }) => {
    await openIn(page, theme);
    const accent = await colourOf(page, 'var(--role-accent)');
    const glow = await colourOf(page, 'color-mix(in srgb, var(--role-accent) 80%, transparent)');
    const railLeft = (await box(rail(page))).x;

    await expect(railButton(page, 'Sessions')).toHaveAttribute('aria-current', 'page');
    const bar = await activeBarOf(railButton(page, 'Sessions'));
    expect(bar, '"Sessions" has the bar').not.toBeNull();
    near(bar!.left, railLeft, 'bar on the left edge of the rail', 0.5);
    near(bar!.height, 32 - 8, 'bar 4 px from the button top and bottom', 0.5);
    expect(bar!.background, 'accent bar').toBe(accent);
    expect(bar!.leftRadius, 'flat on the rail edge').toBe(0);
    expect(bar!.rightRadius, 'fully rounded on the right').toBeGreaterThanOrEqual(1.5);
    expect(bar!.shadow, 'soft glow').toMatch(/0px 0px 8px/);
    expect(bar!.shadow, 'glow in the accent at 80 %').toContain(glow);
    for (const name of ['Projects', 'Resume', 'Settings']) expect(await activeBarOf(railButton(page, name)), `${name}: no bar`).toBeNull();

    await railButton(page, 'Projects').click();
    await expect(railButton(page, 'Projects')).toHaveAttribute('aria-current', 'page');
    expect(await activeBarOf(railButton(page, 'Projects')), 'the bar moves to "Projects"').not.toBeNull();
    expect(await activeBarOf(railButton(page, 'Sessions')), '"Sessions" loses the bar').toBeNull();
  });
}

test.describe('bottom bar of an open session', () => {
  // plan-dark_blue_theme/REQ-12, REQ-13, REQ-14 — scenario "the window frame takes the mock's layout"
  for (const theme of THEMES) {
    test(`${theme}: the bottom bar is 32 px high, each value sits in a pill, the numbers are mono with tabular figures`, async ({ page, request }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const folder = await newFolder('frame-footer');
      await hostedWithContext(request, folder, 45_200);
      await openIn(page, theme);
      await openSession(page, folder);
      await expect(contextChip(page)).toHaveText(/^Context\s*45\.2k \/ 200k · 23%$/);

      const foot = await box(footer(page));
      near(foot.height, 32, 'bottom bar height', 0.5);
      expect(await style(footer(page), 'background-color'), 'the bottom bar role surface').toBe(await colourOf(page, 'var(--role-chrome)'));

      const place = footer(page).getByTitle(folder, { exact: true });
      await expectPill(place, 'path');
      await expectPill(contextChip(page), 'context');
      await expectPill(footer(page).locator('.session-figure-tokens'), 'tokens');
      await expectPill(footer(page).locator('.session-figure-cost'), 'cost');
      await expectPill(zoomGroup(page), 'text size');

      await expectMonoTabular(contextChip(page).getByText(/45\.2k \/ 200k · 23%/), 'context value');
      await expectMonoTabular(footer(page).locator('.session-figure-tokens'), 'tokens');
      await expectMonoTabular(footer(page).locator('.session-figure-cost'), 'cost');
      await expectMonoTabular(zoomGroup(page).getByRole('button', { name: 'Default text size (12 px)' }), 'text size value');
    });
  }

  // plan-dark_blue_theme/REQ-13: the fill follows the percentage, in the colour of its usage level
  test('the context pill fills in proportion to its percentage, in the colour of its level', async ({ page, request }) => {
    const normal = await newFolder('fill-normal');
    const warning = await newFolder('fill-warning');
    const error = await newFolder('fill-error');
    await hostedWithContext(request, normal, 45_200);
    await hostedWithContext(request, warning, 150_000);
    await hostedWithContext(request, error, 190_000);
    await openIn(page, 'dark');
    for (const [folder, percent, colour] of [
      [normal, 23, 'var(--role-accent)'],
      [warning, 75, 'var(--amber-400)'],
      [error, 95, 'var(--rose-400)'],
    ] as const) {
      await openSession(page, folder);
      await expect(contextChip(page)).toContainText(`· ${percent}%`);
      await expect(contextFill(page)).toHaveCount(1);
      const chip = await contextChip(page).evaluate((el) => el.clientWidth);
      const fill = (await box(contextFill(page))).width;
      near(fill, (chip * percent) / 100, `${percent}%: fill width`, 1.5);
      expect(await style(contextFill(page), 'background-color'), `${percent}%: fill at 25 %`).toBe(await colourOf(page, `color-mix(in srgb, ${colour} 25%, transparent)`));
      expect(await style(contextFill(page), 'border-right-width'), `${percent}%: 1 px right edge`).toBe('1px');
      expect(await style(contextFill(page), 'border-right-color'), `${percent}%: right edge at 45 %`).toBe(await colourOf(page, `color-mix(in srgb, ${colour} 45%, transparent)`));
      await expect(contextFill(page), 'decorative').toHaveAttribute('aria-hidden', 'true');
    }
  });
});

test.describe('short-message toast', () => {
  test.beforeEach(async ({ page }) => {
    await showOnlyOwnSessions(page);
  });

  // plan-dark_blue_theme/REQ-15 — scenario "a short message shows at the bottom right"
  for (const theme of THEMES) {
    test(`${theme}: "No session needs input" shows at the bottom right with 8 px corners, a border and an accent dot`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await openIn(page, theme);
      await page.keyboard.press('Alt+KeyI');
      await expect(toast(page)).toHaveText('No session needs input');
      await settled(toast(page));

      const b = await box(toast(page));
      near(1280 - (b.x + b.width), 20, '20 px from the right edge', 1);
      near(800 - (b.y + b.height), 20, '20 px from the bottom edge', 1);
      expect(await style(toast(page), 'border-top-left-radius'), '8 px corners').toBe('8px');
      expect(await style(toast(page), 'border-left-width'), '1 px border').toBe('1px');
      expect(await style(toast(page), 'border-left-color'), 'strong border').toBe(await colourOf(page, 'var(--role-border-strong)'));

      const dot = toast(page).locator(':scope > *').first();
      await expect(dot, 'the dot is decorative').toHaveAttribute('aria-hidden', 'true');
      const d = await box(dot);
      near(d.width, 8, 'dot width', 0.5);
      near(d.height, 8, 'dot height', 0.5);
      expect(await style(dot, 'border-top-left-radius'), 'round dot').toMatch(/^(50%|[4-9]px)$/);
      expect(await style(dot, 'background-color'), 'accent dot').toBe(await colourOf(page, 'var(--role-accent)'));
      const text = await toast(page).evaluate((el) => {
        const node = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
        if (!node) return null;
        const range = document.createRange();
        range.selectNodeContents(node);
        return range.getBoundingClientRect().left;
      });
      expect(text, 'the dot comes before the text').not.toBeNull();
      near(text! - (d.x + d.width), 8, 'dot and text 8 px apart', 1);
    });
  }

  // plan-dark_blue_theme/REQ-15, AppLayout "Shows": above the needs-input snackbar while that shows
  test('while the needs-input snackbar shows, the toast sits 8 px above it and never over it', async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const folder = await newFolder('toast-snackbar');
    const id = await startViaApi(request, folder);
    await openIn(page, 'dark');
    await expect(entry(page, folder)).toBeVisible();

    await page.keyboard.press('Alt+KeyI');
    await expect(toast(page)).toBeVisible();
    await postHook(request, id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    await expect(snackbar(page)).toBeVisible();
    await expect(toast(page), 'the toast still shows').toBeVisible();
    await settled(toast(page));
    await settled(snackbar(page));

    const t = await box(toast(page));
    const s = await box(snackbar(page));
    near(s.y - (t.y + t.height), 8, 'toast 8 px above the snackbar', 1);
    near(1280 - (t.x + t.width), 20, 'toast still 20 px from the right edge', 1);
  });
});
