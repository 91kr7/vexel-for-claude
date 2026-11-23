// e2e of plan-cool_slate_light, batch cool-slate-palette. Expected values come from table A of the plan requirements,
// the specs ThemeTokens, Windows11Look, WebEntry, ListStyles, NavigationRail, SessionList, ThemeSection and the batch scenarios.
/// <reference lib="dom" />
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { pageSettled } from './motion';
import { chooseInSettings, settingsButton, settingsPopup } from './settings';

// A route handler can still wait on the server when a test ends: its error then must not fail the test.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

type Rgba = [number, number, number, number];

// Table A, with the text tones that ThemeTokens darkens for 4.5:1 (plan-cool_slate_light/REQ-14).
const TABLE_A = {
  canvas: 'rgb(243, 245, 248)',
  chrome: 'rgb(246, 248, 251)',
  rail: 'rgb(238, 241, 246)',
  card: 'rgb(255, 255, 255)',
  hover: 'rgb(241, 245, 249)',
  cardActive: 'rgb(238, 244, 255)',
  pill: 'rgb(233, 238, 245)',
  borderSubtle: 'rgba(15, 23, 42, 0.08)',
  borderStrong: 'rgba(15, 23, 42, 0.14)',
  accent: 'rgb(37, 99, 235)',
  accentTint: 'rgba(37, 99, 235, 0.12)',
  contextBg: 'rgb(219, 234, 254)',
  contextText: 'rgb(29, 78, 216)',
  contextBorder: 'rgba(37, 99, 235, 0.22)',
  textPrimary: 'rgb(15, 23, 42)',
  textSecondary: 'rgb(71, 85, 105)',
  workingBg: 'rgb(220, 252, 231)',
  workingDot: 'rgb(22, 163, 74)',
  idleDot: 'rgb(100, 116, 139)',
  warningBg: 'rgb(254, 243, 199)',
  warningBorder: 'rgb(252, 211, 77)',
  dangerBg: 'rgb(254, 226, 226)',
  dangerBorder: 'rgb(252, 165, 165)',
  thumb: 'rgba(100, 116, 139, 0.28)',
  thumbHover: 'rgba(100, 116, 139, 0.45)',
};
// The table A text tones before darkening: the ThemeTokens values must keep their hue.
const MOCK_TEXT = { muted: 'rgb(100, 116, 139)', working: 'rgb(21, 128, 61)', warning: 'rgb(180, 83, 9)', danger: 'rgb(185, 28, 28)' };

// Colours of the previous light set (editorial light): no element may still paint one.
const OLD_LIGHT = [
  'rgb(244, 241, 234)',
  'rgb(252, 250, 245)',
  'rgb(239, 234, 224)',
  'rgb(228, 222, 210)',
  'rgba(28, 25, 23, 0.08)',
  'rgba(28, 25, 23, 0.15)',
  'rgb(28, 25, 23)',
  'rgb(87, 83, 78)',
  'rgb(103, 98, 92)',
  'rgb(0, 101, 174)',
  'rgba(0, 101, 174, 0.12)',
  'rgba(0, 101, 174, 0.35)',
  'rgb(6, 95, 70)',
  'rgb(146, 64, 14)',
  'rgb(159, 18, 57)',
  'rgb(182, 42, 18)',
  'rgb(82, 82, 91)',
];

const LIGHT_SURFACES = ['--bg-canvas', '--bg-surface-1', '--bg-surface-2', '--bg-surface-3', '--role-rail', '--role-hover', '--role-card-active', '--role-pill', '--role-context-bg'];

let projectsRoot: string;
const createdIds: string[] = [];

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-cool-slate-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  await rm(projectsRoot, { recursive: true, force: true });
});

const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const panel = (page: Page) => page.getByRole('region', { name: 'Session List' });
const mainArea = (page: Page) => page.getByRole('main');
const entry = (page: Page, folder: string) => panel(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });

/** Shows in the page only the sessions of this test. */
async function showOnly(page: Page): Promise<void> {
  const own = (session: { folder?: unknown } | undefined) => typeof session?.folder === 'string' && session.folder.startsWith(projectsRoot + path.sep);
  await page.route(
    (url) => url.pathname === '/api/sessions',
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      await route.fulfill({ response, json: ((await response.json()) as { folder?: unknown }[]).filter(own) });
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

async function startViaApi(request: APIRequestContext, name: string): Promise<{ id: string; folder: string }> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder, { recursive: true });
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  return { id, folder };
}

