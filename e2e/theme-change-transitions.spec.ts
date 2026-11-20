// e2e of plan-ui_transitions, batch theme-change: a theme or look change dissolves the whole page, terminal included,
// never blocks input, and the last change wins. Expected values come from the REQs and the specs ColorDissolve,
// ThemeStore and LookStore.
/// <reference lib="dom" />
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type Locator, type Page, expect, test } from '@playwright/test';
import { cardOf, settingsButton, settingsPopup } from './settings';

interface Picture {
  theme: string | null;
  look: string | null;
  canvas: string;
  terminal: string | null;
  animations: { pseudo: string; duration: number; easing: string }[];
}
interface Watch {
  calls: number;
  active: number;
  pictures: Picture[];
  clicksDuringDissolve: number;
  // Page clock (performance.now) of the first press during a dissolve, and of the end of the last dissolve.
  pressedAt: number | null;
  endedAt: number | null;
}

// Values of the theme plans (dark_blue_theme, cool_slate_light), in computed form.
const DARK_BLUE_CANVAS = 'rgb(18, 21, 30)';
const DARK_BLUE_TERM_BG = 'rgb(17, 20, 28)';
const LIGHT_CANVAS = 'rgb(243, 245, 248)';
const LIGHT_TERM_BG = 'rgb(255, 255, 255)';
const SLOW_MS = 1500;

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeEach(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-theme-change-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  await rm(projectsRoot, { recursive: true, force: true });
});

const html = (page: Page) => page.locator('html');
const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const terminal = (page: Page) => page.locator('.xterm-rows');
const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });

/**
 * Records each view transition the page starts and, once its new picture is taken (`ready`), the marks, the colours of
 * the canvas and the terminal, and the cross-fade animations. Also counts the clicks that land while one plays.
 */
function installDissolveWatcher(): void {
  const watch: Watch = { calls: 0, active: 0, pictures: [], clicksDuringDissolve: 0, pressedAt: null, endedAt: null };
  (window as unknown as { dissolveWatch: Watch }).dissolveWatch = watch;
  const native = document.startViewTransition?.bind(document);
  if (!native) return;
  const background = (el: Element | null): string | null => {
    for (let node = el; node; node = node.parentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
    }
    return el ? getComputedStyle(document.documentElement).backgroundColor : null;
  };
  document.startViewTransition = ((arg?: unknown) => {
    watch.calls++;
    watch.active++;
    const transition = native(arg as ViewTransitionUpdateCallback);
    transition.ready.then(
      () => {
        const root = document.documentElement;
        watch.pictures.push({
          theme: root.getAttribute('data-theme'),
          look: root.getAttribute('data-look'),
          canvas: getComputedStyle(document.body).backgroundColor,
          terminal: background(document.querySelector('.xterm-screen')),
          animations: document
            .getAnimations()
            .map((a) => a.effect as KeyframeEffect | null)
            .filter((e): e is KeyframeEffect => !!e?.pseudoElement?.startsWith('::view-transition'))
            .map((e) => ({ pseudo: e.pseudoElement!, duration: Number(e.getTiming().duration), easing: String(e.getKeyframes()[0]?.easing) })),
        });
      },
      () => undefined,
    );
    transition.finished
      .finally(() => {
        watch.active--;
        watch.endedAt = performance.now();
      })
      .catch(() => undefined);
    return transition;
  }) as typeof document.startViewTransition;
  document.addEventListener(
    'pointerdown',
    () => {
      if (watch.active === 0) return;
      watch.clicksDuringDissolve++;
      watch.pressedAt ??= performance.now();
    },
    true,
  );
}

const watchOf = (page: Page) => page.evaluate(() => (window as unknown as { dissolveWatch: Watch }).dissolveWatch);

/** The motion tokens of the enter effect, read on the page. */
const enterTokens = (page: Page) =>
  page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const raw = css.getPropertyValue('--motion-duration-enter').trim();
    const amount = Number.parseFloat(raw);
    // The browser's own form of the easing, so `.16` and `0.16` compare equal.
    const probe = document.createElement('div');
    probe.style.animationTimingFunction = 'var(--motion-ease-enter)';
    document.body.append(probe);
    const easing = getComputedStyle(probe).animationTimingFunction;
    probe.remove();
    return { duration: raw.endsWith('ms') ? amount : amount * 1000, easing };
  });

