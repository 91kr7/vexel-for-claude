// e2e of plan-resume_favorites, batch popup-size.
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';
import { pageSettled } from './motion';

const FOLDERS = 3;
const SESSIONS_PER_FOLDER = 20;
const DEFAULT_DIALOG_WIDTH = 448;
const BACKDROP_PADDING = 16;

let projectsRoot: string;
let firstFolder: string;
const startedIds: string[] = [];

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Resume Session' });
const newSessionDialog = (page: Page) => page.getByRole('dialog', { name: 'New Claude Code Session' });
const title = (page: Page) => dialog(page).getByRole('heading', { name: 'Resume Session' });
const searchBar = (page: Page) => dialog(page).getByRole('textbox', { name: 'Search Past Sessions', exact: true });
const pastSessions = (page: Page) => dialog(page).getByRole('radiogroup', { name: 'Past Sessions' });
const radios = (page: Page) => pastSessions(page).getByRole('radio');
const cancelButton = (page: Page) => dialog(page).getByRole('button', { name: 'Cancel', exact: true });
const resumeButton = (page: Page) => dialog(page).getByRole('button', { name: 'Resume', exact: true });
const railButton = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('button', { name, exact: true });
const isResumeRequest = (url: string, method: string) => /\/api\/past-sessions\/[^/]+\/resume$/.test(new URL(url).pathname) && method === 'POST';

async function pastSession(id: string, folder: string, firstMessage: string, modified: Date): Promise<void> {
  const dir = path.join(E2E_CLAUDE_DIR, 'projects', folder.replaceAll('/', '-'));
  await mkdir(dir, { recursive: true });
  const common = { cwd: folder, sessionId: id, isSidechain: false };
  const lines = [
    { ...common, type: 'user', message: { role: 'user', content: firstMessage } },
    { ...common, type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] } },
  ];
  const file = path.join(dir, `${id}.jsonl`);
  await writeFile(file, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  await utimes(file, modified, modified);
}

test.beforeAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await mkdir(path.join(E2E_CLAUDE_DIR, 'projects'), { recursive: true });
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-popup-size-'));
  for (let f = 0; f < FOLDERS; f++) {
    const folder = path.join(projectsRoot, `project-${f}`);
    await mkdir(folder);
    if (f === 0) firstFolder = folder;
    for (let s = 0; s < SESSIONS_PER_FOLDER; s++) {
      await pastSession(`e2e-size-${f}-${s}`, folder, `Task ${f}-${s}`, new Date(2026, 9, 1 + s, 10 + f, 0, 0));
    }
  }
  await pastSession('e2e-size-unique', firstFolder, 'Unique quokka task', new Date(2026, 9, 28, 9, 0, 0));
});

test.afterEach(async ({ request }) => {
  for (const id of startedIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  await rm(path.join(E2E_CLAUDE_DIR, 'sessions'), { recursive: true, force: true });
});

test.afterAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await rm(projectsRoot, { recursive: true, force: true });
});

/** Measured at rest: a dialog zooms in when it opens (plan-ui_transitions/REQ-1). */
const box = async (locator: Locator) => {
  await pageSettled(locator.page());
  const b = await locator.boundingBox();
  expect(b).not.toBeNull();
  return b!;
};

async function openResume(page: Page): Promise<void> {
  await railButton(page, 'Resume').click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).not.toContainText('Loading…');
  await expect(radios(page).first()).toBeVisible();
}

/** The box must lie fully inside the viewport. */
async function expectInViewport(page: Page, locator: Locator, what: string): Promise<void> {
  const viewport = page.viewportSize()!;
  const b = await box(locator);
  expect(b.x, `${what}: left edge in view`).toBeGreaterThanOrEqual(0);
  expect(b.y, `${what}: top edge in view`).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width, `${what}: right edge in view`).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(b.y + b.height, `${what}: bottom edge in view`).toBeLessThanOrEqual(viewport.height + 0.5);
}

/** The nearest scrolling ancestor of the past sessions, with its sizes. */
const listScroller = (page: Page) =>
  pastSessions(page).evaluate((group) => {
    let el: Element | null = group;
    while (el) {
      const overflow = getComputedStyle(el).overflowY;
      if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight) {
        return { found: true, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, isFrame: el.getAttribute('role') === 'dialog' };
      }
      el = el.parentElement;
    }
    return { found: false, clientHeight: 0, scrollHeight: 0, isFrame: false };
  });

// plan-resume_favorites/REQ-1: about 1.5 times the width of the other dialogs
test('the resume popup is about 1.5 times as wide as the New Session dialog', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  await railButton(page, 'New Claude Code Session').click();
  await expect(newSessionDialog(page)).toBeVisible();
  const newSessionWidth = (await box(newSessionDialog(page))).width;
  expect(newSessionWidth, 'the other dialogs keep their width').toBeCloseTo(DEFAULT_DIALOG_WIDTH, 0);
  await page.keyboard.press('Escape');
  await expect(newSessionDialog(page)).toBeHidden();

  await openResume(page);
  const resumeWidth = (await box(dialog(page))).width;
  expect(resumeWidth).toBeCloseTo(672, 0);
  expect(resumeWidth / newSessionWidth).toBeGreaterThan(1.4);
  expect(resumeWidth / newSessionWidth).toBeLessThan(1.6);
});

