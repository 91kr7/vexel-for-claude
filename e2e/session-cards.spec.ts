// e2e of plan-dark_blue_theme, batch session-cards: list panel width and the session cards.
// The tests write the transcripts that Claude Code would write, so this spec runs in the claude-dir group.
/// <reference lib="dom" />
import { appendFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

// A route handler can still wait on the server when a test ends: its error then must not fail the test.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

type Theme = 'light' | 'dark';
const THEMES: Theme[] = ['dark', 'light'];
const LIST_WIDTH_KEY = 'ai-client.list-width';
const LOOK_KEY = 'ai-client.look';
const SIDES = ['top', 'right', 'bottom', 'left'] as const;

let projectsRoot: string;
const createdIds: string[] = [];
const transcripts: string[] = [];
/** External session summaries the page gets on top of the server's own list. */
let injected: object[] = [];

test.beforeEach(async ({ page }) => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-session-cards-'));
  injected = [];
  await showOnlyOwnSessions(page);
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const file of transcripts.splice(0)) await rm(file, { force: true });
  await rm(projectsRoot, { recursive: true, force: true });
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).locator('.session-entry').filter({ has: page.getByTitle(folder, { exact: true }) });
const needsInputCard = (page: Page, folder: string) => list(page).locator('.session-card').filter({ has: page.getByTitle(folder, { exact: true }) });
const dotOf = (card: Locator) => card.locator('.state-dot').first();
const terminal = (page: Page) => page.locator('.xterm-rows');

/** Waits for the effects that end (list cascade, entry slide-in, pops): a box read while one plays sits where the effect has moved it. */
const effectsDone = (page: Page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );

async function box(locator: Locator) {
  await effectsDone(locator.page());
  const b = await locator.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
}

const near = (actual: number, expected: number, what: string, tolerance = 1) =>
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);
near.soft = (actual: number, expected: number, what: string, tolerance = 0.5) =>
  expect.soft(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);

const style = (locator: Locator, property: string) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);

/** What the browser computes for a CSS value set on `property` of a probe element (e.g. `var(--role-accent)` on `color`). */
const computed = (page: Page, property: string, value: string) =>
  page.evaluate(
    ([p, v]) => {
      const probe = document.createElement('span');
      probe.style.setProperty(p, v);
      document.body.append(probe);
      const result = getComputedStyle(probe).getPropertyValue(p);
      probe.remove();
      return result;
    },
    [property, value] as const,
  );
const colourOf = (page: Page, value: string) => computed(page, 'color', value);

/** Shows in the page only the sessions of the running test: other specs start sessions on the same server. */
async function showOnlyOwnSessions(page: Page): Promise<void> {
  const own = (session: { folder?: unknown } | undefined) => typeof session?.folder === 'string' && session.folder.startsWith(projectsRoot + path.sep);
  await page.route(
    (url) => url.pathname === '/api/sessions',
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      const sessions = (await response.json()) as { folder?: unknown }[];
      await route.fulfill({ response, json: [...sessions.filter(own), ...injected] });
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

async function openIn(page: Page, theme: Theme = 'dark'): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem('ai-client.theme', t), theme);
  await page.goto('/');
  await expect(list(page)).toBeVisible();
}

async function newFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  return folder;
}

async function postHook(request: APIRequestContext, id: string, event: Record<string, string>): Promise<void> {
  expect((await request.post(`/api/sessions/${id}/hook-events`, { data: event })).status()).toBe(204);
}

async function startViaApi(request: APIRequestContext, folder: string): Promise<string> {
  const started = await request.post('/api/sessions', { data: { path: folder } });
  expect(started.status()).toBe(201);
  const { id } = (await started.json()) as { id: string };
  createdIds.push(id);
  return id;
}

