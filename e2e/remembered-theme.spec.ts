// e2e of plan-light_theme, batch remembered-theme (REQ-17, REQ-18), and of plan-dark_blue_theme, batch dark-blue (REQ-32,
// REQ-33, REQ-35), in the browser. Expected values come from the REQs and the specs WebEntry, ThemeStore and ThemeTokens.
// The desktop part is in desktop-window.spec.ts.
/// <reference lib="dom" />
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type Page, chromium, expect, test } from '@playwright/test';
import { chooseInSettings, settingsButton, settingsPopup, toggleThemeInSettings } from './settings';

const KEY = 'ai-client.theme';
const CANVAS = { dark: 'rgb(11, 11, 14)', light: 'rgb(243, 245, 248)', 'dark-blue': 'rgb(18, 21, 30)' };
const FIRST_START = { mark: 'dark-blue', meta: 'dark', canvas: CANVAS['dark-blue'], scheme: 'dark' };

// A browser that has never opened the client: no saved choice (the config default saves dark). A light system theme,
// so that a dark start cannot come from the system.
test.use({ storageState: { cookies: [], origins: [] }, colorScheme: 'light' });

/** The theme the settings popup shows as chosen; the popup closes again. */
async function expectChosenTheme(page: Page, choice: 'Light' | 'Dark' | 'Dark Blue'): Promise<void> {
  await settingsButton(page).click();
  await expect(settingsPopup(page).getByRole('radio', { name: choice, exact: true })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(settingsPopup(page)).toHaveCount(0);
}

/** Records every value the root's `data-theme` takes while the page loads, from before the first page script. */
async function recordMarks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const marks: (string | null)[] = [];
    (window as unknown as { themeMarks: (string | null)[] }).themeMarks = marks;
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes' && record.target === document.documentElement) marks.push(document.documentElement.getAttribute('data-theme'));
      }
    }).observe(document, { attributes: true, attributeFilter: ['data-theme'], subtree: true });
  });
}

/** The distinct values the mark took: the store may set the same theme again when it starts. */
const marks = async (page: Page) => [...new Set(await page.evaluate(() => (window as unknown as { themeMarks: (string | null)[] }).themeMarks))];

/** What the page paints before the app script runs: the app bundle is blocked, so only the head script and the styles act. */
async function firstFrame(page: Page): Promise<{ mark: string | null; meta: string | null; canvas: string; scheme: string }> {
  await page.route(/\/assets\/[^/]+\.js$/, (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('#root')).toBeEmpty();
  return page.evaluate(() => ({
    mark: document.documentElement.getAttribute('data-theme'),
    meta: document.querySelector('meta[name="color-scheme"]')?.getAttribute('content') ?? null,
    canvas: getComputedStyle(document.body).backgroundColor,
    scheme: getComputedStyle(document.documentElement).colorScheme,
  }));
}

async function saveChoice(page: Page, value: string): Promise<void> {
  await page.goto('/');
  await page.evaluate(([key, v]) => localStorage.setItem(key!, v!), [KEY, value]);
}

test.describe('first start', () => {
  // plan-dark_blue_theme/REQ-35, REQ-33 — scenario "the shortcut cycles three themes", the first frame
  test('with nothing saved the client opens Dark Blue, and the head script marks it before the app runs', async ({ page }) => {
    expect(await firstFrame(page)).toEqual(FIRST_START);
  });

  test('with nothing saved the page only ever carries the dark-blue mark and the settings show Dark Blue', async ({ page }) => {
    await recordMarks(page);
    await page.goto('/');
    await expectChosenTheme(page, 'Dark Blue');
    expect(await page.locator('html').getAttribute('data-theme')).toBe('dark-blue');
    expect(await marks(page)).toEqual(['dark-blue']);
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY), 'opening saves nothing').toBeNull();
  });

  // WebEntry: a value other than light, dark or dark-blue counts as no choice
  for (const value of ['blue', '', 'Dark', '"dark"', 'Dark Blue', 'dark_blue']) {
    test(`a saved value ${JSON.stringify(value)} counts as no choice: the client starts Dark Blue`, async ({ page }) => {
      await saveChoice(page, value);
      expect(await firstFrame(page)).toEqual(FIRST_START);
      await page.unroute(/\/assets\/[^/]+\.js$/);
      await page.reload();
      await expectChosenTheme(page, 'Dark Blue');
    });
  }

  // WebEntry: storage not reachable → dark-blue. The ThemeStore side is in the unit tests: the app's session order needs
  // the storage too, so the full page cannot mount here.
  test('with web storage not reachable the head script marks dark-blue', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('denied', 'SecurityError');
        },
      });
    });
    expect(await firstFrame(page)).toEqual(FIRST_START);
    expect(errors).toEqual([]);
  });
});

