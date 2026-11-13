// e2e of plan-wsl_support, batch windows-look, in the browser: LookSwitch, LookStore, the early look mark, Windows11Look and
// the Windows-style WindowButtons. A fake `window.desktopBridge` makes the page behave as in the desktop window; the real
// window is checked in e2e/desktop-window.spec.ts. The window manager's drag and double click are checked by hand.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';

type Look = 'vexel' | 'windows11';
type Rgb = [number, number, number];

const LOOK_KEY = 'ai-client.look';
const WINDOWS_BLUE = 'rgb(0, 120, 212)';
const BUTTON_ORDER = ['Keyboard Shortcuts', 'Dark theme', 'Windows 11 look', 'Plan Usage', 'New Session'];

const topBar = (page: Page) => page.getByRole('banner');
const lookSwitch = (page: Page) => topBar(page).getByRole('button', { name: 'Windows 11 look', exact: true });
const themeSwitch = (page: Page) => topBar(page).getByRole('button', { name: 'Dark theme', exact: true });
const lookMark = (page: Page) => page.locator('html').getAttribute('data-look');
const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const terminalRows = (page: Page) => page.locator('.xterm-rows');
const terminalInput = (page: Page) => page.locator('.xterm-helper-textarea');

function windowButtons(scope: Page | Locator) {
  return {
    close: scope.getByRole('button', { name: 'Close', exact: true }),
    minimize: scope.getByRole('button', { name: 'Minimize', exact: true }),
    maximize: scope.getByRole('button', { name: 'Maximize', exact: true }),
    restore: scope.getByRole('button', { name: 'Restore', exact: true }),
  };
}

/** Saves a look choice before the page loads, as an earlier visit would. */
async function chooseLook(page: Page, look: Look): Promise<void> {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LOOK_KEY, look] as const);
}

async function installFakeBridge(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const calls: string[] = [];
    let listeners: ((maximized: boolean) => void)[] = [];
    Object.assign(window, {
      windowCalls: calls,
      emitMaximized: (value: boolean) => listeners.forEach((listener) => listener(value)),
      desktopBridge: {
        reportOpenSession: () => {},
        onOpenSession: () => () => {},
        closeWindow: () => calls.push('close'),
        minimizeWindow: () => calls.push('minimize'),
        toggleMaximizeWindow: () => calls.push('toggle-maximize'),
        isWindowMaximized: () => Promise.resolve(false),
        onWindowMaximizedChange: (listener: (maximized: boolean) => void) => {
          listeners.push(listener);
          return () => {
            listeners = listeners.filter((other) => other !== listener);
          };
        },
      },
    });
  });
}

const windowCalls = (page: Page) => page.evaluate(() => (window as unknown as { windowCalls: string[] }).windowCalls);
const emitMaximized = (page: Page, value: boolean) => page.evaluate((v) => (window as unknown as { emitMaximized: (v: boolean) => void }).emitMaximized(v), value);

/** Records every value the root `data-look` mark takes from the very start of the document. */
async function recordLookMarks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const marks: (string | null)[] = [];
    (window as unknown as { lookMarks: (string | null)[] }).lookMarks = marks;
    new MutationObserver(() => marks.push(document.documentElement.getAttribute('data-look'))).observe(document, {
      attributes: true,
      attributeFilter: ['data-look'],
      subtree: true,
    });
  });
}
const lookMarks = (page: Page) => page.evaluate(() => (window as unknown as { lookMarks: (string | null)[] }).lookMarks);

/** The computed colour of each token, as `rgb(...)`/`rgba(...)`. */
async function tokens(page: Page, names: string[]): Promise<Record<string, string>> {
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim()), { message: 'the stylesheet applies' }).not.toBe('');
  return page.evaluate((list) => {
    const probe = document.createElement('div');
    document.body.append(probe);
    const out: Record<string, string> = {};
    for (const name of list) {
      probe.style.color = '';
      probe.style.color = `var(${name})`;
      out[name] = getComputedStyle(probe).color;
    }
    probe.remove();
    return out;
  }, names);
}

const rgbOf = (colour: string): Rgb => {
  const [r, g, b] = (colour.match(/[\d.]+/g) ?? []).map(Number);
  return [r!, g!, b!];
};
const luminance = ([r, g, b]: Rgb) =>
  [r, g, b].map((v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
const contrast = (a: string, b: string) => {
  const [la, lb] = [luminance(rgbOf(a)), luminance(rgbOf(b))];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
function hsl(colour: string): { h: number; s: number; l: number } {
  const [r, g, b] = rgbOf(colour).map((v) => v / 255) as Rgb;
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s, l };
}
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

async function setTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await expect(themeSwitch(page)).toBeVisible();
  if ((await page.locator('html').getAttribute('data-theme')) !== theme) await themeSwitch(page).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

async function setLook(page: Page, look: Look): Promise<void> {
  if ((await lookMark(page)) !== look) await lookSwitch(page).click();
  await expect(page.locator('html')).toHaveAttribute('data-look', look);
}

/** Presses Tab until the target has the focus, as a keyboard user does. */
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let i = 0; i < 40 && !(await target.evaluate((e) => e === document.activeElement)); i += 1) await page.keyboard.press('Tab');
  await expect(target, 'reached with Tab').toBeFocused();
}