/** A hosted session whose transcript holds one response with 45.2k tokens of context (23 % of 200k) and a known cost. */
async function hostedWithUsage(request: APIRequestContext, folder: string, state: 'idle' | 'working'): Promise<string> {
  const claudeSessionId = crypto.randomUUID();
  const file = path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'), `${claudeSessionId}.jsonl`);
  await mkdir(path.dirname(file), { recursive: true });
  transcripts.push(file);
  const lines: object[] = [
    { type: 'user', isSidechain: false, message: { role: 'user', content: 'Work' } },
    {
      type: 'assistant',
      uuid: crypto.randomUUID(),
      isSidechain: false,
      message: {
        id: `msg_e2e_session_cards_${claudeSessionId}`,
        model: 'claude-haiku-5-5',
        role: 'assistant',
        content: [{ type: 'text', text: 'Working.' }],
        usage: { input_tokens: 2_000, output_tokens: 1_000, cache_creation_input_tokens: 3_000, cache_read_input_tokens: 40_200 },
      },
    },
  ];
  if (state === 'working') {
    lines.push({
      type: 'assistant',
      isSidechain: false,
      message: { role: 'assistant', content: [{ type: 'tool_use', id: `tool_${claudeSessionId}`, name: 'Bash', input: { command: 'npm test' } }] },
    });
  }
  await appendFile(file, lines.map((line) => `${JSON.stringify(line)}\n`).join(''));
  const id = await startViaApi(request, folder);
  await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt: 'Work', session_id: claudeSessionId });
  if (state === 'idle') await postHook(request, id, { hook_event_name: 'Stop', session_id: claudeSessionId });
  return id;
}

async function idleHosted(request: APIRequestContext, folder: string): Promise<string> {
  const id = await startViaApi(request, folder);
  await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt: 'Work' });
  await postHook(request, id, { hook_event_name: 'Stop' });
  return id;
}

async function openSession(page: Page, folder: string): Promise<void> {
  await list(page).getByTitle(folder, { exact: true }).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
}

async function pointerAway(page: Page): Promise<void> {
  await page.mouse.move(900, 600);
}

/**
 * The accent bar of a card, as the browser draws it on the left edge: an accent-coloured left border, an inset accent
 * shadow offset to the right, or a 3.5 px accent pseudo-element. Null when the card has no accent on its left edge.
 */
function accentBarOf(card: Locator, accent: string) {
  return card.evaluate((el, accentColour) => {
    const s = getComputedStyle(el);
    const border = s.borderLeftColor === accentColour ? parseFloat(s.borderLeftWidth) : 0;
    const shadows = s.boxShadow === 'none' ? [] : s.boxShadow.split(/,(?![^(]*\))/).map((part) => part.trim());
    const inset = shadows
      .filter((part) => part.endsWith('inset') && part.startsWith(accentColour))
      .map((part) => parseFloat(part.slice(accentColour.length).trim().split(/\s+/)[0] ?? '0'))
      .reduce((sum, x) => sum + Math.max(x, 0), 0);
    let pseudo = 0;
    for (const name of ['::before', '::after']) {
      const p = getComputedStyle(el, name);
      if (p.content !== 'none' && p.display !== 'none' && p.backgroundColor === accentColour && Math.abs(parseFloat(p.width) - 3.5) < 0.1) pseudo = 3.5;
    }
    if (pseudo) return { width: pseudo };
    if (!inset && !border) return null;
    return { width: border + inset };
  }, accent);
}

