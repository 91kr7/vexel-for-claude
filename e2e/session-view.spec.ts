// e2e of plan-dark_blue_theme, batch session-view: the 44 px session header and the framed terminal.
/// <reference lib="dom" />
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { currentView, settled } from './motion';

// A route handler can still wait on the server when a test ends: its error then must not fail the test.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

type Theme = 'light' | 'dark';
type Box = { x: number; y: number; width: number; height: number };
const THEMES: Theme[] = ['dark', 'light'];
const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;
const GAP = 12;
const LONG_LINE = 'rendi la validazione del codice fiscale coerente in tutti i form di registrazione, pagamento, profilo e fatturazione elettronica';

let projectsRoot: string;
const createdIds: string[] = [];

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-session-view-'));
  await showOnlyOwnSessions(page);
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  await rm(projectsRoot, { recursive: true, force: true });
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const mainArea = (page: Page) => page.getByRole('main');
const header = (page: Page) => currentView(page).locator('.session-header');
const footer = (page: Page) => mainArea(page).locator('.session-footer');
const frame = (page: Page) => mainArea(page).getByRole('region', { name: /^Terminal/ });
const explorer = (page: Page) => mainArea(page).getByRole('region', { name: 'Git Explorer', exact: true });
const linePill = (page: Page) => header(page).locator('.mono-chip').first();
const terminal = (page: Page) => currentView(page).locator('.xterm-rows');
const terminalInput = (page: Page) => currentView(page).locator('.xterm-helper-textarea');

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
}

const near = (actual: number, expected: number, what: string, tolerance = 1) =>
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);

const style = (locator: Locator, property: string) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);

/** What the browser computes for a CSS value set on `property` of a probe element. */
const computed = (page: Page, property: string, value: string) =>
  page.evaluate(
    ([p, v]) => {
      const probe = document.createElement('div');
      probe.style.setProperty(p, v);
      document.body.append(probe);
      const result = getComputedStyle(probe).getPropertyValue(p);
      probe.remove();
      return result;
    },
    [property, value] as const,
  );
const colourOf = (page: Page, value: string) => computed(page, 'color', value);
const accentBorder = (page: Page) => colourOf(page, 'color-mix(in srgb, var(--role-accent) 75%, transparent)');
const accentRing = (page: Page) => colourOf(page, 'color-mix(in srgb, var(--role-accent) 22%, transparent)');

function luminance(colour: string): number {
  const [r = 0, g = 0, b = 0] = (colour.match(/[\d.]+/g) ?? []).slice(0, 3).map((value) => {
    const channel = Number(value) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Shows in the page only the sessions of the running test: other specs start sessions on the same server. */
async function showOnlyOwnSessions(page: Page): Promise<void> {
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
  await mkdir(folder);
  return folder;
}

/** A folder that is a git repository with one commit, so the header shows the Git Explorer button. */
async function newRepository(name: string): Promise<string> {
  const folder = await newFolder(name);
  await writeFile(path.join(folder, 'README.md'), '# test\n');
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: folder, stdio: 'ignore' });
  git('init', '-q');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  return folder;
}

async function postHook(request: APIRequestContext, id: string, event: Record<string, string>): Promise<void> {
  expect((await request.post(`/api/sessions/${id}/hook-events`, { data: event })).status()).toBe(204);
}

/** An idle hosted session whose header line is `line` (the last prompt). */
async function idleSession(request: APIRequestContext, folder: string, line: string): Promise<void> {
  const started = await request.post('/api/sessions', { data: { path: folder } });
  expect(started.status()).toBe(201);
  const { id } = (await started.json()) as { id: string };
  createdIds.push(id);
  await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt: line });
  await postHook(request, id, { hook_event_name: 'Stop' });
}

async function openIn(page: Page, theme: Theme, folder: string): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem('ai-client.theme', t), theme);
  await page.goto('/');
  await list(page).getByTitle(folder, { exact: true }).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
  await page.mouse.move(0, 0);
}

async function focusTerminal(page: Page): Promise<void> {
  await page.locator('.xterm-screen').click();
  await expect(terminalInput(page)).toBeFocused();
}

/** Moves the keyboard focus out of the frame (opening a session focuses the terminal). */
async function blurFrame(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(terminalInput(page)).not.toBeFocused();
}

