// e2e of plan-ui_transitions, batch modal-dialogs: the fade and zoom of the modal dialogs on open and close.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';
import { presses, recordPresses } from './motion';
import { settingsButton, settingsPopup } from './settings';

interface Effect {
  duration: number;
  keyframes: { offset: number; opacity: string | undefined; transform: string | undefined }[];
}
interface Snapshot {
  phase: 'open' | 'leave';
  backdrop: Effect[];
  frame: Effect[];
  // The dialog frame is hidden from assistive technologies, and its `aria-modal`.
  hidden: boolean;
  modal: string | null;
}

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-dialog-motion-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

const backdrops = (page: Page) => page.locator('.modal-backdrop');
const leavingBackdrops = (page: Page) => page.locator('.modal-backdrop.is-leaving');
const chooser = (page: Page) => page.getByRole('dialog', { name: 'New Claude Code Session' });
const history = (page: Page) => page.getByRole('dialog', { name: 'Resume Session' });
const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const terminal = (page: Page) => page.locator('.xterm-rows');
const confirmation = (page: Page) => page.getByRole('alertdialog', { name: 'Terminate the Session?' });

/** Records the CSS animations of every dialog backdrop and frame when it appears and when it starts to leave. */
async function watchDialogs(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = window as unknown as { __motion: Snapshot[] };
    store.__motion = [];
    const effects = (node: Element | null): Effect[] =>
      (node?.getAnimations() ?? [])
        .filter((animation) => animation instanceof CSSAnimation)
        .map((animation) => ({
          duration: Number(animation.effect?.getComputedTiming().duration ?? 0),
          keyframes: (animation.effect as KeyframeEffect).getKeyframes().map((frame) => ({
            offset: Number(frame.computedOffset),
            opacity: frame.opacity as string | undefined,
            transform: frame.transform as string | undefined,
          })),
        }));
    const snap = (backdrop: Element, phase: Snapshot['phase']) => {
      getComputedStyle(backdrop).opacity;
      const frame = backdrop.querySelector('[role="dialog"], [role="alertdialog"]');
      store.__motion.push({
        phase,
        backdrop: effects(backdrop),
        frame: effects(frame),
        hidden: frame?.closest('[aria-hidden="true"]') != null,
        modal: frame?.getAttribute('aria-modal') ?? null,
      });
    };
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'childList') {
          for (const node of record.addedNodes) {
            if (!(node instanceof Element)) continue;
            const backdrop = node.matches('.modal-backdrop') ? node : node.querySelector('.modal-backdrop');
            if (backdrop) snap(backdrop, 'open');
          }
        } else if (record.target instanceof Element && record.target.matches('.modal-backdrop.is-leaving') && !record.oldValue?.includes('is-leaving')) {
          snap(record.target, 'leave');
        }
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  });
}

const snapshots = (page: Page) => page.evaluate(() => (window as unknown as { __motion: Snapshot[] }).__motion);

