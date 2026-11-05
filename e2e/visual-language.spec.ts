// e2e of plan-claude_sessions_client-ui_redesign, batch visual-language.
/// <reference lib="dom" />
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';

type Rgba = [number, number, number, number];

const repoRoot = path.resolve(import.meta.dirname, '..');
let projectsRoot: string;
const createdIds: string[] = [];

test.use({ colorScheme: 'light' });

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-visual-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

const list = (page: Page) => page.getByRole('region', { name: 'Elenco sessioni' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ hasText: folder });
const terminal = (page: Page) => page.locator('.xterm-rows');

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

/** Resolves any CSS colour, composited bottom-up over the earlier layers, to opaque sRGB through a canvas. */
function composite(page: Page, layers: string[]): Promise<Rgba> {
  return page.evaluate((cssColours) => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    ctx.canvas.width = ctx.canvas.height = 1;
    for (const colour of cssColours) {
      ctx.fillStyle = colour;
      ctx.fillRect(0, 0, 1, 1);
    }
    return [...ctx.getImageData(0, 0, 1, 1).data] as [number, number, number, number];
  }, layers);
}

function tokens(page: Page, names: string[]): Promise<Record<string, string>> {
  return page.evaluate((list) => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(list.map((n) => [n, style.getPropertyValue(n).trim()]));
  }, names);
}

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Colour of the first non-transparent background from the element up to the root. */
function effectiveBackground(locator: Locator): Promise<string> {
  return locator.evaluate((el) => {
    for (let node: Element | null = el; node; node = node.parentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return bg;
    }
    return 'rgb(255, 255, 255)';
  });
}

async function resolved(page: Page, css: string): Promise<Rgba> {
  return composite(page, ['#fff', css]);
}

const textAndStateColours = [
  '--color-text',
  '--color-text-muted',
  '--color-state-needs-input',
  '--color-state-working',
  '--color-state-idle',
  '--color-state-ended',
  '--color-external',
  '--color-error',
  '--color-warning',
  '--color-success',
];
const surfaces = ['--color-surface', '--color-surface-hover', '--color-surface-selected'];

async function contrastFailures(page: Page): Promise<string[]> {
  const names = [
    ...textAndStateColours,
    '--color-bg',
    ...surfaces,
    '--color-state-needs-input-bg',
    '--color-primary',
    '--color-primary-hover',
    '--color-on-primary',
    '--color-danger',
    '--color-danger-hover',
    '--color-on-danger',
    '--color-focus-ring',
    '--color-border-strong',
  ];
  const t = await tokens(page, names);
  for (const n of names) expect(t[n], `token ${n} is defined`).not.toBe('');
  const failures: string[] = [];
  const check = async (fg: string, bgLayers: string[], min: number) => {
    const ratio = contrast(
      await composite(page, [...bgLayers.map((b) => t[b]!), t[fg]!]),
      await composite(page, bgLayers.map((b) => t[b]!)),
    );
    if (ratio < min) failures.push(`${fg} on ${bgLayers.at(-1)}: ${ratio.toFixed(2)} < ${min}`);
  };
  const backgrounds = [['--color-bg'], ...surfaces.map((s) => ['--color-bg', s])];
  for (const fg of textAndStateColours) for (const bg of backgrounds) await check(fg, bg, 4.5);
  for (const fg of ['--color-text', '--color-text-muted', '--color-state-needs-input']) {
    await check(fg, ['--color-bg', '--color-surface', '--color-state-needs-input-bg'], 4.5);
  }
  for (const bg of ['--color-primary', '--color-primary-hover']) await check('--color-on-primary', ['--color-bg', bg], 4.5);
  for (const bg of ['--color-danger', '--color-danger-hover']) await check('--color-on-danger', ['--color-bg', bg], 4.5);
  for (const fg of ['--color-focus-ring', '--color-border-strong']) {
    await check(fg, ['--color-bg'], 3);
    await check(fg, ['--color-bg', '--color-surface'], 3);
  }
  return failures;
}