test.describe('remembered choice', () => {
  // REQ-17, REQ-18 — scenario "The client keeps the dark theme the user chose", the reload part
  test('after the user switches to dark, a reload shows dark from the first frame, with no other mark on the way', async ({ page }) => {
    await page.goto('/');
    await chooseInSettings(page, 'Dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe('dark');

    await recordMarks(page);
    await page.reload();
    await expectChosenTheme(page, 'Dark');
    expect(await marks(page)).toEqual(['dark']);
    expect(await page.locator('meta[name="color-scheme"]').getAttribute('content')).toBe('dark');

    expect(await firstFrame(page)).toEqual({ mark: 'dark', meta: 'dark', canvas: CANVAS.dark, scheme: 'dark' });
  });

  // REQ-17: switching back to light is remembered too
  test('switching back to light saves light, and the next start is light', async ({ page }) => {
    await saveChoice(page, 'dark');
    await page.reload();
    await expectChosenTheme(page, 'Dark');
    await toggleThemeInSettings(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe('light');
    expect(await firstFrame(page)).toEqual({ mark: 'light', meta: 'light', canvas: CANVAS.light, scheme: 'light' });
  });

  // plan-dark_blue_theme/REQ-32, REQ-33 — scenario "Dark Blue is remembered with no flash"
  test('Dark Blue chosen from Light is saved, and a reload shows it from the first frame with no other mark', async ({ page }) => {
    await saveChoice(page, 'light');
    await page.reload();
    await expectChosenTheme(page, 'Light');
    await chooseInSettings(page, 'Dark Blue');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark-blue');
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe('dark-blue');

    await recordMarks(page);
    await page.reload();
    await expectChosenTheme(page, 'Dark Blue');
    expect(await marks(page)).toEqual(['dark-blue']);
    expect(await firstFrame(page)).toEqual(FIRST_START);
  });

  // plan-dark_blue_theme/REQ-32: a saved theme wins over the first-start theme, also on a reload
  for (const [value, choice] of [
    ['light', 'Light'],
    ['dark', 'Dark'],
  ] as const) {
    test(`a saved ${value} theme wins over Dark Blue: the reload shows ${value} from the first frame, never dark-blue`, async ({ page }) => {
      await saveChoice(page, value);
      await recordMarks(page);
      await page.reload();
      await expectChosenTheme(page, choice);
      expect(await marks(page)).toEqual([value]);
      expect(await firstFrame(page)).toEqual({ mark: value, meta: value, canvas: CANVAS[value], scheme: value });
    });
  }

  // ThemeStore rule: the backend stores nothing
  test('a theme change sends nothing to the backend', async ({ page }) => {
    await page.goto('/');
    await expect(settingsButton(page)).toBeVisible();
    // Reads of the session list may happen at any time while other tests start sessions: only a write could store the theme.
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET') requests.push(`${request.method()} ${request.url()}`);
    });
    await chooseInSettings(page, 'Dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.waitForTimeout(300);
    expect(requests).toEqual([]);
  });

  // REQ-17: each browser keeps its own choice
  test('another browser profile keeps its own choice', async ({ page, browser, baseURL }) => {
    await page.goto('/');
    await chooseInSettings(page, 'Dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const other = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    try {
      const otherPage = await other.newPage();
      await otherPage.goto('/');
      await expectChosenTheme(otherPage, 'Dark Blue');
      expect(await otherPage.locator('html').getAttribute('data-theme')).toBe('dark-blue');
    } finally {
      await other.close();
    }
  });

  // REQ-17, REQ-18 — scenario "The client keeps the dark theme the user chose", the browser restart part
  test('after closing the browser and opening it again with the same profile, the client is dark from the first frame', async ({ baseURL }) => {
    const profile = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-profile-'));
    try {
      const first = await chromium.launchPersistentContext(profile, { baseURL, colorScheme: 'light' });
      const page1 = first.pages()[0] ?? (await first.newPage());
      await page1.goto('/');
      await expectChosenTheme(page1, 'Dark Blue');
      await chooseInSettings(page1, 'Dark');
      await expect(page1.locator('html')).toHaveAttribute('data-theme', 'dark');
      await first.close();

      const second = await chromium.launchPersistentContext(profile, { baseURL, colorScheme: 'light' });
      try {
        const page2 = second.pages()[0] ?? (await second.newPage());
        await recordMarks(page2);
        await page2.goto('/');
        await expectChosenTheme(page2, 'Dark');
        expect(await marks(page2)).toEqual(['dark']);
        expect(await firstFrame(page2)).toEqual({ mark: 'dark', meta: 'dark', canvas: CANVAS.dark, scheme: 'dark' });
      } finally {
        await second.close();
      }
    } finally {
      await rm(profile, { recursive: true, force: true });
    }
  });
});

// WebEntry: the head script comes before the styles
test('the served page runs the theme script in the head before any style', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const head = html.slice(0, html.search(/<\/head>/i));
  const script = head.search(/<script(?![^>]*\bsrc=)[^>]*>[^<]*ai-client\.theme/i);
  expect(script, 'an inline head script reads the saved theme').toBeGreaterThan(-1);
  const firstStyle = head.search(/<link[^>]+rel=["']?stylesheet|<style/i);
  if (firstStyle !== -1) expect(script).toBeLessThan(firstStyle);
  // plan-dark_blue_theme/REQ-35, WebEntry: dark in the HTML, so a first start shows no light flash
  expect(head).toMatch(/<meta[^>]+name=["']color-scheme["'][^>]+content=["']dark["']/i);
});