async function waitForDissolveEnd(page: Page): Promise<void> {
  await expect.poll(async () => (await watchOf(page)).active, { timeout: SLOW_MS + 2000 }).toBe(0);
}

async function effectiveBackground(target: Locator): Promise<string> {
  return target.evaluate((el) => {
    for (let node: Element | null = el; node; node = node.parentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
    }
    return getComputedStyle(document.documentElement).backgroundColor;
  });
}

async function choose(page: Page, choice: string): Promise<void> {
  await settingsButton(page).click();
  const popup = settingsPopup(page);
  await expect(popup).toBeVisible();
  await popup.getByRole('tab', { name: 'Appearance', exact: true }).click();
  await cardOf(popup.getByRole('radio', { name: choice, exact: true })).click();
}

async function closeSettings(page: Page): Promise<void> {
  const popup = settingsPopup(page);
  await popup.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(popup).toHaveCount(0);
}

async function openSession(page: Page, request: Page['request'], name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder, { recursive: true });
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  createdIds.push(((await response.json()) as { id: string }).id);
  await entry(page, folder).getByTitle(folder, { exact: true }).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
  return folder;
}

test.describe('colour dissolve', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installDissolveWatcher);
  });

  // REQ-14 assumption: the first paint has no dissolve
  test('the first paint of the app has no dissolve', async ({ page }) => {
    await page.goto('/');
    await expect(rail(page)).toBeVisible();
    await page.waitForTimeout(300);
    expect((await watchOf(page)).calls).toBe(0);
  });

  // REQ-14, REQ-15 — scenario "the theme changes with a colour dissolve"
  test('choosing Light from Dark Blue dissolves the whole page, and the terminal is already in the new colours in the new picture', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ai-client.theme', 'dark-blue'));
    await page.goto('/');
    await expect(html(page)).toHaveAttribute('data-theme', 'dark-blue');
    await openSession(page, page.request, 'dissolve-light');
    expect(await effectiveBackground(page.locator('.xterm-screen')), 'the Dark Blue terminal before the change').toBe(DARK_BLUE_TERM_BG);
    const tokens = await enterTokens(page);

    await choose(page, 'Light');
    await waitForDissolveEnd(page);

    const watch = await watchOf(page);
    expect(watch.calls, 'one dissolve for one change').toBe(1);
    const picture = watch.pictures[0]!;
    expect(picture.theme).toBe('light');
    expect(picture.canvas, 'the new picture has the new canvas').toBe(LIGHT_CANVAS);
    expect(picture.terminal, 'the new picture has the new terminal colours').toBe(LIGHT_TERM_BG);
    // The whole page (the root) cross-fades over the motion tokens.
    const pseudos = picture.animations.map((a) => a.pseudo);
    expect(pseudos).toContain('::view-transition-old(root)');
    expect(pseudos).toContain('::view-transition-new(root)');
    for (const a of picture.animations.filter((x) => /-(old|new)\(root\)$/.test(x.pseudo))) {
      expect(a.duration, `${a.pseudo} duration`).toBe(tokens.duration);
      expect(a.easing.replace(/\s/g, ''), `${a.pseudo} easing`).toBe(tokens.easing.replace(/\s/g, ''));
    }

    // At the end no area keeps a Dark Blue colour.
    await expect(html(page)).toHaveAttribute('data-theme', 'light');
    expect(await effectiveBackground(page.locator('body'))).toBe(LIGHT_CANVAS);
    expect(await effectiveBackground(page.locator('.xterm-screen'))).toBe(LIGHT_TERM_BG);
    expect(await page.evaluate(() => localStorage.getItem('ai-client.theme'))).toBe('light');
  });

  // REQ-14, REQ-32 — scenario "the window look changes with the same dissolve"
  test('choosing Windows 11 dissolves the page with the same timing, and closing Settings keeps its effect', async ({ page }) => {
    await page.goto('/');
    await expect(html(page)).toHaveAttribute('data-look', 'vexel');
    const before = await enterTokens(page);
    const exitBefore = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--motion-duration-exit').trim());

    await choose(page, 'Windows 11');
    await waitForDissolveEnd(page);

    const watch = await watchOf(page);
    expect(watch.calls).toBe(1);
    const picture = watch.pictures[0]!;
    expect(picture.look).toBe('windows11');
    const fades = picture.animations.filter((a) => /-(old|new)\(root\)$/.test(a.pseudo));
    expect(fades.length).toBeGreaterThanOrEqual(2);
    for (const a of fades) {
      expect(a.duration).toBe(before.duration);
      expect(a.easing.replace(/\s/g, '')).toBe(before.easing.replace(/\s/g, ''));
    }
    await expect(html(page)).toHaveAttribute('data-look', 'windows11');
    expect(await enterTokens(page), 'the motion tokens are the same in the new look').toEqual(before);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--motion-duration-exit').trim())).toBe(exitBefore);

    await closeSettings(page);
    expect((await watchOf(page)).calls, 'closing Settings starts no dissolve').toBe(1);
  });

  // REQ-26, REQ-28 — scenario "two quick theme changes end on the last theme"
  test('two quick Alt+A presses end on the theme of the second press, and the shortcut works during the dissolve', async ({ page }) => {
    await page.goto('/');
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
    await page.evaluate((ms) => document.documentElement.style.setProperty('--motion-duration-enter', `${ms}ms`), SLOW_MS);

    await page.keyboard.press('Alt+KeyA');
    await expect.poll(async () => (await watchOf(page)).active, { timeout: 1000 }).toBeGreaterThan(0);
    await page.keyboard.press('Alt+KeyA');
    expect(await page.evaluate(() => localStorage.getItem('ai-client.theme')), 'the second press is taken during the dissolve').toBe('light');

    await waitForDissolveEnd(page);
    await expect(html(page)).toHaveAttribute('data-theme', 'light');
    expect(await effectiveBackground(page.locator('body'))).toBe(LIGHT_CANVAS);
    await page.waitForTimeout(300);
    await expect(html(page), 'no older change lands after the last one').toHaveAttribute('data-theme', 'light');
  });

  // REQ-26
  test('a click during the dissolve ends it at once in the new colours, and the control under it takes the click', async ({ page }) => {
    await page.goto('/');
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
    await page.evaluate((ms) => document.documentElement.style.setProperty('--motion-duration-enter', `${ms}ms`), SLOW_MS);
    const target = (await settingsButton(page).boundingBox())!;

    await page.keyboard.press('Alt+KeyA');
    await expect.poll(async () => (await watchOf(page)).active, { timeout: 1000 }).toBeGreaterThan(0);
    await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
    expect((await watchOf(page)).clicksDuringDissolve, 'the click landed while the dissolve played').toBeGreaterThan(0);
    await waitForDissolveEnd(page);
    // Measured on the page clock: the test runner's round trips and poll intervals are not part of the dissolve.
    const { pressedAt, endedAt } = await watchOf(page);
    expect(endedAt! - pressedAt!, 'the press ends the dissolve at once').toBeLessThan(SLOW_MS / 2);
    await expect(html(page)).toHaveAttribute('data-theme', 'dark-blue');
    expect(await effectiveBackground(page.locator('body')), 'the page is in the new colours').toBe(DARK_BLUE_CANVAS);
    await expect(settingsPopup(page), 'the Settings button takes the click').toBeVisible();
    expect((await watchOf(page)).calls, 'the click starts no other dissolve').toBe(1);
  });

  // REQ-25
  test('with reduced motion the theme changes at once, with no dissolve', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
    await choose(page, 'Light');
    expect(await html(page).getAttribute('data-theme'), 'the mark moves with no wait').toBe('light');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Alt+KeyA');
    expect(await html(page).getAttribute('data-theme')).toBe('dark');
    expect((await watchOf(page)).calls).toBe(0);
  });
});
