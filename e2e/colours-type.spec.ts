// e2e of plan-claude_sessions_client-ui_redesign-material3_mock, batch colours-type, brought to the one dark set and the light-blue accent
// of plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark.
/// <reference lib="dom" />
import { mkdir, mkdtemp, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';

type Rgba = [number, number, number, number];

const repoRoot = path.resolve(import.meta.dirname, '..');
const mockDir = path.join(repoRoot, '.sdd/mockups/vexel-material3');
let projectsRoot: string;
const createdIds: string[] = [];

test.use({ colorScheme: 'light' });

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-colours-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const terminal = (page: Page) => page.locator('.xterm-rows');
const mainArea = (page: Page) => page.getByRole('main');
const emptyButton = (page: Page, name: string) => mainArea(page).getByRole('button', { name, exact: true });

async function openSession(page: Page, request: APIRequestContext, name: string): Promise<void> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  createdIds.push(((await response.json()) as { id: string }).id);
  await page.goto('/');
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText('READY');
}

/** Resolves CSS colours, composited bottom-up, to opaque sRGB through a canvas. */
function composite(page: Page, layers: string[]): Promise<Rgba> {
  return page.evaluate((cssColours) => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    ctx.canvas.width = ctx.canvas.height = 1;
    for (const colour of cssColours) {
      ctx.fillStyle = colour;
      ctx.fillRect(0, 0, 1, 1);
    }
    return [...ctx.getImageData(0, 0, 1, 1).data] as Rgba;
  }, layers);
}

const resolved = (page: Page, css: string) => composite(page, ['#fff', css]);

function tokens(page: Page, names: string[]): Promise<Record<string, string>> {
  return page.evaluate((list) => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(list.map((n) => [n, style.getPropertyValue(n).trim()]));
  }, names);
}

/** Every custom property declared in a `:root` rule, media rules included. */
function rootCustomProperties(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const names = new Set<string>();
    const visit = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (rule instanceof CSSStyleRule && /(^|,)\s*:root\b/.test(rule.selectorText)) {
          for (const p of rule.style) if (p.startsWith('--')) names.add(p);
        } else if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of document.styleSheets) visit(sheet.cssRules);
    return [...names];
  });
}

