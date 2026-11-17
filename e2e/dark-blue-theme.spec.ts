// e2e of plan-dark_blue_theme, batch dark-blue: REQ-30, REQ-31, REQ-34 to REQ-42 in the browser. Expected values come from
// the REQs and the specs ThemeTokens, ThemeStore, ThemeSection, WebEntry, SessionView and Windows11Look. The first frame and
// the remembered choice (REQ-32, REQ-33, REQ-35) are in remembered-theme.spec.ts, the desktop part in desktop-window.spec.ts.
/// <reference lib="dom" />
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { cardOf, chooseInSettings, settingsButton, settingsPopup } from './settings';

type Rgba = [number, number, number, number];

// The REQ-36 table and the Dark Blue set of ThemeTokens, in computed form.
const DARK_BLUE: Record<string, string> = {
  '--bg-canvas': 'rgb(18, 21, 30)',
  '--role-canvas': 'rgb(18, 21, 30)',
  '--bg-surface-1': 'rgb(24, 28, 39)',
  '--role-chrome': 'rgb(24, 28, 39)',
  '--role-list': 'rgb(22, 26, 36)',
  '--bg-surface-2': 'rgb(27, 32, 44)',
  '--role-card': 'rgb(27, 32, 44)',
  '--role-raised': 'rgb(29, 34, 48)',
  '--bg-surface-3': 'rgb(33, 39, 54)',
  '--role-card-active': 'rgb(33, 39, 54)',
  '--border-subtle': 'rgb(46, 53, 70)',
  '--role-border-subtle': 'rgb(46, 53, 70)',
  '--border-strong': 'rgb(56, 65, 86)',
  '--role-border-strong': 'rgb(56, 65, 86)',
  '--accent-primary': 'rgb(56, 189, 248)',
  '--role-accent': 'rgb(56, 189, 248)',
  '--accent-secondary': 'rgb(125, 211, 252)',
  '--accent-deep': 'rgb(2, 132, 199)',
  '--accent-glow': 'rgba(56, 189, 248, 0.16)',
  '--accent-border': 'rgba(56, 189, 248, 0.42)',
  '--accent-selection': 'rgba(56, 189, 248, 0.3)',
  '--on-accent': 'rgb(9, 13, 22)',
  '--text-primary': 'rgb(241, 245, 249)',
  '--text-secondary': 'rgb(148, 163, 184)',
  '--text-muted': 'rgb(128, 143, 164)',
  '--emerald-400': 'rgb(52, 211, 153)',
  '--amber-300': 'rgb(252, 211, 77)',
  '--amber-400': 'rgb(251, 191, 36)',
  '--rose-300': 'rgb(253, 164, 175)',
  '--rose-400': 'rgb(251, 113, 133)',
  '--zinc-400': 'rgb(148, 163, 184)',
  '--zinc-500': 'rgb(100, 116, 139)',
  '--term-bg': 'rgb(17, 20, 28)',
  '--term-frame': 'rgb(51, 59, 79)',
  '--scrollbar-thumb': 'rgb(46, 53, 70)',
  '--scrollbar-thumb-hover': 'rgb(67, 78, 102)',
  '--field-bg': 'rgb(29, 34, 48)',
  '--field-border': 'rgb(59, 68, 92)',
  '--field-focus-ring': 'rgba(56, 189, 248, 0.25)',
};
const MOCK_MUTED = 'rgb(100, 116, 139)';
const ACCENT = DARK_BLUE['--accent-primary']!;
const TERM_BG = DARK_BLUE['--term-bg']!;
const DARK_TERM_BG = 'rgb(11, 11, 14)';
// Colours of the Dark set that Dark Blue replaces: no element outside the terminal may show them in Dark Blue.
const DARK_ONLY = [
  'rgb(11, 11, 14)',
  'rgb(18, 18, 22)',
  'rgb(24, 24, 31)',
  'rgb(33, 33, 43)',
  'rgba(24, 24, 31, 0.82)',
  'rgba(255, 255, 255, 0.07)',
  'rgba(255, 255, 255, 0.13)',
  'rgb(243, 242, 238)',
  'rgb(161, 160, 171)',
  'rgb(137, 136, 148)',
  'rgb(140, 207, 255)',
  'rgba(140, 207, 255, 0.16)',
  'rgba(140, 207, 255, 0.42)',
  'rgb(161, 161, 170)',
];
const SURFACES = ['--bg-canvas', '--bg-surface-1', '--bg-surface-2', '--bg-surface-3', '--role-list', '--role-raised'];

