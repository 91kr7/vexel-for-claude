// e2e of plan-cool_slate_light, batch light-terminal. Expected values come from table B of the plan requirements, the warning
// tones of table A, the specs ThemeTokens, SessionView and ConversationView, and the batch scenarios.
// The fake CLI prints `ANSI<n>` in the 16 ANSI colours, then PALE and BAND in fixed 24-bit colours, on the line COLOURS.
/// <reference lib="dom" />
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, type WebSocketRoute, expect, test } from '@playwright/test';
import { currentView, pageSettled } from './motion';
import { type SettingsChoice, chooseInSettings } from './settings';

type Rgba = [number, number, number, number];

const WHITE = 'rgb(255, 255, 255)';
// Table B.
const TABLE_B = {
  background: WHITE,
  frame: 'rgba(15, 23, 42, 0.14)',
  text: 'rgb(30, 41, 59)',
  cursor: 'rgb(37, 99, 235)',
  divider: 'rgba(15, 23, 42, 0.1)',
};
// ANSI colours fixed by table B: black = strong text, bright black = muted text, green, yellow, blue.
const TABLE_B_ANSI: Record<number, string> = { 0: '#0f172a', 2: '#15803d', 3: '#b45309', 4: '#1d4ed8', 8: '#64748b' };
// Warning tones of table A for the search highlights (batch INT-3).
const SEARCH = { match: 'rgb(254, 243, 199)', current: 'rgb(252, 211, 77)', border: 'rgb(180, 83, 9)' };
// The terminal of Dark and Dark Blue as before this plan (ThemeTokens dark set and Dark Blue set).
const DARK_TERM = { '--term-bg': 'rgb(11, 11, 14)', '--term-fg': 'rgb(243, 242, 238)', '--term-cursor': 'rgb(140, 207, 255)' };
const DARK_BLUE_TERM_BG = 'rgb(17, 20, 28)';
// The xterm.js default ANSI palette, which Dark and Dark Blue keep.
const XTERM_DEFAULT_ANSI = [
  '#2e3436', '#cc0000', '#4e9a06', '#c4a000', '#3465a4', '#75507b', '#06989a', '#d3d7cf',
  '#555753', '#ef2929', '#8ae234', '#fce94f', '#729fcf', '#ad7fa8', '#34e2e2', '#eeeeec',
];
const ANSI_NAMES = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
const ansiToken = (n: number) => `--term-ansi-${n < 8 ? '' : 'bright-'}${ANSI_NAMES[n % 8]}`;
// The fixed colours of the fake CLI's PALE and BAND rows.
const PALE = 'rgb(250, 250, 210)';
const BAND = { fg: 'rgb(203, 213, 225)', bg: 'rgb(241, 245, 249)' };

let projectsRoot: string;
const createdIds: string[] = [];

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-light-terminal-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  await rm(projectsRoot, { recursive: true, force: true });
});

const panel = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => panel(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const frame = (page: Page) => page.getByRole('main').getByRole('region', { name: /^Terminal/ });
const terminal = (page: Page) => currentView(page).locator('.xterm-rows');
const html = (page: Page) => page.locator('html');
const style = (target: Locator, property: string) => target.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);
/** The first opaque background from the element up: what the user sees behind it. */
const effectiveBackground = (target: Locator) =>
  target.evaluate((el) => {
    for (let node: Element | null = el; node; node = node.parentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
    }
    return getComputedStyle(document.documentElement).backgroundColor;
  });
