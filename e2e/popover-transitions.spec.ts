// e2e of plan-ui_transitions, batch popovers: the Plan Usage popover, the "needs input" snackbar, the short-message
// toast and the newer-version notice slide up with a fade on enter, and slide down while they fade out on leave.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { currentView } from './motion';

interface Effect {
  duration: number;
  keyframes: { offset: number; opacity: string | undefined; transform: string | undefined }[];
}
interface Snapshot {
  kind: string;
  phase: 'open' | 'leave';
  effects: Effect[];
}

const KINDS = ['plan-usage-popover', 'snackbar', 'short-message', 'update-notice'] as const;

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-popover-motion-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

const banner = (page: Page) => page.getByRole('banner');
const usageButton = (page: Page) => banner(page).getByRole('button', { name: 'Plan Usage', exact: true });
const popover = (page: Page) => page.getByRole('dialog', { name: 'Plan Usage', exact: true });
const allPopovers = (page: Page) => page.locator('.plan-usage-popover');
const snackbar = (page: Page) => page.getByRole('status').filter({ hasText: 'needs your input' });
const allSnackbars = (page: Page) => page.locator('.snackbar');
const toast = (page: Page) => page.getByRole('status').filter({ hasText: 'No session needs input' });
const allToasts = (page: Page) => page.locator('.short-message');
const notice = (page: Page) => page.getByRole('status', { name: 'Update Available' });
const allNotices = (page: Page) => page.locator('.update-notice');
const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
// The view that stays: during the cross-fade of a session switch the leaving view, with its terminal, is still in the page.
const terminal = (page: Page) => currentView(page).locator('.xterm-rows');

/** Shows in the page only the sessions of this file: other tests start sessions on the same server at the same time. */
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

async function startViaApi(request: APIRequestContext, name: string): Promise<string> {
  const folder = path.join(await mkdtemp(path.join(projectsRoot, 't-')), name);
  await mkdir(folder);
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  createdIds.push(((await response.json()) as { id: string }).id);
  return folder;
}

async function postHook(request: APIRequestContext, folder: string, event: Record<string, string>): Promise<void> {
  const sessions = (await (await request.get('/api/sessions')).json()) as { id: string; folder: string }[];
  const id = sessions.find((session) => session.folder === folder)?.id;
  expect(id, `session of ${folder}`).toBeDefined();
  const response = await request.post(`/api/sessions/${id}/hook-events`, { data: event });
  expect(response.status()).toBe(204);
}

/** Answers the newer-version check of the page with a newer release. */
async function offerNewerVersion(page: Page): Promise<void> {
  await page.route('**/api/newer-version', (route) =>
    route.fulfill({
      json: { status: 'newer', installedVersion: '0.1.0', newerVersion: '9.9.0', releaseUrl: 'https://example.com/releases/v9.9.0' },
    }),
  );
}

/** Records the CSS animations of the four elements when each appears and when it starts to leave. */
function installWatcher(kinds: string[]): void {
  {
    const store = window as unknown as { __motion: Snapshot[] };
    store.__motion = [];
    const kindOf = (node: Element) => kinds.find((kind) => node.classList.contains(kind));
    const snap = (node: Element, phase: Snapshot['phase']) => {
      const kind = kindOf(node);
      if (!kind) return;
      getComputedStyle(node).opacity;
      const effects = node
        .getAnimations()
        .filter((animation) => animation instanceof CSSAnimation)
        .map((animation) => ({
          duration: Number(animation.effect?.getComputedTiming().duration ?? 0),
          keyframes: (animation.effect as KeyframeEffect).getKeyframes().map((frame) => ({
            offset: Number(frame.computedOffset),
            opacity: frame.opacity as string | undefined,
            transform: frame.transform as string | undefined,
          })),
        }));
      store.__motion.push({ kind, phase, effects });
    };
    const selector = kinds.map((kind) => `.${kind}`).join(', ');
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'childList') {
          for (const node of record.addedNodes) {
            if (!(node instanceof Element)) continue;
            for (const element of [node, ...node.querySelectorAll(selector)]) if (element.matches(selector)) snap(element, 'open');
          }
        } else if (record.target instanceof Element && record.target.classList.contains('is-leaving') && !record.oldValue?.includes('is-leaving')) {
          snap(record.target, 'leave');
        }
      }
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  }
}