// Headless Chromium hides scrollbars by default; the scrollbar thumb test needs them drawn.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

let projectsRoot: string;
const createdIds: string[] = [];

// The browser starts in Dark: the config gives it a saved dark choice. A light system theme: Dark Blue must not follow it.
test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });

test.beforeEach(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-dark-blue-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  await rm(projectsRoot, { recursive: true, force: true });
});

const button = (scope: Locator, name: string) => scope.getByRole('button', { name, exact: true });
const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const panel = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => panel(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const terminal = (page: Page) => page.locator('.xterm-rows');
const terminalRegion = (page: Page, folder: string) => page.getByRole('region', { name: `Terminal: ${path.basename(folder)}` });
const chooser = (page: Page) => page.getByRole('dialog', { name: 'New Claude Code Session' });
const html = (page: Page) => page.locator('html');

/** Shows in the page only the sessions of this test, so other specs running on the same server do not change the list. */
async function showOnly(page: Page): Promise<void> {
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
  await entry(page, folder).getByTitle(folder, { exact: true }).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
}

async function toDarkBlue(page: Page): Promise<void> {
  await chooseInSettings(page, 'Dark Blue');
  await expect(html(page)).toHaveAttribute('data-theme', 'dark-blue');
}

const style = (target: Locator, property: string, pseudo?: string) =>
  target.evaluate((el, [p, ps]) => getComputedStyle(el, ps ?? null).getPropertyValue(p!), [property, pseudo] as const);

/** The computed form of a CSS colour value, so `#38bdf8` and `rgb(56, 189, 248)` compare equal. */
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

/** The pixels of a PNG screenshot as rows of [r, g, b], decoded in the page. */
const pixelsOf = (page: Page, png: Buffer) =>
  page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const rows: [number, number, number][][] = [];
    for (let y = 0; y < bitmap.height; y++) {
      const row: [number, number, number][] = [];
      for (let x = 0; x < bitmap.width; x++) row.push([data[(y * bitmap.width + x) * 4]!, data[(y * bitmap.width + x) * 4 + 1]!, data[(y * bitmap.width + x) * 4 + 2]!]);
      rows.push(row);
    }
    return rows;
  }, png.toString('base64'));

const near = ([r, g, b]: [number, number, number], target: Rgba, tolerance: number) =>
  Math.abs(r - target[0]) <= tolerance && Math.abs(g - target[1]) <= tolerance && Math.abs(b - target[2]) <= tolerance;

/** Whether a colour or `box-shadow` value holds `target`, whatever colour syntax the browser uses (rgb, color(), oklab, …). */
const shadowHas = (page: Page, shadow: string, target: string) =>
  page.evaluate(
    ([value, wanted]) => {
      const context = new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true })!;
      const rgba = (c: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = c;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data];
      };
      const want = rgba(wanted!);
      const found = value!.match(/(rgba?|color|oklab|oklch|lab|lch)\([^)]*\)/g) ?? [];
      return found.some((c) => rgba(c).every((channel, i) => Math.abs(channel - want[i]!) <= (i === 3 ? 6 : 2)));
    },
    [shadow, target] as const,
  );

/** Every visible element of `scope` outside the terminal: those that paint a Dark-only colour, and text under 4.5:1. */
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
      let base: C = [0, 0, 0, 1];
      for (const layer of layers.reverse()) base = overC(layer, base);
      const fg = parseC(s.color);
      if (!fg) continue;
      const r = ratio(overC(fg, base), base);
      if (r < 4.5) lowContrast.push(`${describe(el)}: ${s.color} on rgb(${base.slice(0, 3).map(Math.round).join(', ')}) = ${r.toFixed(2)}`);
    }
    return { dark, lowContrast };
  }, darkOnly);
}

/** The ANSI colours xterm paints: its `.xterm-fg-N` rules for indexes 0–255 (higher indexes are xterm's own background slots). */
const ansiColours = (page: Page) =>
  page.evaluate(() => {
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n');
    const colours: Record<string, string> = {};
    for (const m of css.matchAll(/\.xterm-fg-(\d+)\s*\{\s*color:\s*([^;}\s]+)/g)) if (Number(m[1]) < 256) colours[m[1]!] = m[2]!.toLowerCase();
    return colours;
  });