/** Whether the focused element draws a visible focus indicator: an outline or a box-shadow. */
const showsFocus = (target: Locator) =>
  target.evaluate((e) => {
    const s = getComputedStyle(e);
    return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
  });

/** The window area at a point, as Chromium builds it for Electron: the last element in document order that declares a value over the point wins. */
function regionAt(page: Page, x: number, y: number): Promise<string> {
  return page.evaluate(
    ([px, py]) => {
      let region = 'none';
      for (const element of document.querySelectorAll('*')) {
        const value = getComputedStyle(element).getPropertyValue('-webkit-app-region');
        if (value !== 'drag' && value !== 'no-drag') continue;
        const box = element.getBoundingClientRect();
        if (px >= box.left && px < box.right && py >= box.top && py < box.bottom) region = value;
      }
      return region;
    },
    [x, y] as const,
  );
}
const centreRegion = async (page: Page, target: Locator) => {
  const box = (await target.boundingBox())!;
  return regionAt(page, box.x + box.width / 2, box.y + box.height / 2);
};

/**
 * Stops transitions and animations, so a computed style is final at once, and keeps the elements of the page in `window.snapElements`.
 * The Session List is left out: the sessions of other specs on the shared server change it at any time.
 */
async function freezeStyles(page: Page): Promise<void> {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
    document.head.append(style);
    const all = [document.documentElement, ...document.documentElement.querySelectorAll('*')];
    Object.assign(window, { snapElements: all.filter((e) => !e.closest('[aria-label="Session List"]') && e !== style) });
  });
}

/** Every computed style of each kept element still on the page; `null` for an element that left it. */
function styleSnapshot(page: Page): Promise<(string | null)[]> {
  return page.evaluate(() =>
    (window as unknown as { snapElements: Element[] }).snapElements.map((element) => {
      if (!element.isConnected) return null;
      const s = getComputedStyle(element);
      const values: string[] = [];
      for (let i = 0; i < s.length; i += 1) values.push(`${s.item(i)}:${s.getPropertyValue(s.item(i))}`);
      return `${element.tagName}.${element.getAttribute('class') ?? ''}|${values.join(';')}`;
    }),
  );
}

const differences = (a: (string | null)[], b: (string | null)[]) => a.filter((line, i) => line !== null && b[i] !== null && line !== b[i]);

