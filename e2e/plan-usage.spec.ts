// e2e of plan-usage_limits, batch plan-usage-view: the usage button and the plan usage popover in the browser.
// `GET /api/plan-usage` is replaced with page.route: the test never calls the Anthropic endpoint and holds no token.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, type Route, expect, test } from '@playwright/test';

const ONE_SECOND = { timeout: 1000 };
const IN_ONE_HOUR = () => new Date(Date.now() + 3_600_000 + 30 * 60_000 + 30_000).toISOString();
const IN_TWO_DAYS = () => new Date(Date.now() + 2 * 86_400_000 + 5 * 3_600_000 + 60_000).toISOString();

interface Limit {
  label: string;
  percent: number;
  resetsAt: string | null;
}
const limitsAt = (session: number, week: number, model?: number): Limit[] => [
  { label: 'Current session', percent: session, resetsAt: IN_ONE_HOUR() },
  { label: 'Current week (all models)', percent: week, resetsAt: IN_TWO_DAYS() },
  ...(model === undefined ? [] : [{ label: 'Current week (Opus)', percent: model, resetsAt: IN_TWO_DAYS() }]),
];
const okBody = (limits: Limit[]) => ({ status: 'ok', limits });

/** Answers `GET /api/plan-usage` with the next entry of `answers` (the last one repeats). Gives the request count. */
async function planUsageAnswers(page: Page, answers: Array<(route: Route) => Promise<void> | void>): Promise<{ count: () => number }> {
  let calls = 0;
  await page.route(
    (url) => url.pathname === '/api/plan-usage',
    async (route) => {
      const answer = answers[Math.min(calls, answers.length - 1)] as (route: Route) => Promise<void> | void;
      calls += 1;
      await answer(route);
    },
  );
  return { count: () => calls };
}
const json = (body: unknown, status = 200) => (route: Route) => route.fulfill({ status, json: body });

const banner = (page: Page) => page.getByRole('banner');
const usageButton = (page: Page) => banner(page).getByRole('button', { name: 'Plan Usage', exact: true });
const themeSwitch = (page: Page) => banner(page).getByRole('button', { name: 'Dark theme', exact: true });
const newSessionButton = (page: Page) => banner(page).getByRole('button', { name: 'New Session', exact: true });
const shortcutsButton = (page: Page) => banner(page).getByRole('button', { name: 'Keyboard Shortcuts', exact: true });
const popover = (page: Page) => page.getByRole('dialog', { name: 'Plan Usage', exact: true });
const closeButton = (page: Page) => popover(page).getByRole('button', { name: 'Close', exact: true });
const rows = (page: Page) => popover(page).getByRole('listitem');
const bars = (page: Page) => popover(page).getByRole('progressbar');
const hasFocusVisible = (locator: Locator) => locator.evaluate((el) => el.matches(':focus-visible'));
const box = async (locator: Locator) => (await locator.boundingBox()) as { x: number; y: number; width: number; height: number };

async function loadPage(page: Page): Promise<void> {
  await page.goto('/');
  await expect(themeSwitch(page)).toBeVisible();
  await expect(usageButton(page)).toBeVisible();
}

/** The colour that a theme token resolves to, as the browser computes it. */
const tokenColour = (page: Page, token: string) =>
  page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, token);
const colourOf = (locator: Locator, property: 'color' | 'backgroundColor') => locator.evaluate((el, name) => getComputedStyle(el)[name as 'color'], property);

