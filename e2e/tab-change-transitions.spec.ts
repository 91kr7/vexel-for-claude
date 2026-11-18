// e2e of plan-ui_transitions, batch tab-change: the panel that shows after a tab change of the Git Explorer or a menu
// change of Settings fades in with a small rise; the hidden one goes at once.
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { pageSettled } from './motion';
import { cardOf, settingsButton, settingsPopup } from './settings';

interface Effect {
  duration: number;
  playState: string;
  from: { opacity: string | undefined; transform: string | undefined };
}
interface Shown {
  label: string;
  effects: Effect[];
}
interface Watch {
  shown: Shown[];
  maxVisible: number;
}

const SLOW_MS = 1500;

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-tab-motion-')));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

test.afterAll(async () => {
  await rm(projectsRoot, { recursive: true, force: true });
});

const git = (folder: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: folder, encoding: 'utf8' });

async function newRepository(name: string): Promise<string> {
  const root = path.join(await mkdtemp(path.join(projectsRoot, 'r-')), name);
  await mkdir(root);
  git(root, 'init', '-q', '-b', 'main');
  await writeFile(path.join(root, 'README.md'), 'hello\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'first');
  return root;
}

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const mainArea = (page: Page) => page.getByRole('main');
const terminal = (page: Page) => page.locator('.xterm-rows');
const explorerButton = (page: Page) => mainArea(page).locator('.session-header').getByRole('button', { name: 'Git Explorer', exact: true });
const explorer = (page: Page) => mainArea(page).getByRole('region', { name: 'Git Explorer', exact: true });
const gitTab = (page: Page, name: string) => explorer(page).getByRole('tab', { name, exact: true });
const gitPanel = (page: Page, name: string) => explorer(page).getByRole('tabpanel', { name, exact: true });
const menuItem = (page: Page, name: string) => settingsPopup(page).getByRole('tab', { name, exact: true });
const pane = (page: Page, name: string) => settingsPopup(page).getByRole('tabpanel', { name, exact: true });

const GIT_PANELS = '.git-explorer-panel [role="tabpanel"]';
const SETTINGS_PANES = '[role="dialog"] [role="tabpanel"]';

async function openRepositorySession(page: Page, request: APIRequestContext, name: string): Promise<void> {
  const repo = await newRepository(name);
  const response = await request.post('/api/sessions', { data: { path: repo } });
  expect(response.status()).toBe(201);
  createdIds.push(((await response.json()) as { id: string }).id);
  await page.goto('/');
  await entry(page, repo).getByTitle(repo, { exact: true }).click();
  await expect(terminal(page)).toContainText(`CWD:${repo}`);
}

/**
 * Records each tab panel matching `selector` when it shows (mounted visible, or `hidden` removed), with its own CSS
 * animations at that moment, and the largest number of these panels visible at the same frame.
 */
function installTabWatcher(selector: string): void {
  const watch: Watch = { shown: [], maxVisible: 0 };
  (window as unknown as { __tabs: Watch }).__tabs = watch;
  const labelOf = (panel: Element) => document.getElementById(panel.getAttribute('aria-labelledby') ?? '')?.textContent?.trim() ?? '?';
  const visible = (panel: Element) => panel instanceof HTMLElement && !panel.hidden && panel.checkVisibility();
  const snap = (panel: Element) => {
    getComputedStyle(panel).opacity;
    const effects = panel
      .getAnimations()
      .filter((animation) => animation instanceof CSSAnimation)
      .map((animation) => {
        const first = (animation.effect as KeyframeEffect).getKeyframes()[0];
        return {
          duration: Number(animation.effect?.getComputedTiming().duration ?? 0),
          playState: animation.playState,
          from: { opacity: first?.opacity as string | undefined, transform: first?.transform as string | undefined },
        };
      });
    watch.shown.push({ label: labelOf(panel), effects });
  };
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'childList') {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          for (const panel of [node, ...node.querySelectorAll(selector)]) if (panel.matches(selector) && visible(panel)) snap(panel);
        }
      } else if (record.target instanceof Element && record.target.matches(selector) && record.oldValue !== null && visible(record.target)) {
        snap(record.target);
      }
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'], attributeOldValue: true });
  const tick = () => {
    const count = [...document.querySelectorAll(selector)].filter(visible).length;
    watch.maxVisible = Math.max(watch.maxVisible, count);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const watchTabs = (page: Page, selector: string) => page.evaluate(installTabWatcher, selector);
const tabWatch = (page: Page) => page.evaluate(() => (window as unknown as { __tabs: Watch }).__tabs);

async function slowMotion(page: Page): Promise<void> {
  await page.evaluate((ms) => document.documentElement.style.setProperty('--motion-duration-enter', `${ms}ms`), SLOW_MS);
}

interface ThemeClick {
  effectsAtClick: number;
  appliedMs: number;
  effectsAtApply: number;
}

/** Records in the page the first click on a theme card: from the runner, a loaded machine adds its round trips to the app's time. */
function recordThemeClick(): void {
  const record: ThemeClick = { effectsAtClick: -1, appliedMs: Infinity, effectsAtApply: -1 };
  (window as unknown as { __themeClick: ThemeClick }).__themeClick = record;
  let clickAt: number | null = null;
  let section: Element | null = null;
  const playing = () =>
    section?.getAnimations().filter((animation) => animation instanceof CSSAnimation && animation.playState === 'running').length ?? 0;
  document.addEventListener(
    'click',
    (event) => {
      const card = event.target instanceof Element ? event.target.closest('.settings-card') : null;
      if (clickAt !== null || !card) return;
      clickAt = performance.now();
      section = card.closest('[role="tabpanel"]');
      record.effectsAtClick = playing();
    },
    true,
  );
  new MutationObserver(() => {
    if (clickAt === null || record.effectsAtApply !== -1) return;
    record.appliedMs = performance.now() - clickAt;
    record.effectsAtApply = playing();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

const runningEffects = (panel: Locator) =>
  panel.evaluate((element) => element.getAnimations().filter((animation) => animation instanceof CSSAnimation && animation.playState === 'running').length);

/** The panel fades in from transparent with a 4 px rise, within 300 ms (plan-ui_transitions/REQ-31). */
function expectTabEffect(shown: Shown | undefined, label: string): void {
  expect(shown, `${label}: shown`).toBeDefined();
  expect(shown!.label).toBe(label);
  const effects = shown!.effects;
  expect(effects.length, `${label}: an effect plays ${JSON.stringify(effects)}`).toBeGreaterThan(0);
  expect(
    effects.some((effect) => Number(effect.from.opacity) === 0),
    `${label}: starts transparent ${JSON.stringify(effects)}`,
  ).toBe(true);
  expect(
    effects.some((effect) => /translateY\(4px\)|matrix\(1, 0, 0, 1, 0, 4\)/.test(effect.from.transform ?? '')),
    `${label}: starts 4 px lower ${JSON.stringify(effects)}`,
  ).toBe(true);
  for (const effect of effects) {
    expect(effect.duration, `${label}: duration`).toBeGreaterThan(0);
    expect(effect.duration, `${label}: duration`).toBeLessThanOrEqual(300);
  }
}

function expectNoEffect(shown: Shown | undefined, label: string): void {
  expect(shown, `${label}: shown`).toBeDefined();
  expect(shown!.label).toBe(label);
  for (const effect of shown!.effects) expect(effect.duration, `${label}: no effect ${JSON.stringify(shown)}`).toBe(0);
}

test.describe('Git Explorer tab change', () => {
  // plan-ui_transitions/REQ-23, REQ-31 — scenario "switching tabs fades in the new content"
  test('each real tab change fades the new panel in with a small rise; the panel shown at open and a click on the selected tab play nothing', async ({
    page,
    request,
  }) => {
    await openRepositorySession(page, request, 'tab-repo');
    await watchTabs(page, GIT_PANELS);

    await explorerButton(page).click();
    await expect(gitPanel(page, 'Changes')).toBeVisible();
    await pageSettled(page);

    await gitTab(page, 'History').click();
    await expect(gitPanel(page, 'History')).toBeVisible();
    await expect(gitPanel(page, 'Changes')).toBeHidden({ timeout: 50 });
    await pageSettled(page);

    await gitTab(page, 'Changes').click();
    await expect(gitPanel(page, 'Changes')).toBeVisible();
    await pageSettled(page);

    await gitTab(page, 'Changes').click();
    await page.waitForTimeout(100);
    expect(await runningEffects(gitPanel(page, 'Changes')), 'a click on the selected tab plays nothing').toBe(0);

    const watch = await tabWatch(page);
    expect(watch.shown.map((shown) => shown.label)).toEqual(['Changes', 'History', 'Changes']);
    expectNoEffect(watch.shown[0], 'Changes');
    expectTabEffect(watch.shown[1], 'History');
    expectTabEffect(watch.shown[2], 'Changes');
    expect(watch.maxVisible, 'two panels never show together').toBe(1);
  });

  // plan-ui_transitions/REQ-26, REQ-28: the tabs take clicks and keys during the effect, and the last change wins
  test('a click and a key on the tabs during the effect act at once, and the panel of the last tab is the only one shown', async ({ page, request }) => {
    await openRepositorySession(page, request, 'tab-quick-repo');
    await explorerButton(page).click();
    await expect(gitPanel(page, 'Changes')).toBeVisible();
    await pageSettled(page);
    await slowMotion(page);
    await watchTabs(page, GIT_PANELS);

    await gitTab(page, 'History').click();
    await gitTab(page, 'Changes').click({ timeout: 300 });
    await expect(gitTab(page, 'Changes')).toHaveAttribute('aria-selected', 'true', { timeout: 300 });
    await expect(gitPanel(page, 'Changes')).toBeVisible({ timeout: 300 });
    await expect(gitPanel(page, 'History')).toBeHidden({ timeout: 50 });

    await gitTab(page, 'History').focus();
    await page.keyboard.press('Enter');
    await expect(gitTab(page, 'History')).toHaveAttribute('aria-selected', 'true', { timeout: 300 });
    await expect(gitPanel(page, 'History')).toBeVisible({ timeout: 300 });
    expect(await runningEffects(gitPanel(page, 'History')), 'the effect is still playing').toBeGreaterThan(0);

    const watch = await tabWatch(page);
    expect(watch.shown.map((shown) => shown.label)).toEqual(['History', 'Changes', 'History']);
    expect(watch.maxVisible, 'two panels never show together').toBe(1);
  });

  // plan-ui_transitions/REQ-23 with reduced motion (REQ-25)
  test('with reduced motion the new tab panel shows at once with no effect', async ({ page, request }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openRepositorySession(page, request, 'tab-reduced-repo');
    await explorerButton(page).click();
    await expect(gitPanel(page, 'Changes')).toBeVisible();
    await watchTabs(page, GIT_PANELS);

    await gitTab(page, 'History').click();
    await expect(gitPanel(page, 'History')).toBeVisible();
    await gitTab(page, 'Changes').click();
    await expect(gitPanel(page, 'Changes')).toBeVisible();

    const watch = await tabWatch(page);
    expect(watch.shown.map((shown) => shown.label)).toEqual(['History', 'Changes']);
    expectNoEffect(watch.shown[0], 'History');
    expectNoEffect(watch.shown[1], 'Changes');
  });
});

test.describe('Settings menu change', () => {
  // plan-ui_transitions/REQ-24, REQ-31 — scenario "switching tabs fades in the new content"
  test('clicks and arrow keys fade the new section in with a small rise; the section shown on open and a click on the chosen item play nothing', async ({
    page,
  }) => {
    await page.goto('/');
    await watchTabs(page, SETTINGS_PANES);

    await settingsButton(page).click();
    await expect(pane(page, 'Appearance')).toBeVisible();
    await pageSettled(page);

    await menuItem(page, 'Shortcuts').click();
    await expect(pane(page, 'Shortcuts')).toBeVisible();
    await expect(pane(page, 'Appearance')).toBeHidden({ timeout: 50 });
    await pageSettled(page);

    await menuItem(page, 'Shortcuts').click();
    await page.waitForTimeout(100);
    expect(await runningEffects(pane(page, 'Shortcuts')), 'a click on the chosen item plays nothing').toBe(0);

    await menuItem(page, 'Shortcuts').focus();
    await page.keyboard.press('ArrowDown');
    await expect(pane(page, 'Updates')).toBeVisible();
    await pageSettled(page);
    await page.keyboard.press('Home');
    await expect(pane(page, 'Appearance')).toBeVisible();
    await pageSettled(page);

    const watch = await tabWatch(page);
    expect(watch.shown.map((shown) => shown.label)).toEqual(['Appearance', 'Shortcuts', 'Updates', 'Appearance']);
    expectNoEffect(watch.shown[0], 'Appearance');
    expectTabEffect(watch.shown[1], 'Shortcuts');
    expectTabEffect(watch.shown[2], 'Updates');
    expectTabEffect(watch.shown[3], 'Appearance');
    expect(watch.maxVisible, 'two sections never show together').toBe(1);
  });

  // plan-ui_transitions/REQ-26, REQ-27, REQ-28 — scenario "quick arrow keys in Settings end on the last section"
  test('two quick Down presses end on "Updates" with its item focused, and Tab moves on during the effect', async ({ page }) => {
    await page.goto('/');
    await settingsButton(page).click();
    await expect(pane(page, 'Appearance')).toBeVisible();
    await expect(menuItem(page, 'Appearance')).toBeFocused();
    await pageSettled(page);
    await slowMotion(page);
    await watchTabs(page, SETTINGS_PANES);

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(menuItem(page, 'Updates')).toHaveAttribute('aria-selected', 'true', { timeout: 300 });
    await expect(menuItem(page, 'Updates')).toBeFocused({ timeout: 300 });
    await expect(pane(page, 'Updates')).toBeVisible({ timeout: 300 });
    await expect(pane(page, 'Shortcuts')).toBeHidden({ timeout: 50 });
    await expect(pane(page, 'Appearance')).toBeHidden({ timeout: 50 });

    await page.keyboard.press('Tab');
    await expect(settingsPopup(page).getByRole('button', { name: 'Check for Updates', exact: true })).toBeFocused({ timeout: 300 });
    expect(await runningEffects(pane(page, 'Updates')), 'the effect is still playing').toBeGreaterThan(0);

    const watch = await tabWatch(page);
    expect(watch.shown.map((shown) => shown.label)).toEqual(['Shortcuts', 'Updates']);
    expect(watch.maxVisible, 'two sections never show together').toBe(1);
  });

  // plan-ui_transitions/REQ-26: the new section takes clicks while it fades in
  test('a click on a theme card of the section fading in applies the theme at once', async ({ page }) => {
    await page.goto('/');
    await settingsButton(page).click();
    await menuItem(page, 'Shortcuts').click();
    await expect(pane(page, 'Shortcuts')).toBeVisible();
    await pageSettled(page);
    await slowMotion(page);

    await page.evaluate(recordThemeClick);

    await menuItem(page, 'Appearance').click();
    // force: the click lands while the card still rises.
    await cardOf(pane(page, 'Appearance').getByRole('radio', { name: 'Light', exact: true })).click({ force: true });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(pane(page, 'Appearance').getByRole('radio', { name: 'Light', exact: true })).toBeChecked();
    const record = await page.evaluate(() => (window as unknown as { __themeClick: ThemeClick }).__themeClick);
    expect(record.effectsAtClick, 'the click lands while the section fades in').toBeGreaterThan(0);
    expect(record.appliedMs, 'the theme applies at once').toBeLessThan(300);
    expect(record.effectsAtApply, 'the effect is still playing').toBeGreaterThan(0);
  });

  // plan-ui_transitions/REQ-24 with reduced motion (REQ-25)
  test('with reduced motion the new section shows at once with no effect', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await settingsButton(page).click();
    await expect(pane(page, 'Appearance')).toBeVisible();
    await watchTabs(page, SETTINGS_PANES);

    await menuItem(page, 'Shortcuts').click();
    await expect(pane(page, 'Shortcuts')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(pane(page, 'Updates')).toBeVisible();

    const watch = await tabWatch(page);
    expect(watch.shown.map((shown) => shown.label)).toEqual(['Shortcuts', 'Updates']);
    expectNoEffect(watch.shown[0], 'Shortcuts');
    expectNoEffect(watch.shown[1], 'Updates');
  });
});