test.describe('Look switch and look store', () => {
  // plan-wsl_support/REQ-24, REQ-16: with no saved choice the client shows the current look
  test('a first visit shows the current look: the root carries "vexel" and the switch is not pressed', async ({ page }) => {
    await recordLookMarks(page);
    await page.goto('/');
    await expect(lookSwitch(page)).toBeVisible();
    expect(await lookMark(page)).toBe('vexel');
    await expect(lookSwitch(page)).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate((key) => localStorage.getItem(key), LOOK_KEY), 'nothing saved before a choice').toBeNull();
    expect(new Set(await lookMarks(page)), 'the page never carries the Windows 11 mark').toEqual(new Set(['vexel']));
  });

  // plan-wsl_support/REQ-18, TopBar "Shows": the look switch sits right after the theme switch, 6 px apart, before Plan Usage
  test('the look switch sits right after the theme switch, 6 px apart, before "Plan Usage" and "New Session"', async ({ page }) => {
    await page.goto('/');
    await expect(lookSwitch(page)).toBeVisible();
    const names = await topBar(page).getByRole('button').evaluateAll((all) => all.map((e) => e.getAttribute('aria-label') ?? e.textContent?.trim() ?? ''));
    expect(names.filter((name) => BUTTON_ORDER.includes(name))).toEqual(BUTTON_ORDER);
    const theme = (await themeSwitch(page).boundingBox())!;
    const look = (await lookSwitch(page).boundingBox())!;
    expect(look.x - (theme.x + theme.width), 'gap after the theme switch').toBeCloseTo(6, 0);
    expect(Math.abs(look.y - theme.y), 'same row').toBeLessThan(1);
    expect(look.width).toBeCloseTo(theme.width, 0);
    expect(look.height).toBeCloseTo(theme.height, 0);
  });

  // plan-wsl_support/REQ-19, REQ-20, REQ-22: a press switches the whole page at once, no reload, and saves the choice
  test('a press shows the Windows 11 look at once without a reload and saves it; a second press brings back the current look', async ({ page }) => {
    await page.goto('/');
    await expect(lookSwitch(page)).toBeVisible();
    await page.evaluate(() => Object.assign(window, { sameDocument: true }));
    const iconBefore = await lookSwitch(page).locator('svg').innerHTML();

    const sameFrame = await lookSwitch(page).evaluate(
      (button) =>
        new Promise<{ mark: string | null; canvas: string }>((resolve) => {
          (button as HTMLButtonElement).click();
          requestAnimationFrame(() => {
            const probe = document.createElement('div');
            probe.style.color = 'var(--bg-canvas)';
            document.body.append(probe);
            const canvas = getComputedStyle(probe).color;
            probe.remove();
            resolve({ mark: document.documentElement.getAttribute('data-look'), canvas });
          });
        }),
    );
    expect(sameFrame, 'the next frame already carries the Windows 11 mark and its dark canvas').toEqual({ mark: 'windows11', canvas: 'rgb(28, 28, 28)' });
    await expect(lookSwitch(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(lookSwitch(page)).toHaveAttribute('title', 'Windows 11 look');
    expect(await lookSwitch(page).locator('svg').innerHTML(), 'the icon shows the active look').not.toBe(iconBefore);
    expect(await page.evaluate((key) => localStorage.getItem(key), LOOK_KEY)).toBe('windows11');
    await expect.poll(() => topBar(page).evaluate((e) => getComputedStyle(e).backgroundColor), { message: 'the top bar takes the Windows 11 surface' }).toBe('rgb(43, 43, 43)');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).fontFamily), { message: 'the page text takes Segoe UI' }).toContain('Segoe UI');

    await lookSwitch(page).click();
    await expect(lookSwitch(page)).toHaveAttribute('aria-pressed', 'false');
    expect(await lookMark(page)).toBe('vexel');
    expect(await lookSwitch(page).locator('svg').innerHTML()).toBe(iconBefore);
    expect(await page.evaluate((key) => localStorage.getItem(key), LOOK_KEY)).toBe('vexel');
    expect(await page.evaluate(() => (window as unknown as { sameDocument?: boolean }).sameDocument), 'no reload').toBe(true);
  });

  // plan-wsl_support/REQ-22, REQ-23: the saved look is on the root before the first paint, with no other mark before it
  test('after a reload the saved Windows 11 look is on the root from the start, with no current-look mark first', async ({ page }) => {
    await page.goto('/');
    await setLook(page, 'windows11');
    await recordLookMarks(page);
    await page.reload();
    await expect(lookSwitch(page)).toHaveAttribute('aria-pressed', 'true');
    expect(new Set(await lookMarks(page)), 'only the Windows 11 mark, from the head script on').toEqual(new Set(['windows11']));
  });

  // plan-wsl_support/REQ-23: the mark is set before the stylesheets and the app script run
  test('the head script marks the saved look before any stylesheet or module script of the page', async ({ page }) => {
    await chooseLook(page, 'windows11');
    await page.addInitScript(() => {
      const seen: string[] = [];
      (window as unknown as { markAtFirstStyle: string[] }).markAtFirstStyle = seen;
      new MutationObserver((records) => {
        for (const record of records)
          for (const node of record.addedNodes)
            if (node instanceof HTMLLinkElement || node instanceof HTMLStyleElement || (node instanceof HTMLScriptElement && node.type === 'module'))
              seen.push(document.documentElement.getAttribute('data-look') ?? 'none');
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto('/');
    await expect(lookSwitch(page)).toBeVisible();
    const seen = await page.evaluate(() => (window as unknown as { markAtFirstStyle: string[] }).markAtFirstStyle);
    expect(seen.length, 'the page has styles or scripts').toBeGreaterThan(0);
    expect(new Set(seen)).toEqual(new Set(['windows11']));
  });

  // LookStore / WebEntry validity rule: only "vexel" and "windows11" are read back
  test('an unknown saved value shows the current look', async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, 'aero'), LOOK_KEY);
    await recordLookMarks(page);
    await page.goto('/');
    await expect(lookSwitch(page)).toHaveAttribute('aria-pressed', 'false');
    expect(new Set(await lookMarks(page))).toEqual(new Set(['vexel']));
  });

  // plan-wsl_support/REQ-17: look and theme change apart, and each look has both themes
  test('the theme switch keeps the look and the look switch keeps the theme', async ({ page }) => {
    await page.goto('/');
    await setTheme(page, 'dark');
    await setLook(page, 'windows11');
    expect(await page.locator('html').getAttribute('data-theme')).toBe('dark');
    expect((await tokens(page, ['--bg-canvas']))['--bg-canvas']).toBe('rgb(28, 28, 28)');

    await setTheme(page, 'light');
    expect(await lookMark(page), 'the theme change keeps the Windows 11 look').toBe('windows11');
    await expect(lookSwitch(page)).toHaveAttribute('aria-pressed', 'true');
    expect((await tokens(page, ['--bg-canvas']))['--bg-canvas'], 'Windows 11 light canvas').toBe('rgb(238, 238, 238)');

    await setLook(page, 'vexel');
    expect(await page.locator('html').getAttribute('data-theme'), 'the look change keeps the light theme').toBe('light');
    expect((await tokens(page, ['--bg-canvas']))['--bg-canvas'], 'current light canvas').toBe('rgb(244, 241, 234)');
  });
});