const watchElements = (page: Page) => page.evaluate(installWatcher, [...KINDS]);
/** Installs the watcher before the page scripts run, for an element that appears while the page loads. */
const watchFromLoad = (page: Page) => page.addInitScript(installWatcher, [...KINDS]);

const snapshots = async (page: Page, kind: string) =>
  (await page.evaluate(() => (window as unknown as { __motion: Snapshot[] }).__motion)).filter((snapshot) => snapshot.kind === kind);

/** The vertical shift in px of a `translateY(...)`, `translate(...)` or `matrix(...)` transform; 0 for none. */
function shiftOf(transform: string | undefined): number {
  if (!transform || transform === 'none') return 0;
  const translateY = transform.match(/translateY\(\s*(-?[\d.]+)px/);
  if (translateY) return Number(translateY[1]);
  const translate = transform.match(/translate(?:3d)?\(\s*-?[\d.]+px\s*,\s*(-?[\d.]+)px/);
  if (translate) return Number(translate[1]);
  const matrix = transform.match(/matrix\(([^)]*)\)/);
  if (matrix) return Number(matrix[1]?.split(',')[5]);
  return Number.NaN;
}

const framesAt = (effects: Effect[], offset: number) => effects.flatMap((effect) => effect.keyframes).filter((frame) => frame.offset === offset);
/**
 * At `offset` the element is transparent and a few pixels off its place: lower (`direction` 1) or higher (-1). The fade
 * and the shift may come from two effects that play together.
 */
const offPlaceAndTransparentAt = (effects: Effect[], offset: number, direction: 1 | -1 = 1) => {
  const frames = framesAt(effects, offset);
  const shifted = (frame: Effect['keyframes'][number]) => {
    const shift = shiftOf(frame.transform) * direction;
    return shift > 0 && shift <= 24;
  };
  return frames.some((frame) => Number(frame.opacity) === 0) && frames.some(shifted);
};

function expectRiseIn(snapshot: Snapshot | undefined, label: string, direction: 1 | -1 = 1): void {
  expect(snapshot, `${label}: no opening recorded`).toBeDefined();
  const { effects } = snapshot as Snapshot;
  const where = direction === 1 ? 'lower' : 'higher';
  expect(offPlaceAndTransparentAt(effects, 0, direction), `${label}: starts ${where} and transparent ${JSON.stringify(effects)}`).toBe(true);
  for (const effect of effects) expect(effect.duration, `${label}: opening duration`).toBeGreaterThan(0);
}

function expectRiseOut(snapshot: Snapshot | undefined, label: string, direction: 1 | -1 = 1): void {
  expect(snapshot, `${label}: no leaving recorded`).toBeDefined();
  const { effects } = snapshot as Snapshot;
  const where = direction === 1 ? 'lower' : 'higher';
  expect(offPlaceAndTransparentAt(effects, 1, direction), `${label}: ends ${where} and transparent ${JSON.stringify(effects)}`).toBe(true);
  for (const effect of effects) expect(effect.duration, `${label}: leaving duration`).toBeGreaterThan(0);
}

/** Makes the exit effect last long enough to act on a leaving element deterministically. */
async function slowExit(page: Page): Promise<void> {
  await page.evaluate(() => document.documentElement.style.setProperty('--motion-duration-exit', '1500ms'));
}

/** True when the topmost element at the centre of `target` is outside it: the pointer goes through. */
async function pointerGoesThrough(target: Locator): Promise<boolean> {
  return target.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return top === null || !element.contains(top);
  });
}

