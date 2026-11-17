// e2e of plan-ui_transitions, batch tab-change: cross-check of the common rules over every effect of the plan, on one
// user journey that plays them all (dialog, popover, Git Explorer slide, session switch, theme dissolve, list cascade, tab change).
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';
import { cardOf, settingsButton, settingsPopup } from './settings';

interface Played {
  kind: string;
  name: string;
  target: string;
  duration: number;
  delay: number;
  // null for an endless animation: Infinity does not survive JSON.
  iterations: number | null;
  easing: string;
  from: string;
  to: string;
}

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-motion-rules-')));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

test.afterAll(async () => {
  await rm(projectsRoot, { recursive: true, force: true });
});

const git = (folder: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: folder, encoding: 'utf8' });

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const mainArea = (page: Page) => page.getByRole('main');
/** The terminal of a session: during a cross-fade two terminals are in the page. */
const terminalOf = (page: Page, folder: string) => page.locator('.xterm-rows').filter({ hasText: `CWD:${folder}` });
const explorerButton = (page: Page) => mainArea(page).locator('.session-header').getByRole('button', { name: 'Git Explorer', exact: true });
const explorer = (page: Page) => mainArea(page).getByRole('region', { name: 'Git Explorer', exact: true });
const usageButton = (page: Page) => page.getByRole('banner').getByRole('button', { name: 'Plan Usage', exact: true });
const usagePopover = (page: Page) => page.getByRole('dialog', { name: 'Plan Usage', exact: true });

async function startHosted(request: APIRequestContext, folder: string): Promise<void> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  createdIds.push(((await response.json()) as { id: string }).id);
}

/** Shows in the page only the sessions of this file: other tests start sessions on the same server, which would slide in. */
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