const screenBackground = (page: Page) => effectiveBackground(currentView(page).locator('.xterm-screen'));
const token = (page: Page, name: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

/** Shows in the page only the sessions of this test, plus the given external entries; returns the external conversation socket. */
async function showOnly(page: Page, externals: object[] = []): Promise<() => Promise<WebSocketRoute>> {
  const own = (session: { folder?: unknown } | undefined) => typeof session?.folder === 'string' && session.folder.startsWith(projectsRoot + path.sep);
  await page.route(
    (url) => url.pathname === '/api/sessions',
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      await route.fulfill({ response, json: [...((await response.json()) as { folder?: unknown }[]).filter(own), ...externals] });
    },
  );
  await page.routeWebSocket(/\/api\/sessions\/events$/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((message) => {
      const event = JSON.parse(String(message)) as { type?: string; session?: { folder?: unknown } };
      if (event.type !== 'session' || own(event.session)) ws.send(message);
    });
  });
  let socket: WebSocketRoute | undefined;
  await page.routeWebSocket(/\/api\/external-sessions\/[^/]+\/conversation$/, (ws) => {
    socket = ws;
  });
  return async () => {
    await expect.poll(() => socket !== undefined, { message: 'conversation socket connected' }).toBe(true);
    return socket!;
  };
}

async function startViaApi(request: APIRequestContext, name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder, { recursive: true });
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  createdIds.push(((await response.json()) as { id: string }).id);
  return folder;
}

async function choose(page: Page, choice: SettingsChoice, mark: string): Promise<void> {
  await chooseInSettings(page, choice);
  await expect(html(page)).toHaveAttribute('data-theme', mark);
  await pageSettled(page);
}

/** Records every WebSocket the page opens or closes. */
async function logSockets(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const log: string[] = [];
    (window as unknown as { socketLog: string[] }).socketLog = log;
    const Native = window.WebSocket;
    window.WebSocket = class extends Native {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        log.push(`open ${String(url)}`);
        this.addEventListener('close', () => log.push(`close ${String(url)}`));
      }
    };
  });
  return () => page.evaluate(() => [...(window as unknown as { socketLog: string[] }).socketLog]);
}

/** Opens a hosted session in the given theme and has the fake CLI print its coloured rows. */
async function colouredSession(page: Page, request: APIRequestContext, choice: SettingsChoice | null, mark: string): Promise<string> {
  await showOnly(page);
  const folder = await startViaApi(request, 'colours');
  await page.goto('/');
  if (choice) await choose(page, choice, mark);
  await entry(page, folder).getByTitle(folder, { exact: true }).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
  await page.locator('.xterm-screen').click();
  await page.keyboard.type('COLOURS');
  await page.keyboard.press('Enter');
  await expect(terminal(page)).toContainText('COLOURS-DONE');
  return folder;
}

/** The computed `rgb()` form of a CSS colour value or `var()`. */
async function colour(page: Page, cssValue: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement('div');
    probe.style.color = value;
    document.body.append(probe);
    const result = getComputedStyle(probe).color;
    probe.remove();
    return result;
  }, cssValue);
}

function parse(value: string): Rgba {
  const hex = value.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (hex) return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(1) as Rgba;
  const m = value.match(/rgba?\(([^)]+)\)/);
  expect(m, `colour ${value}`).not.toBeNull();
  const [r, g, b, a = '1'] = m![1]!.split(/[ ,/]+/).filter(Boolean);
  return [Number(r), Number(g), Number(b), Number(a)];
}

const sameColour = (a: string, b: string) => parse(a).every((c, i) => Math.abs(c - parse(b)[i]!) <= (i === 3 ? 0.01 : 1));

function over([r, g, b, a]: Rgba, [br, bg, bb]: Rgba): Rgba {
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];
}

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(parse(a)), luminance(parse(b))].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

function hsl([r, g, b]: Rgba): [number, number, number] {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === rr ? ((gg - bb) / d) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

/** The ANSI colours of the xterm theme: its `.xterm-fg-N` rules for indexes 0–15. */
const ansiRules = (page: Page) =>
  page.evaluate(() => {
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n');
    const colours: string[] = [];
    for (const m of css.matchAll(/\.xterm-fg-(\d+)\s*\{\s*color:\s*([^;}\s]+)/g)) if (Number(m[1]) < 16) colours[Number(m[1])] = m[2]!.toLowerCase();
    return colours;
  });

/** The xterm style rules about the cursor. */
const cursorRules = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('style')]
      .map((s) => s.textContent ?? '')
      .join('\n')
      .match(/[^}]*xterm-cursor[^{]*\{[^}]*\}/g)
      ?.join('\n')
      .toLowerCase() ?? '',
  );

