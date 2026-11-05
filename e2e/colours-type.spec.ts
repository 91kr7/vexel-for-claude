// e2e of plan-claude_sessions_client-ui_redesign-material3_mock, batch colours-type.
/// <reference lib="dom" />
import { mkdir, mkdtemp, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';

type Rgba = [number, number, number, number];
type Scheme = 'light' | 'dark';

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

// Board values, from the `.m3` and `.m3.dark` rules of the four boards.
const primaryFamily: Record<Scheme, Record<string, string>> = {
  light: {
    '--primary': '#5847B8',
    '--on-primary': '#FFFFFF',
    '--primary-container': '#E4DFFF',
    '--on-primary-container': '#3F2C9E',
    '--inverse-primary': '#C6BFFF',
  },
  dark: {
    '--primary': '#C6BFFF',
    '--on-primary': '#2A1688',
    '--primary-container': '#3F2C9E',
    '--on-primary-container': '#E4DFFF',
    '--inverse-primary': '#5847B8',
  },
};

const neutrals: Record<Scheme, Record<string, string>> = {
  light: {
    '--secondary-container': '#E4DFF9',
    '--on-secondary-container': '#47435A',
    '--surface': '#FDF8FF',
    '--on-surface': '#1C1B21',
    '--on-surface-variant': '#47464F',
    '--outline': '#787680',
    '--outline-variant': '#C8C5D0',
    '--sc-lowest': '#FFFFFF',
    '--sc-low': '#F7F2FA',
    '--sc': '#F1ECF4',
    '--sc-high': '#EBE6EE',
    '--sc-highest': '#E5E1E9',
    '--dialog': '#F1ECF4',
    '--inverse-surface': '#313036',
    '--inverse-on-surface': '#F4EFF7',
    '--term-bg': '#17151C',
    '--term-fg': '#E5E1E9',
    '--term-dim': '#928F9A',
  },
  dark: {
    '--secondary-container': '#47435A',
    '--on-secondary-container': '#E4DFF9',
    '--surface': '#141318',
    '--on-surface': '#E5E1E9',
    '--on-surface-variant': '#C8C5D0',
    '--outline': '#928F9A',
    '--outline-variant': '#47464F',
    '--sc-lowest': '#0F0E13',
    '--sc-low': '#1C1B21',
    '--sc': '#201F25',
    '--sc-high': '#2B292F',
    '--sc-highest': '#36343A',
    '--dialog': '#2B292F',
    '--inverse-surface': '#E5E1E9',
    '--inverse-on-surface': '#313036',
    '--term-bg': '#0F0E13',
    '--term-fg': '#E5E1E9',
    '--term-dim': '#928F9A',
  },
};

const statusRoles: Record<Scheme, Record<string, string>> = {
  light: {
    '--teal-container': '#C8EBE6',
    '--on-teal-container': '#1F4D48',
    '--error': '#BA1A1A',
    '--on-error': '#FFFFFF',
    '--error-container': '#FFDAD6',
    '--on-error-container': '#93000A',
    '--attn': '#7C5800',
    '--attn-container': '#FFDEA7',
    '--on-attn-container': '#5E4200',
    '--ok': '#2E6B32',
    '--ok-container': '#C3EFC0',
    '--on-ok-container': '#0F5223',
    '--ember': '#E07A4F',
  },
  dark: {
    '--teal-container': '#1F4D48',
    '--on-teal-container': '#C8EBE6',
    '--error': '#FFB4AB',
    '--on-error': '#690005',
    '--error-container': '#93000A',
    '--on-error-container': '#FFDAD6',
    '--attn': '#F0BF48',
    '--attn-container': '#5E4200',
    '--on-attn-container': '#FFDEA7',
    '--ok': '#95D592',
    '--ok-container': '#0F5223',
    '--on-ok-container': '#C3EFC0',
    '--ember': '#F09A72',
  },
};

// ThemeTokens: old names and the role each one points to.
const aliases: [string, string][] = [
  ['--color-bg', '--surface'],
  ['--color-surface', '--sc-low'],
  ['--color-surface-hover', '--sc-high'],
  ['--color-surface-selected', '--secondary-container'],
  ['--color-border', '--outline-variant'],
  ['--color-border-strong', '--outline'],
  ['--color-text', '--on-surface'],
  ['--color-text-muted', '--on-surface-variant'],
  ['--color-state-ended', '--on-surface-variant'],
  ['--color-external', '--on-surface-variant'],
  ['--color-primary', '--primary'],
  ['--color-focus-ring', '--primary'],
  ['--color-state-working', '--primary'],
  ['--color-on-primary', '--on-primary'],
  ['--color-danger', '--error'],
  ['--color-error', '--error'],
  ['--color-on-danger', '--on-error'],
  ['--color-state-needs-input', '--attn'],
  ['--color-warning', '--attn'],
  ['--color-state-needs-input-bg', '--attn-container'],
  ['--color-state-idle', '--ok'],
  ['--color-success', '--ok'],
  ['--terminal-background', '--term-bg'],
];

const list = (page: Page) => page.getByRole('navigation', { name: 'Elenco sessioni' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ hasText: folder });
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

/** Background layers from the root down to the element, for compositing translucent layers. */
function backgroundLayers(locator: Locator): Promise<string[]> {
  return locator.evaluate((el) => {
    const layers: string[] = [];
    for (let node: Element | null = el; node; node = node.parentElement) layers.unshift(getComputedStyle(node).backgroundColor);
    return layers;
  });
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

const closeTo = (a: Rgba, b: Rgba, tol: number) => a.slice(0, 3).every((c, i) => Math.abs(c - b[i]!) <= tol);

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-1, REQ-4
    test('the primary family is light blue with the lightness of the board colour it replaces', async ({ page }) => {
      await page.goto('/');
      const t = await tokens(page, Object.keys(primaryFamily[scheme]));
      const failures: string[] = [];
      for (const [name, boardHex] of Object.entries(primaryFamily[scheme])) {
        expect(t[name], `${name} is defined`).not.toBe('');
        const colour = await resolved(page, t[name]!);
        const board = hexToRgba(boardHex);
        const dL = lab(colour).L - lab(board).L;
        if (Math.abs(dL) > 2) failures.push(`${name}: L* differs by ${dL.toFixed(2)} from ${boardHex}`);
        // Board white has no hue: only its lightness carries over.
        if (hsl(board).s === 0) continue;
        const { h, s } = hsl(colour);
        if (s === 0 || hueDistance(h, 205) > 2) failures.push(`${name}: HSL hue ${h.toFixed(1)}, saturation ${s.toFixed(2)}`);
      }
      expect(failures).toEqual([]);
    });

    // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-2, REQ-4
    test('the neutrals and the terminal roles are grey with the lightness of the board colour they replace', async ({ page }) => {
      await page.goto('/');
      const t = await tokens(page, Object.keys(neutrals[scheme]));
      const failures: string[] = [];
      for (const [name, boardHex] of Object.entries(neutrals[scheme])) {
        expect(t[name], `${name} is defined`).not.toBe('');
        const c = lab(await resolved(page, t[name]!));
        const dL = c.L - lab(hexToRgba(boardHex)).L;
        if (Math.abs(dL) > 2) failures.push(`${name}: L* differs by ${dL.toFixed(2)} from ${boardHex}`);
        if (Math.abs(c.a) > 2 || Math.abs(c.b) > 2) failures.push(`${name}: a*=${c.a.toFixed(2)} b*=${c.b.toFixed(2)}`);
      }
      expect(failures).toEqual([]);
    });

    // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-3
    test('the status roles have the board values', async ({ page }) => {
      await page.goto('/');
      const t = await tokens(page, Object.keys(statusRoles[scheme]));
      for (const [name, boardHex] of Object.entries(statusRoles[scheme])) {
        expect(t[name], `${name} is defined`).not.toBe('');
        expect(await resolved(page, t[name]!), name).toEqual(hexToRgba(boardHex));
      }
    });

    // ThemeTokens: old names point to the roles
    test('the old colour names point to their roles', async ({ page }) => {
      await page.goto('/');
      const names = [...new Set(aliases.flat()), '--color-primary-hover', '--color-danger-hover', '--on-primary', '--on-error'];
      const t = await tokens(page, names);
      for (const [oldName, role] of aliases) {
        expect(t[oldName], `${oldName} is defined`).not.toBe('');
        expect(await resolved(page, t[oldName]!), `${oldName} -> ${role}`).toEqual(await resolved(page, t[role]!));
      }
      const hovers: [string, string, string][] = [
        ['--color-primary-hover', '--primary', '--on-primary'],
        ['--color-danger-hover', '--error', '--on-error'],
      ];
      for (const [hover, base, layer] of hovers) {
        const expected = await composite(page, ['#fff', t[base]!, `color-mix(in srgb, ${t[layer]} 8%, transparent)`]);
        const actual = await resolved(page, t[hover]!);
        expect(closeTo(actual, expected, 2), `${hover}: ${actual} vs ${base} with 8% of ${layer} ${expected}`).toBe(true);
      }
    });

    // ThemeTokens rule: no violet, purple or pink token; tertiary roles not defined
    test('no colour token is violet, purple or pink and the tertiary roles are not defined', async ({ page }) => {
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
        if (Math.hypot(c.a, c.b) > 6 && h >= 240 && h <= 345) offenders.push(`${name}: ${t[name]} (hue ${h.toFixed(0)})`);
      }
      expect(offenders).toEqual([]);
      const tertiary = await tokens(page, ['--tertiary', '--on-tertiary', '--tertiary-container', '--on-tertiary-container']);
      expect(Object.values(tertiary)).toEqual(['', '', '', '']);
    });

    // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-1, REQ-2 (human acceptance: light-blue accents, grey surfaces)
    test('"Nuova sessione" is light blue and the page surface is neutral grey', async ({ page }) => {
      await page.goto('/');
      const button = page.getByRole('complementary').getByRole('button', { name: 'Nuova sessione', exact: true });
      await expect(button).toBeVisible();
      await page.mouse.move(0, 0);
      const accent = await resolved(page, await button.evaluate((el) => getComputedStyle(el).backgroundColor));
      expect(hueDistance(hsl(accent).h, 205), `"Nuova sessione" hue ${hsl(accent).h}`).toBeLessThanOrEqual(2);
      const surface = lab(await resolved(page, await effectiveBackground(page.locator('body'))));
      expect(Math.abs(surface.a), 'page surface a*').toBeLessThanOrEqual(2);
      expect(Math.abs(surface.b), 'page surface b*').toBeLessThanOrEqual(2);
    });
  });
}