function hexToRgba(hex: string): Rgba {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

/** CIELAB (D65) of an sRGB colour. */
function lab([r, g, b]: Rgba): { L: number; a: number; b: number } {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return { L: 116 * f(y) - 16, a: 500 * (f(x) - f(y)), b: 200 * (f(y) - f(z)) };
}

/** HSL hue in degrees and HSL saturation (0..1) of an sRGB colour. */
function hsl([r, g, b]: Rgba): { h: number; s: number } {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  if (d === 0) return { h: 0, s: 0 };
  const l = (max + min) / 2;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h *= 60;
  return { h: h < 0 ? h + 360 : h, s };
}

const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function cssPx(locator: Locator, property: string): Promise<number> {
  return locator.evaluate((el, p) => parseFloat(getComputedStyle(el).getPropertyValue(p)), property);
}

function effectiveBackground(locator: Locator): Promise<string> {
  return locator.evaluate((el) => {
    for (let node: Element | null = el; node; node = node.parentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return bg;
    }
    return 'rgb(255, 255, 255)';
  });
}


for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} system theme`, () => {
    test.use({ colorScheme: scheme });

    // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-5, REQ-6 and batch decision "Light blue": hue 205, L* gaps of the mock orange family
    test('the accent family is light blue, with the CIELAB lightness gaps of the mock orange family', async ({ page }) => {
      await page.goto('/');
      const t = await tokens(page, ['--accent-primary', '--accent-secondary', '--accent-deep']);
      const [primary, secondary, deep] = await Promise.all(Object.values(t).map((v) => resolved(page, v)));
      for (const [name, colour] of [['--accent-primary', primary!], ['--accent-secondary', secondary!], ['--accent-deep', deep!]] as const) {
        expect(hueDistance(hsl(colour).h, 205), `${name} hue ${hsl(colour).h.toFixed(1)}`).toBeLessThanOrEqual(2);
      }
      const gap = (a: string, b: string) => lab(hexToRgba(a)).L - lab(hexToRgba(b)).L;
      expect(lab(secondary!).L - lab(primary!).L, 'secondary: lighter by the #e06d44 → #f29a76 gap').toBeCloseTo(gap('#f29a76', '#e06d44'), 0);
      expect(lab(primary!).L - lab(deep!).L, 'deep: darker by the #e06d44 → #9a3412 gap').toBeCloseTo(gap('#e06d44', '#9a3412'), 0);
    });

    // ThemeTokens "Rules": no token is orange, indigo, violet or pink; the Material 3 roles are not defined
    test('no colour token is orange, indigo, violet or pink, and the Material 3 roles are not defined', async ({ page }) => {
      await page.goto('/');
      const names = await rootCustomProperties(page);
      expect(names.length).toBeGreaterThan(0);
      const t = await tokens(page, names);
      const isColour = await page.evaluate((values) => values.map((v) => v !== '' && CSS.supports('color', v)), Object.values(t));
      const offenders: string[] = [];
      for (const [i, name] of Object.keys(t).entries()) {
        if (!isColour[i]) continue;
        const rgba = await resolved(page, t[name]!);
        const c = lab(rgba);
        const { h } = hsl(rgba);
        // The mock's cool greys reach a chroma of about 7 at hue 240: only clearly coloured tokens count.
        const coloured = Math.hypot(c.a, c.b) > 15;
        if (coloured && ((h >= 5 && h <= 35) || (h >= 235 && h <= 345))) offenders.push(`${name}: ${t[name]} (hue ${h.toFixed(0)})`);
      }
      expect(offenders).toEqual([]);
      const removed = await tokens(page, ['--primary', '--on-primary', '--secondary-container', '--sc-low', '--sc-highest', '--ember', '--tertiary', '--dialog', '--icon-size']);
      expect(Object.values(removed)).toEqual(Array<string>(9).fill(''));
    });

    // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-1, REQ-5 (human acceptance: light-blue accent, near-black page)
    test('"New Session" is light blue and the page is the near-black canvas', async ({ page }) => {
      await page.goto('/');
      const button = emptyButton(page, 'New Session');
      await expect(button).toBeVisible();
      await page.mouse.move(0, 0);
      const accent = await resolved(page, await button.evaluate((el) => getComputedStyle(el).backgroundColor));
      expect(hueDistance(hsl(accent).h, 205), `"New Session" hue ${hsl(accent).h}`).toBeLessThanOrEqual(2);
      const surface = await resolved(page, await effectiveBackground(page.locator('body')));
      expect(luminance(surface), 'near-black canvas').toBeLessThan(0.01);
    });
  });
}

// ThemeTokens: --term-fg and --term-bg are the text and the canvas, whatever the system theme
test('the terminal colours are the primary text on the canvas, and the system theme does not change them', async ({ page }) => {
  await page.goto('/');
  const light = await tokens(page, ['--term-fg', '--term-bg', '--text-primary', '--bg-canvas']);
  expect(await resolved(page, light['--term-fg']!)).toEqual(await resolved(page, light['--text-primary']!));
  expect(await resolved(page, light['--term-bg']!)).toEqual(await resolved(page, light['--bg-canvas']!));
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await tokens(page, ['--term-fg', '--term-bg', '--text-primary', '--bg-canvas'])).toEqual(light);
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-5, BundledFont "Contract"
test('the page declares Roboto Flex and Roboto Mono as in the boards, and no other font', async ({ page }) => {
  await page.goto('/');
  const faces = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].map((f) => ({
      family: f.family.replace(/["']/g, ''),
      weight: f.weight,
      stretch: f.stretch,
      display: f.display,
      style: f.style,
      unicodeRange: f.unicodeRange,
    }));
  });
  expect([...new Set(faces.map((f) => f.family))].sort()).toEqual(['Roboto Flex', 'Roboto Mono']);
  for (const f of faces) {
    expect(f.display, f.family).toBe('swap');
    expect(f.style, f.family).toBe('normal');
    expect(f.unicodeRange, `${f.family}: latin subset`).toMatch(/^U\+0*0-0*FF\b/i);
  }
  const flex = faces.filter((f) => f.family === 'Roboto Flex');
  expect(flex.map((f) => [f.weight, f.stretch])).toEqual([['400 800', '25% 151%']]);
  const monoWeights = faces.filter((f) => f.family === 'Roboto Mono').flatMap((f) => f.weight.split(' ').map(Number));
  expect(Math.min(...monoWeights)).toBe(400);
  expect(Math.max(...monoWeights)).toBe(500);
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-5 (served by the client itself), BundledFont "Guarantees"
test('the fonts come from the client, Roboto Mono from one file, and the files are the mock ones', async ({ page, request, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  const fonts: string[] = [];
  await page.context().route(
    (url) => url.origin !== origin && !['data:', 'blob:'].includes(url.protocol),
    async (route) => {
      external.push(route.request().url());
      await route.abort('internetdisconnected');
    },
  );
  page.on('response', (r) => {
    if (r.request().resourceType() === 'font') {
      expect(r.status(), r.url()).toBe(200);
      fonts.push(r.url());
    }
  });
  await openSession(page, request, 'fonts-origin');
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')),
  );
  expect(new Set(loaded)).toEqual(new Set(['Roboto Flex', 'Roboto Mono']));
  expect(external, 'requests to other servers').toEqual([]);
  for (const url of fonts) expect(new URL(url).origin).toBe(origin);
  const files = [...new Set(fonts.map((u) => path.basename(new URL(u).pathname)))];
  expect(files.filter((f) => /^roboto-flex-latin\b.*\.woff2$/.test(f))).toHaveLength(1);
  expect(files.filter((f) => /^roboto-mono-latin\b.*\.woff2$/.test(f))).toHaveLength(1);
  expect(files).toHaveLength(2);

  for (const name of ['roboto-flex-latin.woff2', 'roboto-mono-latin.woff2']) {
    const [ours, mock] = await Promise.all([
      readFile(path.join(repoRoot, 'src/web/fonts', name)),
      readFile(path.join(mockDir, name)),
    ]);
    expect(ours.equals(mock), `${name} is the mock file`).toBe(true);
  }
  const shipped = (await readdir(path.join(repoRoot, 'dist/web'), { recursive: true })).filter((f) =>
    /\.(woff2?|ttf|otf|eot)$/i.test(f),
  );
  expect(shipped.map((f) => path.basename(f).replace(/-[\w-]{8}\.woff2$/, '.woff2')).sort()).toEqual([
    'roboto-flex-latin.woff2',
    'roboto-mono-latin.woff2',
  ]);
});

// BundledFont rule: OFL 1.1 with the Roboto Flex and Roboto Mono copyright lines; ThirdPartyNotices entries
test('the font licence and the third-party notices cover Roboto Flex and Roboto Mono and no longer Inter', async () => {
  const ofl = await readFile(path.join(repoRoot, 'src/web/fonts/OFL.txt'), 'utf8');
  expect(ofl).toMatch(/SIL Open Font License,?\s+Version 1\.1/i);
  expect(ofl).toMatch(/Copyright .*Roboto Flex Project Authors/);
  expect(ofl).toMatch(/Copyright .*Roboto Mono Project Authors/);

  const notices = await readFile(path.join(repoRoot, 'THIRD-PARTY-NOTICES.md'), 'utf8');
  const entries = notices.split(/^## /m).slice(1);
  const roboto = (family: string) => entries.find((e) => e.startsWith(family));
  expect(roboto('Roboto Flex'), 'Roboto Flex entry').toContain('src/web/fonts/roboto-flex-latin.woff2');
  expect(roboto('Roboto Mono'), 'Roboto Mono entry').toContain('src/web/fonts/roboto-mono-latin.woff2');
  for (const family of ['Roboto Flex', 'Roboto Mono']) expect(roboto(family), family).toContain('src/web/fonts/OFL.txt');
  expect(notices).not.toMatch(/\bInter\b/);
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-10: UI text in Roboto Flex
test('the UI text is in Roboto Flex', async ({ page }) => {
  await page.goto('/');
  await expect(emptyButton(page, 'New Session')).toBeVisible();
  const family = (l: Locator) => l.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(await family(page.locator('body'))).toMatch(/^["']?Roboto Flex["']?,/);
  for (const name of ['Sessions', 'Resume']) {
    const railButton = page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('button', { name, exact: true });
    expect(await family(railButton), name).toMatch(/^["']?Roboto Flex["']?,/);
  }
  expect(await family(page.getByText('No open session.'))).toMatch(/^["']?Roboto Flex["']?,/);
  expect(await family(emptyButton(page, 'Resume Session'))).toMatch(/^["']?Roboto Flex["']?,/);
});

// WebEntry "Rules": the Material 3 type classes, `.brand`, `.btn`, `.chip` and `.mono` no longer exist
test('no stylesheet defines the Material 3 type classes, .brand, .btn, .chip or .mono', async ({ page }) => {
  await page.goto('/');
  const selectors = await page.evaluate(() => {
    const found: string[] = [];
    const visit = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (rule instanceof CSSStyleRule) found.push(rule.selectorText);
        else if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of document.styleSheets) visit(sheet.cssRules);
    return found;
  });
  const removed = /\.(?:label-[lms]|body-[lms]|title-[lm]|headline-s|brand|btn|chip|mono)(?![\w-])/;
  expect(selectors.filter((selector) => removed.test(selector))).toEqual([]);
});

// EmptyState "Shows", AreaState `full`: tile, Roboto Flex 24/32 title, 12/16 secondary text, the accent and the neutral buttons
test('the empty state is the full area-state block with the accent and the neutral buttons', async ({ page }) => {
  await page.goto('/');
  const title = mainArea(page).getByText('No open session.', { exact: true });
  const hint = mainArea(page).getByText('Start a new session or resume a past one.', { exact: true });
  await expect(title).toBeVisible();
  await page.mouse.move(0, 0);
  const t = await tokens(page, ['--accent-primary', '--on-accent', '--bg-surface-1', '--bg-surface-2', '--text-primary', '--text-secondary']);
  const rgb = async (css: string) => resolved(page, css);
  const style = (l: Locator, p: string) => l.evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), p);

  expect([await style(title, 'font-size'), await style(title, 'line-height'), await style(title, 'font-weight')]).toEqual(['24px', '32px', '400']);
  expect([await style(hint, 'font-size'), await style(hint, 'line-height')]).toEqual(['12px', '16px']);
  expect(await rgb(await style(hint, 'color')), 'text colour').toEqual(await rgb(t['--text-secondary']!));
  expect(await cssPx(hint, 'max-width')).toBeLessThanOrEqual(448);

  const block = title.locator('xpath=..');
  expect(await rgb(await style(block, 'background-color')), 'block on surface 1').toEqual(await rgb(t['--bg-surface-1']!));
  expect([await cssPx(block, 'padding-top'), await cssPx(block, 'border-top-left-radius')]).toEqual([40, 12]);
  expect(await cssPx(block, 'max-width')).toBeLessThanOrEqual(528);

  const icon = mainArea(page).locator('svg.icon:not(button svg)');
  await expect(icon).toHaveCount(1);
  const tile = icon.locator('xpath=..');
  const tileBox = (await tile.boundingBox())!;
  expect([tileBox.width, tileBox.height]).toEqual([48, 48]);
  expect(await cssPx(tile, 'border-top-left-radius')).toBe(12);
  const iconBox = (await icon.boundingBox())!;
  expect([iconBox.width, iconBox.height]).toEqual([24, 24]);
  expect(await rgb(await style(icon, 'color')), 'icon in the accent').toEqual(await rgb(t['--accent-primary']!));

  const filled = emptyButton(page, 'New Session');
  const neutral = emptyButton(page, 'Resume Session');
  for (const b of [filled, neutral]) {
    expect([await cssPx(b, 'padding-top'), await cssPx(b, 'padding-left'), await cssPx(b, 'border-top-left-radius'), await cssPx(b, 'font-size')]).toEqual([8, 16, 8, 12]);
  }
  expect(await rgb(await style(filled, 'background-color')), 'accent background').toEqual(await rgb(t['--accent-primary']!));
  expect(await rgb(await style(filled, 'color')), 'text on the accent').toEqual(await rgb(t['--on-accent']!));
  expect(await rgb(await style(neutral, 'background-color')), 'neutral background').toEqual(await rgb(t['--bg-surface-2']!));
  expect(await rgb(await style(neutral, 'color')), 'neutral text').toEqual(await rgb(t['--text-primary']!));
});

// WebEntry `.button-neutral`: on hover, surface 3 and the strong border
test('the neutral empty state button takes surface 3 and the strong border on hover', async ({ page }) => {
  await page.goto('/');
  const b = emptyButton(page, 'Resume Session');
  await expect(b).toBeVisible();
  const t = await tokens(page, ['--bg-surface-3', '--border-strong']);
  await b.hover();
  await expect.poll(async () => resolved(page, await b.evaluate((el) => getComputedStyle(el).backgroundColor))).toEqual(await resolved(page, t['--bg-surface-3']!));
  expect(await b.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(await page.evaluate((v) => {
    const probe = document.createElement('div');
    probe.style.color = v;
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, t['--border-strong']!));
});

// SessionView "Shows", plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-34: Roboto Mono, 12 px, line height 1.2, font loaded before the terminal opens
test('the terminal opens in Roboto Mono at 12 px, after the font has loaded', async ({ page, request }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { monoLoadedAtOpen?: boolean };
    new MutationObserver((_, observer) => {
      if (!document.querySelector('.xterm')) return;
      w.monoLoadedAtOpen = [...document.fonts].some(
        (f) => f.family.replace(/["']/g, '') === 'Roboto Mono' && f.status === 'loaded',
      );
      observer.disconnect();
    }).observe(document, { childList: true, subtree: true });
  });
  await openSession(page, request, 'terminal-font');
  expect(await page.evaluate(() => (window as unknown as { monoLoadedAtOpen?: boolean }).monoLoadedAtOpen)).toBe(true);
  expect(await terminal(page).evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^["']?Roboto Mono["']?/);
  expect(await cssPx(terminal(page), 'font-size')).toBe(12);
  const rowHeight = await terminal(page).locator(':scope > div').first().evaluate((el) => el.getBoundingClientRect().height);
  // xterm multiplies the font's cell height (about 1.32 em for Roboto Mono) by the line height 1.2.
  expect(rowHeight).toBeGreaterThanOrEqual(18);
  expect(rowHeight).toBeLessThanOrEqual(20);
});

// SessionView "Shows", plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-1, REQ-34: the terminal is on the canvas in the primary text, and a system theme change does not recolour or reconnect it
test('the open terminal takes --term-bg and --term-fg, and a system theme change neither recolours nor reconnects it', async ({ page, request }) => {
  let sockets = 0;
  page.on('websocket', () => sockets++);
  await openSession(page, request, 'terminal-colours');
  const opened = sockets;
  const colours = async () => {
    const t = await tokens(page, ['--term-bg', '--term-fg']);
    return {
      bg: await resolved(page, await effectiveBackground(page.locator('.xterm-screen'))),
      fg: await resolved(page, await terminal(page).evaluate((el) => getComputedStyle(el).color)),
      tokenBg: await resolved(page, t['--term-bg']!),
      tokenFg: await resolved(page, t['--term-fg']!),
    };
  };

  const before = await colours();
  expect(before.bg, 'background').toEqual(before.tokenBg);
  expect(before.fg, 'text').toEqual(before.tokenFg);

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(200);
  expect(await colours(), 'the system theme changes nothing').toEqual(before);

  expect(sockets, 'no reconnect').toBe(opened);
  await expect(terminal(page)).toContainText('READY');
  await expect(terminal(page)).not.toContainText('[Session disconnected]');
});