/** The colour of a token with an alpha, as `rgba(r, g, b, a)`; the token must be a hex colour. */
const withAlpha = async (page: Page, token: string, alpha: number) => {
  const hex = (await page.evaluate((t) => getComputedStyle(document.documentElement).getPropertyValue(t).trim(), token)).replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

async function expectBorder(card: Locator, colour: string, what: string, lineStyle = 'solid'): Promise<void> {
  for (const side of SIDES) {
    expect(await style(card, `border-${side}-width`), `${what}: 1 px ${side} border`).toBe('1px');
    expect(await style(card, `border-${side}-style`), `${what}: ${side} border style`).toBe(lineStyle);
    expect(await style(card, `border-${side}-color`), `${what}: ${side} border colour`).toBe(colour);
  }
}

async function expectInactiveCard(page: Page, card: Locator, what: string): Promise<void> {
  expect(await style(card, 'border-top-left-radius'), `${what}: 7 px corners`).toBe('7px');
  expect(await style(card, 'border-bottom-right-radius'), `${what}: 7 px corners`).toBe('7px');
  expect(await style(card, 'background-color'), `${what}: card surface`).toBe(await colourOf(page, 'var(--role-card)'));
  await expectBorder(card, await colourOf(page, 'var(--role-border-subtle)'), what);
  expect(await accentBarOf(card, await colourOf(page, 'var(--role-accent)')), `${what}: no accent bar`).toBeNull();
}

async function expectOpenLook(page: Page, card: Locator, what: string): Promise<void> {
  await expect.poll(() => style(card, 'background-color'), { message: `${what}: active card surface` }).toBe(await colourOf(page, 'var(--role-card-active)'));
  expect(await style(card, 'box-shadow'), `${what}: active card shadow`).toContain(await computed(page, 'box-shadow', 'var(--shadow-card-active)'));
  const bar = await accentBarOf(card, await colourOf(page, 'var(--role-accent)'));
  expect(bar, `${what}: accent bar`).not.toBeNull();
  near(bar!.width, 3.5, `${what}: accent bar width`, 0.05);
}

test.describe('list panel width', () => {
  // plan-dark_blue_theme/REQ-16 — scenario "the session list shows cards like the mock"
  for (const theme of THEMES) {
    test(`${theme}: with no saved width the list panel is 260 px wide, on the session list surface with a subtle right line`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openIn(page, theme);
      near((await box(list(page))).width, 260, 'list panel width', 0.5);
      expect(await page.evaluate((key) => localStorage.getItem(key), LIST_WIDTH_KEY), 'nothing saved').toBeNull();
      expect(await style(list(page), 'background-color'), 'session list surface').toBe(await colourOf(page, 'var(--role-list)'));
      expect(await style(list(page), 'border-right-width'), '1 px right line').toBe('1px');
      expect(await style(list(page), 'border-right-color'), 'subtle right line').toBe(await colourOf(page, 'var(--role-border-subtle)'));
    });
  }

  // plan-dark_blue_theme/REQ-17 — scenario "a saved list width stays"
  for (const saved of [320, 224]) {
    test(`a saved width of ${saved} px stays after a reload`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LIST_WIDTH_KEY, String(saved)] as const);
      await openIn(page);
      near((await box(list(page))).width, saved, 'list panel width', 0.5);
      await page.reload();
      await expect(list(page)).toBeVisible();
      near((await box(list(page))).width, saved, 'list panel width after a reload', 0.5);
      expect(await page.evaluate((key) => localStorage.getItem(key), LIST_WIDTH_KEY), 'saved width untouched').toBe(String(saved));
    });
  }
});

