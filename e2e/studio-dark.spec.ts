// e2e of plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark, batch studio-dark-restyle.
// Expected values come from the REQs, the specs and the `:root` block of .sdd/mockups/studio-dark/mock.html.
/// <reference lib="dom" />
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, type WebSocketRoute, expect, test } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };
type Rgba = [number, number, number, number];

const TOLERANCE = 1;
const CONVERSATION = /\/api\/external-sessions\/[^/]+\/conversation$/;

// Mock `:root` values, with the light-blue accent and the lightened muted text of the plan decisions.
const CANVAS = 'rgb(11, 11, 14)';
const SURFACE_1 = 'rgb(18, 18, 22)';
const SURFACE_2 = 'rgb(24, 24, 31)';
const SURFACE_3 = 'rgb(33, 33, 43)';
const TEXT_PRIMARY = 'rgb(243, 242, 238)';
const TEXT_SECONDARY = 'rgb(161, 160, 171)';
const TEXT_MUTED = 'rgb(137, 136, 148)';
const BORDER_SUBTLE = 'rgba(255, 255, 255, 0.07)';
const BORDER_STRONG = 'rgba(255, 255, 255, 0.13)';
const ACCENT = 'rgb(140, 207, 255)';
const ACCENT_GLOW = 'rgba(140, 207, 255, 0.16)';
const ACCENT_BORDER = 'rgba(140, 207, 255, 0.42)';
// Tailwind v3 status colours.
const EMERALD_400 = 'rgb(52, 211, 153)';
const EMERALD_500_15 = 'rgba(16, 185, 129, 0.15)';
const AMBER_300 = 'rgb(252, 211, 77)';
const AMBER_400 = 'rgb(251, 191, 36)';
const AMBER_500_40 = 'rgba(245, 158, 11, 0.4)';
const ROSE_400 = 'rgb(251, 113, 133)';
const ROSE_500_15 = 'rgba(244, 63, 94, 0.15)';
const ZINC_400 = 'rgb(161, 161, 170)';

let projectsRoot: string;
const createdIds: string[] = [];

test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });

test.beforeEach(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-studio-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  await rm(projectsRoot, { recursive: true, force: true });
});

const topBar = (page: Page) => page.getByRole('banner');
const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const railButton = (page: Page, name: string) => rail(page).getByRole('button', { name, exact: true });
const panel = (page: Page) => page.getByRole('region', { name: 'Session List' });
const mainArea = (page: Page) => page.getByRole('main');
const entry = (page: Page, folder: string) => panel(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const counter = (page: Page) => panel(page).getByRole('status').filter({ hasText: /needs? input/ });
const snackbar = (page: Page) => page.getByRole('status').filter({ hasText: 'needs your input' });
const terminal = (page: Page) => page.locator('.xterm-rows');
const subbar = (page: Page) => mainArea(page).locator('header');
const chooser = (page: Page) => page.getByRole('dialog', { name: 'New Claude Code Session' });
const history = (page: Page) => page.getByRole('dialog', { name: 'Resume Session' });
const button = (scope: Locator, name: string) => scope.getByRole('button', { name, exact: true });

/** Shows in the page only the sessions of this test, plus the given external entries. Returns the conversation socket getter. */
async function showOnly(page: Page, externals: object[] = []): Promise<() => Promise<WebSocketRoute>> {
  const own = (session: { folder?: unknown } | undefined) => typeof session?.folder === 'string' && session.folder.startsWith(projectsRoot + path.sep);
  await page.route(
    (url) => url.pathname === '/api/sessions',
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      const sessions = (await response.json()) as { folder?: unknown }[];
      await route.fulfill({ response, json: [...sessions.filter(own), ...externals] });
    },
  );
  await page.routeWebSocket(/\/api\/sessions\/events$/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((message) => {
      const frame = JSON.parse(String(message)) as { type?: string; session?: { folder?: unknown } };
      if (frame.type !== 'session' || own(frame.session)) ws.send(message);
    });
  });
  let socket: WebSocketRoute | undefined;
  await page.routeWebSocket(CONVERSATION, (ws) => {
    socket = ws;
  });
  return async () => {
    await expect.poll(() => socket !== undefined, { message: 'conversation socket connected' }).toBe(true);
    return socket!;
  };
}

async function newFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder, { recursive: true });
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

const startWorking = (request: APIRequestContext, id: string) => postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt: 'esegui i test' });
const askPermission = (request: APIRequestContext, id: string) => postHook(request, id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });

async function stopViaApi(request: APIRequestContext, id: string): Promise<void> {
  expect((await request.post(`/api/sessions/${id}/stop`)).status()).toBeLessThan(300);
}

async function openFromList(page: Page, folder: string): Promise<void> {
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
}

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
}

const style = (target: Locator, property: string, pseudo?: string) =>
  target.evaluate((el, [p, ps]) => getComputedStyle(el, ps ?? null).getPropertyValue(p!), [property, pseudo] as const);
const px = async (target: Locator, property: string, pseudo?: string) => parseFloat(await style(target, property, pseudo));

/** The computed form of a CSS colour value, so `#8ccfff` and `rgb(140, 207, 255)` compare equal. */
async function colour(page: Page, cssValue: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement('div');
    probe.style.color = value;
    document.body.append(probe);
    const result = getComputedStyle(probe).color;
    probe.remove();
    return result;
  }, cssValue);
}

const token = (page: Page, name: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

function parse(value: string): Rgba {
  const m = value.match(/rgba?\(([^)]+)\)/);
  expect(m, `colour ${value}`).not.toBeNull();
  const [r, g, b, a = '1'] = m![1]!.split(/[ ,/]+/).filter(Boolean);
  return [Number(r), Number(g), Number(b), Number(a)];
}

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Whether the element draws a bar of `width` px in `barColour` at its left edge: border, inset shadow or ::before. */
async function leftBar(target: Locator, barColour: string, width: number): Promise<boolean> {
  return target.evaluate(
    (el, [c, w]) => {
      const near = (v: string) => Math.abs(parseFloat(v) - (w as number)) <= 0.6;
      const s = getComputedStyle(el);
      if (near(s.borderLeftWidth) && s.borderLeftColor === c && s.borderLeftStyle !== 'none') return true;
      if (s.boxShadow.includes(c as string) && /inset/.test(s.boxShadow)) return true;
      for (const pseudo of ['::before', '::after']) {
        const p = getComputedStyle(el, pseudo);
        if (p.content !== 'none' && near(p.width) && p.backgroundColor === c) return true;
      }
      return false;
    },
    [barColour, width] as const,
  );
}

/** Background of the element, or of the first ancestor that paints one. */
async function effectiveBackground(target: Locator): Promise<string> {
  return target.evaluate((el) => {
    for (let node: Element | null = el; node; node = node.parentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
    }
    return getComputedStyle(document.documentElement).backgroundColor;
  });
}