/** Two hosted sessions: a plain folder and a git repository. */
async function twoSessions(request: APIRequestContext, name: string): Promise<{ plain: string; repo: string }> {
  const base = await mkdtemp(path.join(projectsRoot, `${name}-`));
  const plain = path.join(base, 'plain');
  const repo = path.join(base, 'repo');
  await mkdir(plain);
  await mkdir(repo);
  git(repo, 'init', '-q', '-b', 'main');
  await writeFile(path.join(repo, 'README.md'), 'hello\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'first');
  await startHosted(request, plain);
  await startHosted(request, repo);
  return { plain, repo };
}

/** Records, from the first frame of the page, every animation and transition it plays, view transitions included. */
function installRecorder(): void {
  const played: Played[] = [];
  (window as unknown as { __played: Played[] }).__played = played;
  const seen = new WeakSet<Animation>();
  const describe = (element: Element | null) => (element ? `${element.tagName.toLowerCase()}.${[...element.classList].join('.')}` : '?');
  const frame = (keyframe: Keyframe | undefined) => `${String(keyframe?.opacity ?? '')}|${String(keyframe?.transform ?? '')}`;
  const record = (animation: Animation) => {
    if (seen.has(animation)) return;
    seen.add(animation);
    const effect = animation.effect as KeyframeEffect | null;
    const timing = effect?.getComputedTiming();
    const keyframes = effect?.getKeyframes() ?? [];
    played.push({
      kind: animation.constructor.name,
      name:
        animation instanceof CSSAnimation ? animation.animationName : animation instanceof CSSTransition ? animation.transitionProperty : animation.id,
      target: `${describe(effect?.target ?? null)}${effect?.pseudoElement ?? ''}`,
      duration: Number(timing?.duration ?? 0),
      delay: Number(timing?.delay ?? 0),
      iterations: Number(timing?.iterations ?? 1),
      easing: String(timing?.easing === 'linear' ? (keyframes[0]?.easing ?? 'linear') : timing?.easing),
      from: frame(keyframes[0]),
      to: frame(keyframes[keyframes.length - 1]),
    });
  };
  const sweep = () => {
    for (const animation of document.getAnimations()) record(animation);
  };
  const onEvent = (event: Event) => {
    const target = event.target;
    if (target instanceof Element) for (const animation of target.getAnimations()) record(animation);
    sweep();
  };
  for (const type of ['animationstart', 'transitionrun']) document.addEventListener(type, onEvent, true);
  const tick = () => {
    sweep();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const playedOf = (page: Page) => page.evaluate(() => (window as unknown as { __played: Played[] }).__played);

/**
 * Plays every effect of the plan: the list cascade at start, a session switch, the Settings dialog with a menu change and
 * a theme change and back, the Plan Usage popover, a second session switch, the Git Explorer with a tab change.
 */
async function journey(page: Page, sessions: { plain: string; repo: string }): Promise<void> {
  await showOnlyOwnSessions(page);
  await page.goto('/');
  await expect(entry(page, sessions.repo)).toBeVisible();
  await page.waitForTimeout(800);

  await entry(page, sessions.plain).getByTitle(sessions.plain, { exact: true }).click();
  await expect(terminalOf(page, sessions.plain)).toBeVisible();
  await page.waitForTimeout(500);

  await settingsButton(page).click();
  const popup = settingsPopup(page);
  await expect(popup).toBeVisible();
  await page.waitForTimeout(400);
  await popup.getByRole('tab', { name: 'Shortcuts', exact: true }).click();
  await page.waitForTimeout(400);
  await popup.getByRole('tab', { name: 'Appearance', exact: true }).click();
  await page.waitForTimeout(400);
  const theme = await page.locator('html').getAttribute('data-theme');
  const original = theme === 'light' ? 'Light' : theme === 'dark-blue' ? 'Dark Blue' : 'Dark';
  await cardOf(popup.getByRole('radio', { name: original === 'Light' ? 'Dark' : 'Light', exact: true })).click();
  await page.waitForTimeout(500);
  await cardOf(popup.getByRole('radio', { name: original, exact: true })).click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await page.waitForTimeout(400);

  await usageButton(page).click();
  await expect(usagePopover(page)).toBeVisible();
  await page.waitForTimeout(400);
  await usagePopover(page).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(usagePopover(page)).toHaveCount(0);
  await page.waitForTimeout(400);

  await entry(page, sessions.repo).getByTitle(sessions.repo, { exact: true }).click();
  await expect(terminalOf(page, sessions.repo)).toBeVisible();
  await page.waitForTimeout(500);

  await explorerButton(page).click();
  await expect(explorer(page)).toBeVisible();
  await page.waitForTimeout(500);
  await explorer(page).getByRole('tab', { name: 'History', exact: true }).click();
  await page.waitForTimeout(400);
  await explorerButton(page).click();
  await expect(explorer(page)).toHaveCount(0, { timeout: 2000 });
  await page.waitForTimeout(500);
}

/** The new effects of the plan: finite CSS animations, the view transition of the theme dissolve included. */
const effectsOf = (played: Played[]) => played.filter((p) => p.kind === 'CSSAnimation' && Number.isFinite(p.iterations ?? Number.POSITIVE_INFINITY));
const isCascade = (p: Played) => p.target.includes('cascade-item');
const show = (played: Played[]) => JSON.stringify(played.map((p) => `${p.name} ${p.target} ${p.duration}+${p.delay}`));

/** One kind of effect per entry: each must be played by the journey. */
const EFFECTS: [string, (p: Played) => boolean][] = [
  ['modal dialog', (p) => p.target.includes('modal')],
  ['popover', (p) => p.target.includes('plan-usage-popover')],
  ['Git Explorer slide', (p) => p.target.includes('git-explorer-panel')],
  ['session switch', (p) => p.target.includes('main-view')],
  ['theme dissolve', (p) => p.target.includes('::view-transition')],
  ['list cascade', isCascade],
  ['tab change', (p) => p.target.includes('tabpanel') || p.target.includes('settings-pane')],
];

/** What the effect looks like, without its target or its place in a cascade. */
const signature = (p: Played) => `${p.name} ${p.duration} ${p.easing} ${p.from} -> ${p.to}`;

// plan-ui_transitions/REQ-31: every effect of the journey lasts at most 300 ms, a whole cascade ends within 600 ms
test('every effect of a journey through all seven effects lasts at most 300 ms, and the list cascade ends within 600 ms', async ({ page, request }) => {
  test.setTimeout(90_000);
  const sessions = await twoSessions(request, 'limits');
  await page.addInitScript(installRecorder);
  await journey(page, sessions);
  const effects = effectsOf(await playedOf(page));

  for (const [label, matches] of EFFECTS) expect(effects.some(matches), `${label} played: ${show(effects)}`).toBe(true);
  for (const effect of effects) {
    expect(effect.duration, `${effect.name} on ${effect.target}`).toBeGreaterThan(0);
    expect(effect.duration, `${effect.name} on ${effect.target}`).toBeLessThanOrEqual(300);
  }
  for (const item of effects.filter(isCascade)) expect(item.delay + item.duration, `cascade item ends within 600 ms: ${show([item])}`).toBeLessThanOrEqual(600);
});

// plan-ui_transitions/REQ-32: the same effects, with the same timing and keyframes, in the 3 themes and 2 looks
test('the effects look the same in every theme and window look', async ({ browser, request }) => {
  test.setTimeout(480_000);
  const sessions = await twoSessions(request, 'looks');
  const combos = (['dark', 'light', 'dark-blue'] as const).flatMap((theme) => (['vexel', 'windows11'] as const).map((look) => ({ theme, look })));
  const results: { combo: string; signatures: string[] }[] = [];
  for (const { theme, look } of combos) {
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    await context.addInitScript(
      ([themeValue, lookValue]) => {
        localStorage.setItem('ai-client.theme', themeValue!);
        localStorage.setItem('ai-client.look', lookValue!);
      },
      [theme, look],
    );
    const page = await context.newPage();
    await page.addInitScript(installRecorder);
    await journey(page, sessions);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('html')).toHaveAttribute('data-look', look);
    const signatures = [...new Set(effectsOf(await playedOf(page)).map(signature))].sort();
    results.push({ combo: `${theme}/${look}`, signatures });
    await context.close();
  }
  const [first, ...others] = results;
  expect(first!.signatures.length).toBeGreaterThan(0);
  for (const other of others) expect(other.signatures, `${other.combo} against ${first!.combo}`).toEqual(first!.signatures);
});

// plan-ui_transitions/REQ-25, REQ-32 — scenario "with reduced motion every change is immediate"
for (const { theme, look } of [
  { theme: 'dark', look: 'vexel' },
  { theme: 'light', look: 'windows11' },
] as const) {
  test(`with reduced motion every change of the journey happens at once, in ${theme} with the ${look} look`, async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(
      ([themeValue, lookValue]) => {
        localStorage.setItem('ai-client.theme', themeValue!);
        localStorage.setItem('ai-client.look', lookValue!);
      },
      [theme, look],
    );
    const sessions = await twoSessions(request, `reduced-${theme}`);
    await page.addInitScript(installRecorder);
    await journey(page, sessions);
    await expect(page.locator('html')).toHaveAttribute('data-look', look);

    const moving = effectsOf(await playedOf(page)).filter((p) => p.duration > 0 || p.delay > 0);
    expect(moving, `no effect plays: ${show(moving)}`).toEqual([]);
  });
}

// plan-ui_transitions/REQ-29 — scenario "with reduced motion every change is immediate" (the user starts the app)
test('when the app starts, nothing that shows plays an opening effect; only the list cascade plays', async ({ page, request }) => {
  const sessions = await twoSessions(request, 'start');
  await showOnlyOwnSessions(page);
  await page.goto('/');
  await entry(page, sessions.repo).getByTitle(sessions.repo, { exact: true }).click();
  await expect(terminalOf(page, sessions.repo)).toBeVisible();
  await explorerButton(page).click();
  await expect(explorer(page)).toBeVisible();

  await page.addInitScript(installRecorder);
  await page.reload();
  await expect(entry(page, sessions.repo)).toBeVisible();
  await page.waitForTimeout(1500);

  const effects = effectsOf(await playedOf(page)).filter((p) => !isCascade(p));
  expect(effects, `no opening effect at start: ${show(effects)}`).toEqual([]);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});