test.describe('session cards', () => {
  // plan-dark_blue_theme/REQ-18, REQ-19, REQ-20 — scenario "the session list shows cards like the mock"
  for (const theme of THEMES) {
    test(`${theme}: every entry is a card; the open card has the accent border, bar, active surface and shadow; an inactive card changes on hover`, async ({ page, request }) => {
      const working = await newFolder('cards-working');
      const opened = await newFolder('cards-open');
      const other = await newFolder('cards-other');
      await hostedWithUsage(request, working, 'working');
      await idleHosted(request, opened);
      await idleHosted(request, other);
      await openIn(page, theme);
      await openSession(page, opened);
      await pointerAway(page);

      await expect(entry(page, opened)).toHaveAttribute('aria-current', 'true');
      await expectInactiveCard(page, entry(page, working), 'working card');
      await expectInactiveCard(page, entry(page, other), 'idle card');

      const open = entry(page, opened);
      expect(await style(open, 'border-top-left-radius'), 'open card: 7 px corners').toBe('7px');
      await expectBorder(open, await colourOf(page, 'var(--role-accent)'), 'open card');
      await expectOpenLook(page, open, 'open card');
      // SessionList "Entry variants": open turns the label and the line-3 time to the secondary colour
      expect(await style(open.locator('.session-entry-label'), 'color'), 'open card: label').toBe(await colourOf(page, 'var(--text-secondary)'));
      expect(await style(open.locator('.session-entry-time'), 'color'), 'open card: time').toBe(await colourOf(page, 'var(--text-secondary)'));
      expect(await style(entry(page, other).locator('.session-entry-time'), 'color'), 'inactive card: muted time').toBe(await colourOf(page, 'var(--text-muted)'));

      // Cards of one group are 8 px apart.
      const a = await box(entry(page, opened));
      const b = await box(entry(page, other));
      const [upper, lower] = a.y < b.y ? [a, b] : [b, a];
      near(lower.y - (upper.y + upper.height), 8, 'gap between the idle cards', 1);

      await entry(page, other).hover();
      await expect.poll(() => style(entry(page, other), 'background-color'), { message: 'hover: hover surface' }).toBe(await colourOf(page, 'var(--role-hover)'));
      await expectBorder(entry(page, other), await colourOf(page, 'var(--role-border-strong)'), 'hovered card');

      await entry(page, opened).hover();
      await expect.poll(() => style(entry(page, other), 'background-color'), { message: 'pointer gone: card surface again' }).toBe(await colourOf(page, 'var(--role-card)'));
      await expectBorder(open, await colourOf(page, 'var(--role-accent)'), 'hovered open card');
      await expectOpenLook(page, open, 'hovered open card');
    });
  }

  // plan-dark_blue_theme/REQ-18, REQ-19: the needs-input card is a card that keeps its amber border, also when open
  test('the needs-input card has 7 px corners and its amber border; open, it adds the accent bar, active surface and shadow', async ({ page, request }) => {
    const folder = await newFolder('cards-asks');
    const id = await startViaApi(request, folder);
    await postHook(request, id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    await openIn(page);
    const card = needsInputCard(page, folder);
    await expect(card).toBeVisible();
    await pointerAway(page);

    const amber = await withAlpha(page, '--amber-500', 0.4);
    expect(await style(card, 'border-top-left-radius'), '7 px corners').toBe('7px');
    await expectBorder(card, amber, 'closed needs-input card');
    expect(await style(card, 'box-shadow'), 'no shadow while closed').toBe('none');
    expect(await accentBarOf(card, await colourOf(page, 'var(--role-accent)')), 'no accent bar while closed').toBeNull();

    await openSession(page, folder);
    await pointerAway(page);
    await expect(card.locator('.session-entry')).toHaveAttribute('aria-current', 'true');
    await expect.poll(() => style(card, 'border-left-color'), { message: 'still amber when open' }).toBe(amber);
    await expectBorder(card, amber, 'open needs-input card');
    await expectOpenLook(page, card, 'open needs-input card');
  });

  // plan-dark_blue_theme/REQ-21, REQ-22, REQ-50, REQ-53 — scenarios "the session list shows cards like the mock", "the card metrics are smaller"
  test('a working card shows line 1, line 2, the tool line and progress bar, then line 3 with no divider; its numbers are mono with tabular figures, percentage and cost at 10 px', async ({ page, request }) => {
    const folder = await newFolder('cards-lines');
    await hostedWithUsage(request, folder, 'working');
    await openIn(page);
    const card = entry(page, folder);
    await expect(card.locator('.session-entry-tool')).toContainText('Bash');
    await expect(card.locator('.session-entry-context')).toHaveText('23%');
    await expect(card.locator('.session-entry-cost')).toContainText('$');

    const dot = await box(dotOf(card));
    const name = await box(card.getByTitle(folder, { exact: true }));
    const star = await box(list(page).locator('li').filter({ has: page.getByTitle(folder, { exact: true }) }).getByRole('button', { name: 'Mark as Favorite' }));
    const stateName = await box(card.getByText('Running', { exact: true }));
    const label = await box(card.locator('.session-entry-label'));
    const tool = await box(card.locator('.session-entry-tool'));
    const bar = await box(card.locator('.progress-bar'));
    const metrics = card.locator('.session-entry-metrics');
    const line3 = await box(metrics);

    const middle = (b: { y: number; height: number }) => b.y + b.height / 2;
    for (const [what, b] of [['folder name', name], ['star', star], ['state name', stateName]] as const) {
      near(middle(b), middle(dot), `line 1: ${what} on the row of the dot`, 3);
    }
    expect(dot.x, 'dot before the folder name').toBeLessThan(name.x);
    expect(name.x, 'folder name before the star').toBeLessThan(star.x);
    expect(star.x + star.width, 'star before the state name').toBeLessThanOrEqual(stateName.x + 1);

    expect(label.y, 'line 2 below line 1').toBeGreaterThanOrEqual(name.y + name.height - 1);
    // SessionList "Entry row": line 2 4 px below line 1, the tool line 2 px below line 2, the bar 6 px below the tool line, line 3 15 px below (REQ-53: spacing as before)
    const line1Box = await box(card.locator('.session-entry-line').first());
    const line2Box = await box(card.locator('.session-entry-detail'));
    near.soft(line2Box.y - (line1Box.y + line1Box.height), 4, 'line 2 under line 1');
    near.soft(tool.y - (line2Box.y + line2Box.height), 2, 'tool line under line 2');
    near.soft(bar.y - (tool.y + tool.height), 6, 'progress bar under the tool line');
    const contentTop = line3.y + parseFloat(await style(metrics, 'border-top-width')) + parseFloat(await style(metrics, 'padding-top'));
    near.soft(contentTop - (bar.y + bar.height), 15, 'line 3 content 15 px under the progress bar');
    expect(tool.y, 'tool line below line 2').toBeGreaterThanOrEqual(label.y + label.height - 1);
    expect(bar.y, 'progress bar below the tool line').toBeGreaterThanOrEqual(tool.y + tool.height - 1);
    expect(line3.y, 'line 3 below the progress bar').toBeGreaterThanOrEqual(bar.y + bar.height - 1);
    expect(line3.y + line3.height, 'line 3 inside the card').toBeLessThanOrEqual((await box(card)).y + (await box(card)).height);

    // REQ-53: no divider above line 3
    expect((await style(metrics, 'border-top-style')) === 'none' || (await style(metrics, 'border-top-width')) === '0px', 'line 3: no top border').toBe(true);
    // REQ-50: percentage and cost 10 px, the time keeps 10.5 px
    expect(await style(metrics.locator('.session-entry-context'), 'font-size'), 'percentage 10 px').toBe('10px');
    expect(await style(metrics.locator('.session-entry-cost').first(), 'font-size'), 'cost 10 px').toBe('10px');
    expect(await style(metrics.locator('.session-entry-time'), 'font-size'), 'time 10.5 px').toBe('10.5px');
    for (const part of ['.session-entry-context', '.session-entry-cost', '.session-entry-time']) {
      const target = metrics.locator(part).first();
      await expect(target, `${part} on line 3`).toBeVisible();
      expect(await style(target, 'font-family'), `${part}: monospace font`).toBe(await computed(page, 'font-family', 'var(--font-mono)'));
      expect(await style(target, 'font-variant-numeric'), `${part}: tabular figures`).toContain('tabular-nums');
    }
  });
});

test.describe('external session cards', () => {
  const external = (name: string, state: string, extra: object = {}) => ({
    id: `ext-session-cards-${name}`,
    folder: `/srv/elsewhere/${name}`,
    label: `label ${name}`,
    state,
    lastActivity: new Date().toISOString(),
    external: true,
    ...extra,
  });

  // plan-dark_blue_theme/REQ-43 — scenario "an external session card has the solid card border"
  for (const theme of THEMES) {
    test(`${theme}: external cards have the solid 1 px card border in every state, on hover and when open; no dashed border`, async ({ page, request }) => {
      await page.routeWebSocket(/\/api\/external-sessions\/[^/]+\/conversation$/, () => {});
      const hosted = await newFolder('ext-hosted');
      await idleHosted(request, hosted);
      injected = [
        external('idle', 'idle'),
        external('working', 'working'),
        external('ended', 'ended', { resumable: true }),
        external('asking', 'needs_input', { waitingTool: 'Edit' }),
      ];
      await openIn(page, theme);
      await expect(entry(page, hosted)).toBeVisible();
      await pointerAway(page);

      const subtle = await colourOf(page, 'var(--role-border-subtle)');
      const hostedCard = entry(page, hosted);
      for (const side of SIDES) {
        expect(await style(hostedCard, `border-${side}-style`), 'hosted card: solid border').toBe('solid');
      }
      for (const name of ['idle', 'working', 'ended', 'asking']) {
        const card = entry(page, `/srv/elsewhere/${name}`);
        await expect(card, `${name}: external card`).toHaveClass(/\bexternal\b/);
        expect(await style(card, 'border-top-left-radius'), `${name}: 7 px corners`).toBe('7px');
        await expectBorder(card, subtle, `external ${name}`);
      }
      await expect(entry(page, '/srv/elsewhere/asking').getByText('External', { exact: true }), 'the chip still tells it apart').toBeVisible();

      const idle = entry(page, '/srv/elsewhere/idle');
      await idle.hover();
      await expect.poll(() => style(idle, 'border-top-color'), { message: 'hover: strong border' }).toBe(await colourOf(page, 'var(--role-border-strong)'));
      await expectBorder(idle, await colourOf(page, 'var(--role-border-strong)'), 'hovered external card');

      await idle.getByTitle('/srv/elsewhere/idle', { exact: true }).click();
      await expect(idle).toHaveAttribute('aria-current', 'true');
      await pointerAway(page);
      await expect.poll(() => style(idle, 'border-top-color'), { message: 'open: accent border' }).toBe(await colourOf(page, 'var(--role-accent)'));
      await expectBorder(idle, await colourOf(page, 'var(--role-accent)'), 'open external card');
      await expectOpenLook(page, idle, 'open external card');
    });
  }
});

test.describe('working dot', () => {
  /** The running animations of an element: name, duration and iteration count. */
  const animationsOf = (target: Locator) =>
    target.evaluate((el) =>
      el.getAnimations().map((a) => {
        const timing = a.effect?.getComputedTiming();
        return { name: (a as CSSAnimation).animationName, duration: timing?.duration, iterations: timing?.iterations };
      }),
    );

  /** The keyframes of a CSS animation, as the opacity and box-shadow of each frame. */
  const keyframesOf = (target: Locator) =>
    target.evaluate((el) =>
      el.getAnimations().flatMap((a) => ((a.effect as KeyframeEffect | null)?.getKeyframes() ?? []).map((k) => ({ opacity: k.opacity, boxShadow: k.boxShadow }))),
    );

  // plan-dark_blue_theme/REQ-23 — scenario "the session list shows cards like the mock"
  test('the dot of a working session pulses softly in 2.2 s with a fading ring; an idle dot does not pulse', async ({ page, request }) => {
    const working = await newFolder('dot-working');
    const idle = await newFolder('dot-idle');
    await hostedWithUsage(request, working, 'working');
    await idleHosted(request, idle);
    await openIn(page);
    const dot = dotOf(entry(page, working));
    await expect(entry(page, working).getByText('Running', { exact: true })).toBeVisible();

    const animations = await animationsOf(dot);
    expect(animations, 'one animation on the working dot').toHaveLength(1);
    expect(animations[0]!.duration, '2.2 s cycle').toBe(2200);
    expect(animations[0]!.iterations, 'repeats').toBe(Infinity);
    const frames = await keyframesOf(dot);
    expect(frames.some((f) => f.opacity !== undefined && Math.abs(Number(f.opacity) - 0.8) < 0.001), `opacity goes to 0.8: ${JSON.stringify(frames)}`).toBe(true);
    expect(frames.some((f) => /\b4px\b/.test(String(f.boxShadow ?? ''))), `the ring grows to 4 px: ${JSON.stringify(frames)}`).toBe(true);

    await expect(entry(page, idle)).toBeVisible();
    expect(await animationsOf(dotOf(entry(page, idle))), 'idle dot').toEqual([]);
  });

  // plan-dark_blue_theme/REQ-24 — scenario "no pulse with reduced motion"
  test('with reduced motion the dot of a working session does not pulse', async ({ page, request }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const working = await newFolder('dot-reduced');
    await hostedWithUsage(request, working, 'working');
    await openIn(page);
    await expect(entry(page, working).getByText('Running', { exact: true })).toBeVisible();
    expect(await animationsOf(dotOf(entry(page, working))), 'no animation').toEqual([]);
  });
});

// Windows11Look: the session cards take the look's card corners
test('in the Windows 11 look the session cards take the look\'s overlay corners', async ({ page, request }) => {
  const folder = await newFolder('cards-windows');
  await idleHosted(request, folder);
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LOOK_KEY, 'windows11'] as const);
  await openIn(page);
  await expect(page.locator('html')).toHaveAttribute('data-look', 'windows11');
  const overlay = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--radius-overlay').trim());
  expect(overlay, 'the look defines its overlay corners').not.toBe('');
  expect(await style(entry(page, folder), 'border-top-left-radius')).toBe(await computed(page, 'border-top-left-radius', overlay));
});
