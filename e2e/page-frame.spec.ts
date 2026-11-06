// e2e of plan-claude_sessions_client-ui_redesign-material3_mock, batch page-frame, brought to the Studio frame of plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark.
// The server runs the fake CLI (playwright.config.ts).
/// <reference lib="dom" />
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, type WebSocketRoute, expect, test } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };

let projectsRoot: string;
const createdIds: string[] = [];

// A root per test: ended sessions stay in the list, so each test sees only its own.
test.beforeEach(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-frame-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

const topBar = (page: Page) => page.getByRole('banner');
const rail = (page: Page) => page.getByRole('navigation', { name: 'Navigazione principale' });
const railButton = (page: Page, name: string) => rail(page).getByRole('button', { name, exact: true });
const panel = (page: Page) => page.getByRole('region', { name: 'Elenco sessioni' });
const mainArea = (page: Page) => page.getByRole('main');
const entries = (page: Page) => panel(page).getByRole('button');
const entry = (page: Page, folder: string) => entries(page).filter({ has: page.getByTitle(folder, { exact: true }) });
const chip = (page: Page) => panel(page).getByRole('status').filter({ hasText: 'richiede input' });
const badge = (page: Page) => railButton(page, 'Sessioni').locator('.nav-rail-badge');
const snackbar = (page: Page) => page.getByRole('status').filter({ hasText: 'richiede il tuo input' });
const terminal = (page: Page) => page.locator('.xterm-rows');
const chooser = (page: Page) => page.getByRole('dialog', { name: 'Nuova sessione' });
const history = (page: Page) => page.getByRole('dialog', { name: 'Riprendi sessione' });

/** Shows in the page only the sessions of this test: other tests start sessions on the same server at the same time. */
async function showOnlyOwnSessions(page: Page): Promise<() => WebSocketRoute> {
  let events: WebSocketRoute | undefined;
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
    events = ws;
    const server = ws.connectToServer();
    server.onMessage((message) => {
      const frame = JSON.parse(String(message)) as { type?: string; session?: { folder?: unknown } };
      if (frame.type !== 'session' || own(frame.session)) ws.send(message);
    });
  });
  return () => events!;
}

async function newFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
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

const askPermission = (request: APIRequestContext, id: string) => postHook(request, id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
const finishTurn = (request: APIRequestContext, id: string) => postHook(request, id, { hook_event_name: 'Stop' });

async function openFromList(page: Page, folder: string): Promise<void> {
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
}

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
}

async function computedColour(page: Page, cssValue: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement('div');
    probe.style.color = value;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, cssValue);
}

const style = (target: Locator, property: string) => target.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);

/** Whether the focused element draws the focus ring colour as an outline or a box-shadow. */
async function focusedShowsRing(page: Page): Promise<boolean> {
  const ring = await computedColour(page, 'var(--color-focus-ring)');
  return page.evaluate((ringColour) => {
    const el = document.activeElement;
    if (!el) return false;
    const s = getComputedStyle(el);
    const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor === ringColour;
    return outline || s.boxShadow.includes(ringColour);
  }, ring);
}

