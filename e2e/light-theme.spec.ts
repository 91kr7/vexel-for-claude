// e2e of plan-light_theme, batch light-theme. Expected values come from the REQs, the specs ThemeTokens, ThemeStore,
// ThemeSwitch, TopBar, WebEntry, SessionView, and the `[data-theme="editorial-light"]` block of .sdd/mockups/studio-dark/mock.html.
/// <reference lib="dom" />
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, type WebSocketRoute, expect, test } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };
type Rgba = [number, number, number, number];

const CONVERSATION = /\/api\/external-sessions\/[^/]+\/conversation$/;

// Light set: the mock's editorial-light values, with the ThemeTokens light accent, muted text and status tones.
const LIGHT: Record<string, string> = {
  '--bg-canvas': 'rgb(244, 241, 234)',
  '--bg-surface-1': 'rgb(252, 250, 245)',
  '--bg-surface-2': 'rgb(239, 234, 224)',
  '--bg-surface-3': 'rgb(228, 222, 210)',
  '--bg-glass': 'rgba(252, 250, 245, 0.86)',
  '--border-subtle': 'rgba(28, 25, 23, 0.08)',
  '--border-strong': 'rgba(28, 25, 23, 0.15)',
  '--specular-top': 'rgba(255, 255, 255, 0.75)',
  '--text-primary': 'rgb(28, 25, 23)',
  '--text-secondary': 'rgb(87, 83, 78)',
  '--text-muted': 'rgb(103, 98, 92)',
  '--accent-primary': 'rgb(0, 101, 174)',
  '--accent-secondary': 'rgb(0, 76, 130)',
  '--accent-deep': 'rgb(0, 69, 119)',
  '--accent-glow': 'rgba(0, 101, 174, 0.12)',
  '--accent-border': 'rgba(0, 101, 174, 0.35)',
  '--accent-selection': 'rgba(0, 101, 174, 0.3)',
  '--on-accent': 'rgb(255, 255, 255)',
  '--color-focus-ring': 'rgb(0, 101, 174)',
  '--emerald-400': 'rgb(6, 95, 70)',
  '--amber-300': 'rgb(146, 64, 14)',
  '--amber-400': 'rgb(146, 64, 14)',
  '--rose-300': 'rgb(159, 18, 57)',
  '--rose-400': 'rgb(159, 18, 57)',
  '--zinc-400': 'rgb(82, 82, 91)',
};
const MOCK_LIGHT_MUTED = 'rgb(138, 132, 124)';
const DARK_CANVAS = 'rgb(11, 11, 14)';
const DARK_TEXT_PRIMARY = 'rgb(243, 242, 238)';
const DARK_ACCENT = 'rgb(140, 207, 255)';
// Colours of the dark set that no element may show in the light theme, outside the terminal panel.
const DARK_ONLY = [
  DARK_CANVAS,
  'rgb(18, 18, 22)',
  'rgb(24, 24, 31)',
  'rgb(33, 33, 43)',
  'rgba(24, 24, 31, 0.82)',
  'rgba(255, 255, 255, 0.07)',
  'rgba(255, 255, 255, 0.13)',
  DARK_TEXT_PRIMARY,
  'rgb(161, 160, 171)',
  'rgb(137, 136, 148)',
  DARK_ACCENT,
  'rgba(140, 207, 255, 0.16)',
  'rgba(140, 207, 255, 0.42)',
  'rgb(52, 211, 153)',
  'rgb(252, 211, 77)',
  'rgb(251, 191, 36)',
  'rgb(253, 164, 175)',
  'rgb(251, 113, 133)',
  'rgb(161, 161, 170)',
];
const SURFACES = ['--bg-canvas', '--bg-surface-1', '--bg-surface-2', '--bg-surface-3'];

let projectsRoot: string;
const createdIds: string[] = [];

// The page starts dark: the config gives the browser a saved dark choice (REQ-17). A dark system theme: the client must not follow it.
test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });

test.beforeEach(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-light-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  await rm(projectsRoot, { recursive: true, force: true });
});