async function frameLook(page: Page) {
  return frame(page).evaluate((el) => {
    const s = getComputedStyle(el);
    return { borders: [s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor], shadow: s.boxShadow };
  });
}

/** The border box of the frame grown by its focus ring (outline, or an unblurred box-shadow spread). */
async function ringBox(page: Page): Promise<Box> {
  const b = await box(frame(page));
  const reach = await frame(page).evaluate((el) => {
    const s = getComputedStyle(el);
    const outline = s.outlineStyle === 'none' ? 0 : parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset);
    const layers = s.boxShadow === 'none' ? [] : s.boxShadow.split(/,(?![^(]*\))/).map((layer) => layer.replace(/(rgba?|color|oklab|oklch)\([^)]*\)/, '').trim());
    const rings = layers
      .filter((layer) => !layer.includes('inset'))
      .map((layer) => layer.split(/\s+/).map(parseFloat))
      .filter(([x = 0, y = 0, blur = 0]) => x === 0 && y === 0 && blur === 0)
      .map(([, , , spread = 0]) => spread);
    return Math.max(outline, 0, ...rings);
  });
  expect(reach, 'the focused frame draws a ring').toBeGreaterThan(0);
  return { x: b.x - reach, y: b.y - reach, width: b.width + 2 * reach, height: b.height + 2 * reach };
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    // plan-dark_blue_theme/REQ-1, REQ-2, REQ-25 — scenario "the open session shows the mock's header and terminal frame"
    test('the session header is 44 px on its role surface, with the name and the line in a mono pill', async ({ page, request }) => {
      const folder = await newFolder('billing-api');
      await idleSession(request, folder, 'aggiungi la validazione IBAN');
      await openIn(page, theme, folder);
      const head = header(page);

      near((await box(head)).height, 44, 'header height, bottom line included');
      expect(await style(head, 'background-color')).toBe(await colourOf(page, 'var(--role-chrome)'));
      expect(await style(head, 'border-bottom-width')).toBe('1px');
      expect(await style(head, 'border-bottom-style')).toBe('solid');
      expect(await style(head, 'border-bottom-color')).toBe(await colourOf(page, 'var(--role-border-subtle)'));
      expect([await style(head, 'padding-left'), await style(head, 'padding-right')]).toEqual(['16px', '16px']);

      const name = head.getByRole('heading', { level: 2 });
      await expect(name).toHaveText('billing-api');
      expect(await style(name, 'font-size')).toBe('13.5px');
      expect(await style(name, 'line-height')).toBe('18px');
      expect(await style(name, 'font-weight')).toBe('600');
      near(parseFloat(await style(name, 'letter-spacing')), -0.015 * 13.5, 'name letter spacing', 0.01);

      const pill = linePill(page);
      await expect(pill).toContainText('aggiungi la validazione IBAN');
      expect(await style(pill, 'font-family')).toMatch(/Roboto Mono/);
      expect(await style(pill, 'font-size')).toBe('11px');
      expect(await style(pill, 'line-height')).toBe('16px');
      expect(await pill.evaluate((el) => {
        const s = getComputedStyle(el);
        return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft];
      })).toEqual(['2px', '10px', '2px', '10px']);
      expect(await style(pill, 'color')).toBe(await colourOf(page, 'var(--text-secondary)'));
      const nameBox = await box(name);
      const pillBox = await box(pill);
      expect(pillBox.x, 'the pill follows the name').toBeGreaterThan(nameBox.x + nameBox.width - 1);
    });

    // plan-dark_blue_theme/REQ-1, REQ-2, REQ-26
    test('the terminal sits in a frame with a 12 px gap, a 1 px border, 8 px corners and a shadow', async ({ page, request }) => {
      const folder = await newFolder('frame');
      await idleSession(request, folder, 'frame');
      await openIn(page, theme, folder);
      const panel = frame(page);
      await blurFrame(page);

      const main = await box(mainArea(page));
      const head = await box(header(page));
      const panelBox = await box(panel);
      const foot = await box(footer(page));
      near(panelBox.y - (head.y + head.height), GAP, 'gap above the frame');
      near(panelBox.x - main.x, GAP, 'gap left of the frame');
      near(main.x + main.width - (panelBox.x + panelBox.width), GAP, 'gap right of the frame');
      near(foot.y - (panelBox.y + panelBox.height), GAP, 'gap below the frame');

      const strong = await colourOf(page, 'var(--role-border-strong)');
      await expect.poll(() => style(panel, 'border-top-color'), 'the frame leaves its focus look').toBe(strong);
      for (const side of SIDES) {
        expect(await style(panel, `border-${side}-width`), `${side} border width`).toBe('1px');
        expect(await style(panel, `border-${side}-style`), `${side} border style`).toBe('solid');
        expect(await style(panel, `border-${side}-color`), `${side} border colour`).toBe(strong);
      }
      for (const corner of CORNERS) expect(await style(panel, `border-${corner}-radius`), `${corner} corner`).toBe('8px');
      const shadow = await style(panel, 'box-shadow');
      expect(shadow).not.toBe('none');
      expect(shadow).toBe(await computed(page, 'box-shadow', 'var(--shadow-frame)'));
    });

    // plan-dark_blue_theme/REQ-27, REQ-28 — scenario "the open session shows the mock's header and terminal frame"
    test('the focused terminal frame shows an accent border and an accent ring that touches neither the header nor the footer', async ({ page, request }) => {
      const folder = await newFolder('focus');
      await idleSession(request, folder, 'focus');
      await openIn(page, theme, folder);
      const strong = await colourOf(page, 'var(--role-border-strong)');
      const border = await accentBorder(page);
      const ring = await accentRing(page);

      await blurFrame(page);
      await expect.poll(async () => (await frameLook(page)).borders).toEqual([strong, strong, strong, strong]);
      expect((await frameLook(page)).shadow).not.toContain(ring);

      await focusTerminal(page);
      await expect.poll(async () => (await frameLook(page)).borders).toEqual([border, border, border, border]);
      await expect.poll(async () => (await frameLook(page)).shadow).toContain(`${ring} 0px 0px 0px 1px`);

      const ringed = await ringBox(page);
      expect(overlaps(ringed, await box(header(page))), 'ring vs header').toBe(false);
      expect(overlaps(ringed, await box(footer(page))), 'ring vs footer').toBe(false);
      const main = await box(mainArea(page));
      expect(ringed.x, 'ring inside the left gap').toBeGreaterThan(main.x);
      expect(ringed.x + ringed.width, 'ring inside the right gap').toBeLessThan(main.x + main.width);

      // Focus elsewhere: the frame goes back to its plain border, without the ring.
      await page.keyboard.press('Control+Shift+L');
      await expect(terminalInput(page)).not.toBeFocused();
      await expect.poll(async () => (await frameLook(page)).borders).toEqual([strong, strong, strong, strong]);
      await expect.poll(async () => (await frameLook(page)).shadow).not.toContain(ring);
    });
  });
}

