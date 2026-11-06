// e2e of plan-light_theme, batch remembered-theme: REQ-17, REQ-18, REQ-19 in the browser. Expected values come from
// the REQs and the specs WebEntry, ThemeStore and ThemeTokens. The desktop part (REQ-17, REQ-20) is in desktop-window.spec.ts.
/// <reference lib="dom" />
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type Page, chromium, expect, test } from '@playwright/test';

const KEY = 'ai-client.theme';
const CANVAS = { dark: 'rgb(11, 11, 14)', light: 'rgb(244, 241, 234)' };

// A browser that has never opened the client: no saved choice (the config default saves dark). A dark system theme,
// so that a light start cannot come from the system.
test.use({ storageState: { cookies: [], origins: [] }, colorScheme: 'dark' });

const themeSwitch = (page: Page) => page.getByRole('banner').getByRole('button', { name: 'Dark theme', exact: true });

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
  // REQ-19, REQ-18 — scenario "The client opens light the first time"
  test('with nothing saved the client opens light, and the head script marks it before the app runs', async ({ page }) => {
    expect(await firstFrame(page)).toEqual({ mark: 'light', meta: 'light', canvas: CANVAS.light, scheme: 'light' });
  });

  test('with nothing saved the page only ever carries the light mark and the switch is not pressed', async ({ page }) => {
    await recordMarks(page);
    await page.goto('/');
    await expect(themeSwitch(page)).toHaveAttribute('aria-pressed', 'false');
    expect(await page.locator('html').getAttribute('data-theme')).toBe('light');
    expect(await marks(page)).toEqual(['light']);
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY), 'opening saves nothing').toBeNull();
  });

  // WebEntry: a value other than dark or light counts as no choice
  for (const value of ['blue', '', 'Dark', '"dark"']) {
    test(`a saved value ${JSON.stringify(value)} counts as no choice: the client starts light`, async ({ page }) => {
      await saveChoice(page, value);
      expect(await firstFrame(page)).toEqual({ mark: 'light', meta: 'light', canvas: CANVAS.light, scheme: 'light' });
      await page.unroute(/\/assets\/[^/]+\.js$/);
      await page.reload();
      await expect(themeSwitch(page)).toHaveAttribute('aria-pressed', 'false');
    });
  }

  // WebEntry: storage not reachable → light. The ThemeStore side is in the unit tests: the app's session order needs
  // the storage too, so the full page cannot mount here.
  test('with web storage not reachable the head script marks light', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('denied', 'SecurityError');
        },
      });
    });
    expect(await firstFrame(page)).toEqual({ mark: 'light', meta: 'light', canvas: CANVAS.light, scheme: 'light' });
    expect(errors).toEqual([]);
  });
});

test.describe('remembered choice', () => {
  // REQ-17, REQ-18 — scenario "The client keeps the dark theme the user chose", the reload part
  test('after the user switches to dark, a reload shows dark from the first frame, with no light mark on the way', async ({ page }) => {
    await page.goto('/');
    await themeSwitch(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe('dark');

    await recordMarks(page);
    await page.reload();
    await expect(themeSwitch(page)).toHaveAttribute('aria-pressed', 'true');
    expect(await marks(page)).toEqual(['dark']);
    expect(await page.locator('meta[name="color-scheme"]').getAttribute('content')).toBe('dark');

    expect(await firstFrame(page)).toEqual({ mark: 'dark', meta: 'dark', canvas: CANVAS.dark, scheme: 'dark' });
  });

  // REQ-17: switching back to light is remembered too
  test('switching back to light saves light, and the next start is light', async ({ page }) => {
    await saveChoice(page, 'dark');
    await page.reload();
    await expect(themeSwitch(page)).toHaveAttribute('aria-pressed', 'true');
    await themeSwitch(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe('light');
    expect(await firstFrame(page)).toEqual({ mark: 'light', meta: 'light', canvas: CANVAS.light, scheme: 'light' });
  });

  // ThemeStore rule: the backend stores nothing
  test('a theme change sends nothing to the backend', async ({ page }) => {
    await page.goto('/');
    await expect(themeSwitch(page)).toBeVisible();
    // Reads of the session list may happen at any time while other tests start sessions: only a write could store the theme.
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET') requests.push(`${request.method()} ${request.url()}`);
    });
    await themeSwitch(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.waitForTimeout(300);
    expect(requests).toEqual([]);
  });

  // REQ-17: each browser keeps its own choice
  test('another browser profile keeps its own choice', async ({ page, browser, baseURL }) => {
    await page.goto('/');
    await themeSwitch(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const other = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    try {
      const otherPage = await other.newPage();
      await otherPage.goto('/');
      await expect(themeSwitch(otherPage)).toHaveAttribute('aria-pressed', 'false');
      expect(await otherPage.locator('html').getAttribute('data-theme')).toBe('light');
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
      await expect(themeSwitch(page1)).toHaveAttribute('aria-pressed', 'false');
      await themeSwitch(page1).click();
      await expect(page1.locator('html')).toHaveAttribute('data-theme', 'dark');
      await first.close();

      const second = await chromium.launchPersistentContext(profile, { baseURL, colorScheme: 'light' });
      try {
        const page2 = second.pages()[0] ?? (await second.newPage());
        await recordMarks(page2);
        await page2.goto('/');
        await expect(themeSwitch(page2)).toHaveAttribute('aria-pressed', 'true');
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
  expect(head).toMatch(/<meta[^>]+name=["']color-scheme["'][^>]+content=["']light["']/i);
});