/** The first number of a `scale(...)` or `matrix(...)` transform. */
const scaleOf = (transform: string | undefined) => Number(transform?.match(/(?:scale|matrix)\(\s*([\d.]+)/)?.[1] ?? Number.NaN);
const frameAt = (effects: Effect[], offset: number) => effects.flatMap((effect) => effect.keyframes).filter((frame) => frame.offset === offset);
const transparentAt = (effects: Effect[], offset: number) => frameAt(effects, offset).some((frame) => Number(frame.opacity) === 0);
const slightZoomAt = (effects: Effect[], offset: number) =>
  frameAt(effects, offset).some((frame) => {
    const scale = scaleOf(frame.transform);
    return scale >= 0.9 && scale < 1;
  });

/** Checks the opening snapshot: backdrop fades in, frame zooms in slightly from transparent, each within 300 ms. */
function expectOpening(snapshot: Snapshot | undefined, label: string): void {
  expect(snapshot, `${label}: no opening recorded`).toBeDefined();
  const { backdrop, frame } = snapshot as Snapshot;
  expect(transparentAt(backdrop, 0), `${label}: backdrop fades in ${JSON.stringify(backdrop)}`).toBe(true);
  expect(transparentAt(frame, 0), `${label}: frame starts transparent ${JSON.stringify(frame)}`).toBe(true);
  expect(slightZoomAt(frame, 0), `${label}: frame starts slightly smaller ${JSON.stringify(frame)}`).toBe(true);
  // plan-ui_transitions/REQ-31
  for (const effect of [...backdrop, ...frame]) {
    expect(effect.duration, `${label}: opening duration`).toBeGreaterThan(0);
    expect(effect.duration, `${label}: opening duration`).toBeLessThanOrEqual(300);
  }
}

/** Checks the leaving snapshot: closed at once (hidden, not modal), frame zooms out slightly, backdrop fades out, each within 300 ms. */
function expectLeaving(snapshot: Snapshot | undefined, label: string): void {
  expect(snapshot, `${label}: no leaving recorded`).toBeDefined();
  const { backdrop, frame, hidden, modal } = snapshot as Snapshot;
  expect(hidden, `${label}: closed, no longer exposed from the start of its exit`).toBe(true);
  expect(modal, `${label}: no aria-modal while it leaves`).toBeNull();
  expect(transparentAt(backdrop, 1), `${label}: backdrop fades out ${JSON.stringify(backdrop)}`).toBe(true);
  expect(slightZoomAt(frame, 1), `${label}: frame ends slightly smaller ${JSON.stringify(frame)}`).toBe(true);
  // plan-ui_transitions/REQ-31
  for (const effect of [...backdrop, ...frame]) {
    expect(effect.duration, `${label}: leaving duration`).toBeGreaterThan(0);
    expect(effect.duration, `${label}: leaving duration`).toBeLessThanOrEqual(300);
  }
}

/** Makes the exit effect last long enough to act on a leaving dialog deterministically. */
async function slowExit(page: Page): Promise<void> {
  await page.evaluate(() => document.documentElement.style.setProperty('--motion-duration-exit', '1500ms'));
}

async function openWorkingSession(page: Page, request: APIRequestContext, name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  createdIds.push(((await response.json()) as { id: string }).id);
  await page.goto('/');
  await entry(page, folder).getByTitle(folder, { exact: true }).click();
  await expect(terminal(page)).toContainText('READY');
  await page.locator('.xterm-screen').click();
  await page.keyboard.type('WORK');
  await page.keyboard.press('Enter');
  await expect(entry(page, folder)).toContainText('Running');
  return folder;
}

// plan-ui_transitions/REQ-1, REQ-2, REQ-27 — scenario "a dialog opens with a zoom and closes with the reverse"
test('Settings fades and zooms in on open, Esc closes it at once and it zooms out while fading', async ({ page }) => {
  await page.goto('/');
  await watchDialogs(page);

  await settingsButton(page).click();
  await expect(settingsPopup(page)).toBeVisible();
  // plan-ui_transitions/REQ-27: the focus is in the dialog from the start
  await expect.poll(() => settingsPopup(page).evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);

  await page.keyboard.press('Escape');
  await expect(settingsPopup(page)).toHaveCount(0);
  await expect(backdrops(page)).toHaveCount(0, { timeout: 1000 });

  const [opening, leaving] = await snapshots(page);
  expectOpening(opening, 'Settings');
  expect(leaving?.phase).toBe('leave');
  expectLeaving(leaving, 'Settings');
});

// plan-ui_transitions/REQ-1, REQ-2: the New session and Resume session dialogs play the same effects
for (const { label, key, dialog } of [
  { label: 'New session', key: 'Alt+KeyN', dialog: chooser },
  { label: 'Resume session', key: 'Alt+KeyH', dialog: history },
]) {
  test(`the ${label} dialog fades and zooms in, and out on close`, async ({ page }) => {
    await page.goto('/');
    await watchDialogs(page);

    await page.keyboard.press(key);
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(backdrops(page)).toHaveCount(0, { timeout: 1000 });

    const [opening, leaving] = await snapshots(page);
    expectOpening(opening, label);
    expectLeaving(leaving, label);
  });
}

// plan-ui_transitions/REQ-26, REQ-28 — scenario "closing a dialog while it opens ends with the dialog closed"
test('Alt+H then Esc at once closes the Resume session dialog, and the next keys reach the page', async ({ page }) => {
  await page.goto('/');
  await slowExit(page);
  await watchDialogs(page);

  await page.keyboard.press('Alt+KeyH');
  await page.keyboard.press('Escape');
  await expect(history(page)).toHaveCount(0);
  await expect(leavingBackdrops(page), 'the dialog plays its exit').toHaveCount(1);
  const leaving = (await snapshots(page)).find((snapshot) => snapshot.phase === 'leave');
  expect(leaving?.hidden, 'closed, no longer exposed from the start of its exit').toBe(true);

  // A page shortcut works while the Resume session dialog is still leaving.
  await recordPresses(page, '.modal-backdrop.is-leaving');
  await page.keyboard.press('Alt+KeyN');
  await expect(chooser(page)).toBeVisible();
  expect((await presses(page)).find((press) => press.key.toLowerCase() === 'n')?.during, 'Alt+N lands while the dialog leaves').toBe(true);
  await expect(chooser(page).evaluate((element) => element.contains(document.activeElement))).resolves.toBe(true);

  await expect(backdrops(page)).toHaveCount(1, { timeout: 3000 });
  await expect(history(page)).toHaveCount(0);
  await expect(chooser(page)).toBeVisible();
});

// plan-ui_transitions/REQ-26, REQ-28: a click goes through a leaving dialog, and a reopen during the exit wins
test('a click on the gear while Settings leaves opens Settings again, and it stays open', async ({ page }) => {
  await page.goto('/');
  await slowExit(page);
  await watchDialogs(page);

  await settingsButton(page).click();
  await expect(settingsPopup(page)).toBeVisible();
  await recordPresses(page, '.modal-backdrop.is-leaving');
  await page.keyboard.press('Escape');
  await expect(settingsPopup(page)).toHaveCount(0);
  await expect(leavingBackdrops(page)).toHaveCount(1);
  expect((await snapshots(page)).find((snapshot) => snapshot.phase === 'leave')?.hidden, 'closed, no longer exposed from the start of its exit').toBe(true);

  await settingsButton(page).click();
  expect((await presses(page)).find((press) => press.type === 'pointerdown')?.during, 'the click lands while Settings leaves').toBe(true);

  await expect(settingsPopup(page)).toBeVisible();
  await expect(leavingBackdrops(page)).toHaveCount(0);
  await expect(backdrops(page)).toHaveCount(1);
  await page.waitForTimeout(1800);
  await expect(settingsPopup(page), 'the old exit does not close the reopened dialog').toBeVisible();
  await expect(settingsPopup(page)).toHaveAttribute('aria-modal', 'true');
});

// plan-ui_transitions/REQ-1, REQ-2: a Warning dialog plays the same effects
test('the "Terminate" warning dialog fades and zooms in, and out on "Cancel"', async ({ page, request }) => {
  await openWorkingSession(page, request, 'warning-motion');
  await watchDialogs(page);

  await page.getByRole('button', { name: 'Terminate', exact: true }).first().click();
  await expect(confirmation(page)).toBeVisible();
  await confirmation(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(confirmation(page)).toHaveCount(0);
  await expect(backdrops(page)).toHaveCount(0, { timeout: 1000 });

  const [opening, leaving] = await snapshots(page);
  expectOpening(opening, 'Terminate');
  expectLeaving(leaving, 'Terminate');
});

// plan-ui_transitions/REQ-25, REQ-30 — scenario "with reduced motion the dialogs open and close at once"
test('with reduced motion the "Terminate" dialog appears and goes with no effect, and the dot stays still', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const folder = await openWorkingSession(page, request, 'reduced-motion-dialog');
  await watchDialogs(page);

  await page.getByRole('button', { name: 'Terminate', exact: true }).first().click();
  await expect(confirmation(page)).toBeVisible();
  await confirmation(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await backdrops(page).count(), 'the dialog goes at once').toBe(0);

  const records = await snapshots(page);
  expect(records.map((record) => record.phase), 'no leaving phase').toEqual(['open']);
  for (const effect of [...(records[0]?.backdrop ?? []), ...(records[0]?.frame ?? [])]) expect(effect.duration, 'no opening effect').toBe(0);

  // plan-ui_transitions/REQ-30: the existing reduced-motion rule still stops the working dot
  const dot = entry(page, folder).locator('[aria-hidden="true"]').first();
  const animation = await dot.evaluate((element) => {
    const style = getComputedStyle(element);
    return { name: style.animationName, state: style.animationPlayState, duration: style.animationDuration };
  });
  expect(animation.name === 'none' || animation.state === 'paused' || animation.duration === '0s', JSON.stringify(animation)).toBe(true);
});

// plan-ui_transitions/REQ-25: a change of the system setting applies at once, with no reload
test('turning reduced motion on while the app is open removes the dialog effects at once', async ({ page }) => {
  await page.goto('/');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await watchDialogs(page);

  await settingsButton(page).click();
  await expect(settingsPopup(page)).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await backdrops(page).count(), 'the dialog goes at once').toBe(0);

  const records = await snapshots(page);
  expect(records.map((record) => record.phase)).toEqual(['open']);
  for (const effect of [...(records[0]?.backdrop ?? []), ...(records[0]?.frame ?? [])]) expect(effect.duration).toBe(0);
});