async function postHook(request: APIRequestContext, id: string, event: Record<string, string>): Promise<void> {
  expect((await request.post(`/api/sessions/${id}/hook-events`, { data: event })).status()).toBe(204);
}

/** A working, a needs-input and an ended session; the working one is open. Scenario "the Light theme shows the Cool Slate colours". */
async function threeSessions(page: Page, request: APIRequestContext) {
  await showOnly(page);
  const working = await startViaApi(request, 'working-row');
  const asking = await startViaApi(request, 'asking-row');
  const ended = await startViaApi(request, 'ended-row');
  await postHook(request, working.id, { hook_event_name: 'UserPromptSubmit', prompt: 'run the tests' });
  await postHook(request, asking.id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  expect((await request.post(`/api/sessions/${ended.id}/stop`)).status()).toBeLessThan(300);
  await page.goto('/');
  await entry(page, working.folder).getByTitle(working.folder, { exact: true }).click();
  await expect(page.locator('.xterm-rows')).toContainText(`CWD:${working.folder}`);
  await expect(entry(page, ended.folder)).toContainText('Ended');
  return { working: working.folder, asking: asking.folder, ended: ended.folder };
}

const style = (target: Locator, property: string) => target.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);

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

/** The computed `box-shadow` of a shadow value or `var()`. */
async function shadow(page: Page, cssValue: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement('div');
    probe.style.boxShadow = value;
    document.body.append(probe);
    const result = getComputedStyle(probe).boxShadow;
    probe.remove();
    return result;
  }, cssValue);
}