type Run = { text: string; color: string; background: string };

/** Every visible span of the terminal rows with its text colour and the background it is drawn on. */
const runs = (page: Page, termBg: string): Promise<Run[]> =>
  terminal(page).evaluate(
    (element, fallback) =>
      [...element.querySelectorAll('span')]
        .filter((span) => (span.textContent ?? '').trim() !== '')
        .map((span) => {
          const s = getComputedStyle(span);
          const transparent = /^rgba\(.*, 0\)$|^transparent$/.test(s.backgroundColor);
          return { text: span.textContent ?? '', color: s.color, background: transparent ? fallback : s.backgroundColor };
        }),
    termBg,
  );

const runOf = async (page: Page, text: string, termBg: string): Promise<Run> => {
  const found = (await runs(page, termBg)).find((run) => run.text.trim() === text);
  expect(found, `the terminal shows ${text}`).toBeDefined();
  return found!;
};

// ---------------------------------------------------------------------------------------------------------------------
test.describe('Light terminal tokens', () => {
  // plan-cool_slate_light/REQ-17, REQ-18, REQ-20: background, frame, text, cursor of table B; text readable on the selection
  test('the Light terminal tokens take table B, and the text reaches 4.5:1 on the selection', async ({ page }) => {
    await page.goto('/');
    await choose(page, 'Light', 'light');
    expect(await colour(page, 'var(--term-bg)')).toBe(TABLE_B.background);
    expect(sameColour(await colour(page, 'var(--term-frame)'), TABLE_B.frame), 'frame').toBe(true);
    expect(await colour(page, 'var(--term-fg)')).toBe(TABLE_B.text);
    expect(await colour(page, 'var(--term-cursor)')).toBe(TABLE_B.cursor);
    const selection = over(parse(await colour(page, 'var(--term-selection)')), parse(TABLE_B.background));
    expect(contrast(TABLE_B.text, `rgb(${selection.slice(0, 3).join(', ')})`), 'text on the selection').toBeGreaterThanOrEqual(4.5);
  });

  // plan-cool_slate_light/REQ-18, REQ-19: the 16 ANSI tokens; the table B ones exact, all at 4.5:1 on white, white and bright white slate grey
  test('the Light ANSI tokens take table B where it gives them, and every one reaches 4.5:1 on the terminal background', async ({ page }) => {
    await page.goto('/');
    await choose(page, 'Light', 'light');
    for (let n = 0; n < 16; n++) {
      const value = await colour(page, `var(${ansiToken(n)})`);
      expect(await token(page, ansiToken(n)), `${ansiToken(n)} is set`).not.toBe('');
      if (TABLE_B_ANSI[n]) expect(sameColour(value, TABLE_B_ANSI[n]), `${ansiToken(n)} = ${TABLE_B_ANSI[n]}`).toBe(true);
      expect(contrast(value, TABLE_B.background), `${ansiToken(n)} ${value} on white`).toBeGreaterThanOrEqual(4.5);
    }
    // Gatekeeper decision on REQ-19: white and bright white are mid-grey slate tones.
    for (const n of [7, 15]) {
      const [hue, saturation] = hsl(parse(await colour(page, `var(${ansiToken(n)})`)));
      expect(hue, `${ansiToken(n)} hue is slate`).toBeGreaterThanOrEqual(200);
      expect(hue, `${ansiToken(n)} hue is slate`).toBeLessThanOrEqual(230);
      expect(saturation, `${ansiToken(n)} is a grey`).toBeLessThan(0.3);
    }
  });

  // plan-cool_slate_light/REQ-11, REQ-14: search highlights from the warning tones; text 4.5:1 on both, border 3:1 on the background
  test('the Light search highlights take the warning tones of table A and stay readable', async ({ page }) => {
    await page.goto('/');
    await choose(page, 'Light', 'light');
    const [match, current, border] = await Promise.all(['--term-match-bg', '--term-match-current-bg', '--term-match-current-border'].map((n) => colour(page, `var(${n})`)));
    expect(match).toBe(SEARCH.match);
    expect(current).toBe(SEARCH.current);
    expect(border).toBe(SEARCH.border);
    expect(contrast(TABLE_B.text, match)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(TABLE_B.text, current)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(border, TABLE_B.background)).toBeGreaterThanOrEqual(3);
  });

  // plan-cool_slate_light/REQ-24, REQ-13: Dark and Dark Blue keep their terminal tokens and set no ANSI token
  test('Dark and Dark Blue keep their terminal and tool output tokens and set no ANSI token', async ({ page }) => {
    await page.goto('/');
    for (const [choice, mark, termBg] of [['Dark', 'dark', DARK_TERM['--term-bg']], ['Dark Blue', 'dark-blue', DARK_BLUE_TERM_BG]] as const) {
      await choose(page, choice, mark);
      expect(await colour(page, 'var(--term-bg)'), `${choice} background`).toBe(termBg);
      expect(await colour(page, 'var(--term-fg)'), `${choice} text`).toBe(DARK_TERM['--term-fg']);
      expect(await colour(page, 'var(--term-cursor)'), `${choice} cursor`).toBe(DARK_TERM['--term-cursor']);
      expect(sameColour(await colour(page, 'var(--term-selection)'), 'rgba(140, 207, 255, 0.3)'), `${choice} selection`).toBe(true);
      expect(await colour(page, 'var(--term-match-bg)'), `${choice} match`).toBe('rgb(113, 63, 18)');
      expect(await colour(page, 'var(--term-match-current-bg)'), `${choice} current match`).toBe('rgb(146, 64, 14)');
      expect(await colour(page, 'var(--term-match-current-border)'), `${choice} current border`).toBe('rgb(252, 211, 77)');
      for (let n = 0; n < 16; n++) expect(await token(page, ansiToken(n)), `${choice} ${ansiToken(n)}`).toBe('');
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('Light hosted terminal', () => {
  // plan-cool_slate_light/REQ-17, REQ-18, REQ-19 — scenario "the hosted terminal turns light"
  test('in Light the open terminal is white in its frame, with dark slate text, a blue cursor and the ANSI tokens as its colours', async ({ page, request }) => {
    await colouredSession(page, request, 'Light', 'light');
    expect(await style(frame(page), 'background-color')).toBe(TABLE_B.background);
    // At rest: with the keyboard focus the frame shows the accent border instead.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.mouse.move(0, 0);
    await expect.poll(() => style(frame(page), 'border-top-color'), { message: 'frame border' }).toBe(TABLE_B.frame);
    expect(await screenBackground(page)).toBe(TABLE_B.background);
    expect(await style(terminal(page), 'color')).toBe(TABLE_B.text);
    expect(await cursorRules(page), 'the cursor is the table B blue').toMatch(/#2563eb|rgb\(37,\s*99,\s*235\)/);

    const rules = await ansiRules(page);
    for (let n = 0; n < 16; n++) {
      const expected = await colour(page, `var(${ansiToken(n)})`);
      expect(sameColour(rules[n] ?? 'none', expected), `xterm ANSI ${n} = ${ansiToken(n)}`).toBe(true);
      // Each ANSI row shows in its token colour: the token already reaches 4.5:1, so nothing lifts it.
      expect(sameColour((await runOf(page, `ANSI${n}`, TABLE_B.background)).color, expected), `ANSI${n} drawn in ${expected}`).toBe(true);
    }
  });

  // plan-cool_slate_light/REQ-25 — scenario "the hosted terminal turns light", last step
  test('in Light the text Claude Code draws in its own pale colours, on a band too, reaches 4.5:1', async ({ page, request }) => {
    await colouredSession(page, request, 'Light', 'light');
    const pale = await runOf(page, 'PALE', TABLE_B.background);
    expect(contrast(pale.color, pale.background), `PALE ${pale.color} on ${pale.background}`).toBeGreaterThanOrEqual(4.5);
    const band = await runOf(page, 'BAND', TABLE_B.background);
    expect(band.background, 'the band keeps its own background').toBe(BAND.bg);
    expect(contrast(band.color, band.background), `BAND ${band.color} on ${band.background}`).toBeGreaterThanOrEqual(4.5);
    for (const run of await runs(page, TABLE_B.background)) {
      expect(contrast(run.color, run.background), `"${run.text}" ${run.color} on ${run.background}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  // plan-cool_slate_light/REQ-20, REQ-14 — scenario "selected text and search matches stay readable"
  test('in Light the selected text and every search match stay readable on the light terminal', async ({ page, request }) => {
    await colouredSession(page, request, 'Light', 'light');
    const rows = terminal(page).locator(':scope > div');
    const first = rows.filter({ hasText: /^ANSI0\s*$/ });
    const last = rows.filter({ hasText: /^BAND\s*$/ });
    const from = (await first.boundingBox())!;
    const to = (await last.boundingBox())!;
    await page.mouse.move(from.x + 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + 60, to.y + to.height / 2, { steps: 8 });
    await page.mouse.up();
    const selectionBg = await page.locator('.xterm-selection div').first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(selectionBg, 'a selection is drawn').not.toBe('rgba(0, 0, 0, 0)');
    const selected = (await runs(page, TABLE_B.background)).filter((run) => /^(ANSI\d+|PALE|BAND)$/.test(run.text.trim()));
    expect(selected).toHaveLength(18);
    for (const run of selected) {
      expect(contrast(run.color, selectionBg), `selected "${run.text}" ${run.color} on ${selectionBg}`).toBeGreaterThanOrEqual(4.5);
    }

    await currentView(page).locator('header').getByRole('button', { name: 'Search', exact: true }).click();
    const search = page.getByRole('search', { name: 'Terminal search' });
    await page.keyboard.type('ANSI1');
    await expect(search.getByRole('status')).toHaveText(/ of 7$/);
    await expect.poll(async () => (await runs(page, TABLE_B.background)).filter((run) => [SEARCH.match].includes(run.background)).length).toBeGreaterThan(0);
    const highlighted = (await runs(page, TABLE_B.background)).filter((run) => run.background !== TABLE_B.background);
    expect(highlighted.map((run) => run.background), 'matches on the match tone').toContain(SEARCH.match);
    for (const run of highlighted) {
      expect(contrast(run.color, run.background), `highlighted "${run.text}" ${run.color} on ${run.background}`).toBeGreaterThanOrEqual(4.5);
    }
    const outlines = await page.evaluate(() =>
      [...document.querySelectorAll('.xterm-decoration')]
        .map((element) => getComputedStyle(element))
        .filter((s) => s.display !== 'none' && s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0)
        .map((s) => `${s.outlineWidth} ${s.outlineColor}`),
    );
    expect(outlines, 'the current match outline').toEqual([`1px ${SEARCH.border}`]);
  });

  // plan-cool_slate_light/REQ-24, REQ-13, REQ-25, SessionView theme change — scenario "Dark and Dark Blue keep the dark terminal"
  test('switching from Light to Dark, then Dark Blue, gives back the dark terminal, the xterm.js colours and the written colours at once, with no reconnection', async ({ page, request }) => {
    const sockets = await logSockets(page);
    await colouredSession(page, request, 'Light', 'light');
    expect(await screenBackground(page)).toBe(TABLE_B.background);
    const before = await sockets();

    for (const [choice, mark, termBg] of [['Dark', 'dark', DARK_TERM['--term-bg']], ['Dark Blue', 'dark-blue', DARK_BLUE_TERM_BG]] as const) {
      await choose(page, choice, mark);
      await expect.poll(() => screenBackground(page), { message: `${choice} background` }).toBe(termBg);
      expect(await style(terminal(page), 'color'), `${choice} text`).toBe(DARK_TERM['--term-fg']);
      expect(await cursorRules(page), `${choice} cursor`).toMatch(/#8ccfff|rgb\(140,\s*207,\s*255\)/);
      expect(await ansiRules(page), `${choice} keeps the xterm.js ANSI defaults`).toEqual(XTERM_DEFAULT_ANSI);
      // No minimum contrast outside Light: the fixed colours stay as written.
      expect((await runOf(page, 'PALE', termBg)).color, `${choice} PALE as written`).toBe(PALE);
      const band = await runOf(page, 'BAND', termBg);
      expect([band.color, band.background], `${choice} BAND as written`).toEqual([BAND.fg, BAND.bg]);
      for (let n = 0; n < 16; n++) expect(sameColour((await runOf(page, `ANSI${n}`, termBg)).color, XTERM_DEFAULT_ANSI[n]!), `${choice} ANSI${n}`).toBe(true);
    }

    await choose(page, 'Light', 'light');
    await expect.poll(() => screenBackground(page)).toBe(TABLE_B.background);
    const pale = await runOf(page, 'PALE', TABLE_B.background);
    expect(contrast(pale.color, TABLE_B.background), 'back in Light the pale text is lifted again').toBeGreaterThanOrEqual(4.5);
    expect(sameColour((await runOf(page, 'ANSI2', TABLE_B.background)).color, TABLE_B_ANSI[2]!), 'back in Light green is table B').toBe(true);

    await expect(terminal(page)).toContainText('ANSI0');
    await expect(terminal(page)).not.toContainText('[Session disconnected]');
    expect(await sockets(), 'no connection opened or closed').toEqual(before);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('tool output of external sessions', () => {
  const external = (folder: string) => ({ id: 'ext-light-terminal', folder, label: 'Light tool output', state: 'idle', lastActivity: new Date().toISOString(), external: true });

  async function openToolCard(page: Page): Promise<Locator> {
    const folder = path.join(projectsRoot, 'external');
    const connection = await showOnly(page, [external(folder)]);
    await page.goto('/');
    await entry(page, folder).getByTitle(folder, { exact: true }).click();
    (await connection()).send(
      JSON.stringify({
        type: 'items',
        items: [
          { kind: 'tool_call', name: 'Bash', summary: 'npm test', id: 'tool-1' },
          { kind: 'tool_result', text: 'Tests: 12 passed', truncated: false, toolUseId: 'tool-1' },
        ],
      }),
    );
    const card = page.locator('.conversation-view').getByRole('article', { name: 'Tool: Bash', exact: true });
    await card.getByRole('button').first().click();
    const output = card.locator('pre');
    await expect(output).toHaveText('Tests: 12 passed');
    return output;
  }

  // plan-cool_slate_light/REQ-21, REQ-22, REQ-14 — scenario "the tool output of an external session is light"
  test('in Light the open tool output shows on white, in dark slate text, under the table B divider', async ({ page }) => {
    await page.goto('/');
    await choose(page, 'Light', 'light');
    const output = await openToolCard(page);
    expect(await style(output, 'background-color')).toBe(TABLE_B.background);
    expect(await style(output, 'color')).toBe(TABLE_B.text);
    expect(await style(output, 'border-top-width')).toBe('1px');
    expect(sameColour(await style(output, 'border-top-color'), TABLE_B.divider), 'top line').toBe(true);
    expect(contrast(TABLE_B.text, TABLE_B.background)).toBeGreaterThanOrEqual(4.5);
  });

  // plan-cool_slate_light/REQ-13, REQ-24 — scenario "Dark and Dark Blue keep the dark terminal": the tool output as before this plan
  test('in Dark and Dark Blue the open tool output keeps the canvas, the secondary text and the subtle border line', async ({ page }) => {
    const output = await openToolCard(page);
    for (const [choice, mark] of [['Dark', 'dark'], ['Dark Blue', 'dark-blue']] as const) {
      await choose(page, choice, mark);
      expect(await style(output, 'background-color'), `${choice} background`).toBe(await colour(page, 'var(--role-canvas)'));
      expect(await style(output, 'color'), `${choice} text`).toBe(await colour(page, 'var(--text-secondary)'));
      expect(await style(output, 'border-top-color'), `${choice} line`).toBe(await colour(page, 'var(--role-border-subtle)'));
      expect(luminance(parse(await style(output, 'background-color'))), `${choice} background is dark`).toBeLessThan(0.05);
    }
  });
});