function luminance(colour: string): number {
  const [r, g, b] = (colour.match(/[\d.]+/g) ?? []).map(Number);
  const channel = (v = 0) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

test.describe('the usage button', () => {
  // plan-usage_limits/REQ-1, REQ-2, REQ-15: right after the switch, 6 px apart, before "New Session", named and with a tooltip
  test('sits right after the theme switch, 6 px apart, before New Session, named and titled "Plan Usage"', async ({ page }) => {
    await planUsageAnswers(page, [json({ status: 'unavailable' })]);
    await loadPage(page);
    const [shortcuts, sw, usage, create] = [await box(shortcutsButton(page)), await box(themeSwitch(page)), await box(usageButton(page)), await box(newSessionButton(page))];
    expect(sw.x).toBeGreaterThan(shortcuts.x);
    expect(usage.x - (sw.x + sw.width)).toBeCloseTo(6, 0);
    expect(create.x).toBeGreaterThan(usage.x + usage.width);
    expect(usage.width).toBeCloseTo(sw.width, 0);
    expect(usage.height).toBeCloseTo(sw.height, 0);
    await expect(usageButton(page)).toHaveAttribute('title', 'Plan Usage');
    await expect(usageButton(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(usageButton(page).locator('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  // plan-usage_limits/REQ-2, REQ-3 — scenario "The user uses the button with the keyboard"
  test('Tab reaches it with a visible focus, Enter opens the popover and Esc closes it', async ({ page }) => {
    await planUsageAnswers(page, [json(okBody(limitsAt(40, 50)))]);
    await loadPage(page);
    await themeSwitch(page).focus();
    await page.keyboard.press('Tab');
    await expect(usageButton(page)).toBeFocused();
    expect(await hasFocusVisible(usageButton(page))).toBe(true);
    await page.keyboard.press('Enter');
    await expect(popover(page)).toBeVisible(ONE_SECOND);
    await expect(usageButton(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(usageButton(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(popover(page)).toHaveCount(0);
    await expect(usageButton(page)).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Space');
    await expect(popover(page)).toBeVisible(ONE_SECOND);
  });

  // plan-usage_limits/REQ-3: using the button again, or the close button, hides the popover
  test('a second click, the close button and Esc inside the panel each hide the popover', async ({ page }) => {
    await planUsageAnswers(page, [json(okBody(limitsAt(40, 50)))]);
    await loadPage(page);
    await usageButton(page).click();
    await expect(popover(page)).toBeVisible();
    await usageButton(page).click();
    await expect(popover(page)).toHaveCount(0);

    await usageButton(page).click();
    await expect(popover(page)).toBeVisible();
    await closeButton(page).click();
    await expect(popover(page)).toHaveCount(0);
    await expect(usageButton(page)).toHaveAttribute('aria-expanded', 'false');

    await usageButton(page).click();
    await expect(popover(page)).toBeVisible();
    await closeButton(page).focus();
    await page.keyboard.press('Escape');
    await expect(popover(page)).toHaveCount(0);
  });
});

test.describe('the popover figures', () => {
  // plan-usage_limits/REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-11 — scenarios "sees the 5-hour and weekly limits", "a weekly limit per model"
  test('shows each limit with its percentage as a number and a bar, and its reset as a time remaining and a date', async ({ page }) => {
    const answers = await planUsageAnswers(page, [json(okBody(limitsAt(40, 75, 0)))]);
    await loadPage(page);
    await usageButton(page).click();
    await expect(popover(page).getByRole('heading', { name: 'Plan Usage' })).toBeVisible();
    await expect(rows(page)).toHaveCount(3);
    await expect(rows(page).nth(0)).toContainText('Current session');
    await expect(rows(page).nth(0)).toContainText('40%');
    await expect(rows(page).nth(1)).toContainText('Current week (all models)');
    await expect(rows(page).nth(1)).toContainText('75%');
    await expect(rows(page).nth(2)).toContainText('Current week (Opus)');
    await expect(rows(page).nth(2)).toContainText('0%');
    await expect(rows(page).nth(0)).toContainText(/Resets in 1h (29|30)m · [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}, \d{2}:\d{2}/);
    await expect(rows(page).nth(1)).toContainText(/Resets in 2d 5h · [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}, \d{2}:\d{2}/);
    await expect(bars(page)).toHaveCount(3);
    await expect(bars(page).nth(0)).toHaveAccessibleName('Current session');
    await expect(bars(page).nth(0)).toHaveAttribute('aria-valuenow', '40');
    await expect(bars(page).nth(1)).toHaveAttribute('aria-valuenow', '75');
    await expect(bars(page).nth(2)).toHaveAttribute('aria-valuenow', '0');
    const track = await box(bars(page).nth(1));
    const fill = await box(bars(page).nth(1).locator('div'));
    expect(fill.width / track.width).toBeCloseTo(0.75, 1);
    expect(answers.count()).toBe(1);
  });

  // plan-usage_limits/REQ-10 — scenario "A limit near its threshold stands out": normal, 70+ amber, 90+ rose
  test('shows a limit at 75% in amber and one at 93% in rose, number and bar, and a lower one in neither', async ({ page }) => {
    await planUsageAnswers(page, [json(okBody(limitsAt(75, 93, 20)))]);
    await loadPage(page);
    await usageButton(page).click();
    await expect(rows(page)).toHaveCount(3);
    const [amber, rose] = [await tokenColour(page, '--amber-400'), await tokenColour(page, '--rose-400')];
    const numberOf = (n: number) => rows(page).nth(n).locator('.plan-limit-percent');
    const fillOf = (n: number) => bars(page).nth(n).locator('div');
    expect(await colourOf(numberOf(0), 'color')).toBe(amber);
    expect(await colourOf(fillOf(0), 'backgroundColor')).toBe(amber);
    expect(await colourOf(numberOf(1), 'color')).toBe(rose);
    expect(await colourOf(fillOf(1), 'backgroundColor')).toBe(rose);
    expect(await colourOf(numberOf(2), 'color')).not.toBe(amber);
    expect(await colourOf(numberOf(2), 'color')).not.toBe(rose);
    expect(await colourOf(fillOf(2), 'backgroundColor')).not.toBe(amber);
    expect(await colourOf(fillOf(2), 'backgroundColor')).not.toBe(rose);
  });

  // plan-usage_limits/REQ-10: the levels use the rounded value, 70 and 90 are the first of each level
  test('the levels start at 70% and 90%', async ({ page }) => {
    await planUsageAnswers(page, [json(okBody(limitsAt(69, 70, 90)))]);
    await loadPage(page);
    await usageButton(page).click();
    await expect(rows(page)).toHaveCount(3);
    const [amber, rose] = [await tokenColour(page, '--amber-400'), await tokenColour(page, '--rose-400')];
    const numberColour = (n: number) => colourOf(rows(page).nth(n).locator('.plan-limit-percent'), 'color');
    expect(await numberColour(0)).not.toBe(amber);
    expect(await numberColour(1)).toBe(amber);
    expect(await numberColour(2)).toBe(rose);
  });

  // plan-usage_limits/REQ-11: opening reads again, and never shows the figures of an earlier opening
  test('reads again on every opening and shows "Loading…" instead of the earlier figures', async ({ page }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const answers = await planUsageAnswers(page, [
      json(okBody(limitsAt(40, 50))),
      async (route) => {
        await gate;
        await route.fulfill({ json: okBody(limitsAt(61, 62)) });
      },
    ]);
    await loadPage(page);
    await usageButton(page).click();
    await expect(rows(page).nth(0)).toContainText('40%');
    await usageButton(page).click();
    await expect(popover(page)).toHaveCount(0);
    await usageButton(page).click();
    await expect(popover(page)).toContainText('Loading…');
    await expect(popover(page)).not.toContainText('40%');
    expect(answers.count()).toBe(2);
    release();
    await expect(rows(page).nth(0)).toContainText('61%');
  });

  // plan-usage_limits/REQ-17 — scenario "The panel shows that it is loading": the client keeps responding
  test('shows "Loading…" while the answer is slow and the rest of the client keeps responding', async ({ page }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await planUsageAnswers(page, [
      async (route) => {
        await gate;
        await route.fulfill({ json: okBody(limitsAt(40, 50)) });
      },
    ]);
    await loadPage(page);
    await usageButton(page).click();
    await expect(popover(page).getByRole('status')).toHaveText('Loading…');
    await expect(popover(page).locator('li')).toHaveCount(0);
    await themeSwitch(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await themeSwitch(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    release();
    await expect(rows(page)).toHaveCount(2);
    await expect(popover(page).getByText('Loading…')).toHaveCount(0);
  });

  // plan-usage_limits/REQ-11 — scenario "The figures are read once per opening"
  test('reads the figures once per opening and shows the new ones only on the next opening', async ({ page }) => {
    await page.clock.install();
    const answers = await planUsageAnswers(page, [json(okBody(limitsAt(40, 50))), json(okBody(limitsAt(45, 50)))]);
    await loadPage(page);
    await usageButton(page).click();
    await expect(rows(page).nth(0)).toContainText('40%');
    await page.clock.runFor(300_000);
    await expect(rows(page).nth(0)).toContainText('40%');
    expect(answers.count()).toBe(1);
    await usageButton(page).click();
    await expect(popover(page)).toHaveCount(0);
    await usageButton(page).click();
    await expect(rows(page).nth(0)).toContainText('45%');
    expect(answers.count()).toBe(2);
  });

  // plan-usage_limits/REQ-11: nothing loads while the popover is closed
  test('loads nothing once the popover is closed', async ({ page }) => {
    await page.clock.install();
    const answers = await planUsageAnswers(page, [json(okBody(limitsAt(40, 50)))]);
    await loadPage(page);
    await usageButton(page).click();
    await expect(rows(page)).toHaveCount(2);
    await usageButton(page).click();
    await expect(popover(page)).toHaveCount(0);
    await page.clock.runFor(180_000);
    expect(answers.count()).toBe(1);
  });
});

test.describe('the states without figures', () => {
  // plan-usage_limits/REQ-13 — scenario "Plan limits are not available"
  for (const [name, answer] of [
    ['unavailable', json({ status: 'unavailable' })],
    ['an error', json({ status: 'error' })],
    ['an HTTP failure', json({ status: 'error' }, 500)],
    ['a network failure', (route: Route) => route.abort()],
  ] as const) {
    test(`says "Plan usage is not available" and shows no row and no 0% on ${name}`, async ({ page }) => {
      await planUsageAnswers(page, [answer]);
      await loadPage(page);
      await usageButton(page).click();
      await expect(popover(page)).toContainText('Plan usage is not available');
      await expect(popover(page).locator('li')).toHaveCount(0);
      await expect(bars(page)).toHaveCount(0);
      await expect(popover(page)).not.toContainText('0%');
      await expect(popover(page).getByText('Loading…')).toHaveCount(0);
    });
  }

  // plan-usage_limits/REQ-13 at the backend: the fixture Claude Code folder has no credentials, so the real route says unavailable
  test('the real route answers unavailable, without a token, on an account with no sign-in token', async ({ request }: { request: APIRequestContext }) => {
    const response = await request.get('/api/plan-usage');
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: 'unavailable' });
  });

  test('the real page says "Plan usage is not available" when the server has no token', async ({ page }) => {
    await loadPage(page);
    await usageButton(page).click();
    await expect(popover(page)).toContainText('Plan usage is not available');
    await expect(popover(page).locator('li')).toHaveCount(0);
  });
});

test.describe('the popover next to the rest of the client', () => {
  let projectsRoot: string;
  const createdIds: string[] = [];

  test.afterEach(async ({ request }) => {
    for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  });

  // The page shows only the sessions of the running test: other specs leave theirs on the server.
  test.beforeEach(async ({ page }) => {
    projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-plan-usage-'));
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
  });

  const terminal = (page: Page) => page.locator('.xterm-rows');
  const terminalInput = (page: Page) => page.locator('.xterm-helper-textarea');
  // The first visible row stands for the scroll position of the terminal.
  const firstRow = async (page: Page) => (await terminal(page).locator(':scope > div').first().textContent()) ?? '';

  // plan-usage_limits/REQ-4 — scenario "The panel opens and closes without touching the work"
  test('opening and closing keeps the session working, the terminal focused and its scroll position', async ({ page, request }) => {
    await planUsageAnswers(page, [json(okBody(limitsAt(40, 50)))]);
    const folder = path.join(projectsRoot, 'work');
    await mkdir(folder);
    const created = await request.post('/api/sessions', { data: { path: folder } });
    expect(created.status()).toBe(201);
    createdIds.push(((await created.json()) as { id: string }).id);
    await loadPage(page);
    await page.getByTitle(folder, { exact: true }).click();
    await expect(terminal(page)).toContainText('READY');

    await page.locator('.xterm-screen').click();
    await expect(terminalInput(page)).toBeFocused();
    for (let n = 0; n < 45; n++) {
      await page.keyboard.type(`line${n}`);
      await page.keyboard.press('Enter');
    }
    await expect(terminal(page)).toContainText('IN:');
    const atEnd = await firstRow(page);
    await page.locator('.xterm-screen').hover();
    await page.mouse.wheel(0, -300);
    await expect.poll(() => firstRow(page)).not.toBe(atEnd);
    await expect.poll(async () => {
      const before = await firstRow(page);
      await page.waitForTimeout(250);
      return (await firstRow(page)) === before;
    }, { message: 'the wheel scroll has settled' }).toBe(true);
    const scrolled = await firstRow(page);

    await usageButton(page).click();
    await expect(popover(page)).toBeVisible();
    await expect(terminalInput(page)).toBeFocused();
    await usageButton(page).click();
    await expect(popover(page)).toHaveCount(0);
    await expect(terminalInput(page)).toBeFocused();
    expect(await firstRow(page)).toBe(scrolled);

    await page.keyboard.type('after');
    await page.keyboard.press('Enter');
    // The fake CLI echoes line by line: under a loaded machine the terminal can lag behind the typing.
    await expect(terminal(page)).toContainText('LINE:after', { timeout: 30_000 });
    await expect(page.getByTitle(folder, { exact: true }).first()).toBeVisible();
  });

  // plan-usage_limits/REQ-4: opening the popover does not close a dialog; the dialog backdrop covers it
  test('a dialog opened while the popover is open stays open, above the popover', async ({ page }) => {
    await planUsageAnswers(page, [json(okBody(limitsAt(40, 50)))]);
    await loadPage(page);
    await usageButton(page).click();
    await expect(rows(page)).toHaveCount(2);
    await newSessionButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'New Claude Code Session' });
    await expect(dialog).toBeVisible();
    await expect(popover(page)).toBeVisible();
    const popoverBox = await box(popover(page));
    const onTop = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('[role="dialog"]')?.getAttribute('aria-label') ?? '',
      { x: popoverBox.x + popoverBox.width / 2, y: popoverBox.y + popoverBox.height / 2 },
    );
    expect(onTop, 'the point of the popover is covered by something that is not the popover').not.toBe('Plan Usage');
  });
});

test.describe('the look in both themes', () => {
  // plan-usage_limits/REQ-15, REQ-16 — scenario "The panel reads well in both themes"
  for (const theme of ['dark', 'light'] as const) {
    test(`the button, the panel, the bars and the levels are readable in the ${theme} theme`, async ({ page }) => {
      await planUsageAnswers(page, [json(okBody(limitsAt(30, 75, 95)))]);
      await loadPage(page);
      if (theme === 'light') await themeSwitch(page).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await usageButton(page).click();
      await expect(rows(page)).toHaveCount(3);

      const panelBackground = await colourOf(popover(page), 'backgroundColor');
      if (theme === 'dark') expect(luminance(panelBackground)).toBeLessThan(0.1);
      else expect(luminance(panelBackground)).toBeGreaterThan(0.6);
      expect(contrast(await colourOf(popover(page).getByRole('heading', { name: 'Plan Usage' }), 'color'), panelBackground)).toBeGreaterThan(4.5);
      expect(contrast(await colourOf(rows(page).nth(0).locator('.plan-limit-label'), 'color'), panelBackground)).toBeGreaterThan(4.5);
      expect(contrast(await colourOf(rows(page).nth(0).locator('.plan-limit-reset'), 'color'), panelBackground)).toBeGreaterThan(3);
      for (const n of [1, 2]) {
        const percent = await colourOf(rows(page).nth(n).locator('.plan-limit-percent'), 'color');
        expect(contrast(percent, panelBackground), `limit ${n} number`).toBeGreaterThan(3);
      }
      const track = await colourOf(bars(page).nth(0), 'backgroundColor');
      expect(contrast(await colourOf(bars(page).nth(0).locator('div'), 'backgroundColor'), track), 'fill against its track').toBeGreaterThan(1.3);
      expect(contrast(track, panelBackground), 'track against the panel').toBeGreaterThan(1.05);

      await page.mouse.move(0, 400);
      await usageButton(page).blur();
      // The look of the switch, once the hover transition (150 ms) has ended.
      const looks = async (button: Locator) => `${await colourOf(button, 'backgroundColor')}|${await colourOf(button, 'color')}|${await colourOf(button, 'borderColor' as 'color')}`;
      await expect.poll(async () => (await looks(usageButton(page))) === (await looks(themeSwitch(page)))).toBe(true);
    });
  }

  // plan-usage_limits/REQ-15: every text of the button and the popover is English
  test('every text is English in every state', async ({ page }) => {
    const states = [okBody(limitsAt(40, 50, 0)), { status: 'unavailable' }];
    const texts: string[] = [];
    for (const state of states) {
      await planUsageAnswers(page, [json(state)]);
      await loadPage(page);
      await usageButton(page).click();
      await expect(popover(page)).not.toContainText('Loading…');
      texts.push((await popover(page).innerText()).replace(/\s+/g, ' '));
      texts.push((await usageButton(page).getAttribute('aria-label')) ?? '', (await usageButton(page).getAttribute('title')) ?? '');
    }
    const words = texts.join(' ').match(/[A-Za-z]{4,}/g) ?? [];
    const english = new Set(['Plan', 'Usage', 'Close', 'Current', 'session', 'week', 'models', 'Opus', 'Resets', 'usage', 'available', 'Loading']);
    expect(words.filter((word) => !english.has(word) && !/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/.test(word))).toEqual([]);
    expect(texts[0]).toMatch(/Resets in \d/);
  });
});