const topBar = (page: Page) => page.getByRole('banner');
const button = (scope: Locator, name: string) => scope.getByRole('button', { name, exact: true });
const themeSwitch = (page: Page) => button(topBar(page), 'Dark theme');
const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const panel = (page: Page) => page.getByRole('region', { name: 'Session List' });
const mainArea = (page: Page) => page.getByRole('main');
const entry = (page: Page, folder: string) => panel(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const terminal = (page: Page) => page.locator('.xterm-rows');
const chooser = (page: Page) => page.getByRole('dialog', { name: 'New Claude Code Session' });
const snackbar = (page: Page) => page.getByRole('status').filter({ hasText: 'needs your input' });
const themeMark = (page: Page) => page.locator('html').getAttribute('data-theme');

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

/** The computed form of a CSS colour value, so `#0065ae` and `rgb(0, 101, 174)` compare equal. */
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

const token = (page: Page, name: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

/** Every custom property of the page root with its computed value. */
/** The largest difference of one colour channel between two PNG screenshots of the same size, decoded in the page. */
const maxChannelDifference = (page: Page, a: Buffer, b: Buffer) =>
  page.evaluate(async ([a, b]) => {
    const pixels = async (base64: string) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d')!;
      context.drawImage(bitmap, 0, 0);
      return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    };
    const [first, second] = [await pixels(a), await pixels(b)];
    if (first.length !== second.length) return Infinity;
    let max = 0;
    for (let i = 0; i < first.length; i++) max = Math.max(max, Math.abs(first[i]! - second[i]!));
    return max;
  }, [a.toString('base64'), b.toString('base64')] as const);

const allTokens = (page: Page) =>
  page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return Object.fromEntries([...s].filter((n) => n.startsWith('--')).map((n) => [n, s.getPropertyValue(n).trim()]));
  });

/** Parses `rgb()`, `rgba()` and `color(srgb …)` into 0–255 channels and alpha. */
function parse(value: string): Rgba {
  const srgb = value.match(/color\(srgb\s+([^)]+)\)/);
  if (srgb) {
    const [r, g, b, a = '1'] = srgb[1]!.split(/[\s/]+/).filter(Boolean);
    return [Number(r) * 255, Number(g) * 255, Number(b) * 255, Number(a)];
  }
  const m = value.match(/rgba?\(([^)]+)\)/);
  expect(m, `colour ${value}`).not.toBeNull();
  const [r, g, b, a = '1'] = m![1]!.split(/[ ,/]+/).filter(Boolean);
  return [Number(r), Number(g), Number(b), Number(a)];
}

const sameColour = (a: string, b: string) => parse(a).every((c, i) => Math.abs(c - parse(b)[i]!) <= (i === 3 ? 0.01 : 1));

function over([r, g, b, a]: Rgba, [br, bg, bb]: Rgba): Rgba {
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];
}

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

function hue([r, g, b]: Rgba): number {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const d = max - Math.min(rr, gg, bb);
  if (d === 0) return 0;
  const h = max === rr ? ((gg - bb) / d) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  return (h * 60 + 360) % 360;
}

async function toLight(page: Page): Promise<void> {
  await themeSwitch(page).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
}

/**
 * Looks at every visible element of `scope`, outside the terminal panel. Returns the elements that paint a colour of
 * the dark set, and the text whose contrast on the background below it is under 4.5:1.
 */