// ThemeTokens rule: --term-fg is the same light grey in both sets; --term-bg is dark grey in both
test('the terminal text colour is the same in both sets and the terminal background is dark in both', async ({ page }) => {
  await page.goto('/');
  const light = await tokens(page, ['--term-fg', '--term-bg']);
  await page.emulateMedia({ colorScheme: 'dark' });
  const dark = await tokens(page, ['--term-fg', '--term-bg']);
  expect(await resolved(page, dark['--term-fg']!)).toEqual(await resolved(page, light['--term-fg']!));
  expect(luminance(await resolved(page, light['--term-bg']!))).toBeLessThan(0.05);
  expect(luminance(await resolved(page, dark['--term-bg']!))).toBeLessThan(0.05);
});

// ThemeTokens: icon size of the board `.icon`
test('the icon size token is 20 px', async ({ page }) => {
  await page.goto('/');
  const size = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.width = 'var(--icon-size)';
    document.body.append(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return width;
  });
  expect(size).toBe(20);
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

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-5: UI text in Roboto Flex, `.mono` in Roboto Mono
test('the UI text is in Roboto Flex and the mono class is in Roboto Mono', async ({ page }) => {
  await page.goto('/');
  await expect(emptyButton(page, 'Nuova sessione')).toBeVisible();
  const family = (l: Locator) => l.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(await family(page.locator('body'))).toMatch(/^["']?Roboto Flex["']?,/);
  for (const name of ['Nuova sessione', 'Riprendi sessione']) {
    expect(await family(page.getByRole('complementary').getByRole('button', { name, exact: true })), name).toMatch(/^["']?Roboto Flex["']?,/);
  }
  expect(await family(page.getByText('Nessuna sessione aperta.'))).toMatch(/^["']?Roboto Flex["']?,/);
  const mono = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.className = 'mono';
    document.body.append(probe);
    const f = getComputedStyle(probe).fontFamily;
    probe.remove();
    return f;
  });
  expect(mono).toMatch(/^["']?Roboto Mono["']?,/);
});

// WebEntry: global classes IDENTICAL to the board `<style>` block
test('the board type, button, chip and icon classes have the board look', async ({ page }) => {
  await page.goto('/');
  const looks = await page.evaluate(() => {
    const props = [
      'font-family', 'font-size', 'line-height', 'font-weight', 'letter-spacing', 'font-variation-settings',
      'display', 'align-items', 'gap', 'height', 'width', 'padding', 'border-radius', 'border-top-style',
      'border-top-width', 'cursor', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'color', 'flex-shrink',
    ];
    const read = (el: Element) => {
      const s = getComputedStyle(el);
      return Object.fromEntries(props.map((p) => [p, s.getPropertyValue(p)]));
    };
    const out: Record<string, Record<string, string>> = {};
    for (const cls of ['brand', 'label-l', 'label-m', 'body-l', 'body-m', 'body-s', 'title-m', 'title-l', 'headline-s', 'btn', 'chip']) {
      const el = document.createElement('div');
      el.className = cls;
      el.textContent = 'x';
      document.body.append(el);
      out[cls] = read(el);
    }
    const svgNs = 'http://www.w3.org/2000/svg';
    const icon = document.createElementNS(svgNs, 'svg');
    icon.setAttribute('class', 'icon');
    document.body.append(icon);
    out.icon = read(icon);
    const chip = document.createElement('div');
    chip.className = 'chip';
    const chipIcon = document.createElementNS(svgNs, 'svg');
    chipIcon.setAttribute('class', 'icon');
    chip.append(chipIcon);
    document.body.append(chip);
    out.chipIcon = read(chipIcon);
    return out;
  });

  expect(looks.brand!['font-family']).toMatch(/^["']?Roboto Flex["']?,/);
  expect(looks.brand!['font-weight']).toBe('800');
  expect(looks.brand!['letter-spacing']).toBe('-0.5px');
  expect(looks.brand!['font-variation-settings']).toMatch(/"wdth" 125/);
  expect(looks.brand!['font-variation-settings']).toMatch(/"GRAD" 50/);

  const type: [string, string, string, string, string][] = [
    // class, size, line height, weight, letter spacing
    ['label-l', '14px', '20px', '500', '0.1px'],
    ['label-m', '12px', '16px', '500', '0.5px'],
    ['body-l', '16px', '24px', '400', '0.5px'],
    ['body-m', '14px', '20px', '400', '0.25px'],
    ['body-s', '12px', '16px', '400', '0.4px'],
    ['title-m', '16px', '24px', '500', '0.15px'],
    ['title-l', '22px', '28px', '500', 'normal'],
    ['headline-s', '24px', '32px', '500', 'normal'],
  ];
  for (const [cls, size, lineHeight, weight, spacing] of type) {
    const l = looks[cls]!;
    expect([l['font-size'], l['line-height'], l['font-weight'], l['letter-spacing']], cls).toEqual([size, lineHeight, weight, spacing]);
  }

  const btn = looks.btn!;
  expect([btn.display, btn['align-items'], btn.gap, btn.height, btn.padding, btn['border-radius'], btn.cursor]).toEqual([
    'inline-flex', 'center', '8px', '40px', '0px 20px 0px 16px', '20px', 'pointer',
  ]);
  expect(btn['border-top-style'] === 'none' || btn['border-top-width'] === '0px', 'btn has no border').toBe(true);

  const chip = looks.chip!;
  expect([chip.display, chip['align-items'], chip.gap, chip.height, chip.padding, chip['border-radius']]).toEqual([
    'inline-flex', 'center', '6px', '28px', '0px 10px 0px 8px', '8px',
  ]);

  const icon = looks.icon!;
  expect([icon.width, icon.height, icon.fill, icon['stroke-width'], icon['stroke-linecap'], icon['stroke-linejoin'], icon['flex-shrink']]).toEqual([
    '20px', '20px', 'none', '2px', 'round', 'round', '0',
  ]);
  expect(icon.stroke, 'icon stroke is the text colour').toBe(icon.color);
  expect([looks.chipIcon!.width, looks.chipIcon!.height]).toEqual(['16px', '16px']);
});

// EmptyState "Shows", plan-claude_sessions_client-ui_redesign-material3_mock/REQ-1, REQ-2, REQ-5
test('the empty state is drawn with the board type classes, buttons and colour roles', async ({ page }) => {
  await page.goto('/');
  const title = mainArea(page).getByText('Nessuna sessione aperta.', { exact: true });
  const hint = mainArea(page).getByText('Avvia una nuova sessione o riprendine una passata.', { exact: true });
  await expect(title).toBeVisible();
  await page.mouse.move(0, 0);
  const t = await tokens(page, ['--primary', '--on-primary', '--outline', '--on-surface-variant']);
  const rgb = async (css: string) => resolved(page, css);
  const style = (l: Locator, p: string) => l.evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), p);

  await expect(title).toHaveClass(/\btitle-l\b/);
  expect([await style(title, 'font-size'), await style(title, 'line-height'), await style(title, 'font-weight')]).toEqual(['22px', '28px', '500']);
  await expect(hint).toHaveClass(/\bbody-m\b/);
  expect([await style(hint, 'font-size'), await style(hint, 'line-height')]).toEqual(['14px', '20px']);
  expect(await rgb(await style(hint, 'color')), 'hint colour').toEqual(await rgb(t['--on-surface-variant']!));

  const icon = mainArea(page).locator('svg.icon:not(button svg)');
  await expect(icon).toHaveCount(1);
  const iconBox = (await icon.boundingBox())!;
  expect([iconBox.width, iconBox.height]).toEqual([48, 48]);
  expect(await rgb(await style(icon, 'color')), 'icon colour').toEqual(await rgb(t['--on-surface-variant']!));

  const filled = emptyButton(page, 'Nuova sessione');
  const outlined = emptyButton(page, 'Riprendi sessione');
  for (const b of [filled, outlined]) {
    await expect(b).toHaveClass(/\bbtn\b/);
    await expect(b).toHaveClass(/\blabel-l\b/);
    expect([await cssPx(b, 'height'), await cssPx(b, 'border-top-left-radius'), await cssPx(b, 'font-size')]).toEqual([40, 20, 14]);
    expect(await style(b, 'font-weight')).toBe('500');
  }
  expect(await rgb(await style(filled, 'background-color')), 'filled background').toEqual(await rgb(t['--primary']!));
  expect(await rgb(await style(filled, 'color')), 'filled text').toEqual(await rgb(t['--on-primary']!));

  expect(await style(outlined, 'background-color'), 'outlined background').toBe('rgba(0, 0, 0, 0)');
  expect([await style(outlined, 'border-top-style'), await style(outlined, 'border-top-width')]).toEqual(['solid', '1px']);
  expect(await rgb(await style(outlined, 'border-top-color')), 'outlined border').toEqual(await rgb(t['--outline']!));
  expect(await rgb(await style(outlined, 'color')), 'outlined text').toEqual(await rgb(t['--on-surface-variant']!));
});

// EmptyState: on hover, each button takes an 8% layer of its text colour
test('each empty state button takes an 8% layer of its text colour on hover', async ({ page }) => {
  await page.goto('/');
  await expect(emptyButton(page, 'Nuova sessione')).toBeVisible();
  for (const name of ['Nuova sessione', 'Riprendi sessione']) {
    const b = emptyButton(page, name);
    await page.mouse.move(0, 0);
    const shown = async () => composite(page, ['#fff', ...(await backgroundLayers(b))]);
    const rest = await shown();
    const text = await b.evaluate((el) => getComputedStyle(el).color);
    const expected = await composite(page, [`rgb(${rest.slice(0, 3).join(',')})`, `color-mix(in srgb, ${text} 8%, transparent)`]);
    await b.hover();
    await expect.poll(async () => closeTo(await shown(), expected, 2), { message: `${name} hover layer, expected ${expected}` }).toBe(true);
  }
});

// SessionView "Shows": Roboto Mono, 14 px, rows about 22 px, font loaded before the terminal opens
test('the terminal opens in Roboto Mono at 14 px, after the font has loaded', async ({ page, request }) => {
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
  expect(await cssPx(terminal(page), 'font-size')).toBe(14);
  const rowHeight = await terminal(page).locator(':scope > div').first().evaluate((el) => el.getBoundingClientRect().height);
  expect(rowHeight).toBeGreaterThanOrEqual(21);
  expect(rowHeight).toBeLessThanOrEqual(23);
});

// SessionView "Shows", plan-claude_sessions_client-ui_redesign-material3_mock/REQ-2: terminal colours follow the active theme with no reconnect
test('the open terminal takes --term-bg and --term-fg of the active theme and recolours at once with no reconnect', async ({ page, request }) => {
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

  const light = await colours();
  expect(light.bg, 'light background').toEqual(light.tokenBg);
  expect(light.fg, 'light text').toEqual(light.tokenFg);

  await page.emulateMedia({ colorScheme: 'dark' });
  const darkBg = await resolved(page, (await tokens(page, ['--term-bg']))['--term-bg']!);
  expect(darkBg, 'the dark set has its own --term-bg').not.toEqual(light.tokenBg);
  await expect.poll(async () => (await colours()).bg, { message: 'dark background' }).toEqual(darkBg);
  const dark = await colours();
  expect(dark.fg, 'dark text').toEqual(dark.tokenFg);

  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(async () => (await colours()).bg, { message: 'back to light' }).toEqual(light.tokenBg);

  expect(sockets, 'no reconnect').toBe(opened);
  await expect(terminal(page)).toContainText('READY');
  await expect(terminal(page)).not.toContainText('[Sessione disconnessa]');
});