// plan-ui_transitions/REQ-3, REQ-4 — the Plan Usage popover hangs under its title-bar button: it drops from it on
// open and lifts back to it on close
test('the Plan Usage popover drops from its button with a fade on open, and lifts back while it fades out on close', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const folder = await startViaApi(request, 'usage-motion');
  await page.goto('/');
  await expect(entry(page, folder)).toBeVisible();
  await watchElements(page);

  await usageButton(page).click();
  await expect(popover(page)).toBeVisible();
  await popover(page).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(popover(page)).toHaveCount(0, { timeout: 100 });
  await expect(allPopovers(page)).toHaveCount(0, { timeout: 1000 });

  const [opening, leaving] = await snapshots(page, 'plan-usage-popover');
  expect(opening?.phase).toBe('open');
  expectRiseIn(opening, 'Plan Usage', -1);
  expect(leaving?.phase).toBe('leave');
  expectRiseOut(leaving, 'Plan Usage', -1);
});

// plan-ui_transitions/REQ-26, REQ-27, REQ-28: the close button works from the first frame; a leaving popover takes
// no pointer input; a reopen during the exit wins
test('the Plan Usage popover closes at once while it enters, lets the pointer through while it leaves, and reopens at once', async ({ page }) => {
  await showOnlyOwnSessions(page);
  await page.goto('/');
  await slowExit(page);

  await usageButton(page).click();
  // force: the click lands while the popover still moves.
  await popover(page).getByRole('button', { name: 'Close', exact: true }).click({ force: true, timeout: 100 });
  await expect(popover(page), 'closed: no longer exposed').toHaveCount(0, { timeout: 100 });
  await expect(allPopovers(page), 'the popover plays its exit').toHaveCount(1);
  await expect(allPopovers(page)).toHaveAttribute('aria-hidden', 'true');
  expect(await pointerGoesThrough(allPopovers(page)), 'the leaving popover takes no pointer input').toBe(true);

  await usageButton(page).click({ timeout: 1000 });
  await expect(popover(page)).toBeVisible();
  await expect(allPopovers(page)).toHaveCount(1);
  await page.waitForTimeout(1800);
  await expect(popover(page), 'the old exit does not close the reopened popover').toBeVisible();
});

// plan-ui_transitions/REQ-3, REQ-4, REQ-26, REQ-28 — scenario "the snackbar acts while it is still entering"
test('"Open" on the snackbar while it slides in opens the session, and the snackbar slides down while it fades out', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const shown = await startViaApi(request, 'shown-session');
  const waiting = await startViaApi(request, 'waiting-session');
  await page.goto('/');
  await entry(page, shown).getByTitle(shown, { exact: true }).click();
  await expect(terminal(page)).toContainText(`CWD:${shown}`);
  await watchElements(page);

  await postHook(request, waiting, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  // force: the click lands while the snackbar still moves, as a user's would.
  await snackbar(page).getByRole('button', { name: 'Open', exact: true }).click({ force: true });

  await expect(terminal(page)).toContainText(`CWD:${waiting}`);
  await expect(entry(page, waiting)).toHaveAttribute('aria-current', 'true');
  await expect(allSnackbars(page)).toHaveCount(0, { timeout: 1000 });

  const [opening, leaving] = await snapshots(page, 'snackbar');
  expectRiseIn(opening, 'snackbar');
  expect(leaving?.phase).toBe('leave');
  expectRiseOut(leaving, 'snackbar');
});