async function expectPulse(target: Locator, pulses: boolean): Promise<void> {
  const animation = await target.evaluate((el) => {
    const s = getComputedStyle(el);
    return { name: s.animationName, duration: s.animationDuration, count: s.animationIterationCount };
  });
  if (pulses) {
    expect(animation.name, 'the dot pulses').not.toBe('none');
    expect(animation.duration).toBe('2s');
    expect(animation.count).toBe('infinite');
  } else {
    expect(animation.name, 'the dot does not pulse').toBe('none');
  }
}

// ---------------------------------------------------------------------------------------------------------------------
test.describe('theme and palette', () => {
  // REQ-1, REQ-2 — scenario "The user sees the client in the dark Studio look": dark on a light system
  test('the page is dark on a light system and declares only the dark colour scheme', async ({ page }) => {
    await page.goto('/');
    await expect(railButton(page, 'New Claude Code Session')).toBeVisible();
    expect(await effectiveBackground(page.locator('body'))).toBe(CANVAS);
    expect(await style(page.locator('body'), 'color')).toBe(TEXT_PRIMARY);
    expect(await style(page.locator('html'), 'color-scheme')).toBe('dark');
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'dark');

    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await effectiveBackground(page.locator('body')), 'the system theme changes nothing').toBe(CANVAS);
  });

  // REQ-4, ThemeTokens: the mock's :root values
  test('the canvas, surface, border and text tokens have the mock values', async ({ page }) => {
    await page.goto('/');
    const expected: Record<string, string> = {
      '--bg-canvas': CANVAS,
      '--bg-surface-1': SURFACE_1,
      '--bg-surface-2': SURFACE_2,
      '--bg-surface-3': SURFACE_3,
      '--bg-glass': 'rgba(24, 24, 31, 0.82)',
      '--border-subtle': BORDER_SUBTLE,
      '--border-strong': BORDER_STRONG,
      '--specular-top': 'rgba(255, 255, 255, 0.08)',
      '--text-primary': TEXT_PRIMARY,
      '--text-secondary': TEXT_SECONDARY,
      '--text-muted': TEXT_MUTED,
    };
    for (const [name, value] of Object.entries(expected)) expect(await colour(page, `var(${name})`), name).toBe(value);
    expect(await token(page, '--term-size')).toBe('12px');
  });

  // REQ-5, REQ-6, REQ-52, gatekeeper decision: the light-blue accent family
  test('the accent family is light blue, with glow at 16 %, border at 42 % and a darker deep end', async ({ page }) => {
    await page.goto('/');
    expect(await colour(page, 'var(--accent-primary)')).toBe(ACCENT);
    expect(await colour(page, 'var(--accent-secondary)')).toBe('rgb(214, 238, 255)');
    expect(await colour(page, 'var(--accent-deep)')).toBe('rgb(0, 142, 244)');
    expect(await colour(page, 'var(--accent-glow)')).toBe(ACCENT_GLOW);
    expect(await colour(page, 'var(--accent-border)')).toBe(ACCENT_BORDER);
    expect(await colour(page, 'var(--on-accent)')).toBe(CANVAS);
    const deep = parse(await colour(page, 'var(--accent-deep)'));
    expect(luminance(deep), 'the deep end is darker than the accent').toBeLessThan(luminance(parse(ACCENT)));
  });

  // Gatekeeper decision: the Material 3 roles, the old --color-* names and the type classes are deleted
  test('the Material 3 roles and the removed old names are not defined', async ({ page }) => {
    await page.goto('/');
    for (const name of ['--primary', '--on-primary', '--surface', '--sc-low', '--sc-high', '--outline', '--ember', '--color-bg', '--color-text', '--color-primary']) {
      expect(await token(page, name), name).toBe('');
    }
    expect(await colour(page, 'var(--color-error)')).toBe(ROSE_400);
    expect(await colour(page, 'var(--color-focus-ring)')).toBe(ACCENT);
    expect(await colour(page, 'var(--color-backdrop)')).toBe('rgba(0, 0, 0, 0.65)');
  });

  // REQ-7: selected text uses the accent at 30 %
  test('selected text has the accent at 30 % as background', async ({ page }) => {
    await page.goto('/');
    await expect(railButton(page, 'New Claude Code Session')).toBeVisible();
    expect(await page.locator('body').evaluate((el) => getComputedStyle(el, '::selection').backgroundColor)).toBe('rgba(140, 207, 255, 0.3)');
  });

  // REQ-3, WebEntry: thin 5 px rounded scrollbars with the strong border thumb, and scrollbar-width thin
  test('the stylesheet gives scrollbars the mock look and a thin width', async ({ page }) => {
    await page.goto('/');
    const rules = await page.evaluate(() =>
      [...document.styleSheets].flatMap((sheet) => {
        try {
          return [...sheet.cssRules].map((r) => r.cssText);
        } catch {
          return [];
        }
      }),
    );
    const scrollbar = rules.filter((r) => /::-webkit-scrollbar\s*\{/.test(r));
    expect(scrollbar.join('\n')).toMatch(/width:\s*5px/);
    const thumb = rules.filter((r) => /::-webkit-scrollbar-thumb/.test(r)).join('\n');
    expect(thumb).toMatch(/var\(--border-strong\)/);
    expect(thumb).toMatch(/border-radius/);
    expect(rules.join('\n')).toMatch(/scrollbar-width:\s*thin/);
  });

  // REQ-51: every text colour reaches 4.5:1 on the canvas and on the three surfaces
  test('primary, secondary and muted text reach 4.5:1 on canvas and surfaces 1, 2 and 3', async ({ page }) => {
    await page.goto('/');
    for (const text of ['--text-primary', '--text-secondary', '--text-muted']) {
      for (const bg of ['--bg-canvas', '--bg-surface-1', '--bg-surface-2', '--bg-surface-3']) {
        const ratio = contrast(parse(await colour(page, `var(${text})`)), parse(await colour(page, `var(${bg})`)));
        expect(ratio, `${text} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  // REQ-10, REQ-11: Roboto Flex for the UI, Roboto Mono for the mono parts
  test('the UI is in Roboto Flex and the list labels are in Roboto Mono', async ({ page, request }) => {
    await showOnly(page);
    await startViaApi(request, await newFolder('font-check'));
    await page.goto('/');
    expect(await style(page.locator('body'), 'font-family')).toMatch(/^["']?Roboto Flex["']?/);
    expect(await style(panel(page).getByRole('heading', { level: 1 }), 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    expect(await style(panel(page).locator('time').first(), 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('page frame', () => {
  // REQ-13, REQ-14, REQ-53 — scenario "The user sees the client in the dark Studio look"
  test('at 1440 x 900 the frame fills the window: 48 px top bar, 52 px rail, 224 px list panel, main to the right edge', async ({ page }) => {
    await showOnly(page);
    await page.goto('/');
    const bar = await box(topBar(page));
    expect(bar.x).toBe(0);
    expect(bar.y).toBe(0);
    expect(bar.width).toBeCloseTo(1440, 0);
    expect(bar.height).toBeCloseTo(48, 0);
    const railBox = await box(rail(page));
    expect(railBox.x).toBe(0);
    expect(railBox.y).toBeCloseTo(48, 0);
    expect(railBox.width).toBeCloseTo(52, 0);
    expect(railBox.y + railBox.height).toBeCloseTo(900, 0);
    const panelBox = await box(panel(page));
    expect(panelBox.x).toBeCloseTo(52, 0);
    expect(panelBox.width).toBeCloseTo(224, 0);
    const mainBox = await box(mainArea(page));
    expect(mainBox.x).toBeCloseTo(276, 0);
    expect(mainBox.x + mainBox.width).toBeCloseTo(1440, 0);
    expect(mainBox.y + mainBox.height).toBeCloseTo(900, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);
    expect(await style(topBar(page), 'border-radius')).toBe('0px');
  });

  // REQ-14, REQ-16, plan-keyboard_shortcuts/REQ-22, TopBar: logo mark, "Vexel for Claude", the shortcuts button, the theme switch and the accent "New Session", nothing else
  test('the top bar shows the "VX" mark, "Vexel for Claude" and only the shortcuts button, the theme switch, "Plan Usage" and "New Session"', async ({ page }) => {
    await page.goto('/');
    expect(await style(topBar(page), 'background-color')).toBe(SURFACE_2);
    expect(await style(topBar(page), 'border-bottom-color')).toBe(BORDER_SUBTLE);
    await expect(topBar(page)).toContainText('Vexel');
    await expect(topBar(page)).toContainText('for Claude');
    // plan-usage_limits/REQ-1: the usage button joins the bar.
    await expect(topBar(page).getByRole('button')).toHaveCount(4);
    await expect(button(topBar(page), 'Keyboard Shortcuts')).toBeVisible();
    await expect(button(topBar(page), 'Dark theme')).toBeVisible();
    await expect(button(topBar(page), 'Plan Usage')).toBeVisible();
    await expect(button(topBar(page), 'New Session')).toBeVisible();

    const mark = topBar(page).getByText('VX', { exact: true });
    await expect(mark).toBeVisible();
    await expect(mark).toHaveAttribute('aria-hidden', 'true');
    const markBox = await box(mark);
    expect(markBox.width).toBeCloseTo(28, 0);
    expect(markBox.height).toBeCloseTo(28, 0);
    expect(await style(mark, 'border-radius')).toBe('8px');
    const gradient = await style(mark, 'background-image');
    expect(gradient).toMatch(/^linear-gradient\(135deg, rgb\(140, 207, 255\).*rgb\(0, 142, 244\)/);
    expect(await style(mark, 'color')).toBe(CANVAS);
    expect(await style(mark, 'font-family')).toMatch(/^["']?Roboto Mono["']?/);

    const suffix = topBar(page).getByText('for Claude', { exact: true });
    expect(await style(suffix, 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    expect(await style(suffix, 'color')).toBe(TEXT_MUTED);
  });

  // REQ-14, REQ-52: the top bar button is accent with dark text reaching 4.5:1
  test('"New Session" in the top bar is the accent button with canvas text at 4.5:1 or more', async ({ page }) => {
    await page.goto('/');
    const newSession = button(topBar(page), 'New Session');
    const bg = await style(newSession, 'background-color');
    const fg = await style(newSession, 'color');
    expect(bg).toBe(ACCENT);
    expect(fg).toBe(CANVAS);
    expect(contrast(parse(fg), parse(bg))).toBeGreaterThanOrEqual(4.5);
    expect((await box(newSession)).height).toBeCloseTo(32, 0);
  });

  // REQ-15 — scenario "The new-session dialog uses the Studio modal": the top-bar button opens the dialog
  test('"New Session" in the top bar opens the new-session dialog', async ({ page }) => {
    await page.goto('/');
    await button(topBar(page), 'New Session').click();
    await expect(chooser(page)).toBeVisible();
  });

  // REQ-14: the rail and the list panel no longer show the logo or the brand
  test('the rail and the list panel show no logo and no brand', async ({ page }) => {
    await page.goto('/');
    await expect(rail(page)).not.toContainText('Vexel');
    await expect(panel(page)).not.toContainText('Vexel');
    await expect(rail(page).locator('[role="img"]')).toHaveCount(0);
    await expect(panel(page).getByRole('button', { name: 'New Session' })).toHaveCount(0);
  });

  // REQ-17, REQ-53: 52 px rail, 34 x 34 px buttons, the accent gradient "New Claude Code Session", a divider
  test('the rail shows "New Claude Code Session", a divider, "Sessions" and "Resume", all 34 x 34 px', async ({ page }) => {
    await page.goto('/');
    await expect(rail(page).getByRole('button')).toHaveCount(3);
    for (const name of ['New Claude Code Session', 'Sessions', 'Resume']) {
      const b = await box(railButton(page, name));
      expect(b.width, name).toBeCloseTo(34, 0);
      expect(b.height, name).toBeCloseTo(34, 0);
    }
    const fab = railButton(page, 'New Claude Code Session');
    expect(await style(fab, 'background-image')).toMatch(/^linear-gradient\(135deg, rgb\(140, 207, 255\).*rgb\(0, 142, 244\)/);
    expect(await style(fab, 'color')).toBe(CANVAS);
    const fabBox = await box(fab);
    const sessionsBox = await box(railButton(page, 'Sessions'));
    expect(sessionsBox.y - (fabBox.y + fabBox.height), 'room for the divider').toBeGreaterThan(6);
    expect(await style(rail(page), 'background-color')).toBe(SURFACE_1);
  });

  // REQ-18 — scenario "The user sees the client in the dark Studio look": tooltip on hover, no label under the buttons
  test('a rail button shows its name in a tooltip on hover and no label under it', async ({ page }) => {
    await page.goto('/');
    const resume = railButton(page, 'Resume');
    const tooltip = resume.getByText('Resume', { exact: true });
    expect(Number(await style(tooltip, 'opacity')), 'hidden before hover').toBe(0);
    await resume.hover();
    await expect.poll(async () => Number(await style(tooltip, 'opacity'))).toBe(1);
    const tip = await box(tooltip);
    const btn = await box(resume);
    expect(tip.x, 'the tooltip sits on the right of the button').toBeGreaterThan(btn.x + btn.width - TOLERANCE);
    expect(await style(tooltip, 'background-color')).toBe(SURFACE_3);
    for (const name of ['Sessions', 'Resume']) {
      const b = await box(railButton(page, name));
      expect(b.height, `${name}: no label under the icon`).toBeCloseTo(34, 0);
    }
  });

  // REQ-19: the active destination has accent glow, accent border and the 2.5 px bar on the left
  test('"Sessions" has the active style: accent glow, accent border and the 2.5 px accent bar', async ({ page }) => {
    await page.goto('/');
    const sessions = railButton(page, 'Sessions');
    await expect(sessions).toHaveAttribute('aria-current', 'page');
    expect(await style(sessions, 'background-color')).toBe(ACCENT_GLOW);
    expect(await style(sessions, 'border-top-color')).toBe(ACCENT_BORDER);
    expect(await style(sessions, 'color')).toBe(ACCENT);
    expect(await leftBar(sessions, ACCENT, 2.5)).toBe(true);
    expect(await style(railButton(page, 'Resume'), 'background-color')).toBe('rgba(0, 0, 0, 0)');
  });

  // REQ-20, REQ-21 — scenario "The user sees the client in the dark Studio look": small amber badge and the counter pill
  test('one session needing input gives a small amber "1" on the corner of "Sessions" and the amber "1 needs input" pill', async ({ page, request }) => {
    await showOnly(page);
    const id = await startViaApi(request, await newFolder('needs-badge'));
    await page.goto('/');
    await expect(entry(page, path.join(projectsRoot, 'needs-badge'))).toBeVisible();
    const sessions = railButton(page, 'Sessions');
    const badge = sessions.getByText('1', { exact: true });
    await expect(badge).toHaveCount(0);

    await askPermission(request, id);
    await expect(badge).toBeVisible();
    expect(await style(badge, 'background-color')).toBe(AMBER_400);
    expect(await style(badge, 'color')).toBe(CANVAS);
    expect(await style(badge, 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    const b = await box(badge);
    const s = await box(sessions);
    expect(b.height).toBeCloseTo(14, 0);
    expect(b.x + b.width, 'on the right corner').toBeGreaterThan(s.x + s.width);
    expect(b.y, 'on the top corner').toBeLessThan(s.y);

    await expect(counter(page)).toHaveText('1 needs input');
    const pill = counter(page).locator(':scope > *').first();
    expect(await style(pill, 'color')).toBe(AMBER_400);
    expect(await style(pill, 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
  });

  // REQ-12, REQ-21: the list title "Sessions" is a mono uppercase muted label
  test('the list title "Sessions" is the mono uppercase muted label', async ({ page }) => {
    await page.goto('/');
    const title = panel(page).getByRole('heading', { level: 1, name: 'Sessions' });
    await expect(title).toBeVisible();
    expect(await style(title, 'text-transform')).toBe('uppercase');
    expect(await px(title, 'font-size')).toBe(10);
    expect(await style(title, 'color')).toBe(TEXT_MUTED);
    expect(await style(panel(page), 'background-color')).toBe(SURFACE_1);
    expect(await style(panel(page), 'border-right-color')).toBe(BORDER_SUBTLE);
  });

  // REQ-22: the main area shows the dot grid
  test('the main area shows the 18 px dot grid', async ({ page }) => {
    await page.goto('/');
    expect(await style(mainArea(page), 'background-image')).toMatch(/radial-gradient\(rgba\(255, 255, 255, 0\.13\) 1px, (?:transparent|rgba\(0, 0, 0, 0\)) 1px\)/);
    expect(await style(mainArea(page), 'background-size')).toBe('18px 18px');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('session list', () => {
  // REQ-8, REQ-9, REQ-23 to REQ-29 — scenario "The list shows each session as a compact Studio row"
  test('working, idle, ended, external and needs-input sessions have their Studio rows', async ({ page, request }) => {
    const external = { id: 'ext-studio-1', folder: '/srv/esterni/mobile-app', label: 'Rifattorizza', state: 'idle', lastActivity: new Date().toISOString(), external: true };
    await showOnly(page, [external]);
    const working = await newFolder('working-row');
    const idle = await newFolder('idle-row');
    const ended = await newFolder('ended-row');
    const asking = await newFolder('asking-row');
    const workingId = await startViaApi(request, working);
    await startViaApi(request, idle);
    const endedId = await startViaApi(request, ended);
    const askingId = await startViaApi(request, asking);
    await startWorking(request, workingId);
    await askPermission(request, askingId);
    await stopViaApi(request, endedId);
    await page.goto('/');
    await expect(entry(page, ended)).toContainText('Ended');

    // REQ-23: dot, folder name, mono details, 6 px radius, no avatar
    const idleRow = entry(page, idle);
    expect(await style(idleRow, 'border-top-left-radius')).toBe('6px');
    await expect(idleRow.locator('.avatar')).toHaveCount(0);
    const idleDot = idleRow.locator('[aria-hidden="true"]').first();
    const dotBox = await box(idleDot);
    expect(dotBox.width).toBeCloseTo(8, 0);
    expect(dotBox.height).toBeCloseTo(8, 0);
    expect(await style(idleDot, 'background-color')).toBe(ZINC_400);
    await expectPulse(idleDot, false);
    expect(await style(idleRow.getByText('Idle', { exact: true }), 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    expect(await style(idleRow.locator('time'), 'font-family')).toMatch(/^["']?Roboto Mono["']?/);

    // REQ-23: surface 2 on hover
    await idleRow.hover();
    await expect.poll(() => style(idleRow, 'background-color')).toBe(SURFACE_2);

    // REQ-25: taller than 30 px only for the two lines
    const rowBox = await box(idleRow);
    expect(rowBox.height).toBeGreaterThan(30);
    expect(rowBox.height).toBeLessThanOrEqual(48 + TOLERANCE);

    // REQ-8, REQ-9, REQ-26: emerald pulsing dot and the emerald progress bar
    const workingRow = entry(page, working);
    const workingDot = workingRow.locator('[aria-hidden="true"]').first();
    expect(await style(workingDot, 'background-color')).toBe(EMERALD_400);
    await expectPulse(workingDot, true);
    expect(await style(workingRow.getByText('Running', { exact: true }), 'color')).toBe(EMERALD_400);
    const bar = workingRow.locator('.progress-bar');
    await expect(bar).toBeVisible();
    expect(await style(bar, 'background-color')).toBe(EMERALD_500_15);
    const indicatorColours = await bar.evaluate((el) =>
      [el, ...el.querySelectorAll('*')].flatMap((node) => ['::before', '::after', null].map((p) => getComputedStyle(node, p).backgroundColor)),
    );
    expect(indicatorColours, 'the indicator is emerald-400').toContain(EMERALD_400);

    // REQ-29: the ended row stays dimmed, in muted text
    const endedRow = entry(page, ended);
    expect(await style(endedRow, 'color')).toBe(TEXT_MUTED);
    expect(await style(endedRow.locator('[aria-hidden="true"]').first(), 'background-color')).toBe(ZINC_400);

    // REQ-27: the external row has a dashed border
    const externalRow = entry(page, external.folder);
    expect(await style(externalRow, 'border-top-style')).toBe('dashed');

    // REQ-28: the needs-input card in the permission-banner look, amber tag and accent "Reply"
    const card = panel(page).locator('li').filter({ has: page.getByTitle(asking, { exact: true }) }).locator(':scope > *').first();
    expect(await style(card, 'background-color')).toBe(SURFACE_2);
    expect(await style(card, 'border-top-color')).toBe(AMBER_500_40);
    expect(await style(card, 'border-top-left-radius')).toBe('12px');
    const tag = card.getByText('Needs Input', { exact: true });
    expect(await style(tag, 'text-transform')).toBe('uppercase');
    expect(await style(tag, 'color')).toBe(AMBER_300);
    const reply = button(card, 'Reply');
    expect(await style(reply, 'background-color')).toBe(ACCENT);
    expect(await style(reply, 'color')).toBe(CANVAS);

    // REQ-24: a click opens the working session; its row gets the glow and the 2 px accent bar
    await openFromList(page, working);
    await expect(workingRow).toHaveAttribute('aria-current', 'true');
    await expect.poll(() => style(workingRow, 'background-color')).toBe(ACCENT_GLOW);
    expect(await leftBar(workingRow, ACCENT, 2)).toBe(true);
  });

  // REQ-27: an open external row keeps its dashed border
  test('an open external entry keeps its dashed border and gets the accent bar', async ({ page }) => {
    const external = { id: 'ext-studio-2', folder: '/srv/esterni/web-app', label: 'Correggi', state: 'idle', lastActivity: new Date().toISOString(), external: true };
    const socket = await showOnly(page, [external]);
    await page.goto('/');
    const row = entry(page, external.folder);
    await row.click();
    (await socket()).send(JSON.stringify({ type: 'items', items: [] }));
    await expect(row).toHaveAttribute('aria-current', 'true');
    expect(await style(row, 'border-top-style')).toBe('dashed');
    await expect.poll(() => style(row, 'background-color')).toBe(ACCENT_GLOW);
    expect(await leftBar(row, ACCENT, 2)).toBe(true);
  });

  // REQ-9, Decisions "Motion": under reduced motion the dots stop
  test('with reduced motion the working dot does not pulse', async ({ page, request }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await showOnly(page);
    const folder = await newFolder('reduced-motion');
    await startWorking(request, await startViaApi(request, folder));
    await page.goto('/');
    await expect(entry(page, folder)).toContainText('Running');
    const dot = entry(page, folder).locator('[aria-hidden="true"]').first();
    const animation = await dot.evaluate((el) => {
      const s = getComputedStyle(el);
      return { name: s.animationName, state: s.animationPlayState, duration: s.animationDuration };
    });
    expect(animation.name === 'none' || animation.state === 'paused' || animation.duration === '0s', JSON.stringify(animation)).toBe(true);
  });

  // REQ-8: the needs-input dot is amber and pulses (external row, which has the dot)
  test('an external needs-input row has the pulsing amber dot and the "External" chip', async ({ page }) => {
    const external = { id: 'ext-studio-3', folder: '/srv/esterni/api', label: 'Aggiorna', state: 'needs_input', waitingTool: 'Edit', lastActivity: new Date().toISOString(), external: true };
    await showOnly(page, [external]);
    await page.goto('/');
    const row = entry(page, external.folder);
    const dot = row.locator('[aria-hidden="true"]').first();
    expect(await style(dot, 'background-color')).toBe(AMBER_400);
    await expectPulse(dot, true);
    expect(await style(row, 'border-top-style')).toBe('dashed');
    const chip = row.getByText('External', { exact: true });
    expect(await style(chip, 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    await expect(button(row, 'Reply')).toHaveCount(0);
    await expect(row).toContainText('Permission for Edit');
  });

  // REQ-12: the group titles are mono uppercase muted labels
  test('the group headings are mono uppercase muted labels', async ({ page, request }) => {
    await showOnly(page);
    await startViaApi(request, await newFolder('group-heading'));
    await page.goto('/');
    const heading = panel(page).getByRole('heading', { level: 2 }).first();
    await expect(heading).toBeVisible();
    expect(await style(heading, 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    expect(await style(heading, 'text-transform')).toBe('uppercase');
    expect(await px(heading, 'font-size')).toBe(10);
    expect(await style(heading, 'color')).toBe(TEXT_MUTED);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('hosted session view', () => {
  // REQ-30, REQ-31, REQ-32, REQ-34, REQ-35, REQ-42 — scenario "The open hosted session uses the Studio subbar and terminal"
  test('the open working session has the 40 px subbar, the 12 px terminal on canvas and no key badges; the snackbar sits at the bottom right', async ({ page, request }) => {
    await showOnly(page);
    const open = await newFolder('billing-api');
    const other = await newFolder('web-dashboard');
    const openId = await startViaApi(request, open);
    const otherId = await startViaApi(request, other);
    await page.goto('/');
    await openFromList(page, open);
    await startWorking(request, openId);

    // REQ-30, REQ-53, plan-session_list_width/REQ-15, REQ-20: 40 px subbar with name, pill and actions, no avatar; the mono path is in the footer
    const head = subbar(page);
    await expect(head.getByRole('heading', { level: 2, name: 'billing-api' })).toBeVisible();
    expect((await box(head)).height).toBeCloseTo(40, 0);
    await expect(head).not.toContainText(open);
    const pathText = mainArea(page).locator('footer').getByText(open, { exact: true });
    expect(await style(pathText, 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    await expect(head.locator('.avatar')).toHaveCount(0);

    // REQ-31: the emerald tinted mono pill with its dot
    const pill = head.getByText('Running', { exact: true });
    await expect(pill).toBeVisible();
    expect(await style(pill, 'background-color')).toBe(EMERALD_500_15);
    expect(await style(pill, 'color')).toBe(EMERALD_400);
    expect(await style(pill, 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    await expect(pill.locator('[aria-hidden="true"]')).toHaveCount(1);

    // REQ-32, changed by plan-session_list_width/REQ-32, REQ-36: orange "Interrupt" with a pause icon, rose "Terminate" with "■"
    const interrupt = button(head, 'Interrupt');
    expect(await style(interrupt, 'color')).toBe(await colour(page, 'var(--orange-400)'));
    expect(await style(interrupt, 'background-color')).toBe(await colour(page, 'var(--orange-500-15)'));
    await expect(interrupt.locator('svg')).toHaveCount(1);
    await expect(interrupt).not.toContainText('■');
    const stop = button(head, 'Terminate');
    expect(await style(stop, 'color')).toBe(ROSE_400);
    expect(await style(stop, 'background-color')).toBe(ROSE_500_15);
    await expect(stop).toContainText('■');
    for (const action of [interrupt, stop]) expect(await style(action, 'font-family')).toMatch(/^["']?Roboto Mono["']?/);

    // REQ-34: the terminal panel on canvas, subtle border, 8 px radius, 12 px mono
    const region = page.getByRole('region', { name: 'Terminal: billing-api' });
    expect(await style(region, 'background-color')).toBe(CANVAS);
    expect(await style(region, 'border-top-color')).toBe(BORDER_SUBTLE);
    expect(await style(region, 'border-top-left-radius')).toBe('8px');
    expect(await effectiveBackground(page.locator('.xterm-screen'))).toBe(CANVAS);
    expect(await px(terminal(page), 'font-size')).toBe(12);
    expect(await style(terminal(page), 'font-family')).toMatch(/^["']?Roboto Mono["']?/);

    // plan-session_list_width, assumption "Key hint": no keyboard badges under the terminal
    await expect(mainArea(page).locator('kbd')).toHaveCount(0);

    // REQ-42, REQ-41: the snackbar is the glass toast, fixed 20 px from the bottom right corner of the window
    const before = await box(region);
    await askPermission(request, otherId);
    await expect(snackbar(page)).toBeVisible();
    const toast = await box(snackbar(page));
    expect(toast.x + toast.width).toBeCloseTo(1440 - 20, 0);
    expect(toast.y + toast.height).toBeCloseTo(900 - 20, 0);
    expect(await style(snackbar(page), 'position')).toBe('fixed');
    expect(await style(snackbar(page), 'background-color')).toBe('rgba(24, 24, 31, 0.82)');
    expect.soft(await style(snackbar(page), 'backdrop-filter')).toBe('blur(14px)');
    expect(await style(snackbar(page), 'border-top-left-radius')).toBe('8px');
    expect(await style(snackbar(page), 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    expect(await style(button(snackbar(page), 'Open'), 'color')).toBe(ACCENT);
    expect(await box(region), 'the terminal panel does not resize for the snackbar').toEqual(before);
  });

  // plan-session_list_width/REQ-28: the footer under the terminal, in place of the hint row, is 40 px high
  test('the footer under the terminal is 40 px high', async ({ page, request }) => {
    await showOnly(page);
    const folder = await newFolder('footer-row');
    await startViaApi(request, folder);
    await page.goto('/');
    await openFromList(page, folder);
    expect((await box(mainArea(page).locator('footer'))).height).toBeCloseTo(40, 0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('external session view', () => {
  // REQ-33, REQ-36 to REQ-41 — scenario "The external session shows messages and tool cards in the Studio style"
  test('the external view shows square avatars, left-aligned messages, the mono chip and the failed tool card', async ({ page }) => {
    const external = { id: 'ext-studio-4', folder: '/srv/esterni/negozio', label: 'Aggiungi il carrello', state: 'idle', lastActivity: new Date().toISOString(), external: true };
    const socket = await showOnly(page, [external]);
    await page.goto('/');
    await entry(page, external.folder).click();
    const today = `${new Date().toISOString().slice(0, 10)}T09:30:00.000Z`;
    (await socket()).send(
      JSON.stringify({
        type: 'items',
        items: [
          { kind: 'user', text: 'Esegui i test', timestamp: today },
          { kind: 'assistant', text: 'Lancio `npm test` ora.' },
          { kind: 'tool_call', name: 'Bash', summary: 'npm test', id: 'tool-1' },
          { kind: 'tool_result', text: 'Errore: 2 test falliti', truncated: false, toolUseId: 'tool-1', isError: true },
        ],
      }),
    );
    const userMessage = mainArea(page).getByRole('article', { name: 'You', exact: true });
    const claudeMessage = mainArea(page).getByRole('article', { name: 'Claude', exact: true });
    await expect(userMessage).toContainText('Esegui i test');

    // REQ-53: the subbar of the external view is 40 px high too
    expect.soft((await box(subbar(page))).height, 'external subbar height').toBeCloseTo(40, 0);

    // REQ-33: accent "Resume Here", neutral mono "Read-only"
    const resume = button(mainArea(page), 'Resume Here');
    expect(await style(resume, 'background-color')).toBe(ACCENT);
    expect(await style(resume, 'color')).toBe(CANVAS);
    expect((await box(resume)).height).toBeCloseTo(32, 0);
    const readOnly = mainArea(page).getByText('Read-only', { exact: true });
    expect(await style(readOnly, 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    expect(await effectiveBackground(readOnly)).toBe(SURFACE_2);

    // REQ-36, REQ-38: 24 px square avatars, "U" and the accent "✦"
    const userAvatar = userMessage.getByText('U', { exact: true });
    const claudeAvatar = claudeMessage.getByText('✦', { exact: true });
    for (const avatar of [userAvatar, claudeAvatar]) {
      const b = await box(avatar);
      expect(b.width).toBeCloseTo(24, 0);
      expect(b.height).toBeCloseTo(24, 0);
      expect(await style(avatar, 'border-top-left-radius')).toBe('6px');
    }
    expect(await style(claudeAvatar, 'background-color')).toBe(ACCENT);
    expect(await style(claudeAvatar, 'color')).toBe(CANVAS);
    expect(await style(userAvatar, 'background-color')).toBe(SURFACE_3);

    // REQ-36: the name line with the mono time
    await expect(userMessage.getByText('You', { exact: true })).toBeVisible();
    await expect(claudeMessage.getByText('Claude', { exact: true })).toBeVisible();
    const time = userMessage.locator('time');
    expect(await style(time, 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    expect(await style(time, 'color')).toBe(TEXT_MUTED);

    // REQ-37: the user message is left-aligned, its text in a surface-2 box
    const userBox = await box(userAvatar);
    const claudeBox = await box(claudeAvatar);
    expect(userBox.x).toBeCloseTo(claudeBox.x, 0);
    const userText = userMessage.getByText('Esegui i test', { exact: true });
    expect(await effectiveBackground(userText)).toBe(SURFACE_2);
    expect((await box(userText)).x).toBeGreaterThan(userBox.x + userBox.width);

    // REQ-40: inline code is a mono chip
    const code = claudeMessage.getByText('npm test', { exact: true });
    expect(await style(code, 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    expect(await style(code, 'background-color')).toBe(SURFACE_2);
    expect(await style(code, 'border-top-left-radius')).toBe('4px');
    await expect(claudeMessage).not.toContainText('`');

    // REQ-39: the tool card row, then the open output on canvas
    const card = mainArea(page).getByRole('article', { name: 'Tool: Bash' });
    const toggle = card.getByRole('button').first();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(card.locator('svg')).toHaveCount(0);
    const name = toggle.getByText('Bash', { exact: true });
    expect(await style(name, 'color')).toBe(ACCENT);
    expect(await style(name, 'background-color')).toBe(SURFACE_3);
    expect(await style(toggle.getByText('npm test', { exact: true }), 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    const outcome = toggle.getByText(/Error/);
    await expect(outcome).toContainText('▾');
    expect(await style(outcome, 'color')).toBe(ROSE_400);
    expect(await style(outcome, 'font-family')).toMatch(/^["']?Roboto Mono["']?/);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const output = card.getByText('Errore: 2 test falliti');
    await expect(output).toBeVisible();
    expect(await effectiveBackground(output)).toBe(CANVAS);
    expect(await px(output, 'font-size')).toBe(12);
    expect(await style(output, 'color')).toBe(TEXT_SECONDARY);
  });

  // REQ-41: "N new messages" is the glass toast
  test('"N new messages" is a glass button in mono', async ({ page }) => {
    const external = { id: 'ext-studio-5', folder: '/srv/esterni/lungo', label: 'Molti messaggi', state: 'idle', lastActivity: new Date().toISOString(), external: true };
    const socket = await showOnly(page, [external]);
    await page.goto('/');
    await entry(page, external.folder).click();
    const ws = await socket();
    ws.send(JSON.stringify({ type: 'items', items: Array.from({ length: 40 }, (_, i) => ({ kind: 'assistant', text: `messaggio ${i + 1}` })) }));
    await expect(mainArea(page).getByText('messaggio 40', { exact: true })).toBeVisible();
    await mainArea(page).getByText('messaggio 1', { exact: true }).scrollIntoViewIfNeeded();
    ws.send(JSON.stringify({ type: 'items', items: [{ kind: 'assistant', text: 'nuovo 1' }, { kind: 'assistant', text: 'nuovo 2' }] }));
    const more = button(mainArea(page), '2 new messages');
    await expect(more).toBeVisible();
    expect(await style(more, 'background-color')).toBe('rgba(24, 24, 31, 0.82)');
    expect.soft(await style(more, 'backdrop-filter')).toBe('blur(14px)');
    expect(await style(more, 'border-top-left-radius')).toBe('8px');
    expect(await style(more, 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    expect(await px(more, 'font-size')).toBe(12);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('dialogs', () => {
  // REQ-43, REQ-44, REQ-46, REQ-47 — scenario "The new-session dialog uses the Studio modal"
  test('the new-session dialog has the mock modal: dark backdrop with no blur, header with dot and "[Esc]", mono field, surface-1 footer', async ({ page }) => {
    await page.goto('/');
    await button(topBar(page), 'New Session').click();
    const dialog = chooser(page);
    await expect(dialog).toBeVisible();

    // REQ-43: backdrop and frame
    const backdrop = dialog.locator('xpath=..');
    expect(await style(backdrop, 'background-color')).toBe('rgba(0, 0, 0, 0.65)');
    expect(await style(backdrop, 'backdrop-filter')).toBe('none');
    expect(await style(dialog, 'background-color')).toBe(SURFACE_2);
    expect(await style(dialog, 'border-top-color')).toBe(BORDER_STRONG);
    expect(await style(dialog, 'border-top-left-radius')).toBe('12px');
    expect((await box(dialog)).width).toBeLessThanOrEqual(448 + TOLERANCE);

    // REQ-44: the accent dot, the title and the mono "[Esc]"
    const title = dialog.getByRole('heading', { name: 'New Claude Code Session' });
    const esc = button(dialog, 'Close (Esc)');
    await expect(esc).toHaveText('[Esc]');
    expect(await style(esc, 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    expect(await style(esc, 'color')).toBe(TEXT_MUTED);
    expect((await box(esc)).x).toBeGreaterThan((await box(title)).x);
    const dot = await title.evaluate((el) => {
      const dotEl = el.previousElementSibling;
      if (!dotEl) return null;
      const s = getComputedStyle(dotEl);
      return { bg: s.backgroundColor, w: dotEl.getBoundingClientRect().width, hidden: dotEl.getAttribute('aria-hidden') };
    });
    expect(dot).toEqual({ bg: ACCENT, w: 8, hidden: 'true' });
    expect(await px(title, 'font-size')).toBe(14);
    expect(await style(title, 'font-weight')).toBe('600');

    // REQ-46: the mono label and the field on canvas, accent border on focus
    const field = dialog.getByRole('textbox', { name: 'Working Directory Path', exact: true });
    const label = dialog.getByText('Working Directory Path', { exact: true });
    expect(await px(label, 'font-size')).toBe(11);
    expect(await style(label, 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    expect(await style(field, 'background-color')).toBe(CANVAS);
    expect(await style(field, 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    await expect(field).toBeFocused();
    expect(await style(field, 'border-top-color')).toBe(ACCENT_BORDER);
    expect((await box(label)).y).toBeLessThan((await box(field)).y);

    // REQ-47: surface-1 footer, neutral "Cancel", accent "Start Session"
    const cancel = button(dialog, 'Cancel');
    const start = button(dialog, 'Start Session');
    const footer = cancel.locator('xpath=..');
    expect(await style(footer, 'background-color')).toBe(SURFACE_1);
    expect(await style(footer, 'border-top-color')).toBe(BORDER_SUBTLE);
    expect(await style(cancel, 'background-color')).toBe(SURFACE_2);
    expect(await style(cancel, 'color')).toBe(TEXT_PRIMARY);
    expect(await style(start, 'background-color')).toBe(ACCENT);
    expect(await style(start, 'color')).toBe(CANVAS);
    expect((await box(start)).x).toBeGreaterThan((await box(cancel)).x);
  });

  // REQ-45 — scenario "The new-session dialog uses the Studio modal": "[Esc]" closes as "Cancel", the open session stays
  test('a click on "[Esc]" closes the new-session dialog and the open session does not change', async ({ page, request }) => {
    await showOnly(page);
    const folder = await newFolder('esc-keeps-open');
    await startViaApi(request, folder);
    await page.goto('/');
    await openFromList(page, folder);
    await button(topBar(page), 'New Session').click();
    await expect(chooser(page)).toBeVisible();
    await button(chooser(page), 'Close (Esc)').click();
    await expect(chooser(page)).toHaveCount(0);
    await expect(entry(page, folder)).toHaveAttribute('aria-current', 'true');
    await expect(terminal(page)).toContainText(`CWD:${folder}`);
  });

  // REQ-45, Dialog "Keyboard": "[Esc]" is in the focus trap
  test('Tab from "Start Session" wraps to "[Esc]" inside the dialog', async ({ page }) => {
    await page.goto('/');
    await button(topBar(page), 'New Session').click();
    const dialog = chooser(page);
    await button(dialog, 'Start Session').focus();
    await page.keyboard.press('Tab');
    await expect(button(dialog, 'Close (Esc)')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(button(dialog, 'Start Session')).toBeFocused();
  });

  // REQ-45: "[Esc]" in the resume dialog closes it too
  test('a click on "[Esc]" closes the resume dialog', async ({ page }) => {
    await page.route('**/api/past-sessions', (route) => route.fulfill({ json: [] }));
    await page.goto('/');
    await railButton(page, 'Resume').click();
    await expect(history(page)).toBeVisible();
    await button(history(page), 'Close (Esc)').click();
    await expect(history(page)).toHaveCount(0);
  });

  // REQ-48 — scenario "The stop confirmation is drawn in rose"
  test('the stop confirmation shows "Terminate" in rose and focuses "Cancel"', async ({ page, request }) => {
    await showOnly(page);
    const folder = await newFolder('stop-rose');
    const id = await startViaApi(request, folder);
    await page.goto('/');
    await openFromList(page, folder);
    await startWorking(request, id);
    await expect(subbar(page).getByText('Running', { exact: true })).toBeVisible();
    await button(subbar(page), 'Terminate').click();
    const confirm = page.getByRole('alertdialog', { name: 'Terminate the Session?' });
    await expect(confirm).toBeVisible();
    await expect(button(confirm, 'Cancel')).toBeFocused();
    const primary = button(confirm, 'Terminate');
    expect(await style(primary, 'color')).toBe(ROSE_400);
    expect(await style(primary, 'background-color')).toBe(ROSE_500_15);
    await expect(confirm.locator('svg')).toHaveCount(0);
  });

  // REQ-49 — scenario "The running-elsewhere warning is drawn in amber"
  test('"Resume Here" opens the warning with the text in an amber banner and "Resume Anyway" in amber', async ({ page }) => {
    const external = { id: 'ext-studio-6', folder: '/srv/esterni/ricerca', label: 'Analisi', state: 'idle', lastActivity: new Date().toISOString(), external: true };
    const socket = await showOnly(page, [external]);
    await page.goto('/');
    await entry(page, external.folder).click();
    (await socket()).send(JSON.stringify({ type: 'items', items: [] }));
    await button(mainArea(page), 'Resume Here').click();
    const warning = page.getByRole('alertdialog', { name: 'Session Running in a Terminal' });
    await expect(warning).toBeVisible();
    const text = warning.getByText(/This session is still running/);
    const banner = text.locator('xpath=ancestor::*[contains(@class, "vx-surface-2")][1]');
    expect(await style(banner, 'border-top-color')).toBe(AMBER_500_40);
    expect(await style(banner, 'border-top-left-radius')).toBe('12px');
    expect(await style(banner.locator('svg'), 'color')).toBe(AMBER_400);
    const primary = button(warning, 'Resume Anyway');
    expect(await style(primary, 'color')).toBe(AMBER_400);
    await expect(button(warning, 'Cancel')).toBeFocused();
  });

  // Decisions "Dialog avatars", REQ-12: the dialog rows keep a neutral 24 px avatar, headings are mono labels
  test('the resume history shows mono path headings without uppercase, neutral avatars and the amber running pill', async ({ page }) => {
    await page.route('**/api/past-sessions', (route) =>
      route.fulfill({
        json: [
          {
            folder: '/home/dev/Progetti/Negozio',
            sessions: [
              { id: 'past-1', label: 'Prima sessione', lastActivity: '2026-11-04T09:00:00.000Z', runningElsewhere: true },
              { id: 'past-2', label: 'Seconda sessione', lastActivity: '2026-11-03T09:00:00.000Z', runningElsewhere: false },
            ],
          },
        ],
      }),
    );
    await page.goto('/');
    await railButton(page, 'Resume').click();
    const dialog = history(page);
    const heading = dialog.getByText('/home/dev/Progetti/Negozio', { exact: true });
    await expect(heading).toBeVisible();
    expect(await style(heading, 'text-transform')).toBe('none');
    expect(await style(heading, 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    expect(await style(heading, 'color')).toBe(TEXT_MUTED);
    const avatars = dialog.locator('.avatar');
    await expect(avatars).toHaveCount(2);
    const a = await box(avatars.first());
    expect(a.width).toBeCloseTo(24, 0);
    expect(await style(avatars.first(), 'background-color')).toBe(SURFACE_3);
    expect(await style(avatars.nth(1), 'background-color')).toBe(SURFACE_3);
    const running = dialog.getByText('Running in a terminal', { exact: true });
    expect(await style(running, 'color')).toBe(AMBER_400);
    expect(await style(running, 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('area states', () => {
  // REQ-50 — scenario "The user sees the error state when the server stops"
  test('the empty main area uses the full area-state block, and a lost server gives the compact block with a rose tile', async ({ page }) => {
    let events: WebSocketRoute | undefined;
    await page.route(
      (url) => url.pathname === '/api/sessions',
      (route) => (route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.fallback()),
    );
    await page.routeWebSocket(/\/api\/sessions\/events$/, (ws) => {
      events = ws;
    });
    await page.goto('/');

    const empty = mainArea(page).locator('.vx-surface-1').filter({ hasText: 'No open session.' });
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('Start a new session or resume a past one.');
    const title = empty.getByText('No open session.', { exact: true });
    expect(await px(title, 'font-size')).toBe(24);
    expect(await style(title, 'font-family')).toMatch(/^["']?Roboto Flex["']?/);
    const tile = empty.locator('[aria-hidden="true"]').first();
    const tileBox = await box(tile);
    expect(tileBox.width).toBeCloseTo(48, 0);
    expect(await style(tile.locator('svg'), 'color')).toBe(ACCENT);
    expect(await style(button(empty, 'New Session'), 'background-color')).toBe(ACCENT);
    expect(await style(button(empty, 'Resume Session'), 'background-color')).toBe(SURFACE_2);

    await expect.poll(() => events !== undefined).toBe(true);
    await events!.close({ code: 1001, reason: 'server stopped' });
    const alert = panel(page).getByRole('alert');
    await expect(alert).toHaveText('Connection to the server lost. Reload the page.');
    expect(await style(alert, 'background-color')).toBe(SURFACE_1);
    const errorTile = alert.locator('[aria-hidden="true"]').first();
    expect((await box(errorTile)).width).toBeCloseTo(32, 0);
    expect(await style(errorTile.locator('svg'), 'color')).toBe(ROSE_400);
  });

  // REQ-50: the list empty state and loading state use the compact block
  test('"No sessions." in the list is the compact area-state block', async ({ page }) => {
    await page.route(
      (url) => url.pathname === '/api/sessions',
      (route) => (route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.fallback()),
    );
    // No live frames: sessions that parallel tests start would fill the list.
    await page.routeWebSocket(/\/api\/sessions\/events$/, () => {});
    await page.goto('/');
    const block = panel(page).locator('.vx-surface-1').filter({ hasText: 'No sessions.' });
    await expect(block).toBeVisible();
    const title = block.getByText('No sessions.', { exact: true });
    expect(await px(title, 'font-size')).toBe(12);
    expect((await box(block.locator('[aria-hidden="true"]').first())).width).toBeCloseTo(32, 0);
  });
});