// plan-dark_blue_theme/REQ-27: the search box inside the frame also lights the frame up
test('the frame shows the accent border and ring while its search box has the focus', async ({ page, request }) => {
  const folder = await newFolder('search-focus');
  await idleSession(request, folder, 'search');
  await openIn(page, 'dark', folder);
  await focusTerminal(page);
  await page.keyboard.press('Control+Shift+F');
  await expect(page.getByRole('search', { name: 'Terminal search' }).getByRole('textbox')).toBeFocused();
  const border = await accentBorder(page);
  const ring = await accentRing(page);
  await expect.poll(async () => (await frameLook(page)).borders).toEqual([border, border, border, border]);
  await expect.poll(async () => (await frameLook(page)).shadow).toContain(`${ring} 0px 0px 0px 1px`);
});

// plan-dark_blue_theme/REQ-25: a long line is cut with "…" inside a pill of at most 420 px
test('a long line is cut with an ellipsis in a pill at most 420 px wide', async ({ page, request }) => {
  const folder = await newFolder('long-line');
  await idleSession(request, folder, LONG_LINE);
  await openIn(page, 'dark', folder);
  const pill = linePill(page);
  await expect(pill).toContainText(LONG_LINE.slice(0, 20));

  expect((await box(pill)).width, 'pill width').toBeLessThanOrEqual(420.5);
  const cut = await pill.evaluate((el) =>
    [el, ...el.querySelectorAll('*')].some((node) => {
      const s = getComputedStyle(node);
      return s.textOverflow === 'ellipsis' && s.whiteSpace === 'nowrap' && s.overflowX === 'hidden' && node.scrollWidth > node.clientWidth;
    }),
  );
  expect(cut, 'the line text overflows into an ellipsis').toBe(true);
  near((await box(header(page))).height, 44, 'header height with a long line');
});