function parse(value: string): Rgba {
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

function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
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

async function toLight(page: Page): Promise<void> {
  await chooseInSettings(page, 'Light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await pageSettled(page);
}

/** Elements of `scope`, outside the terminal, that paint a colour of `colours`. */
async function painting(scope: Locator, colours: string[]): Promise<string[]> {
  return scope.evaluate((root, list) => {
    const found: string[] = [];
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (el.closest('.xterm') || !el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
      const s = getComputedStyle(el);
      const painted = [s.color, s.backgroundColor];
      for (const side of ['top', 'right', 'bottom', 'left']) {
        if (s.getPropertyValue(`border-${side}-style`) !== 'none' && parseFloat(s.getPropertyValue(`border-${side}-width`)) > 0) {
          painted.push(s.getPropertyValue(`border-${side}-color`));
        }
      }
      for (const value of painted) if (list.includes(value)) found.push(`${el.tagName.toLowerCase()}.${String(el.className)}: ${value}`);
    }
    return found;
  }, colours);
}

/** Per element, outside the terminal: its box, its border sides and whether it has a shadow. */
const geometry = (page: Page) =>
  page.evaluate(() =>
    [...document.body.querySelectorAll('*')]
      .filter((el) => !el.closest('.xterm'))
      .map((el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const borders = ['top', 'right', 'bottom', 'left'].map((side) => `${s.getPropertyValue(`border-${side}-style`)} ${s.getPropertyValue(`border-${side}-width`)}`);
        const name = `${el.tagName.toLowerCase()}.${String(el.className)}`;
        return { name, box: [r.x, r.y, r.width, r.height].map(Math.round).join(','), borders: borders.join('|'), shadow: s.boxShadow !== 'none' };
      }),
  );

// ---------------------------------------------------------------------------------------------------------------------
test.describe('Cool Slate tokens', () => {
  // plan-cool_slate_light/REQ-1, REQ-2, REQ-3, REQ-6, REQ-7: the Light levels and roles take table A
  test('the Light set takes the surfaces, borders, accent, text, shadows and scrollbar of table A', async ({ page }) => {
    await page.goto('/');
    await toLight(page);
    const expected: Record<string, string> = {
      '--bg-canvas': TABLE_A.canvas,
      '--role-canvas': TABLE_A.canvas,
      '--role-chrome': TABLE_A.chrome,
      '--role-list': TABLE_A.chrome,
      '--role-rail': TABLE_A.rail,
      '--role-card': TABLE_A.card,
      '--role-raised': TABLE_A.card,
      '--role-hover': TABLE_A.hover,
      '--role-card-active': TABLE_A.cardActive,
      '--role-pill': TABLE_A.pill,
      '--role-track': TABLE_A.pill,
      '--role-border-subtle': TABLE_A.borderSubtle,
      '--role-border-strong': TABLE_A.borderStrong,
      '--role-accent': TABLE_A.accent,
      '--role-accent-glow': TABLE_A.accentTint,
      '--role-context-bg': TABLE_A.contextBg,
      '--role-context-text': TABLE_A.contextText,
      '--role-context-border': TABLE_A.contextBorder,
      '--color-focus-ring': TABLE_A.accent,
      '--field-focus-ring': TABLE_A.accent,
      '--field-bg': TABLE_A.canvas,
      '--field-border': TABLE_A.borderStrong,
      '--text-primary': TABLE_A.textPrimary,
      '--text-secondary': TABLE_A.textSecondary,
      '--scrollbar-thumb': TABLE_A.thumb,
      '--scrollbar-thumb-hover': TABLE_A.thumbHover,
    };
    for (const [name, value] of Object.entries(expected)) expect(sameColour(await colour(page, `var(${name})`), value), `${name} = ${value}`).toBe(true);
    expect(await shadow(page, 'var(--shadow-card)')).toBe(await shadow(page, '0 1px 2px rgba(15, 23, 42, 0.05)'));
    expect(await shadow(page, 'var(--shadow-card-active)')).toBe(await shadow(page, '0 2px 8px rgba(37, 99, 235, 0.1)'));
  });

  // plan-cool_slate_light/REQ-4, REQ-5: status colours of table A; "Interrupt" takes the warning colours
  test('the Light status tokens follow table A and every orange token equals the amber one of the same use', async ({ page }) => {
    await page.goto('/');
    await toLight(page);
    const expected: Record<string, string> = {
      '--emerald-500-15': TABLE_A.workingBg,
      '--emerald-dot': TABLE_A.workingDot,
      '--zinc-dot': TABLE_A.idleDot,
      '--amber-500-15': TABLE_A.warningBg,
      '--amber-500-30': TABLE_A.warningBorder,
      '--rose-500-15': TABLE_A.dangerBg,
      '--rose-500-30': TABLE_A.dangerBorder,
    };
    for (const [name, value] of Object.entries(expected)) expect(await colour(page, `var(${name})`), name).toBe(value);
    for (const [orange, amber] of [
      ['--orange-400', '--amber-400'],
      ['--orange-500-15', '--amber-500-15'],
      ['--orange-500-25', '--amber-500-25'],
      ['--orange-500-30', '--amber-500-30'],
    ]) {
      expect(await colour(page, `var(${orange})`), `${orange} = ${amber}`).toBe(await colour(page, `var(${amber})`));
    }
    // A darkened text tone keeps the hue of its table A value.
    for (const [name, mock] of [
      ['--text-muted', MOCK_TEXT.muted],
      ['--zinc-400', MOCK_TEXT.muted],
      ['--emerald-400', MOCK_TEXT.working],
      ['--amber-400', MOCK_TEXT.warning],
      ['--rose-400', MOCK_TEXT.danger],
    ] as const) {
      const [h, , l] = hsl(parse(await colour(page, `var(${name})`)));
      const [mh, , ml] = hsl(parse(mock));
      expect(Math.abs(h - mh), `${name} keeps the hue of ${mock}`).toBeLessThanOrEqual(3);
      expect(l, `${name} is not lighter than ${mock}`).toBeLessThanOrEqual(ml + 0.005);
    }
  });

  // plan-cool_slate_light/REQ-14: text reaches 4.5:1 on every light surface, and the darkening is the least needed
  test('the Light text tones reach 4.5:1 on every light surface, and each darkened tone only just reaches it', async ({ page }) => {
    await page.goto('/');
    await toLight(page);
    const surfaces = await Promise.all(LIGHT_SURFACES.map(async (bg) => [bg, parse(await colour(page, `var(${bg})`))] as const));
    for (const text of ['--text-primary', '--text-secondary', '--text-muted']) {
      const fg = parse(await colour(page, `var(${text})`));
      for (const [bg, surface] of surfaces) expect(contrast(fg, surface), `${text} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    const muted = parse(await colour(page, 'var(--text-muted)'));
    const lowest = Math.min(...surfaces.map(([, s]) => contrast(muted, s)));
    expect(lowest, 'the muted text is the least darkening of the mock value').toBeLessThan(4.65);
    expect(Math.min(...surfaces.map(([, s]) => contrast(parse(MOCK_TEXT.muted), s))), 'the mock muted text fails somewhere').toBeLessThan(4.5);

    const contextText = parse(await colour(page, 'var(--role-context-text)'));
    expect(contrast(contextText, parse(await colour(page, 'var(--role-context-bg)'))), 'context pill text').toBeGreaterThanOrEqual(4.5);

    // Status text on the light surfaces and on its own fill and hover fill.
    const families: [string, string[]][] = [
      ['--emerald-400', ['--emerald-500-15']],
      ['--amber-400', ['--amber-500-15', '--amber-500-25']],
      ['--amber-300', ['--amber-500-15', '--amber-500-25']],
      ['--rose-400', ['--rose-500-15', '--rose-500-25']],
      ['--rose-300', ['--rose-500-15', '--rose-500-25']],
      ['--orange-400', ['--orange-500-15', '--orange-500-25']],
      ['--zinc-400', ['--zinc-500-15']],
    ];
    for (const [text, fills] of families) {
      const fg = parse(await colour(page, `var(${text})`));
      for (const [bg, surface] of surfaces) {
        if (bg === '--role-context-bg' && (text.startsWith('--emerald') || text.startsWith('--zinc'))) continue;
        expect(contrast(fg, surface), `${text} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const fill of fills) {
        const tint = parse(await colour(page, `var(${fill})`));
        expect(contrast(fg, over(tint, parse(TABLE_A.chrome))), `${text} on ${fill}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  // plan-cool_slate_light/REQ-15: working, needs input, error and idle stay apart in text tone and dot
  test('the Light status tones and dots are green, amber, red and slate, apart from each other', async ({ page }) => {
    await page.goto('/');
    await toLight(page);
    const hueOf = async (name: string) => hsl(parse(await colour(page, `var(${name})`)));
    const text = { working: await hueOf('--emerald-400'), warning: await hueOf('--amber-400'), danger: await hueOf('--rose-400'), idle: await hueOf('--zinc-400') };
    expect(text.working[0], 'working is green').toBeGreaterThan(90);
    expect(text.working[0]).toBeLessThan(160);
    expect(text.warning[0], 'needs input is amber').toBeGreaterThan(20);
    expect(text.warning[0]).toBeLessThan(50);
    expect(text.danger[0] < 10 || text.danger[0] > 340, 'error is red').toBe(true);
    expect(text.idle[0], 'idle is slate').toBeGreaterThan(200);
    expect(text.idle[0]).toBeLessThan(230);
    expect(text.idle[1], 'idle is a low-saturation grey').toBeLessThan(text.working[1]);
    const dots = [await colour(page, 'var(--emerald-dot)'), await colour(page, 'var(--amber-400)'), await colour(page, 'var(--zinc-dot)')];
    expect(new Set(dots).size, 'three distinct dots').toBe(3);
  });

  // plan-cool_slate_light/REQ-13: in Dark and Dark Blue, in both looks, every new role token equals the token it replaces
  for (const theme of ['Dark', 'Dark Blue'] as const) {
    for (const look of ['macOS', 'Windows 11'] as const) {
      test(`in ${theme} with the ${look} look the new role tokens equal the levels they replace`, async ({ page }) => {
        await page.goto('/');
        await chooseInSettings(page, look);
        await chooseInSettings(page, theme);
        const pairs: [string, string][] = [
          ['--role-rail', '--role-canvas'],
          ['--role-hover', '--bg-surface-3'],
          ['--role-hover', '--role-card-active'],
          ['--role-pill', '--role-raised'],
          ['--role-track', '--bg-surface-3'],
          ['--role-context-bg', '--role-raised'],
          ['--role-context-text', '--text-secondary'],
          ['--role-context-border', '--role-border-strong'],
          ['--emerald-dot', '--emerald-400'],
          ['--zinc-dot', '--zinc-400'],
        ];
        for (const [fresh, old] of pairs) expect(await colour(page, `var(${fresh})`), `${fresh} = ${old}`).toBe(await colour(page, `var(${old})`));
        expect(await shadow(page, 'var(--shadow-card-active)')).toBe(await shadow(page, 'var(--shadow-card)'));
      });
    }
  }

  // Windows11Look, gatekeeper decision of 2026-11-20: the Windows 11 look keeps its own Light levels; the other tokens take table A
  test('in Light with the Windows 11 look the role tokens follow its own levels and the status tokens take table A', async ({ page }) => {
    await page.goto('/');
    await chooseInSettings(page, 'Windows 11');
    await toLight(page);
    expect(await colour(page, 'var(--bg-canvas)')).toBe('rgb(238, 238, 238)');
    const pairs: [string, string][] = [
      ['--role-rail', '--role-canvas'],
      ['--role-hover', '--bg-surface-3'],
      ['--role-card-active', '--bg-surface-3'],
      ['--role-track', '--bg-surface-3'],
      ['--role-pill', '--role-raised'],
      ['--role-context-bg', '--role-raised'],
      ['--role-context-text', '--text-secondary'],
      ['--role-context-border', '--role-border-strong'],
    ];
    for (const [role, level] of pairs) expect(await colour(page, `var(${role})`), `${role} = ${level}`).toBe(await colour(page, `var(${level})`));
    expect(await colour(page, 'var(--amber-500-15)')).toBe(TABLE_A.warningBg);
    expect(await colour(page, 'var(--emerald-dot)')).toBe(TABLE_A.workingDot);
    expect(await colour(page, 'var(--scrollbar-thumb)')).toBe(TABLE_A.thumb);
    expect(await shadow(page, 'var(--shadow-card)')).toBe(await shadow(page, '0 1px 2px rgba(15, 23, 42, 0.05)'));
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('Cool Slate client', () => {
  // Scenario "the Light theme shows the Cool Slate colours": plan-cool_slate_light/REQ-1, REQ-2, REQ-4, REQ-5, REQ-6
  test('with a working, a needs-input and an ended session, the client shows the table A colours', async ({ page, request }) => {
    const { working, asking, ended } = await threeSessions(page, request);
    await toLight(page);
    await page.mouse.move(1400, 880);

    expect(await style(page.locator('body'), 'background-color'), 'canvas').toBe(TABLE_A.canvas);
    expect(await style(page.getByRole('banner'), 'background-color'), 'title bar').toBe(TABLE_A.chrome);
    expect(await style(rail(page), 'background-color'), 'rail').toBe(TABLE_A.rail);
    expect(await style(page.getByRole('region', { name: `Terminal: ${path.basename(working)}` }), 'border-top-color'), 'terminal frame').toBe(TABLE_A.borderStrong);

    const open = entry(page, working);
    await expect.poll(() => style(open, 'background-color'), 'open card is pale blue').toBe(TABLE_A.cardActive);
    expect(await style(open, 'border-top-color'), 'open card has a blue border').toBe(TABLE_A.accent);
    expect(await style(open, 'box-shadow')).toContain('rgba(37, 99, 235, 0.1) 0px 2px 8px 0px');
    expect(await style(entry(page, ended), 'background-color'), 'card').toBe(TABLE_A.card);

    expect(await style(open.locator('.state-dot'), 'background-color'), 'working dot').toBe(TABLE_A.workingDot);
    const askingCard = panel(page).locator('.session-card').filter({ has: page.getByTitle(asking, { exact: true }) });
    const tag = askingCard.locator('.perm-tag');
    expect(await style(tag, 'background-color'), 'needs-input tag is amber').toBe(TABLE_A.warningBg);
    expect(await style(tag, 'border-top-color')).toBe(TABLE_A.warningBorder);
    expect(await style(tag, 'color')).toBe(await colour(page, 'var(--amber-300)'));
    expect(await style(panel(page).locator('.needs-input-chip .state-dot'), 'background-color'), 'needs-input dot').toBe(await colour(page, 'var(--amber-400)'));
    expect(await style(entry(page, ended).locator('.state-dot'), 'background-color'), 'ended dot').toBe(TABLE_A.idleDot);

    const interrupt = mainArea(page).getByRole('button', { name: 'Interrupt', exact: true });
    const terminate = mainArea(page).getByRole('button', { name: 'Terminate', exact: true });
    expect(await style(interrupt, 'background-color'), 'Interrupt is amber').toBe(TABLE_A.warningBg);
    expect(await style(interrupt, 'border-top-color')).toBe(TABLE_A.warningBorder);
    expect(await style(interrupt, 'color')).toBe(await colour(page, 'var(--amber-400)'));
    expect(await style(terminate, 'background-color'), 'Terminate is red').toBe(TABLE_A.dangerBg);
    expect(await style(terminate, 'border-top-color')).toBe(TABLE_A.dangerBorder);
    expect(await style(terminate, 'color')).toBe(await colour(page, 'var(--rose-400)'));

    // plan-cool_slate_light/REQ-1: hover surface of a card that is not open
    await entry(page, ended).hover();
    await expect.poll(() => style(entry(page, ended), 'background-color'), 'hover surface').toBe(TABLE_A.hover);

    // plan-cool_slate_light/REQ-11: no element keeps a colour of the previous light set
    await page.mouse.move(1400, 880);
    expect(await painting(page.locator('body'), OLD_LIGHT), 'elements with an editorial-light colour').toEqual([]);
  });

  // Scenario "the Light theme shows the Cool Slate colours", last line: plan-cool_slate_light/REQ-8, REQ-9
  test('switching to Light adds no border or shadow and moves or resizes no element', async ({ page, request }) => {
    await threeSessions(page, request);
    await page.mouse.move(1400, 880);
    await pageSettled(page);
    const dark = await geometry(page);
    await toLight(page);
    await page.mouse.move(1400, 880);
    const light = await geometry(page);
    await chooseInSettings(page, 'Dark');
    await pageSettled(page);
    await page.mouse.move(1400, 880);
    const darkAgain = await geometry(page);

    expect(light.length, 'same elements in both themes').toBe(dark.length);
    const changed: string[] = [];
    for (const [i, d] of dark.entries()) {
      const l = light[i]!;
      const d2 = darkAgain[i];
      // An element that changes between the two Dark readings (a ticking time) says nothing about the theme.
      if (!d2 || d2.name !== d.name || d2.box !== d.box || d2.borders !== d.borders || d2.shadow !== d.shadow) continue;
      if (l.name !== d.name) changed.push(`${d.name} → ${l.name}`);
      else if (l.box !== d.box) changed.push(`${d.name}: box ${d.box} → ${l.box}`);
      else if (l.borders !== d.borders) changed.push(`${d.name}: borders ${d.borders} → ${l.borders}`);
      else if (!d.shadow && l.shadow) changed.push(`${d.name}: a shadow appears`);
    }
    expect(changed, 'elements changed by the theme').toEqual([]);
  });

  // Scenario "dialogs, scrollbars and focus follow the palette": plan-cool_slate_light/REQ-7, REQ-11, REQ-16
  test('Settings on "Appearance" uses the palette, the "Light" card shows it, and every control shows a blue focus ring', async ({ page }) => {
    await page.goto('/');
    await toLight(page);
    await settingsButton(page).click();
    const popup = settingsPopup(page);
    await expect(popup).toBeVisible();
    await popup.getByRole('tab', { name: 'Appearance', exact: true }).click();
    await pageSettled(page);

    const preview = popup.locator('.theme-preview-light');
    expect(await style(preview, 'background-color'), 'Light card canvas').toBe(TABLE_A.canvas);
    expect(await style(preview.locator('.theme-preview-bar'), 'background-color'), 'Light card surface').toBe(TABLE_A.card);
    expect(await style(preview.locator('.theme-preview-line.accent'), 'background-color'), 'Light card accent').toBe(TABLE_A.accent);
    expect(await style(preview.locator('.theme-preview-line:not(.accent)').first(), 'background-color'), 'Light card text line').toBe(TABLE_A.textPrimary);
    expect(await painting(popup, OLD_LIGHT), 'popup elements with an editorial-light colour').toEqual([]);

    expect(await colour(page, 'var(--scrollbar-thumb)'), 'scrollbar thumb').toBe(TABLE_A.thumb);

    const rings: string[] = [];
    let seen = 0;
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const ring = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body || !el.closest('[role="dialog"]')) return null;
        const s = getComputedStyle(el);
        const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 ? s.outlineColor : '';
        return { name: el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? el.tagName, outline, shadow: s.boxShadow };
      });
      if (!ring) continue;
      seen += 1;
      if (ring.outline !== TABLE_A.accent && !ring.shadow.includes(TABLE_A.accent)) rings.push(`${ring.name}: outline "${ring.outline}", shadow "${ring.shadow}"`);
    }
    expect(seen, 'Tab reaches controls of the dialog').toBeGreaterThan(2);
    expect(rings, 'controls without the blue focus ring').toEqual([]);
  });
});