test.describe('Look change with an open session', () => {
  const createdIds: string[] = [];
  let projectsRoot: string;

  test.beforeAll(async () => {
    projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-look-'));
  });

  test.afterEach(async ({ request }) => {
    for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  });

  async function startViaApi(request: APIRequestContext, folder: string): Promise<string> {
    const response = await request.post('/api/sessions', { data: { path: folder } });
    expect(response.status()).toBe(201);
    const { id } = (await response.json()) as { id: string };
    createdIds.push(id);
    return id;
  }

  const visibleRows = (page: Page) =>
    terminalRows(page).evaluate((element) =>
      [...element.children]
        .map((row) => row.textContent?.trim() ?? '')
        .filter(Boolean)
        .join('\n'),
    );

  // plan-wsl_support/REQ-20, REQ-21: same session, same scroll position, session still answers, no reload
  test('the look switch keeps the open session, its scroll position and its connection', async ({ page, request }) => {
    const folder = path.join(await mkdtemp(path.join(projectsRoot, 'l-')), 'look');
    await mkdir(folder);
    await startViaApi(request, folder);
    await page.goto('/');
    await entry(page, folder).click();
    await expect(terminalRows(page)).toContainText(`CWD:${folder}`);
    await page.locator('.xterm-screen').click();
    await expect(terminalInput(page)).toBeFocused();
    await page.keyboard.type('COUNT');
    await page.keyboard.press('Enter');
    await expect(terminalRows(page)).toContainText('COUNT-DONE');

    const screen = (await page.locator('.xterm-screen').boundingBox())!;
    await page.mouse.move(screen.x + screen.width / 2, screen.y + screen.height / 2);
    for (let i = 0; i < 4; i += 1) await page.mouse.wheel(0, -300);
    await expect(terminalRows(page)).not.toContainText('COUNT-DONE');
    await page.evaluate(() => Object.assign(window, { sameDocument: true }));
    const before = await visibleRows(page);

    await lookSwitch(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-look', 'windows11');
    await page.waitForTimeout(300);
    expect(await visibleRows(page), 'same rows on screen').toBe(before);
    expect(await page.evaluate(() => (window as unknown as { sameDocument?: boolean }).sameDocument), 'no reload').toBe(true);

    await lookSwitch(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-look', 'vexel');
    await page.waitForTimeout(300);
    expect(await visibleRows(page), 'same rows after switching back').toBe(before);

    await page.locator('.xterm-screen').click();
    await page.keyboard.type('after look');
    await page.keyboard.press('Enter');
    await expect(terminalRows(page), 'the session still answers').toContainText('LINE:after look');
  });

  // plan-wsl_support/REQ-21, REQ-27: the non-modal "Plan Usage" panel stays open across a look change, with 8 px corners
  test('the open "Plan Usage" panel stays open across a look change and takes 8 px corners', async ({ page }) => {
    await page.route((url) => url.pathname === '/api/plan-usage', (route) => route.fulfill({ status: 200, json: { status: 'unavailable' } }));
    await page.goto('/');
    await topBar(page).getByRole('button', { name: 'Plan Usage', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Plan Usage', exact: true });
    await expect(panel).toBeVisible();
    await lookSwitch(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-look', 'windows11');
    await expect(panel, 'the look change keeps the panel open').toBeVisible();
    await expect.poll(() => panel.evaluate((e) => getComputedStyle(e).borderTopLeftRadius)).toBe('8px');
  });
});

test.describe('Windows 11 look styles', () => {
  // plan-wsl_support/REQ-25, Windows11Look tokens: Mica-like surfaces of the client's own greys and the Windows accent blue
  for (const [theme, expected] of [
    ['dark', { '--bg-canvas': 'rgb(28, 28, 28)', '--bg-surface-1': 'rgb(32, 32, 32)', '--bg-surface-2': 'rgb(43, 43, 43)', '--bg-surface-3': 'rgb(50, 50, 50)', '--accent-deep': WINDOWS_BLUE, '--accent-primary': 'rgb(96, 205, 255)' }],
    ['light', { '--bg-canvas': 'rgb(238, 238, 238)', '--bg-surface-1': 'rgb(243, 243, 243)', '--bg-surface-2': 'rgb(250, 250, 250)', '--bg-surface-3': 'rgb(233, 233, 233)', '--accent-deep': WINDOWS_BLUE, '--accent-primary': 'rgb(0, 95, 184)' }],
  ] as const) {
    test(`${theme} theme: Windows 11 surfaces and the Windows accent blue`, async ({ page }) => {
      await chooseLook(page, 'windows11');
      await page.goto('/');
      await setTheme(page, theme);
      expect(await tokens(page, Object.keys(expected))).toEqual(expected);
      const logo = topBar(page).getByText('VX', { exact: true });
      const gradient = await logo.evaluate((e) => {
        for (let node: Element | null = e; node; node = node.parentElement) {
          const image = getComputedStyle(node).backgroundImage;
          if (image.includes('gradient')) return image;
        }
        return '';
      });
      expect(gradient, 'the logo mark gradient ends on the Windows blue').toContain(WINDOWS_BLUE);
    });
  }

  // plan-wsl_support/REQ-26: Segoe UI first, then the sans-serif fallbacks; the app ships no Segoe UI file
  test('the text uses Segoe UI with a sans-serif fallback, and no Segoe UI font file is loaded', async ({ page }) => {
    const fontRequests: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'font' || /segoe|selawik/i.test(request.url())) fontRequests.push(request.url());
    });
    await chooseLook(page, 'windows11');
    await page.goto('/');
    await expect(lookSwitch(page)).toBeVisible();
    const families = await page.evaluate(() => [getComputedStyle(document.body).fontFamily, getComputedStyle(document.querySelector('header')!).fontFamily]);
    for (const family of families) {
      const names = family.split(',').map((name) => name.trim().replace(/^["']|["']$/g, ''));
      expect(names, family).toContain('Segoe UI');
      expect(names.indexOf('Segoe UI'), 'Segoe UI comes before the generic fallbacks').toBeLessThan(names.indexOf('sans-serif'));
      expect(names.at(-1)).toBe('sans-serif');
    }
    expect(fontRequests.filter((url) => /segoe|selawik/i.test(url)), 'no Segoe UI file').toEqual([]);
    const faces = await page.evaluate(() => [...document.fonts].map((face) => face.family.replace(/["']/g, '')));
    expect(faces.filter((family) => /segoe|selawik/i.test(family)), 'no @font-face for Segoe UI').toEqual([]);
  });

  // plan-wsl_support/REQ-27: 4 px corners on small controls, 8 px on dialogs
  test('small controls have 4 px corners and a dialog has 8 px corners', async ({ page }) => {
    await chooseLook(page, 'windows11');
    await page.goto('/');
    const newSession = topBar(page).getByRole('button', { name: 'New Session', exact: true });
    await expect(newSession).toBeVisible();
    for (const control of [newSession, lookSwitch(page), themeSwitch(page)])
      expect(await control.evaluate((e) => getComputedStyle(e).borderTopLeftRadius), await control.getAttribute('aria-label') ?? 'New Session').toBe('4px');
    await newSession.click();
    const dialog = page.getByRole('dialog', { name: 'New Claude Code Session' });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((e) => getComputedStyle(e).borderTopLeftRadius)).toBe('8px');
    const field = dialog.getByRole('textbox').first();
    if (await field.count()) expect(await field.evaluate((e) => getComputedStyle(e).borderTopLeftRadius), 'a field').toBe('4px');
  });

  // plan-wsl_support/REQ-36: text contrast in all four combinations of look and theme
  for (const look of ['vexel', 'windows11'] as const)
    for (const theme of ['dark', 'light'] as const) {
      test(`${look} look, ${theme} theme: text tones reach 4.5:1 on the canvas and the surfaces`, async ({ page }) => {
        await chooseLook(page, look);
        await page.goto('/');
        await setTheme(page, theme);
        const t = await tokens(page, [
          '--bg-canvas', '--bg-surface-1', '--bg-surface-2', '--bg-surface-3',
          '--text-primary', '--text-secondary', '--text-muted', '--accent-primary', '--on-accent',
        ]);
        const backgrounds = ['--bg-canvas', '--bg-surface-1', '--bg-surface-2', '--bg-surface-3'];
        const failures: string[] = [];
        for (const text of ['--text-primary', '--text-secondary', '--text-muted', '--accent-primary'])
          for (const background of backgrounds) {
            const ratio = contrast(t[text]!, t[background]!);
            if (ratio < 4.5) failures.push(`${text} ${t[text]} on ${background} ${t[background]}: ${ratio.toFixed(2)}`);
          }
        const onAccent = contrast(t['--on-accent']!, t['--accent-primary']!);
        if (onAccent < 4.5) failures.push(`--on-accent on --accent-primary: ${onAccent.toFixed(2)}`);
        expect(failures).toEqual([]);
      });
    }

  // plan-wsl_support/REQ-36, Windows11Look contrast rule: status text tones and the "Interrupt" orange
  for (const theme of ['dark', 'light'] as const)
    test(`windows11 look, ${theme} theme: status text tones reach 4.5:1 on the canvas and the surfaces`, async ({ page }) => {
      await chooseLook(page, 'windows11');
      await page.goto('/');
      await setTheme(page, theme);
      const t = await tokens(page, ['--bg-canvas', '--bg-surface-1', '--bg-surface-2', '--bg-surface-3', '--emerald-400', '--amber-400', '--rose-400', '--zinc-400', '--orange-400', '--on-accent', '--accent-deep']);
      const failures: string[] = [];
      for (const text of ['--emerald-400', '--amber-400', '--rose-400', '--zinc-400'])
        for (const background of ['--bg-canvas', '--bg-surface-1', '--bg-surface-2', '--bg-surface-3']) {
          const ratio = contrast(t[text]!, t[background]!);
          if (ratio < 4.5) failures.push(`${text} ${t[text]} on ${background} ${t[background]}: ${ratio.toFixed(2)}`);
        }
      const orange = contrast(t['--orange-400']!, t['--bg-surface-1']!);
      if (orange < 4.5) failures.push(`--orange-400 on --bg-surface-1: ${orange.toFixed(2)}`);
      const onDeep = contrast(t['--on-accent']!, t['--accent-deep']!);
      if (onDeep < 4.5) failures.push(`--on-accent on --accent-deep: ${onDeep.toFixed(2)}`);
      expect(failures).toEqual([]);
    });

  // plan-wsl_support/REQ-37: the accent keeps the Windows blue where it can, and changes tone only where contrast needs it
  for (const theme of ['dark', 'light'] as const)
    test(`windows11 look, ${theme} theme: the accent text tone differs from the Windows blue only because the blue misses 4.5:1, and keeps its hue`, async ({ page }) => {
      await chooseLook(page, 'windows11');
      await page.goto('/');
      await setTheme(page, theme);
      const t = await tokens(page, ['--accent-deep', '--accent-primary', '--bg-canvas', '--bg-surface-1', '--bg-surface-2', '--bg-surface-3']);
      expect(t['--accent-deep']).toBe(WINDOWS_BLUE);
      if (t['--accent-primary'] !== WINDOWS_BLUE) {
        const blueMisses = ['--bg-canvas', '--bg-surface-1', '--bg-surface-2', '--bg-surface-3'].some((bg) => contrast(WINDOWS_BLUE, t[bg]!) < 4.5);
        expect(blueMisses, 'the tone changes only because the Windows blue misses 4.5:1 as text').toBe(true);
      }
      expect(hueGap(hsl(t['--accent-primary']!).h, hsl(WINDOWS_BLUE).h), 'the same blue family').toBeLessThanOrEqual(15);
    });

  // plan-wsl_support/REQ-38: working, needs input, error and the grey of waiting/ended stay apart, with the hues of the current look
  for (const theme of ['dark', 'light'] as const)
    test(`windows11 look, ${theme} theme: the status colours stay apart and keep the hues of the current look`, async ({ page }) => {
      const names = ['--emerald-400', '--amber-400', '--rose-400', '--zinc-400'];
      await page.goto('/');
      await setTheme(page, theme);
      const current = await tokens(page, names);
      await setLook(page, 'windows11');
      const windows = await tokens(page, names);
      const [working, needsInput, error, grey] = names.map((name) => hsl(windows[name]!));
      for (const [a, b, label] of [[working!, needsInput!, 'working/needs input'], [working!, error!, 'working/error'], [needsInput!, error!, 'needs input/error']] as const)
        expect(hueGap(a.h, b.h), label).toBeGreaterThanOrEqual(30);
      expect(grey!.s, 'waiting and ended are grey').toBeLessThan(0.15);
      for (const tone of [working!, needsInput!, error!]) expect(tone.s, 'the other states are coloured').toBeGreaterThan(0.5);
      for (const name of names.slice(0, 3)) {
        const [a, b] = [hsl(current[name]!), hsl(windows[name]!)];
        expect(hueGap(a.h, b.h), `${name} keeps its hue`).toBeLessThanOrEqual(3);
      }
    });

  // plan-wsl_support/REQ-34, REQ-17, Windows11Look rule: the current look is untouched; nothing applies without the Windows 11 mark
  for (const theme of ['dark', 'light'] as const)
    test(`${theme} theme: every computed style of the current look is the same as with no look mark, before and after a round trip`, async ({ page }) => {
      await page.goto('/');
      await setTheme(page, theme);
      await expect(lookSwitch(page)).toHaveAttribute('aria-pressed', 'false');
      await page.mouse.move(0, 0);
      await freezeStyles(page);
      const vexel = await styleSnapshot(page);
      await page.evaluate(() => document.documentElement.removeAttribute('data-look'));
      const unmarked = await styleSnapshot(page);
      await page.evaluate(() => document.documentElement.setAttribute('data-look', 'vexel'));
      expect(differences(unmarked, vexel), 'differences with no look mark').toEqual([]);

      await lookSwitch(page).click();
      await expect(page.locator('html')).toHaveAttribute('data-look', 'windows11');
      expect(differences(await styleSnapshot(page), vexel).length, 'the Windows 11 look does change the page').toBeGreaterThan(0);
      await lookSwitch(page).click();
      await expect(page.locator('html')).toHaveAttribute('data-look', 'vexel');
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.mouse.move(0, 0);
      expect(differences(await styleSnapshot(page), vexel), 'differences after a round trip').toEqual([]);
    });

  // plan-wsl_support/REQ-34: the terminal panel stays dark in both looks
  test('the terminal colours are the same in both looks and both themes', async ({ page }) => {
    const names = ['--term-bg', '--term-fg', '--font-mono'];
    await page.goto('/');
    for (const theme of ['dark', 'light'] as const) {
      await setTheme(page, theme);
      await setLook(page, 'vexel');
      const current = await tokens(page, names.slice(0, 2));
      const mono = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font-mono'));
      await setLook(page, 'windows11');
      expect(await tokens(page, names.slice(0, 2)), theme).toEqual(current);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font-mono'))).toBe(mono);
    }
  });
});

test.describe('Windows-style window buttons in the desktop top bar', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBridge(page);
  });

  // plan-wsl_support/REQ-28, REQ-40, WindowButtons "Windows 11 look shows"
  test('in the Windows 11 look "Minimize", "Maximize", "Close" sit at the right end after "New Session", 46 px wide, bar high, flush with the window edge', async ({ page }) => {
    await chooseLook(page, 'windows11');
    await page.goto('/');
    const bar = topBar(page);
    const { close, minimize, maximize } = windowButtons(bar);
    await expect(close).toBeVisible();
    const [min, max, cls] = await Promise.all([minimize, maximize, close].map(async (b) => (await b.boundingBox())!));
    const barBox = (await bar.boundingBox())!;
    const newSession = (await bar.getByRole('button', { name: 'New Session', exact: true }).boundingBox())!;
    const width = page.viewportSize()!.width;
    expect(min!.x).toBeLessThan(max!.x);
    expect(max!.x).toBeLessThan(cls!.x);
    expect(min!.x, 'after "New Session"').toBeGreaterThanOrEqual(newSession.x + newSession.width);
    expect(cls!.x + cls!.width, 'flush with the right edge of the window').toBeCloseTo(width, 0);
    for (const box of [min!, max!, cls!]) {
      expect(box.width).toBeCloseTo(46, 0);
      // As high as the bar, inside its 1 px bottom line.
      expect(box.height).toBeGreaterThanOrEqual(barBox.height - 1);
      expect(box.height).toBeLessThanOrEqual(barBox.height);
    }
    expect(max!.x - (min!.x + min!.width), 'no gap').toBeCloseTo(0, 0);
    expect(cls!.x - (max!.x + max!.width), 'no gap').toBeCloseTo(0, 0);

    const logo = (await bar.getByText('VX', { exact: true }).boundingBox())!;
    const controlsLeft = await bar.locator('button, a, input, [role="button"]').evaluateAll((all) => all.map((e) => e.getBoundingClientRect().x));
    expect(Math.min(...controlsLeft), 'no control before the logo').toBeGreaterThan(logo.x);
    expect(await bar.getByRole('button', { name: /^(Close|Minimize|Maximize|Restore)$/ }).count(), 'one set of window buttons').toBe(3);
    const backgrounds = await Promise.all([close, minimize, maximize].map((b) => b.evaluate((e) => getComputedStyle(e).backgroundColor)));
    expect(backgrounds, 'not the macOS colours').not.toContain('rgb(255, 95, 87)');
  });

  // plan-wsl_support/REQ-28: each glyph shows without hover; REQ-31: Restore while maximized
  test('the glyphs show without the pointer, and "Maximize" becomes "Restore" with another glyph while the window is maximized', async ({ page }) => {
    await chooseLook(page, 'windows11');
    await page.goto('/');
    const { close, minimize, maximize, restore } = windowButtons(topBar(page));
    await expect(close).toBeVisible();
    await page.mouse.move(5, 300);
    for (const button of [minimize, maximize, close]) await expect(button.locator('svg')).toBeVisible();
    const maximizeGlyph = await maximize.locator('svg').innerHTML();
    await emitMaximized(page, true);
    await expect(restore).toBeVisible();
    await expect(maximize).toHaveCount(0);
    expect(await restore.locator('svg').innerHTML()).not.toBe(maximizeGlyph);
    await emitMaximized(page, false);
    await expect(maximize).toBeVisible();
  });

  // plan-wsl_support/REQ-29, REQ-30, REQ-31: the same window actions as the macOS buttons
  test('"Minimize" asks to minimize, "Maximize" and "Restore" to toggle maximize, "Close" to close to the tray', async ({ page }) => {
    await chooseLook(page, 'windows11');
    await page.goto('/');
    const { close, minimize, maximize, restore } = windowButtons(topBar(page));
    await minimize.click();
    await maximize.click();
    await emitMaximized(page, true);
    await restore.click();
    await close.click();
    expect(await windowCalls(page)).toEqual(['minimize', 'toggle-maximize', 'toggle-maximize', 'close']);
  });

  // WindowButtons "Windows 11 look shows": the close button turns red under the pointer
  test('the pointer over "Close" shows the Windows close red with a white glyph', async ({ page }) => {
    await chooseLook(page, 'windows11');
    await page.goto('/');
    const { close } = windowButtons(topBar(page));
    await close.hover();
    await expect.poll(() => close.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(196, 43, 28)');
    await expect.poll(() => close.locator('svg').evaluate((e) => getComputedStyle(e).color)).toBe('rgb(255, 255, 255)');
  });

  // plan-wsl_support/REQ-28, REQ-34, TopBar: a look change moves the buttons at once
  test('a look change moves the buttons: macOS buttons before the logo in the current look, Windows-style at the right end in the Windows 11 look', async ({ page }) => {
    await page.goto('/');
    const bar = topBar(page);
    const { close, minimize, maximize } = windowButtons(bar);
    await expect(close).toBeVisible();
    const logoX = async () => (await bar.getByText('VX', { exact: true }).boundingBox())!.x;
    const macRed = (await close.boundingBox())!;
    expect(macRed.width, 'a 12 px macOS circle').toBeCloseTo(12, 0);
    expect(macRed.x + macRed.width).toBeLessThan(await logoX());
    expect(await close.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(255, 95, 87)');
    const macOrder = await Promise.all([close, minimize, maximize].map(async (b) => (await b.boundingBox())!.x));
    expect(macOrder[0]).toBeLessThan(macOrder[1]!);
    expect(macOrder[1]).toBeLessThan(macOrder[2]!);

    await lookSwitch(page).click();
    const windowsClose = (await close.boundingBox())!;
    expect(windowsClose.x + windowsClose.width).toBeCloseTo(page.viewportSize()!.width, 0);
    expect(windowsClose.x).toBeGreaterThan(await logoX());

    await lookSwitch(page).click();
    const back = (await close.boundingBox())!;
    expect(back.x).toBeCloseTo(macRed.x, 0);
    expect(back.width).toBeCloseTo(12, 0);
  });

  // plan-wsl_support/REQ-39: Tab reaches the look switch and the Windows-style buttons, with a visible focus; Enter acts
  test('Tab reaches the look switch and the three buttons with a visible focus, and Enter acts on each', async ({ page }) => {
    await chooseLook(page, 'windows11');
    await page.goto('/');
    const bar = topBar(page);
    const { close, minimize, maximize } = windowButtons(bar);
    await expect(close).toBeVisible();

    await tabTo(page, lookSwitch(page));
    expect(await showsFocus(lookSwitch(page)), 'look switch focus').toBe(true);
    await page.keyboard.press('Enter');
    await expect(lookSwitch(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(lookSwitch(page)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(lookSwitch(page)).toHaveAttribute('aria-pressed', 'true');

    await tabTo(page, minimize);
    expect(await showsFocus(minimize), 'Minimize focus').toBe(true);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(maximize).toBeFocused();
    expect(await showsFocus(maximize), 'Maximize focus').toBe(true);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    expect(await showsFocus(close), 'Close focus').toBe(true);
    await page.keyboard.press('Enter');
    expect(await windowCalls(page)).toEqual(['minimize', 'toggle-maximize', 'close']);
  });

  // plan-wsl_support/REQ-32, REQ-33: an empty drag area at every width in both looks; the look switch and the buttons are no-drag
  for (const look of ['vexel', 'windows11'] as const)
    for (const width of [1280, 800, 560, 400, 320]) {
      test(`${look} look at ${width} px: the logo and the brand are a drag area, the look switch and the window buttons are not`, async ({ page }) => {
        await chooseLook(page, look);
        await page.setViewportSize({ width, height: 600 });
        await page.goto('/');
        const bar = topBar(page);
        await expect(lookSwitch(page)).toBeAttached();
        for (const label of ['VX', 'Vexel']) {
          const box = (await bar.getByText(label, { exact: true }).boundingBox())!;
          const x = box.x + box.width / 2;
          expect(x, `${label} inside the window`).toBeGreaterThan(0);
          expect(x).toBeLessThan(width);
          expect(await regionAt(page, x, box.y + box.height / 2), label).toBe('drag');
        }
        expect(await centreRegion(page, lookSwitch(page)), 'look switch').toBe('no-drag');
        const { close, minimize, maximize } = windowButtons(bar);
        for (const button of [close, minimize, maximize]) expect(await centreRegion(page, button), await button.getAttribute('aria-label') ?? '').toBe('no-drag');
        if (look === 'windows11') {
          const [min, cls] = [(await minimize.boundingBox())!, (await close.boundingBox())!];
          expect(await regionAt(page, min.x + min.width, min.y + min.height / 2), 'between Minimize and Maximize').toBe('no-drag');
          expect(cls.x + cls.width, 'Close ends at the window edge').toBeCloseTo(width, 0);
        }
      });
    }
});

// plan-wsl_support/REQ-35: no window buttons in a browser, in either look
test('in the browser the top bar shows no window buttons in either look', async ({ page }) => {
  await page.goto('/');
  const bar = topBar(page);
  for (const look of ['vexel', 'windows11'] as const) {
    await setLook(page, look);
    for (const name of ['Close', 'Minimize', 'Maximize', 'Restore']) await expect(bar.getByRole('button', { name, exact: true }), `${look}: ${name}`).toHaveCount(0);
    const logo = (await bar.getByText('VX', { exact: true }).boundingBox())!;
    const contentLeft = await bar.evaluate((e) => e.getBoundingClientRect().x + parseFloat(getComputedStyle(e).paddingLeft));
    expect(logo.x, `${look}: the logo is the first thing of the bar`).toBeCloseTo(contentLeft, 0);
    const lastRight = await bar.getByRole('button', { name: 'New Session', exact: true }).evaluate((e) => e.getBoundingClientRect().right);
    const contentRight = await bar.evaluate((e) => e.getBoundingClientRect().right - parseFloat(getComputedStyle(e).paddingRight));
    expect(lastRight, `${look}: "New Session" ends the bar`).toBeCloseTo(contentRight, 0);
  }
});