// ---------------------------------------------------------------------------------------------------------------------
test.describe('theme choice', () => {
  // REQ-30, ThemeSection: three cards in order, each with its own preview, the active one checked
  test('Settings > Appearance offers Light, Dark and Dark Blue, checks the active one, and the Dark Blue card previews its own colours', async ({ page }) => {
    await page.goto('/');
    await chooseInSettings(page, 'Light');
    await settingsButton(page).click();
    const popup = settingsPopup(page);
    await popup.getByRole('tab', { name: 'Appearance', exact: true }).click();
    const group = popup.getByRole('group', { name: 'Theme', exact: true });
    await expect(group.getByRole('radio')).toHaveCount(3);
    const names = await group.getByRole('radio').evaluateAll((radios) => radios.map((r) => r.closest('label')?.textContent?.trim()));
    expect(names).toEqual(['Light', 'Dark', 'Dark Blue']);
    await expect(group.getByRole('radio', { name: 'Light', exact: true })).toBeChecked();
    await expect(group.getByRole('radio', { name: 'Dark Blue', exact: true })).not.toBeChecked();

    // The preview shows Dark Blue whatever the active theme: here Light.
    const card = cardOf(group.getByRole('radio', { name: 'Dark Blue', exact: true }));
    const painted = await card.evaluate((el) => [...el.querySelectorAll('*')].map((n) => getComputedStyle(n).backgroundColor));
    expect(painted, 'the preview shows the Dark Blue canvas').toContain(DARK_BLUE['--bg-canvas']);
    expect(painted, 'the preview shows the Dark Blue accent').toContain(ACCENT);
    await expect(card.locator('svg').first(), 'the card has its icon').toBeVisible();
  });

  // REQ-31, REQ-36, REQ-38, REQ-30 — scenario "the user switches to Dark Blue"
  test('choosing Dark Blue with a session open restyles the client and the terminal at once, keeping the session, the dialog and the list scroll', async ({ page, request }) => {
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
    for (let i = 0; i < 10; i++) folders.push(await newFolder(`blue-${String(i).padStart(2, '0')}`));
    for (const folder of folders) await startViaApi(request, folder);
    await page.goto('/');
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
    const open = folders[0]!;
    await openFromList(page, open);
    const region = terminalRegion(page, open);
    expect(await effectiveBackground(page.locator('.xterm-screen')), 'the Dark terminal background before the change').toBe(DARK_TERM_BG);

    const scroller = await panel(page).evaluateHandle((el) => {
      const all = [el, ...el.querySelectorAll('*')] as HTMLElement[];
      return all.find((n) => n.scrollHeight > n.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(n).overflowY)) ?? null;
    });
    expect(await scroller.evaluate((n) => n !== null), 'the session list scrolls').toBe(true);
    await scroller.evaluate((n) => n!.scrollTo(0, n!.scrollHeight));
    const scrollTop = await scroller.evaluate((n) => n!.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
    const sockets = await page.evaluate(() => [...(window as unknown as { socketLog: string[] }).socketLog]);
    const reloads = await page.evaluate(() => performance.getEntriesByType('navigation').length);

    await settingsButton(page).click();
    const popup = settingsPopup(page);
    await popup.getByRole('tab', { name: 'Appearance', exact: true }).click();
    const darkBlue = popup.getByRole('radio', { name: 'Dark Blue', exact: true });
    await cardOf(darkBlue).click();

    await expect(html(page)).toHaveAttribute('data-theme', 'dark-blue');
    await expect(darkBlue).toBeChecked();
    await expect(popup, 'the settings dialog stays open').toBeVisible();
    expect(await style(page.locator('body'), 'background-color')).toBe(DARK_BLUE['--bg-canvas']);
    expect(await style(page.locator('body'), 'color')).toBe(DARK_BLUE['--text-primary']);
    // The terminal takes the new colours at once (REQ-38), with no new connection (REQ-31).
    await expect.poll(() => effectiveBackground(page.locator('.xterm-screen')), { timeout: 2000 }).toBe(TERM_BG);
    expect(await style(region, 'background-color')).toBe(TERM_BG);
    await popup.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(popup).toHaveCount(0);

    await page.waitForTimeout(300);
    expect(await scroller.evaluate((n) => n!.scrollTop), 'the list keeps its scroll position').toBe(scrollTop);
    await expect(region, 'the same session stays open').toBeVisible();
    await expect(terminal(page)).toContainText(`CWD:${open}`);
    await expect(terminal(page)).not.toContainText('[Session disconnected]');
    expect(await page.evaluate(() => [...(window as unknown as { socketLog: string[] }).socketLog]), 'no connection opened or closed').toEqual(sockets);
    expect(await page.evaluate(() => performance.getEntriesByType('navigation').length), 'no reload').toBe(reloads);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('first start and shortcut', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  // REQ-34, REQ-35 — scenario "the shortcut cycles three themes"
  test('with nothing saved the client starts in Dark Blue, and the theme shortcut cycles Light, Dark, Dark Blue', async ({ page }) => {
    await page.goto('/');
    await expect(rail(page)).toBeVisible();
    await expect(html(page)).toHaveAttribute('data-theme', 'dark-blue');
    const seen: (string | null)[] = [];
    for (let i = 0; i < 3; i++) {
      const before = await html(page).getAttribute('data-theme');
      await page.keyboard.press('Alt+KeyA');
      await expect(html(page)).not.toHaveAttribute('data-theme', before!);
      seen.push(await html(page).getAttribute('data-theme'));
    }
    expect(seen).toEqual(['light', 'dark', 'dark-blue']);
    expect(await page.evaluate(() => localStorage.getItem('ai-client.theme')), 'each shortcut press saves the theme').toBe('dark-blue');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('Dark Blue palette', () => {
  // REQ-36, REQ-37, REQ-38, REQ-40, ThemeTokens Dark Blue set
  test('the Dark Blue set has the REQ-36 colours, the slate text tones, the mock status tones and its terminal and native part tokens', async ({ page }) => {
    await page.goto('/');
    await toDarkBlue(page);
    for (const [name, expected] of Object.entries(DARK_BLUE)) expect(sameColour(await colour(page, `var(${name})`), expected), `${name} = ${expected}`).toBe(true);
  });

  // REQ-38, REQ-39: only the background and frame change; foreground, cursor and selection keep the Dark values
  test('the other terminal tokens keep the Dark values', async ({ page }) => {
    await page.goto('/');
    const names = ['--term-fg', '--term-cursor', '--term-selection', '--term-match-bg', '--term-match-current-bg', '--term-match-current-border'];
    const dark: Record<string, string> = {};
    for (const n of names) dark[n] = await token(page, n);
    for (const n of names) expect(dark[n], `${n} is defined`).not.toBe('');
    await toDarkBlue(page);
    for (const n of names) expect(await token(page, n), n).toBe(dark[n]);
  });

  // REQ-41, ThemeTokens rules: text 4.5:1 on every surface; the muted text lightened only as much as needed
  test('Dark Blue text reaches 4.5:1 on every surface, and the muted text is lightened only as much as needed', async ({ page }) => {
    await page.goto('/');
    await toDarkBlue(page);
    const ratios: Record<string, number[]> = {};
    for (const text of ['--text-primary', '--text-secondary', '--text-muted']) {
      ratios[text] = [];
      for (const bg of SURFACES) {
        const r = contrast(parse(await colour(page, `var(${text})`)), parse(await colour(page, `var(${bg})`)));
        expect(r, `${text} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        ratios[text]!.push(r);
      }
    }
    const mockWorst = Math.min(...(await Promise.all(SURFACES.map(async (bg) => contrast(parse(MOCK_MUTED), parse(await colour(page, `var(${bg})`)))))));
    expect(mockWorst, 'the mock muted text fails, so it changes').toBeLessThan(4.5);
    expect(Math.min(...ratios['--text-muted']!), 'the muted text is the least lightening').toBeLessThan(4.6);
    const muted = parse(await colour(page, 'var(--text-muted)'));
    expect(Math.abs(hue(muted) - hue(parse(MOCK_MUTED))), 'same hue as the mock muted text').toBeLessThanOrEqual(3);
  });

  // REQ-37, REQ-41: status tones reach 4.5:1 on the surfaces and on the 15 % tint of their family
  test('Dark Blue status tones reach 4.5:1 on every surface and on their 15 % tint', async ({ page }) => {
    await page.goto('/');
    await toDarkBlue(page);
    const families: [string, string][] = [
      ['--emerald-400', '--emerald-500-15'],
      ['--amber-300', '--amber-500-15'],
      ['--amber-400', '--amber-500-15'],
      ['--rose-300', '--rose-500-15'],
      ['--rose-400', '--rose-500-15'],
      ['--zinc-400', '--zinc-500-15'],
      ['--orange-400', '--orange-500-15'],
    ];
    for (const [text, tint] of families) {
      const fg = parse(await colour(page, `var(${text})`));
      for (const bg of SURFACES.slice(0, 4)) {
        const base = parse(await colour(page, `var(${bg})`));
        expect(contrast(fg, base), `${text} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(fg, over(parse(await colour(page, `var(${tint})`)), base)), `${text} on ${tint} over ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  // REQ-42, ThemeTokens rules: the accent, the focus ring colour, reaches 3:1 on every surface; text on accent fills 4.5:1
  test('the Dark Blue accent reaches 3:1 on every surface and carries its on-accent text at 4.5:1', async ({ page }) => {
    await page.goto('/');
    await toDarkBlue(page);
    const accent = parse(await colour(page, 'var(--accent-primary)'));
    expect(sameColour(await colour(page, 'var(--color-focus-ring)'), ACCENT)).toBe(true);
    for (const bg of SURFACES) expect(contrast(accent, parse(await colour(page, `var(${bg})`))), `accent on ${bg}`).toBeGreaterThanOrEqual(3);
    const onAccent = parse(await colour(page, 'var(--on-accent)'));
    expect(contrast(onAccent, accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(onAccent, parse(await colour(page, 'var(--accent-deep)')))).toBeGreaterThanOrEqual(4.5);
  });

  // WebEntry, REQ-40: the colour scheme is dark in Dark Blue, whatever the system theme
  test('Dark Blue uses the dark colour scheme on a light system', async ({ page }) => {
    await page.goto('/');
    await toDarkBlue(page);
    expect(await style(html(page), 'color-scheme')).toBe('dark');
    await chooseInSettings(page, 'Light');
    expect(await style(html(page), 'color-scheme')).toBe('light');
  });

  // Windows11Look, INT-12: Dark Blue keeps its colours in the Windows 11 look; the Windows 11 dark set is only for Dark
  test('in the Windows 11 look Dark Blue keeps its colours and takes the shapes and caption tokens; Dark takes the Windows 11 set', async ({ page }) => {
    await page.goto('/');
    await chooseInSettings(page, 'Windows 11');
    await expect(html(page)).toHaveAttribute('data-look', 'windows11');
    expect(sameColour(await colour(page, 'var(--bg-canvas)'), 'rgb(28, 28, 28)'), 'Dark takes the Windows 11 canvas').toBe(true);
    await toDarkBlue(page);
    for (const n of ['--bg-canvas', '--bg-surface-1', '--bg-surface-2', '--bg-surface-3', '--role-list', '--role-raised', '--text-primary', '--text-secondary', '--text-muted', '--accent-primary', '--accent-deep', '--on-accent', '--zinc-400']) {
      expect(sameColour(await colour(page, `var(${n})`), DARK_BLUE[n]!), `${n} keeps the Dark Blue value`).toBe(true);
    }
    expect(await token(page, '--radius-card')).toBe('8px');
    expect(await token(page, '--radius-pill')).toBe('4px');
    expect(sameColour(await colour(page, 'var(--caption-hover)'), 'rgba(255, 255, 255, 0.08)')).toBe(true);
    expect(sameColour(await colour(page, 'var(--caption-pressed)'), 'rgba(255, 255, 255, 0.05)')).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('Dark Blue screens', () => {
  // REQ-36, REQ-37, REQ-41: list in every state and an open session, no Dark colour left, all text readable
  test('with sessions in every state and one open, no element keeps a Dark colour, status tones follow the mock and all text reaches 4.5:1', async ({ page, request }) => {
    await showOnly(page);
    const working = await newFolder('working-row');
    const ended = await newFolder('ended-row');
    const asking = await newFolder('asking-row');
    await startViaApi(request, await newFolder('idle-row'));
    const workingId = await startViaApi(request, working);
    const endedId = await startViaApi(request, ended);
    const askingId = await startViaApi(request, asking);
    await postHook(request, workingId, { hook_event_name: 'UserPromptSubmit', prompt: 'run the tests' });
    expect((await request.post(`/api/sessions/${endedId}/stop`)).status()).toBeLessThan(300);
    await page.goto('/');
    await toDarkBlue(page);
    await openFromList(page, working);
    await postHook(request, askingId, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    await expect(entry(page, asking)).toContainText('Needs Input');
    await expect(entry(page, ended)).toContainText('Ended');

    const result = await audit(page.locator('body'), DARK_ONLY);
    expect(result.dark, 'elements that keep a Dark-set colour').toEqual([]);
    expect(result.lowContrast, 'text under 4.5:1').toEqual([]);

    expect(await style(entry(page, working).getByText('Running', { exact: true }), 'color'), 'working is emerald').toBe(DARK_BLUE['--emerald-400']);
    expect([DARK_BLUE['--amber-300'], DARK_BLUE['--amber-400']], 'needs input is amber').toContain(await style(entry(page, asking).getByText('Needs Input', { exact: true }), 'color'));
    expect([DARK_BLUE['--zinc-400'], DARK_BLUE['--zinc-500']], 'ended is the mock slate').toContain(await style(entry(page, ended).getByText('Ended', { exact: true }), 'color'));
    // REQ-36 table: the session list surface
    expect(await effectiveBackground(panel(page)), 'the session list').toBe(DARK_BLUE['--role-list']);
  });

  // REQ-38, REQ-39: background, frame and focus ring of the mock; ANSI colours unchanged
  test('a terminal in Dark Blue has the mock background, frame and focus ring, and keeps the ANSI colours of Dark', async ({ page, request }) => {
    await showOnly(page);
    const folder = await newFolder('blue-terminal');
    await startViaApi(request, folder);
    await page.goto('/');
    await openFromList(page, folder);
    const darkAnsi = await ansiColours(page);
    expect(Object.keys(darkAnsi).length, 'xterm paints ANSI colour rules').toBeGreaterThanOrEqual(16);

    await toDarkBlue(page);
    const region = terminalRegion(page, folder);
    await expect.poll(() => effectiveBackground(page.locator('.xterm-screen'))).toBe(TERM_BG);
    expect(await style(region, 'background-color')).toBe(TERM_BG);
    await expect.poll(() => style(region, 'border-top-color'), { message: 'the frame' }).toBe(DARK_BLUE['--term-frame']);
    expect(await ansiColours(page), 'ANSI colours as in Dark').toEqual(darkAnsi);

    await page.locator('.xterm-screen').click();
    await expect
      .poll(async () => shadowHas(page, await style(region, 'border-top-color'), 'rgba(56, 189, 248, 0.75)'), { message: 'focused frame border: accent at 75 %' })
      .toBe(true);
    const frameShadow = await style(region, 'box-shadow');
    expect(await shadowHas(page, frameShadow, 'rgba(56, 189, 248, 0.22)'), `focused frame ring: accent at 22 % in ${frameShadow}`).toBe(true);

    // A terminal opened directly in Dark Blue takes the same colours.
    await page.reload();
    await openFromList(page, folder);
    await expect.poll(() => effectiveBackground(page.locator('.xterm-screen'))).toBe(TERM_BG);
    expect(await ansiColours(page)).toEqual(darkAnsi);
  });

  // REQ-40: form controls as the mock's prompt box
  test('a text field in Dark Blue has the raised fill, the mock border, and an accent border with a 25 % ring on focus', async ({ page }) => {
    await page.goto('/');
    await toDarkBlue(page);
    await button(rail(page), 'New Claude Code Session').click();
    const field = chooser(page).locator('.field-input').first();
    await expect(field).toBeVisible();
    await field.blur();
    expect(await style(field, 'background-color')).toBe(DARK_BLUE['--role-raised']);
    expect(await style(field, 'border-top-color')).toBe(DARK_BLUE['--field-border']);
    await field.focus();
    await expect.poll(() => style(field, 'border-top-color')).toBe(ACCENT);
    const ring = await style(field, 'box-shadow');
    expect(await shadowHas(page, ring, 'rgba(56, 189, 248, 0.25)'), `focus ring accent at 25 % in ${ring}`).toBe(true);
  });

  // REQ-40: rounded scrollbar thumbs in #2E3546
  test('a scrolling list in Dark Blue paints its scrollbar thumb in #2E3546', async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 420 });
    await showOnly(page);
    for (let i = 0; i < 10; i++) await startViaApi(request, await newFolder(`thumb-${String(i).padStart(2, '0')}`));
    await page.goto('/');
    await toDarkBlue(page);
    const handle = await panel(page).evaluateHandle((el) => {
      const all = [el, ...el.querySelectorAll('*')] as HTMLElement[];
      return all.find((n) => n.scrollHeight > n.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(n).overflowY)) ?? null;
    });
    expect(await handle.evaluate((n) => n !== null), 'the session list scrolls').toBe(true);
    const area = await handle.evaluate((n) => {
      const r = n!.getBoundingClientRect();
      const bar = n!.offsetWidth - n!.clientWidth;
      return { x: r.right - bar, y: r.top, width: bar, height: r.height };
    });
    expect(area.width, 'a scrollbar shows').toBeGreaterThan(0);
    const pixels = await pixelsOf(page, await page.screenshot({ clip: area, animations: 'disabled' }));
    const thumb = parse(DARK_BLUE['--scrollbar-thumb']!);
    const count = pixels.flat().filter((p) => near(p, thumb, 2)).length;
    expect(count, 'thumb pixels in #2E3546').toBeGreaterThan(20);
  });

  // REQ-42, WebEntry: in Dark Blue the focus ring of the active entry sits inside its accent border, with a gap
  test('the keyboard focus on the open session entry shows the accent ring inside the border, apart from it', async ({ page, request }) => {
    await showOnly(page);
    const folder = await newFolder('focus-card');
    await startViaApi(request, folder);
    await page.goto('/');
    await toDarkBlue(page);
    await openFromList(page, folder);
    await page.keyboard.press('Alt+KeyL');
    const focused = entry(page, folder);
    await expect(focused).toBeFocused();
    expect(await focused.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    const b = (await focused.boundingBox())!;
    const pixels = await pixelsOf(page, await page.screenshot({ clip: { x: b.x, y: b.y, width: b.width, height: 12 }, animations: 'disabled' }));
    const column = pixels.map((row) => row[Math.floor(row.length / 2)]!);
    const accent = parse(ACCENT);
    const isAccent = column.map((p) => near(p, accent, 40));
    const firstAccent = isAccent.indexOf(true);
    expect(firstAccent, `accent border at the top edge: ${JSON.stringify(column)}`).toBeGreaterThanOrEqual(0);
    expect(firstAccent).toBeLessThanOrEqual(1);
    const gap = isAccent.indexOf(false, firstAccent);
    expect(gap, 'a gap below the border').toBeGreaterThan(firstAccent);
    const ring = isAccent.indexOf(true, gap);
    expect(ring, `the ring below the gap: ${JSON.stringify(column)}`).toBeGreaterThan(gap);
    expect(ring, 'the ring sits about 4 px inside the edge').toBeLessThanOrEqual(6);
  });

  // REQ-42: every control reached with Tab shows a visible focus indicator
  test('every control reached with Tab in Dark Blue shows a visible focus', async ({ page, request }) => {
    await showOnly(page);
    const folder = await newFolder('tab-focus');
    await startViaApi(request, folder);
    await page.goto('/');
    await toDarkBlue(page);
    await openFromList(page, folder);
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    const missing: string[] = [];
    let reached = 0;
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body || el.closest('.xterm')) return null;
        const own = getComputedStyle(el);
        const after = getComputedStyle(el, '::after');
        const ring = (s: CSSStyleDeclaration) => (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
        const label = `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}"`;
        return { label, visible: ring(own) || ring(after) || el.closest('label') !== null && ring(getComputedStyle(el.closest('label')!)) };
      });
      if (!info) continue;
      reached++;
      if (!info.visible) missing.push(info.label);
    }
    expect(reached, 'Tab reaches controls').toBeGreaterThan(5);
    expect(missing, 'controls with no visible focus').toEqual([]);
  });
});