// plan-claude_sessions_client-ui_redesign/REQ-2
test('the client is light on a light system and turns dark at once, with no reload, when the system turns dark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Navigazione principale' }).getByRole('button', { name: 'Nuova sessione' })).toBeVisible();
  await page.evaluate(() => ((window as unknown as { noReloadMarker: boolean }).noReloadMarker = true));

  const lightBg = await resolved(page, await effectiveBackground(page.locator('body')));
  const lightText = await resolved(page, await page.locator('body').evaluate((b) => getComputedStyle(b).color));
  expect(luminance(lightBg), 'light page background').toBeGreaterThan(0.5);
  expect(luminance(lightText), 'light page text').toBeLessThan(0.2);

  await page.emulateMedia({ colorScheme: 'dark' });

  const darkBg = await resolved(page, await effectiveBackground(page.locator('body')));
  const darkText = await resolved(page, await page.locator('body').evaluate((b) => getComputedStyle(b).color));
  expect(luminance(darkBg), 'dark page background').toBeLessThan(0.2);
  expect(luminance(darkText), 'dark page text').toBeGreaterThan(0.5);
  expect(await page.evaluate(() => (window as unknown as { noReloadMarker?: boolean }).noReloadMarker), 'no reload').toBe(true);

  await page.emulateMedia({ colorScheme: 'light' });
  expect(await resolved(page, await effectiveBackground(page.locator('body')))).toEqual(lightBg);
});

// plan-claude_sessions_client-ui_redesign/REQ-2, WebEntry: the page declares color-scheme light dark
test('the page declares both colour schemes for native controls', async ({ page }) => {
  await page.goto('/');
  const content = await page.locator('meta[name="color-scheme"]').getAttribute('content');
  expect(content?.split(/\s+/).sort()).toEqual(['dark', 'light']);
});

// plan-claude_sessions_client-ui_redesign/REQ-2, ThemeTokens and WebEntry: the terminal has the dark --term-bg of the active theme
test('the terminal of a hosted session is dark in both themes, in the --term-bg of each', async ({ page, request }) => {
  await openSession(page, request, 'terminal-theme');
  const terminalBackground = () =>
    effectiveBackground(page.locator('.xterm-screen')).then((c) => resolved(page, c));
  const tokenBackground = async () => resolved(page, (await tokens(page, ['--term-bg']))['--term-bg']!);

  const lightToken = await tokenBackground();
  expect(await terminalBackground()).toEqual(lightToken);
  expect(luminance(lightToken), 'light terminal background is dark').toBeLessThan(0.05);
  await page.emulateMedia({ colorScheme: 'dark' });
  const darkToken = await tokenBackground();
  await expect.poll(terminalBackground).toEqual(darkToken);
  expect(luminance(darkToken), 'dark terminal background is dark').toBeLessThan(0.05);
  await expect(terminal(page)).toContainText('READY');
});

for (const scheme of ['light', 'dark'] as const) {
  // ThemeTokens: contrast rules (WCAG 2.2 AA) in each colour set
  test(`the ${scheme} token set meets the contrast rules`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    expect(await contrastFailures(page)).toEqual([]);
  });
}

// ThemeTokens: light and dark sets differ in their surface and text colours
test('the dark set replaces the light surface and text colours', async ({ page }) => {
  await page.goto('/');
  const names = ['--color-bg', '--color-surface', '--color-text'];
  const light = await tokens(page, names);
  await page.emulateMedia({ colorScheme: 'dark' });
  const dark = await tokens(page, names);
  for (const n of names) expect(await resolved(page, dark[n]!), n).not.toEqual(await resolved(page, light[n]!));
});