// plan-resume_favorites/REQ-2, REQ-3: capped height with clear space, only the list scrolls
test('with many sessions the popup stops below the window height and only the list scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await openResume(page);

  const frame = await box(dialog(page));
  expect(frame.height, 'capped at about 70 % of the window height').toBeLessThanOrEqual(0.7 * 900 + 1);
  expect(frame.height, 'the cap is reached with many sessions').toBeGreaterThanOrEqual(0.7 * 900 - 1);
  expect(frame.y, 'clear space above').toBeGreaterThan(0.1 * 900);
  expect(900 - (frame.y + frame.height), 'clear space below').toBeGreaterThan(0.1 * 900);

  const scroller = await listScroller(page);
  expect(scroller.found, 'the past sessions sit in a scrolling area').toBe(true);
  expect(scroller.isFrame, 'the frame itself does not scroll').toBe(false);
  expect(await dialog(page).evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);

  const fixed = [title(page), searchBar(page), cancelButton(page), resumeButton(page)];
  const before = await Promise.all(fixed.map(box));
  const lastRow = radios(page).last();
  await expect(lastRow).not.toBeInViewport();

  await box(pastSessions(page)).then((b) => page.mouse.move(b.x + b.width / 2, Math.min(b.y + 40, frame.y + frame.height - 80)));
  for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 600);
  await expect(lastRow).toBeInViewport();

  const after = await Promise.all(fixed.map(box));
  for (let i = 0; i < fixed.length; i++) {
    expect(after[i]!.y, 'header, search bar and footer stay where they were').toBeCloseTo(before[i]!.y, 0);
  }
  for (const [i, locator] of fixed.entries()) await expectInViewport(page, locator, `fixed part ${i}`);
});

// plan-resume_favorites/REQ-2: below the cap the frame follows its content
test('with few visible sessions the popup follows its content', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await openResume(page);

  await searchBar(page).fill('quokka');
  await expect(radios(page)).toHaveCount(1);

  const frame = await box(dialog(page));
  expect(frame.height).toBeLessThan(0.7 * 900 - 1);
  const scroller = await listScroller(page);
  expect(scroller.found, 'nothing scrolls when the content fits').toBe(false);
});

for (const viewport of [
  { width: 520, height: 360 },
  { width: 360, height: 300 },
]) {
  // plan-resume_favorites/REQ-4: fully visible and usable in a small window
  test(`in a ${viewport.width}x${viewport.height} window the whole popup is in view and usable`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await openResume(page);

    const frame = await box(dialog(page));
    expect(frame.x, 'backdrop padding on the left').toBeGreaterThanOrEqual(BACKDROP_PADDING - 0.5);
    expect(frame.x + frame.width, 'backdrop padding on the right').toBeLessThanOrEqual(viewport.width - BACKDROP_PADDING + 0.5);
    expect(frame.y, 'backdrop padding on the top').toBeGreaterThanOrEqual(BACKDROP_PADDING - 0.5);
    expect(frame.y + frame.height, 'backdrop padding on the bottom').toBeLessThanOrEqual(viewport.height - BACKDROP_PADDING + 0.5);
    expect(frame.width, 'the frame takes the backdrop width').toBeCloseTo(viewport.width - 2 * BACKDROP_PADDING, 0);
    // With many sessions the frame stands at its cap: 70 % of the window, at least 280 px, at most the backdrop.
    const cap = Math.min(Math.max(0.7 * viewport.height, 280), viewport.height - 2 * BACKDROP_PADDING);
    expect(frame.height, 'the frame stands at its cap').toBeCloseTo(cap, 0);

    for (const [name, locator] of [
      ['title', title(page)],
      ['search bar', searchBar(page)],
      ['Cancel', cancelButton(page)],
      ['Resume', resumeButton(page)],
    ] as const) {
      await expectInViewport(page, locator, name);
    }
    const scroller = await listScroller(page);
    expect(scroller.found, 'the list scrolls inside the popup').toBe(true);
    expect(scroller.clientHeight, 'the list area keeps room for one row').toBeGreaterThanOrEqual(56);

    await searchBar(page).fill('quokka');
    await expect(radios(page)).toHaveCount(1);
    const row = radios(page).first();
    await row.click();
    await expect(row).toBeChecked();
    await expectInViewport(page, resumeButton(page), 'Resume after the search');

    const resumed = page.waitForResponse((r) => isResumeRequest(r.url(), r.request().method()));
    await resumeButton(page).click();
    const response = await resumed;
    expect(response.ok()).toBe(true);
    startedIds.push(((await response.json()) as { id: string }).id);
    await expect(dialog(page)).toBeHidden();
  });
}