test.describe('rail and list panel', () => {
  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-14, REQ-17: scenario "The user starts a new session from the rail"
  test('at 1440 px the top bar shows the brand, the rail its actions and no logo, the panel "Sessioni", and "Nuova sessione" opens the dialog', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    await expect(page).toHaveTitle('Vexel for Claude');
    await expect(rail(page).getByRole('img')).toHaveCount(0);
    for (const name of ['Nuova sessione', 'Sessioni', 'Riprendi']) await expect(railButton(page, name)).toBeVisible();
    await expect(topBar(page).getByText('Vexel', { exact: true })).toBeVisible();
    await expect(topBar(page).getByText('for Claude', { exact: true })).toBeVisible();
    await expect(panel(page).getByText('Vexel', { exact: true })).toHaveCount(0);
    await expect(panel(page).getByRole('heading', { level: 1, name: 'Sessioni', exact: true })).toBeVisible();

    await railButton(page, 'Nuova sessione').click();
    await expect(chooser(page)).toBeVisible();
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-8: scenario "The user opens the resume history from the rail"
  test('"Riprendi" in the rail opens the resume history', async ({ page }) => {
    await page.goto('/');
    await railButton(page, 'Riprendi').click();
    await expect(history(page)).toBeVisible();
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-53; AppLayout "Description": rail, list panel and main area side by side
  test('the rail sits at the left edge, then the list panel, then the main area', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const railBox = await box(rail(page));
    const panelBox = await box(panel(page));
    const mainBox = await box(mainArea(page));
    expect(railBox.x).toBeCloseTo(0, 0);
    expect(railBox.width, 'rail width').toBeCloseTo(52, 0);
    expect(railBox.x + railBox.width).toBeLessThanOrEqual(panelBox.x + 0.5);
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(mainBox.x + 0.5);
    expect(panelBox.width, 'panel 224 px wide').toBeCloseTo(224, 0);
    expect(mainBox.x + mainBox.width).toBeCloseTo(1440, 0);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-6, REQ-17, NavigationRail "Shows": "Nuova sessione" as `.vx-rail-fab`
  test('the rail "Nuova sessione" is the 34 px gradient button with the 16 px plus icon in the text-on-accent colour', async ({ page }) => {
    await page.goto('/');
    const fab = railButton(page, 'Nuova sessione');
    await page.mouse.move(0, 899);
    const fabBox = await box(fab);
    expect([fabBox.width, fabBox.height]).toEqual([34, 34]);
    expect(await style(fab, 'border-radius')).toBe('8px');
    const accent = await computedColour(page, 'var(--accent-primary)');
    const deep = await computedColour(page, 'var(--accent-deep)');
    const gradient = await style(fab, 'background-image');
    expect(gradient).toContain('linear-gradient(135deg');
    expect(gradient).toContain(accent);
    expect(gradient).toContain(deep);
    expect(await style(fab, 'color')).toBe(await computedColour(page, 'var(--on-accent)'));
    expect(await fab.locator('svg').evaluate((svg) => [svg.getBoundingClientRect().width, svg.getBoundingClientRect().height])).toEqual([16, 16]);
  });

  // NavigationRail "Shows": "Sessioni" is always the current page, "Riprendi" never
  test('"Sessioni" carries aria-current="page" and "Riprendi" does not', async ({ page }) => {
    await page.goto('/');
    await expect(railButton(page, 'Sessioni')).toHaveAttribute('aria-current', 'page');
    await expect(railButton(page, 'Riprendi')).not.toHaveAttribute('aria-current');
    await railButton(page, 'Riprendi').click();
    await expect(history(page)).toBeVisible();
    await history(page).getByRole('button', { name: 'Annulla', exact: true }).click();
    await expect(railButton(page, 'Sessioni')).toHaveAttribute('aria-current', 'page');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-13, REQ-14, REQ-16; AppLayout and TopBar "Shows": the flat list panel, and the brand in the top bar
  test('the list panel is flat on surface 1 with the subtle right line, and the top bar shows "Vexel" then "for Claude"', async ({ page }) => {
    await page.goto('/');
    expect(await style(panel(page), 'border-radius')).toBe('0px');
    expect(await style(panel(page), 'background-color')).toBe(await computedColour(page, 'var(--bg-surface-1)'));
    expect(await style(panel(page), 'border-right-color')).toBe(await computedColour(page, 'var(--border-subtle)'));

    const brand = topBar(page).getByText('Vexel', { exact: true });
    const forClaude = topBar(page).getByText('for Claude', { exact: true });
    const title = panel(page).getByRole('heading', { level: 1, name: 'Sessioni', exact: true });
    expect(await style(brand, 'font-size')).toBe('14px');
    expect(await style(brand, 'font-weight')).toBe('600');
    expect(await style(forClaude, 'color')).toBe(await computedColour(page, 'var(--text-muted)'));
    expect(await style(forClaude, 'font-size')).toBe('10px');
    const brandBox = await box(brand);
    const forBox = await box(forClaude);
    expect(forBox.x, '"for Claude" follows "Vexel"').toBeGreaterThan(brandBox.x + brandBox.width - 0.5);
    expect((await box(title)).y, 'the title row is below the top bar').toBeGreaterThanOrEqual((await box(topBar(page))).y + 48 - 0.5);
    expect(await title.evaluate((el) => getComputedStyle(el).marginTop + ' ' + getComputedStyle(el).marginBottom)).toBe('0px 0px');
  });

  // AppLayout rule: the list panel has no "Nuova sessione" or "Riprendi sessione" button
  test('the list panel holds no "Nuova sessione" or "Riprendi sessione" button and there is no complementary sidebar', async ({ page }) => {
    await page.goto('/');
    await expect(panel(page)).toBeVisible();
    for (const name of ['Nuova sessione', 'Riprendi sessione', 'Riprendi']) await expect(panel(page).getByRole('button', { name, exact: true })).toHaveCount(0);
    await expect(page.getByRole('complementary')).toHaveCount(0);
  });
});

test.describe('needs-input badge and chip', () => {
  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-9, REQ-11: both follow the number of sessions that need input and hide at zero
  test('the rail badge and the panel chip show the number of sessions that need input and hide at zero', async ({ page, request }) => {
    await showOnlyOwnSessions(page);
    const first = await startViaApi(request, await newFolder('count-one'));
    const second = await startViaApi(request, await newFolder('count-two'));
    await page.goto('/');
    await expect(entries(page)).toHaveCount(2);

    await expect(chip(page)).toHaveCount(0);
    await expect(badge(page)).toHaveCount(0);
    await expect(railButton(page, 'Sessioni')).toHaveText('Sessioni');
    await expect(panel(page).getByRole('status')).toHaveCount(1);

    await askPermission(request, first);
    await expect(chip(page)).toHaveText('1 richiede input');
    await expect(badge(page)).toHaveText('1');
    await askPermission(request, second);
    await expect(chip(page)).toHaveText('2 richiede input');
    await expect(badge(page)).toHaveText('2');
    await expect(railButton(page, 'Sessioni'), 'the badge does not change the accessible name').toHaveCount(1);

    await finishTurn(request, first);
    await expect(chip(page)).toHaveText('1 richiede input');
    await expect(badge(page)).toHaveText('1');
    await finishTurn(request, second);
    await expect(chip(page)).toHaveCount(0);
    await expect(badge(page)).toHaveCount(0);
    await expect(railButton(page, 'Sessioni')).toHaveText('Sessioni');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-20, REQ-21: the amber tinted pill with its dot, and the amber badge
  test('the chip is the amber tinted pill with its dot and the badge is amber-400 with canvas text', async ({ page, request }) => {
    await showOnlyOwnSessions(page);
    await askPermission(request, await startViaApi(request, await newFolder('colours')));
    await page.goto('/');
    await expect(chip(page)).toHaveText('1 richiede input');

    const pill = chip(page).locator(':scope > *').first();
    expect(await style(pill, 'background-color')).toBe('rgba(245, 158, 11, 0.15)');
    expect(await style(pill, 'color')).toBe('rgb(251, 191, 36)');
    await expect(pill.locator('svg')).toHaveCount(0);
    await expect(pill.locator('[aria-hidden="true"]')).toHaveCount(1);
    expect(await style(badge(page), 'background-color')).toBe('rgb(251, 191, 36)');
    expect(await style(badge(page), 'color')).toBe(await computedColour(page, 'var(--bg-canvas)'));
    await expect(badge(page)).toHaveAttribute('aria-hidden', 'true');
  });
});

test.describe('rail "Sessioni" moves the focus to the list', () => {
  // AppLayout "Actions": the open session's entry gets the focus
  test('with a session open, "Sessioni" focuses its entry and shows the focus ring', async ({ page, request }) => {
    await showOnlyOwnSessions(page);
    const other = await newFolder('focus-other');
    const opened = await newFolder('focus-open');
    await startViaApi(request, other);
    await startViaApi(request, opened);
    await page.goto('/');
    await openFromList(page, opened);

    await railButton(page, 'Sessioni').click();
    await expect(entry(page, opened)).toBeFocused();
    await expect.poll(() => focusedShowsRing(page), 'the focused entry shows the focus ring').toBe(true);
  });

  // AppLayout "Actions": no open session, the first enabled entry gets the focus
  test('with no session open, "Sessioni" focuses the first entry of the list', async ({ page, request }) => {
    await showOnlyOwnSessions(page);
    await startViaApi(request, await newFolder('first-a'));
    await startViaApi(request, await newFolder('first-b'));
    await page.goto('/');
    await expect(entries(page)).toHaveCount(2);

    await railButton(page, 'Sessioni').click();
    await expect(entries(page).first()).toBeFocused();
  });

  // AppLayout "Actions": Ctrl+Shift+L follows the same rule, the first entry when the open session has none
  test('Ctrl+Shift+L with no entry for the open session focuses the first entry of the list', async ({ page, request }) => {
    const events = await showOnlyOwnSessions(page);
    const opened = await newFolder('removed-open');
    const openedId = await startViaApi(request, opened);
    await startViaApi(request, await newFolder('still-listed'));
    await page.goto('/');
    await openFromList(page, opened);
    events().send(JSON.stringify({ type: 'session-removed', id: openedId }));
    await expect(entries(page)).toHaveCount(1);
    await page.locator('.xterm-screen').click();

    await page.keyboard.press('Control+Shift+L');

    await expect(entries(page).first()).toBeFocused();
  });

  // AppLayout "Actions": with no list entry the focus goes to "Nuova sessione" in the rail
  test('with an empty list, "Sessioni" focuses "Nuova sessione" in the rail', async ({ page }) => {
    await showOnlyOwnSessions(page);
    await page.goto('/');
    await expect(panel(page).getByText('Nessuna sessione.')).toBeVisible();

    await railButton(page, 'Sessioni').click();
    await expect(railButton(page, 'Nuova sessione')).toBeFocused();
  });
});

test.describe('needs-input snackbar', () => {
  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-9, REQ-11, REQ-13, REQ-14, REQ-15: scenario "The user opens a waiting session from the snackbar"
  test('a waiting session shows the snackbar, and "Apri" opens it and hides the snackbar', async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await showOnlyOwnSessions(page);
    const billing = await newFolder('billing-api');
    const dashboard = await newFolder('web-dashboard');
    await startViaApi(request, billing);
    const dashboardId = await startViaApi(request, dashboard);
    await page.goto('/');
    await openFromList(page, billing);
    await expect(snackbar(page)).toHaveCount(0);

    await askPermission(request, dashboardId);
    await expect(snackbar(page)).toHaveText(/^\s*web-dashboard richiede il tuo input\s*Apri\s*$/);
    await expect(snackbar(page).locator('b, strong').filter({ hasText: 'web-dashboard' })).toHaveCount(1);
    await expect(badge(page)).toHaveText('1');
    await expect(chip(page)).toHaveText('1 richiede input');

    await snackbar(page).getByRole('button', { name: 'Apri', exact: true }).click();
    await expect(terminal(page)).toContainText(`CWD:${dashboard}`);
    await expect(entry(page, dashboard)).toHaveAttribute('aria-current', 'true');
    await expect(snackbar(page)).toHaveCount(0);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-42; AppLayout "Shows": fixed at the bottom right of the window, above the content
  test('the snackbar sits 20 px from the bottom right of the window, above the open session', async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await showOnlyOwnSessions(page);
    const open = await newFolder('place-open');
    const waiting = await newFolder('place-waiting');
    await startViaApi(request, open);
    const waitingId = await startViaApi(request, waiting);
    await page.goto('/');
    await openFromList(page, open);
    await askPermission(request, waitingId);
    await expect(snackbar(page)).toBeVisible();

    const bar = await box(snackbar(page));
    expect(1440 - (bar.x + bar.width), 'gap to the right edge of the window').toBeCloseTo(20, 0);
    expect(900 - (bar.y + bar.height), 'gap to the bottom edge of the window').toBeCloseTo(20, 0);
    const onTop = await snackbar(page).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.left + 8, r.top + r.height / 2));
    });
    expect(onTop, 'nothing covers the snackbar').toBe(true);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-41, NeedsInputSnackbar "Shows": the glass toast
  test('the snackbar is the glass toast with mono text and the accent "Apri"', async ({ page, request }) => {
    await showOnlyOwnSessions(page);
    const waitingId = await startViaApi(request, await newFolder('look-waiting'));
    await page.goto('/');
    await expect(entries(page)).toHaveCount(1);
    await askPermission(request, waitingId);
    await expect(snackbar(page)).toBeVisible();

    expect(await style(snackbar(page), 'background-color')).toBe(await computedColour(page, 'var(--bg-glass)'));
    expect(await style(snackbar(page), 'color')).toBe(await computedColour(page, 'var(--text-primary)'));
    expect(await style(snackbar(page), 'border-radius')).toBe('8px');
    expect(await style(snackbar(page), 'font-size')).toBe('12px');
    expect(await style(snackbar(page), 'font-family')).toMatch(/^["']?Roboto Mono["']?/);
    await expect(snackbar(page).locator('b')).toHaveText('look-waiting');
    const open = snackbar(page).getByRole('button', { name: 'Apri', exact: true });
    expect(await style(open, 'color')).toBe(await computedColour(page, 'var(--accent-primary)'));
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-15: the snackbar hides when that session no longer needs input
  test('the snackbar disappears when that session no longer needs input', async ({ page, request }) => {
    await showOnlyOwnSessions(page);
    const waitingId = await startViaApi(request, await newFolder('stops-asking'));
    await page.goto('/');
    await expect(entries(page)).toHaveCount(1);
    await askPermission(request, waitingId);
    await expect(snackbar(page)).toHaveText(/stops-asking richiede il tuo input/);

    await finishTurn(request, waitingId);
    await expect(snackbar(page)).toHaveCount(0);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-15: the snackbar hides when the user opens that session from the list
  test('the snackbar disappears when the user opens that session from the list', async ({ page, request }) => {
    await showOnlyOwnSessions(page);
    const folder = await newFolder('opened-from-list');
    const waitingId = await startViaApi(request, folder);
    await page.goto('/');
    await expect(entries(page)).toHaveCount(1);
    await askPermission(request, waitingId);
    await expect(snackbar(page)).toBeVisible();

    await openFromList(page, folder);
    await expect(snackbar(page)).toHaveCount(0);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-13: only a session that is not open gives the snackbar
  test('the open session that starts to need input gives no snackbar', async ({ page, request }) => {
    await showOnlyOwnSessions(page);
    const folder = await newFolder('open-asks');
    const id = await startViaApi(request, folder);
    await page.goto('/');
    await openFromList(page, folder);

    await askPermission(request, id);
    await expect(chip(page)).toHaveText('1 richiede input');
    await expect(entry(page, folder)).toContainText('Richiede input');
    await expect(snackbar(page)).toHaveCount(0);
  });

  // NeedsInputSnackbar contract: sessions that already need input at the first list load give no snackbar
  test('a session that already needs input when the page loads gives no snackbar until it asks again', async ({ page, request }) => {
    await showOnlyOwnSessions(page);
    const id = await startViaApi(request, await newFolder('asked-before-load'));
    await askPermission(request, id);
    await page.goto('/');
    await expect(chip(page)).toHaveText('1 richiede input');
    await expect(snackbar(page)).toHaveCount(0);

    await finishTurn(request, id);
    await expect(chip(page)).toHaveCount(0);
    await askPermission(request, id);
    await expect(snackbar(page)).toHaveText(/asked-before-load richiede il tuo input/);
  });

  // NeedsInputSnackbar rule: one snackbar at a time, the newer session replaces the one shown
  test('a second session that starts to need input replaces the first one in a single snackbar', async ({ page, request }) => {
    await showOnlyOwnSessions(page);
    const firstId = await startViaApi(request, await newFolder('asks-first'));
    const secondId = await startViaApi(request, await newFolder('asks-second'));
    await page.goto('/');
    await expect(entries(page)).toHaveCount(2);

    await askPermission(request, firstId);
    await expect(snackbar(page)).toHaveText(/asks-first richiede il tuo input/);
    await askPermission(request, secondId);
    await expect(snackbar(page)).toHaveText(/asks-second richiede il tuo input/);
    await expect(snackbar(page)).toHaveCount(1);
    await expect(chip(page)).toHaveText('2 richiede input');
  });
});