// plan-claude_sessions_client-ui_redesign/REQ-6
test('with no internet connection the page and a session load their font and icons from the client only', async ({ page, request, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  const fontResponses: { url: string; status: number }[] = [];
  await page.context().route(
    (url) => url.origin !== origin && !['data:', 'blob:'].includes(url.protocol),
    async (route) => {
      external.push(route.request().url());
      await route.abort('internetdisconnected');
    },
  );
  page.on('response', (r) => {
    if (r.request().resourceType() === 'font') fontResponses.push({ url: r.url(), status: r.status() });
  });

  await openSession(page, request, 'offline');
  await page.evaluate(() => document.fonts.ready);

  expect(external, 'requests to servers outside the client').toEqual([]);
  expect(fontResponses.length, 'the UI font is downloaded').toBeGreaterThan(0);
  for (const f of fontResponses) {
    expect(new URL(f.url).origin).toBe(origin);
    expect(f.status).toBe(200);
  }
  const loaded = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')),
  );
  expect(new Set(loaded), 'Roboto Flex and Roboto Mono are loaded').toEqual(new Set(['Roboto Flex', 'Roboto Mono']));
  await expect(page.getByRole('button', { name: 'Nuova sessione', exact: true }).locator('svg.icon')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Interrompi' }).locator('svg.icon')).toBeVisible();
});

// plan-claude_sessions_client-ui_redesign/REQ-6: no style shipped with the client points to another server
test('the built page and stylesheets reference no external resource', async () => {
  const distDir = path.join(repoRoot, 'dist/web');
  const html = await readFile(path.join(distDir, 'index.html'), 'utf8');
  expect(html).not.toMatch(/(?:src|href)\s*=\s*["']?(?:https?:)?\/\//i);
  const cssFiles = (await readdir(path.join(distDir, 'assets'))).filter((f) => f.endsWith('.css'));
  expect(cssFiles.length).toBeGreaterThan(0);
  for (const file of cssFiles) {
    const css = await readFile(path.join(distDir, 'assets', file), 'utf8');
    expect(css, file).not.toMatch(/url\(\s*["']?(?:https?:)?\/\//i);
    expect(css, file).not.toMatch(/@import\s+(?:url\()?\s*["']?(?:https?:)?\/\//i);
  }
});

// BundledFont: the UI uses Roboto Flex, the terminal Roboto Mono
test('the UI uses the bundled Roboto Flex font and the terminal uses Roboto Mono', async ({ page, request }) => {
  await openSession(page, request, 'font');
  const face = await page.evaluate(async () => {
    await document.fonts.ready;
    const f = [...document.fonts].find((x) => x.family.replace(/["']/g, '') === 'Roboto Flex');
    return f && { weight: f.weight, display: f.display };
  });
  expect(face).toEqual({ weight: '400 800', display: 'swap' });
  for (const name of ['Nuova sessione', 'Riprendi']) {
    const family = await page.getByRole('button', { name, exact: true }).evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family, name).toMatch(/^["']?Roboto Flex/);
  }
  expect(await page.locator('body').evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^["']?Roboto Flex/);
  expect(await terminal(page).evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^["']?Roboto Mono/);
});

// IconSet: each button keeps its accessible name and shows one decorative icon sized by --icon-size in its text colour
test('the rail "Riprendi" and the session toolbar buttons carry decorative icons', async ({ page, request }) => {
  await openSession(page, request, 'icons');
  const iconSize = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.width = 'var(--icon-size)';
    document.body.append(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return width;
  });
  expect(iconSize).toBe(20);

  const buttons = [
    page.getByRole('button', { name: 'Riprendi', exact: true }),
    page.getByRole('button', { name: 'Interrompi', exact: true }),
    page.getByRole('button', { name: 'Termina', exact: true }),
  ];
  for (const button of buttons) {
    await expect(button).toHaveCount(1);
    const icon = button.locator('svg');
    await expect(icon).toHaveCount(1);
    await expect(icon).toHaveClass(/\bicon\b/);
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
    await expect(icon).toHaveAttribute('focusable', 'false');
    const box = (await icon.boundingBox())!;
    expect(box.width).toBeCloseTo(iconSize, 0);
    expect(box.height).toBeCloseTo(iconSize, 0);
    const [iconColour, textColour] = await Promise.all([
      icon.evaluate((el) => getComputedStyle(el).color),
      button.evaluate((el) => getComputedStyle(el).color),
    ]);
    expect(iconColour).toBe(textColour);
  }
});

// WebEntry: primary and danger buttons take their look from the tokens; others are secondary
test('empty state "Nuova sessione" looks primary, toolbar "Termina" looks danger, "Riprendi sessione" looks secondary', async ({ page, request }) => {
  const look = async (button: Locator) => ({
    bg: await resolved(page, await button.evaluate((el) => getComputedStyle(el).backgroundColor)),
    fg: await resolved(page, await button.evaluate((el) => getComputedStyle(el).color)),
  });
  const mainButton = (name: string) => page.getByRole('main').getByRole('button', { name, exact: true });
  await page.goto('/');
  const t = await tokens(page, ['--color-primary', '--color-on-primary', '--color-danger', '--color-on-danger']);
  await page.mouse.move(0, 0);
  const primary = await look(mainButton('Nuova sessione'));
  expect(primary).toEqual({ bg: await resolved(page, t['--color-primary']!), fg: await resolved(page, t['--color-on-primary']!) });
  const secondary = await look(mainButton('Riprendi sessione'));

  await openSession(page, request, 'button-looks');
  await page.mouse.move(0, 0);
  const danger = await look(page.getByRole('button', { name: 'Termina', exact: true }));
  expect(danger).toEqual({ bg: await resolved(page, t['--color-danger']!), fg: await resolved(page, t['--color-on-danger']!) });
  expect(secondary.bg).not.toEqual(primary.bg);
  expect(secondary.bg).not.toEqual(danger.bg);
});

// WebEntry: the element focused from the keyboard shows a ring in --color-focus-ring
test('a button focused from the keyboard shows the focus ring colour', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Navigazione principale' }).getByRole('button', { name: 'Nuova sessione' })).toBeVisible();
  const ring = await resolved(page, (await tokens(page, ['--color-focus-ring']))['--color-focus-ring']!);

  let focusedTag = '';
  for (let i = 0; i < 10 && focusedTag !== 'BUTTON'; i++) {
    await page.keyboard.press('Tab');
    focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? '');
  }
  expect(focusedTag).toBe('BUTTON');
  const style = await page.evaluate(() => {
    const s = getComputedStyle(document.activeElement!);
    return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, outlineColor: s.outlineColor, boxShadow: s.boxShadow };
  });
  const outlineShown = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
  if (outlineShown) {
    expect(await resolved(page, style.outlineColor)).toEqual(ring);
  } else {
    const shadowColour = style.boxShadow.match(/(?:rgba?|oklch|oklab|color)\([^)]*\)/)?.[0];
    expect(shadowColour, `a ring is drawn (box-shadow: ${style.boxShadow})`).toBeDefined();
    expect(await resolved(page, shadowColour!)).toEqual(ring);
  }
});

// plan-claude_sessions_client-ui_redesign/REQ-7
test('each bundled font and icon set is recorded with its source, version and an existing licence file', async () => {
  const notices = await readFile(path.join(repoRoot, 'THIRD-PARTY-NOTICES.md'), 'utf8');
  const entries = notices.split(/^## /m).slice(1);
  expect(entries.length).toBeGreaterThanOrEqual(2);

  for (const entry of entries) {
    const title = entry.split('\n', 1)[0]!;
    expect(entry, `${title}: source`).toMatch(/https?:\/\//);
    const paths = [...entry.matchAll(/`([^`]+)`/g)].map((m) => m[1]!).filter((p) => p.includes('/') && !p.startsWith('@'));
    // ThirdPartyNotices: the version, or where the files were taken when no version is recorded.
    const takenFrom = paths.some((p) => !p.startsWith('src/'));
    expect(/\b\d+\.\d+\.\d+\b/.test(entry) || takenFrom, `${title}: package version or where it was taken`).toBe(true);
    expect(entry, `${title}: licence`).toMatch(/licen[cs]e/i);
    const licenceFiles = paths.filter((p) => /(LICENSE|OFL|COPYING)[^/]*$/i.test(p));
    expect(licenceFiles.length, `${title}: licence file named`).toBeGreaterThan(0);
    for (const p of paths) expect(existsSync(path.join(repoRoot, p)), `${title}: ${p} exists`).toBe(true);
  }

  expect(notices).toContain('src/web/fonts/roboto-flex-latin.woff2');
  expect(notices).toContain('src/web/fonts/roboto-mono-latin.woff2');
  expect(notices).toContain('src/web/fonts/OFL.txt');
  expect(notices).toContain('src/web/icons/Icons.tsx');
  expect(notices).toContain('src/web/icons/LICENSE');
  expect(await readFile(path.join(repoRoot, 'src/web/fonts/OFL.txt'), 'utf8')).toMatch(/SIL OPEN FONT LICENSE\s+Version 1\.1/i);
  expect(await readFile(path.join(repoRoot, 'src/web/icons/LICENSE'), 'utf8')).toMatch(/ISC License/i);
});

// plan-claude_sessions_client-ui_redesign/REQ-7: every font or image file shipped from src/web has an entry
test('every font and image asset in the client sources is named in the third-party notices', async () => {
  const notices = await readFile(path.join(repoRoot, 'THIRD-PARTY-NOTICES.md'), 'utf8');
  const assets = (await readdir(path.join(repoRoot, 'src/web'), { recursive: true }))
    .filter((f) => /\.(woff2?|ttf|otf|eot|svg|png|jpe?g|gif|webp|ico|avif)$/i.test(f))
    .map((f) => path.posix.join('src/web', f.split(path.sep).join('/')));
  expect(assets.length).toBeGreaterThan(0);
  for (const asset of assets) expect(notices, asset).toContain(asset);
});