// plan-ui_transitions/REQ-3, REQ-4 — scenario "the short-message toast enters and leaves"
test('"No session needs input" slides up with a fade, and after 4 s slides down while it fades out', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const folder = await startViaApi(request, 'idle-session');
  await page.goto('/');
  await expect(entry(page, folder)).toBeVisible();
  await watchElements(page);

  await page.keyboard.press('Alt+KeyI');
  await expect(toast(page)).toBeVisible({ timeout: 1000 });
  await expect(allToasts(page)).toHaveCount(0, { timeout: 6000 });

  const [opening, leaving] = await snapshots(page, 'short-message');
  expectRiseIn(opening, 'toast');
  expect(leaving?.phase).toBe('leave');
  expectRiseOut(leaving, 'toast');
});

// plan-ui_transitions/REQ-28 (ShortMessageToast spec): a new text while it shows replaces the text, with no new enter effect
test('pressing the shortcut again while the toast shows keeps the same toast with no new enter effect', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const folder = await startViaApi(request, 'idle-again');
  await page.goto('/');
  await expect(entry(page, folder)).toBeVisible();
  await watchElements(page);

  await page.keyboard.press('Alt+KeyI');
  await expect(toast(page)).toBeVisible({ timeout: 1000 });
  await toast(page).evaluate((element) => element.setAttribute('data-first-toast', ''));
  await page.waitForTimeout(500);
  await page.keyboard.press('Alt+KeyI');
  await page.waitForTimeout(300);

  await expect(allToasts(page)).toHaveCount(1);
  await expect(allToasts(page), 'the same box').toHaveAttribute('data-first-toast', '');
  await expect(allToasts(page)).not.toHaveClass(/is-leaving/);
  const records = await snapshots(page, 'short-message');
  expect(records.map((record) => record.phase), 'one enter effect only').toEqual(['open']);
});

// plan-ui_transitions/REQ-3, REQ-4, REQ-26: the newer-version notice rises in; its close button works at once; the leaving
// notice is hidden from assistive technologies and lets the pointer through
test('the newer-version notice slides up with a fade, closes at once and slides down while it fades out', async ({ page }) => {
  await offerNewerVersion(page);
  await watchFromLoad(page);
  await page.goto('/');
  await slowExit(page);

  await notice(page).getByRole('button', { name: 'Close Update Notice', exact: true }).click({ force: true, timeout: 2000 });
  await expect(notice(page)).toHaveCount(0, { timeout: 100 });
  await expect(allNotices(page), 'the notice plays its exit').toHaveCount(1);
  await expect(allNotices(page)).toHaveAttribute('aria-hidden', 'true');
  expect(await pointerGoesThrough(allNotices(page)), 'the leaving notice takes no pointer input').toBe(true);
  await expect(allNotices(page)).toHaveCount(0, { timeout: 3000 });

  const records = await snapshots(page, 'update-notice');
  expect(records.map((record) => record.phase)).toEqual(['open', 'leave']);
  expectRiseIn(records[0], 'notice');
  expectRiseOut(records[1], 'notice');
});

// plan-ui_transitions/REQ-3, REQ-4 with reduced motion: the elements appear and go at once
test('with reduced motion the Plan Usage popover and the toast appear and go with no effect', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await showOnlyOwnSessions(page);
  const folder = await startViaApi(request, 'reduced-motion');
  await page.goto('/');
  await expect(entry(page, folder)).toBeVisible();
  await watchElements(page);

  await usageButton(page).click();
  await expect(popover(page)).toBeVisible();
  await popover(page).getByRole('button', { name: 'Close', exact: true }).click();
  expect(await allPopovers(page).count(), 'the popover goes at once').toBe(0);

  await page.keyboard.press('Alt+KeyI');
  await expect(toast(page)).toBeVisible({ timeout: 1000 });
  await expect(allToasts(page)).toHaveCount(0, { timeout: 6000 });

  for (const kind of ['plan-usage-popover', 'short-message']) {
    const records = await snapshots(page, kind);
    expect(records.map((record) => record.phase), `${kind}: no leaving phase`).toEqual(['open']);
    for (const effect of records[0]?.effects ?? []) expect(effect.duration, `${kind}: no opening effect`).toBe(0);
  }
});