// plan-dark_blue_theme/REQ-26, REQ-28: the git explorer sits past the frame's 12 px gap, and the ring does not reach it
test('with the git explorer open, it sits right of the frame past the 12 px gap, and the ring does not reach it', async ({ page, request }) => {
  const folder = await newRepository('repo');
  await idleSession(request, folder, 'git');
  await openIn(page, 'dark', folder);
  await header(page).getByRole('button', { name: 'Git Explorer', exact: true }).click();
  await expect(explorer(page)).toBeVisible();
  // The frame shrinks while the panel slides in (plan-ui_transitions/REQ-5): both are measured at rest.
  await settled(explorer(page));

  const panelBox = await box(frame(page));
  const gitBox = await box(explorer(page));
  near(gitBox.x - (panelBox.x + panelBox.width), GAP, 'gap between the frame and the git explorer');
  expect(gitBox.y < panelBox.y + panelBox.height && panelBox.y < gitBox.y + gitBox.height, 'git explorer on the same row as the frame').toBe(true);
  const head = await box(header(page));
  const main = await box(mainArea(page));
  near(panelBox.y - (head.y + head.height), GAP, 'gap above the frame');
  near(panelBox.x - main.x, GAP, 'gap left of the frame');

  await focusTerminal(page);
  await expect.poll(async () => (await frameLook(page)).shadow).toContain(`${await accentRing(page)} 0px 0px 0px 1px`);
  expect(overlaps(await ringBox(page), gitBox), 'ring vs git explorer').toBe(false);
});

// plan-dark_blue_theme/REQ-26, REQ-28: nothing of the frame paints over the header, the footer or the git explorer
test('the focused frame and its shadow paint nothing over the header, the footer or the git explorer', async ({ page, request }) => {
  const folder = await newRepository('paint');
  await idleSession(request, folder, 'paint');
  await openIn(page, 'dark', folder);
  await header(page).getByRole('button', { name: 'Git Explorer', exact: true }).click();
  await expect(explorer(page)).toBeVisible();
  await focusTerminal(page);
  await expect.poll(async () => (await frameLook(page)).shadow).toContain(`${await accentRing(page)} 0px 0px 0px 1px`);
  await page.mouse.move(0, 0);

  const head = await box(header(page));
  const foot = await box(footer(page));
  const gitBox = await box(explorer(page));
  // Strips next to the frame: the bottom of the header, the top of the footer and the left edge of the git explorer.
  const strips = [
    { what: 'header', clip: { x: head.x, y: head.y + head.height - 6, width: head.width, height: 6 } },
    { what: 'footer', clip: { x: foot.x, y: foot.y, width: foot.width, height: 8 } },
    { what: 'git explorer', clip: { x: gitBox.x, y: gitBox.y + 40, width: 8, height: gitBox.height - 80 } },
  ];
  const withFrame = await Promise.all(strips.map(({ clip }) => page.screenshot({ clip, animations: 'disabled', caret: 'hide' })));
  await page.addStyleTag({ content: '.session-terminal-panel, .session-terminal-panel:focus-within { box-shadow: none !important; border-color: transparent !important; }' });
  const without = await Promise.all(strips.map(({ clip }) => page.screenshot({ clip, animations: 'disabled', caret: 'hide' })));
  for (const [n, { what }] of strips.entries()) expect(withFrame[n]!.equals(without[n]!), `the frame paints over the ${what}`).toBe(true);
});

// plan-cool_slate_light/REQ-17, REQ-18 (they replace plan-dark_blue_theme/REQ-29): the terminal is light in Light
test('in the Light theme the terminal is light inside its frame', async ({ page, request }) => {
  const folder = await newFolder('light-terminal');
  await idleSession(request, folder, 'light');
  await openIn(page, 'light', folder);

  const termBg = await colourOf(page, 'var(--term-bg)');
  expect(await style(frame(page), 'background-color')).toBe(termBg);
  expect(termBg, 'terminal background is the table B white').toBe('rgb(255, 255, 255)');
  expect(await style(terminal(page), 'color'), 'terminal text is the table B dark slate').toBe('rgb(30, 41, 59)');
  // The page around the frame is light.
  expect(luminance(await style(header(page), 'background-color')), 'header is light').toBeGreaterThan(0.5);
});