async function audit(scope: Locator, darkOnly: string[]): Promise<{ dark: string[]; lowContrast: string[] }> {
  return scope.evaluate((root, darkColours) => {
    type C = [number, number, number, number];
    const parseC = (v: string): C | null => {
      const srgb = v.match(/color\(srgb\s+([^)]+)\)/);
      if (srgb) {
        const [r, g, b, a = '1'] = srgb[1]!.split(/[\s/]+/).filter(Boolean);
        return [Number(r) * 255, Number(g) * 255, Number(b) * 255, Number(a)];
      }
      const m = v.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = '1'] = m[1]!.split(/[ ,/]+/).filter(Boolean);
      return [Number(r), Number(g), Number(b), Number(a)];
    };
    const overC = ([r, g, b, a]: C, [br, bg, bb]: C): C => [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];
    const lum = ([r, g, b]: C) => {
      const lin = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const ratio = (a: C, b: C) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi! + 0.05) / (lo! + 0.05);
    };
    const describe = (el: Element) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} "${(el.textContent ?? '').trim().slice(0, 30)}"`;
    const inTerminal = (el: Element) => !!el.closest('.xterm') || !!el.closest('[role="region"][aria-label^="Terminal"]');
    const dark: string[] = [];
    const lowContrast: string[] = [];
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (inTerminal(el) || !el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
      const s = getComputedStyle(el);
      const painted: [string, string][] = [
        ['color', s.color],
        ['background-color', s.backgroundColor],
      ];
      for (const side of ['top', 'right', 'bottom', 'left']) {
        if (s.getPropertyValue(`border-${side}-style`) !== 'none' && parseFloat(s.getPropertyValue(`border-${side}-width`)) > 0) {
          painted.push([`border-${side}-color`, s.getPropertyValue(`border-${side}-color`)]);
        }
      }
      for (const [prop, value] of painted) if (darkColours.includes(value)) dark.push(`${describe(el)}: ${prop} ${value}`);

      const ownText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
      if (!ownText || el.closest('button:disabled')) continue;
      const layers: C[] = [];
      let image = false;
      for (let node: Element | null = el; node; node = node.parentElement) {
        const ns = getComputedStyle(node);
        if (ns.backgroundImage !== 'none') image = true;
        const bg = parseC(ns.backgroundColor);
        if (bg && bg[3] > 0) layers.push(bg);
        if (bg && bg[3] >= 1) break;
      }
      if (image) continue;
      let base: C = [255, 255, 255, 1];
      for (const layer of layers.reverse()) base = overC(layer, base);
      const fg = parseC(s.color);
      if (!fg) continue;
      const r = ratio(overC(fg, base), base);
      if (r < 4.5) lowContrast.push(`${describe(el)}: ${s.color} on rgb(${base.slice(0, 3).map(Math.round).join(', ')}) = ${r.toFixed(2)}`);
    }
    return { dark, lowContrast };
  }, darkOnly);
}

// ---------------------------------------------------------------------------------------------------------------------
test.describe('theme switch', () => {
  // REQ-1, TopBar: the switch on the right of the bar, 6 px before "New Session", on the empty screen and with a session open
  test('the top bar shows the 32 x 32 switch just before "New Session", with and without an open session', async ({ page, request }) => {
    await showOnly(page);
    const folder = await newFolder('switch-place');
    await startViaApi(request, folder);
    await page.goto('/');
    const check = async (screen: string) => {
      const sw = await box(themeSwitch(page));
      const next = await box(button(topBar(page), 'New Session'));
      const bar = await box(topBar(page));
      expect(sw.width, screen).toBeCloseTo(32, 0);
      expect(sw.height, screen).toBeCloseTo(32, 0);
      expect(next.x - (sw.x + sw.width), `${screen}: 6 px before "New Session"`).toBeCloseTo(6, 0);
      expect(sw.x, `${screen}: on the right half of the bar`).toBeGreaterThan(bar.width / 2);
      expect(Math.abs(sw.y + sw.height / 2 - (bar.y + bar.height / 2)), `${screen}: vertically centred`).toBeLessThanOrEqual(1);
    };
    await check('empty screen');
    await openFromList(page, folder);
    await check('hosted session open');
    await toLight(page);
    await check('light theme');
  });

  // REQ-2 — ThemeSwitch: name and tooltip "Dark theme", aria-pressed and icon follow the theme
  test('the switch is "Dark theme", pressed with a moon in the dark theme and not pressed with a sun in the light theme', async ({ page }) => {
    await page.goto('/');
    const sw = themeSwitch(page);
    await expect(sw).toBeVisible();
    expect(await themeMark(page)).toBe('dark');
    await expect(sw).toHaveAttribute('aria-pressed', 'true');
    await expect(sw).toHaveAttribute('title', 'Dark theme');
    const moon = await sw.locator('svg').evaluate((el) => el.outerHTML);
    await expect(sw.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(await style(sw, 'border-top-left-radius')).toBe('8px');

    await sw.click();
    await expect(sw).toHaveAttribute('aria-pressed', 'false');
    expect(await themeMark(page)).toBe('light');
    await expect(sw).toHaveAccessibleName('Dark theme');
    await expect(sw).toHaveAttribute('title', 'Dark theme');
    const sun = await sw.locator('svg').evaluate((el) => el.outerHTML);
    expect(sun, 'the icon changes with the theme').not.toBe(moon);
    expect((await box(sw)).width, 'the size does not change').toBeCloseTo(32, 0);

    await sw.click();
    await expect(sw).toHaveAttribute('aria-pressed', 'true');
    expect(await sw.locator('svg').evaluate((el) => el.outerHTML)).toBe(moon);
  });

  // ThemeSwitch: the mock's icon-button look at rest and on hover, in the light theme
  test('in the light theme the switch is on surface 1 with the secondary icon, and on hover on surface 3 with the strong border', async ({ page }) => {
    await page.goto('/');
    await toLight(page);
    const sw = themeSwitch(page);
    await page.mouse.move(700, 600);
    await expect.poll(() => style(sw, 'background-color')).toBe(LIGHT['--bg-surface-1']);
    expect(await style(sw, 'border-top-color')).toBe(LIGHT['--border-subtle']);
    expect(await style(sw, 'color')).toBe(LIGHT['--text-secondary']);
    const icon = await box(sw.locator('svg'));
    expect(icon.width).toBeCloseTo(16, 0);
    await sw.hover();
    await expect.poll(() => style(sw, 'background-color')).toBe(LIGHT['--bg-surface-3']);
    expect(await style(sw, 'border-top-color')).toBe(LIGHT['--border-strong']);
    expect(await style(sw, 'color')).toBe(LIGHT['--text-primary']);
  });

  // REQ-3: the whole client changes at once, without a reload
  test('a click turns the whole client light at once, without a reload', async ({ page }) => {
    await showOnly(page);
    await page.goto('/');
    await expect(rail(page)).toBeVisible();
    let navigations = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations += 1;
    });
    await page.evaluate(() => ((window as unknown as { pageMarker: number }).pageMarker = 42));
    await themeSwitch(page).click();
    expect(await style(page.locator('body'), 'background-color')).toBe(LIGHT['--bg-canvas']);
    expect(await style(page.locator('body'), 'color')).toBe(LIGHT['--text-primary']);
    expect(await style(topBar(page), 'background-color')).toBe(LIGHT['--bg-surface-2']);
    expect(await style(button(topBar(page), 'New Session'), 'background-color')).toBe(LIGHT['--accent-primary']);
    expect(await page.evaluate(() => (window as unknown as { pageMarker?: number }).pageMarker), 'the page did not reload').toBe(42);
    expect(navigations).toBe(0);
  });

  // REQ-17: the chosen theme survives a reload
  test('a reload keeps the light theme the user chose', async ({ page }) => {
    await page.goto('/');
    await toLight(page);
    await page.reload();
    await expect(themeSwitch(page)).toHaveAttribute('aria-pressed', 'false');
    expect(await themeMark(page)).toBe('light');
  });

  // REQ-4, REQ-12 — scenario "The user switches the client to the light theme"
  test('switching to light keeps the open session running, its connection, the list scroll position, and the dark terminal panel', async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 420 });
    await page.addInitScript(() => {
      const log: string[] = [];
      (window as unknown as { socketLog: string[] }).socketLog = log;
      const Native = window.WebSocket;
      window.WebSocket = class extends Native {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          log.push(`open ${String(url)}`);
          this.addEventListener('close', () => log.push(`close ${String(url)}`));
        }
      };
    });
    await showOnly(page);
    const folders: string[] = [];
    for (let i = 0; i < 10; i++) folders.push(await newFolder(`scroll-${String(i).padStart(2, '0')}`));
    for (const folder of folders) await startViaApi(request, folder);
    await page.goto('/');
    const open = folders[0]!;
    await openFromList(page, open);

    const scroller = await panel(page).evaluateHandle((el) => {
      const all = [el, ...el.querySelectorAll('*')] as HTMLElement[];
      return all.find((n) => n.scrollHeight > n.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(n).overflowY)) ?? null;
    });
    expect(await scroller.evaluate((n) => n !== null), 'the session list scrolls').toBe(true);
    await scroller.evaluate((n) => n!.scrollTo(0, n!.scrollHeight));
    const scrollTop = await scroller.evaluate((n) => n!.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
    const region = page.getByRole('region', { name: `Terminal: ${path.basename(open)}` });
    await expect(region).toBeVisible();
    const sockets = await page.evaluate(() => [...(window as unknown as { socketLog: string[] }).socketLog]);
    const regionBefore = await box(region);

    await themeSwitch(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(themeSwitch(page)).toHaveAttribute('aria-pressed', 'false');
    await page.waitForTimeout(500);

    expect(await style(page.locator('body'), 'background-color')).toBe(LIGHT['--bg-canvas']);
    expect(await scroller.evaluate((n) => n!.scrollTop), 'the list keeps its scroll position').toBe(scrollTop);
    await expect(region, 'the same session stays open').toBeVisible();
    await expect(terminal(page)).toContainText(`CWD:${open}`);
    await expect(terminal(page)).not.toContainText('[Session disconnected]');
    expect(await page.evaluate(() => [...(window as unknown as { socketLog: string[] }).socketLog]), 'no connection opened or closed').toEqual(sockets);
    expect(await box(region), 'the terminal panel does not move').toEqual(regionBefore);

    // REQ-12: the panel keeps the dark terminal colours
    expect(await style(region, 'background-color')).toBe(DARK_CANVAS);
    expect(await style(region, 'border-top-color'), 'the panel border follows the light set').toBe(LIGHT['--border-subtle']);
    expect(await effectiveBackground(page.locator('.xterm-screen'))).toBe(DARK_CANVAS);
    expect(await style(terminal(page), 'color')).toBe(DARK_TEXT_PRIMARY);
  });

  // REQ-4: a theme change does not close an open dialog or lose what the user typed
  test('a theme change keeps the new-session dialog open with the typed path', async ({ page }) => {
    await page.goto('/');
    await button(topBar(page), 'New Session').click();
    const field = chooser(page).getByRole('textbox', { name: 'Working Directory Path', exact: true });
    await field.fill('/tmp/some-project');
    // The modal backdrop covers the top bar, so the click is dispatched to the switch directly.
    await themeSwitch(page).evaluate((el) => (el as HTMLButtonElement).click());
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(chooser(page)).toBeVisible();
    await expect(field).toHaveValue('/tmp/some-project');
    expect(await style(chooser(page), 'background-color')).toBe(LIGHT['--bg-surface-2']);
  });

  // REQ-5, REQ-13 — scenario "The user goes back to the dark theme with the keyboard"
  test('with the keyboard the switch shows the focus ring and toggles on Enter and Space; back in dark the client looks as before', async ({ page }) => {
    await showOnly(page);
    await page.goto('/');
    await expect(button(mainArea(page), 'New Session')).toBeVisible();
    const darkTokens = await allTokens(page);
    const darkShot = await page.screenshot({ animations: 'disabled' });

    const sw = themeSwitch(page);
    for (let i = 0; i < 20 && !(await sw.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(sw).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(sw).toHaveAttribute('aria-pressed', 'false');

    // REQ-5, WebEntry: the shared 2 px accent ring, 2 px away
    expect(await sw.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
    expect(await style(sw, 'outline-style')).not.toBe('none');
    expect(await style(sw, 'outline-width')).toBe('2px');
    expect(await style(sw, 'outline-offset')).toBe('2px');
    expect(await style(sw, 'outline-color')).toBe(LIGHT['--accent-primary']);
    const ringOnCanvas = contrast(parse(await style(sw, 'outline-color')), parse(LIGHT['--bg-surface-2']!));
    expect(ringOnCanvas, 'the ring stays visible on the light top bar').toBeGreaterThanOrEqual(3);

    await page.keyboard.press('Space');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.keyboard.press('Space');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(sw).toHaveAttribute('aria-pressed', 'true');
    expect(await style(sw, 'outline-color')).toBe(DARK_ACCENT);

    // REQ-13: the dark theme is the same as before the change
    expect(await allTokens(page)).toEqual(darkTokens);
    await sw.evaluate((el) => (el as HTMLElement).blur());
    const afterShot = await page.screenshot({ animations: 'disabled' });
    // Anti-aliasing of rounded corners can differ by one level between two renders.
    expect(await maxChannelDifference(page, darkShot, afterShot), 'the dark client looks as before').toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('light palette', () => {
  // REQ-7, REQ-9, REQ-14, REQ-15, REQ-16, ThemeTokens light set
  test('the light set has the editorial-light values with the light accent and status tones', async ({ page }) => {
    await page.goto('/');
    await toLight(page);
    for (const [name, value] of Object.entries(LIGHT)) expect(sameColour(await colour(page, `var(${name})`), value), `${name} = ${value}`).toBe(true);
  });

  // ThemeTokens: the 500 tones, tints, backdrop, shadows, fonts, sizes and terminal tokens are the same in both sets
  test('the shared tokens and the terminal tokens do not change with the theme', async ({ page }) => {
    await page.goto('/');
    const names = [
      '--emerald-500',
      '--amber-500',
      '--rose-500',
      '--zinc-500',
      '--emerald-500-15',
      '--amber-500-15',
      '--rose-500-15',
      '--zinc-500-15',
      '--color-backdrop',
      '--shadow-sm',
      '--shadow',
      '--shadow-lg',
      '--shadow-2xl',
      '--font-ui',
      '--font-mono',
      '--term-size',
      '--focus-ring-width',
      '--focus-ring-offset',
      '--term-bg',
      '--term-fg',
      '--term-cursor',
      '--term-selection',
    ];
    const dark = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await token(page, n)] as const)));
    for (const n of names) expect(dark[n], `${n} is defined`).not.toBe('');
    expect(await colour(page, 'var(--term-bg)')).toBe(DARK_CANVAS);
    expect(await colour(page, 'var(--term-fg)')).toBe(DARK_TEXT_PRIMARY);
    expect(await colour(page, 'var(--term-cursor)')).toBe(DARK_ACCENT);
    expect(sameColour(await colour(page, 'var(--term-selection)'), 'rgba(140, 207, 255, 0.3)')).toBe(true);
    await toLight(page);
    for (const n of names) expect(await token(page, n), n).toBe(dark[n]);
  });

  // REQ-14: text colours reach 4.5:1; the muted text is the only change from the mock, and only as much as needed
  test('light text colours reach 4.5:1 on canvas and surfaces, and the muted text is darkened only as much as needed', async ({ page }) => {
    await page.goto('/');
    await toLight(page);
    const ratios: Record<string, number[]> = {};
    for (const text of ['--text-primary', '--text-secondary', '--text-muted']) {
      ratios[text] = [];
      for (const bg of SURFACES) {
        const r = contrast(parse(await colour(page, `var(${text})`)), parse(await colour(page, `var(${bg})`)));
        expect(r, `${text} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        ratios[text]!.push(r);
      }
    }
    const mockWorst = Math.min(...(await Promise.all(SURFACES.map(async (bg) => contrast(parse(MOCK_LIGHT_MUTED), parse(await colour(page, `var(${bg})`)))))));
    expect(mockWorst, 'the mock muted text fails, so it changes').toBeLessThan(4.5);
    expect(Math.min(...ratios['--text-muted']!), 'the muted text is the least darkening').toBeLessThan(4.6);
    const muted = parse(await colour(page, 'var(--text-muted)'));
    expect(Math.abs(hue(muted) - hue(parse(MOCK_LIGHT_MUTED))), 'same hue as the mock muted text').toBeLessThanOrEqual(3);
  });

  // REQ-9, REQ-15: the light accent keeps the 205° hue, is the lightest tone that reaches 4.5:1, and text on it reaches 4.5:1
  test('the light accent has the 205° hue, reaches 4.5:1 on canvas and surfaces, and carries white text at 4.5:1', async ({ page }) => {
    await page.goto('/');
    await toLight(page);
    const accent = parse(await colour(page, 'var(--accent-primary)'));
    expect(hue(accent)).toBeCloseTo(205, 0);
    const onSurfaces = await Promise.all(SURFACES.map(async (bg) => contrast(accent, parse(await colour(page, `var(${bg})`)))));
    for (const r of onSurfaces) expect(r).toBeGreaterThanOrEqual(4.5);
    expect(Math.min(...onSurfaces), 'the lightest tone that reaches 4.5:1').toBeLessThan(4.6);
    const onAccent = parse(await colour(page, 'var(--on-accent)'));
    expect(contrast(onAccent, accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(onAccent, parse(await colour(page, 'var(--accent-deep)')))).toBeGreaterThanOrEqual(4.5);

    const newSession = button(topBar(page), 'New Session');
    expect(await style(newSession, 'background-color')).toBe(LIGHT['--accent-primary']);
    expect(await style(newSession, 'color')).toBe(LIGHT['--on-accent']);
    expect(await style(page.getByRole('banner').getByText('VX', { exact: true }), 'background-image')).toMatch(
      /^linear-gradient\(135deg, rgb\(0, 101, 174\).*rgb\(0, 69, 119\)/,
    );
    expect(await page.locator('body').evaluate((el) => getComputedStyle(el, '::selection').backgroundColor)).toBe(LIGHT['--accent-selection']);
  });

  // REQ-16: the status text tones are readable on the light surfaces and on their tints, and stay apart
  test('the light status tones reach 4.5:1 on canvas, surfaces and their 15 % tint, and are distinct', async ({ page }) => {
    await page.goto('/');
    await toLight(page);
    const families: [string, string][] = [
      ['--emerald-400', '--emerald-500-15'],
      ['--amber-400', '--amber-500-15'],
      ['--amber-300', '--amber-500-15'],
      ['--rose-400', '--rose-500-15'],
      ['--rose-300', '--rose-500-15'],
      ['--zinc-400', '--zinc-500-15'],
    ];
    for (const [text, tint] of families) {
      const fg = parse(await colour(page, `var(${text})`));
      const tintColour = parse(await colour(page, `var(${tint})`));
      for (const bg of SURFACES) {
        const surface = parse(await colour(page, `var(${bg})`));
        expect(contrast(fg, surface), `${text} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(fg, over(tintColour, surface)), `${text} on ${tint} over ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    const tones = await Promise.all(['--emerald-400', '--amber-400', '--rose-400', '--zinc-400'].map(async (n) => parse(await colour(page, `var(${n})`))));
    for (let i = 0; i < tones.length; i++) {
      for (let j = i + 1; j < tones.length; j++) {
        const distance = Math.hypot(tones[i]![0] - tones[j]![0], tones[i]![1] - tones[j]![1], tones[i]![2] - tones[j]![2]);
        expect(distance, `status tones ${i} and ${j} are distinct`).toBeGreaterThan(60);
      }
    }
  });

  // REQ-10, REQ-11: same fonts, and native controls and scrollbars in the light scheme, whatever the system theme
  test('the light theme keeps Roboto Flex and Roboto Mono, and the colour scheme follows the theme', async ({ page, request }) => {
    await showOnly(page);
    await startViaApi(request, await newFolder('font-light'));
    await page.goto('/');
    expect(await style(page.locator('html'), 'color-scheme')).toBe('dark');
    await toLight(page);
    expect(await style(page.locator('html'), 'color-scheme')).toBe('light');
    expect(await style(page.locator('body'), 'font-family')).toMatch(/^["']?Roboto Flex["']?/);
    expect(await style(panel(page).getByRole('heading', { level: 1 }), 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    expect(await style(panel(page).locator('time').first(), 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    await page.emulateMedia({ colorScheme: 'light' });
    expect(await style(page.locator('html'), 'color-scheme')).toBe('light');
    await themeSwitch(page).click();
    expect(await style(page.locator('html'), 'color-scheme'), 'dark again on a light system').toBe('dark');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('light screens', () => {
  // REQ-6, REQ-8, REQ-12, REQ-14, REQ-16: list rows in every state, the open hosted session and the snackbar
  test('with sessions in every state and a hosted session open, no element keeps a dark colour and all text reaches 4.5:1', async ({ page, request }) => {
    const external = { id: 'ext-light-1', folder: '/srv/external/mobile-app', label: 'Refactor', state: 'idle', lastActivity: new Date().toISOString(), external: true };
    await showOnly(page, [external]);
    const working = await newFolder('working-row');
    const idle = await newFolder('idle-row');
    const ended = await newFolder('ended-row');
    const asking = await newFolder('asking-row');
    const workingId = await startViaApi(request, working);
    await startViaApi(request, idle);
    const endedId = await startViaApi(request, ended);
    const askingId = await startViaApi(request, asking);
    await postHook(request, workingId, { hook_event_name: 'UserPromptSubmit', prompt: 'run the tests' });
    await expect((await request.post(`/api/sessions/${endedId}/stop`)).status()).toBeLessThan(300);
    await page.goto('/');
    await toLight(page);
    await openFromList(page, working);
    await postHook(request, askingId, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    await expect(snackbar(page)).toBeVisible();
    await expect(entry(page, ended)).toContainText('Ended');

    const result = await audit(page.locator('body'), DARK_ONLY);
    expect(result.dark, 'elements that keep a dark-set colour').toEqual([]);
    expect(result.lowContrast, 'text under 4.5:1').toEqual([]);

    // REQ-16: the working row reads in the light emerald
    expect(await style(entry(page, working).getByText('Running', { exact: true }), 'color')).toBe(LIGHT['--emerald-400']);
    // REQ-12: the terminal panel stays dark
    expect(await style(page.getByRole('region', { name: 'Terminal: working-row' }), 'background-color')).toBe(DARK_CANVAS);
  });

  // REQ-6, NavigationRail: the rail tooltip on hover takes the light surface 3, strong border and primary text
  test('a rail tooltip shown in the light theme is on surface 3 with the primary text', async ({ page }) => {
    await page.goto('/');
    await toLight(page);
    const sessions = rail(page).getByRole('button', { name: 'Sessions', exact: true });
    await sessions.hover();
    const tooltip = sessions.locator('.vx-tooltip');
    await expect.poll(() => style(tooltip, 'opacity')).toBe('1');
    await expect.poll(() => style(tooltip, 'color')).toBe(LIGHT['--text-primary']);
    expect(await style(tooltip, 'background-color')).toBe(LIGHT['--bg-surface-3']);
    expect(await style(tooltip, 'border-top-color')).toBe(LIGHT['--border-strong']);
  });

  // REQ-12, SessionView: a terminal opened in the light theme still takes the dark terminal colours, cursor and selection included
  test('a terminal opened in the light theme uses the fixed dark terminal colours, cursor and selection', async ({ page, request }) => {
    await showOnly(page);
    const folder = await newFolder('light-terminal');
    await startViaApi(request, folder);
    await page.goto('/');
    await toLight(page);
    await openFromList(page, folder);
    const region = page.getByRole('region', { name: 'Terminal: light-terminal' });
    expect(await style(region, 'background-color')).toBe(DARK_CANVAS);
    expect(await effectiveBackground(page.locator('.xterm-screen'))).toBe(DARK_CANVAS);
    expect(await style(terminal(page), 'color')).toBe(DARK_TEXT_PRIMARY);
    const xtermCss = await page.evaluate(() =>
      [...document.querySelectorAll('style')]
        .map((s) => s.textContent ?? '')
        .filter((t) => t.includes('.xterm'))
        .join('\n'),
    );
    const cursorRules = xtermCss.match(/[^}]*xterm-cursor[^{]*\{[^}]*\}/g)?.join('\n') ?? '';
    expect(cursorRules.toLowerCase(), 'the cursor is the dark accent').toMatch(/#8ccfff|rgb\(140,\s*207,\s*255\)/);
    expect(cursorRules.toLowerCase(), 'the cursor is not the light accent').not.toMatch(/#0065ae|rgb\(0,\s*101,\s*174\)/);
    // xterm paints the selection as an opaque colour: the token blended over the terminal background.
    const selection = xtermCss.match(/xterm-selection div\s*\{[^}]*background-color:\s*#([0-9a-f]{6})/i)?.[1];
    expect(selection, 'xterm selection colour').toBeDefined();
    const painted = [0, 2, 4].map((i) => parseInt(selection!.slice(i, i + 2), 16));
    const expected = over([140, 207, 255, 0.3], [11, 11, 14, 1]);
    for (const [i, channel] of painted.entries()) expect(Math.abs(channel - expected[i]!), `selection #${selection}`).toBeLessThanOrEqual(1.5);
  });

  // REQ-6, REQ-14, REQ-16 — scenario "An external session reads well in the light theme"
  test('an external session with tool calls is on light surfaces and all its text reaches 4.5:1', async ({ page }) => {
    const external = { id: 'ext-light-2', folder: '/srv/external/shop', label: 'Add the cart', state: 'idle', lastActivity: new Date().toISOString(), external: true };
    const socket = await showOnly(page, [external]);
    await page.goto('/');
    await toLight(page);
    await entry(page, external.folder).click();
    (await socket()).send(
      JSON.stringify({
        type: 'items',
        items: [
          { kind: 'user', text: 'Run the tests', timestamp: new Date().toISOString() },
          { kind: 'assistant', text: 'Running `npm test` now.' },
          { kind: 'tool_call', name: 'Bash', summary: 'npm test', id: 'tool-1' },
          { kind: 'tool_result', text: 'Error: 2 tests failed', truncated: false, toolUseId: 'tool-1', isError: true },
          { kind: 'tool_call', name: 'Read', summary: 'src/cart.ts', id: 'tool-2' },
          { kind: 'tool_result', text: 'export const cart = [];', truncated: false, toolUseId: 'tool-2', isError: false },
        ],
      }),
    );
    await expect(mainArea(page).getByRole('article', { name: 'You', exact: true })).toContainText('Run the tests');
    for (const name of ['Tool: Bash', 'Tool: Read']) {
      const toggle = mainArea(page).getByRole('article', { name }).getByRole('button').first();
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    }
    const output = mainArea(page).getByText('Error: 2 tests failed', { exact: true });
    await expect(output).toBeVisible();
    const outputBg = await output.evaluate((el) => {
      for (let node: Element | null = el; node; node = node.parentElement) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg !== 'rgba(0, 0, 0, 0)') return bg;
      }
      return '';
    });
    expect(luminance(parse(outputBg)), `tool output background ${outputBg} is light`).toBeGreaterThan(0.5);

    const result = await audit(mainArea(page), DARK_ONLY);
    expect(result.dark, 'elements that keep a dark-set colour').toEqual([]);
    expect(result.lowContrast, 'text under 4.5:1').toEqual([]);
  });

  // REQ-6, REQ-8, REQ-14: the new-session dialog in the light theme
  test('the new-session dialog is light, keeps the mock backdrop, and all its text reaches 4.5:1', async ({ page }) => {
    await page.goto('/');
    await toLight(page);
    await button(topBar(page), 'New Session').click();
    const dialog = chooser(page);
    await expect(dialog).toBeVisible();
    expect(await style(dialog.locator('xpath=..'), 'background-color')).toBe('rgba(0, 0, 0, 0.65)');
    expect(await style(dialog, 'background-color')).toBe(LIGHT['--bg-surface-2']);
    expect(await style(button(dialog, 'Start Session'), 'background-color')).toBe(LIGHT['--accent-primary']);
    const result = await audit(dialog, DARK_ONLY);
    expect(result.dark, 'elements that keep a dark-set colour').toEqual([]);
    expect(result.lowContrast, 'text under 4.5:1').toEqual([]);
  });
});
