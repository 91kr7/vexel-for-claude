// e2e of plan-resume_favorites, batch popup-size.
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';
import { pageSettled } from './motion';

const FOLDERS = 3;
const SESSIONS_PER_FOLDER = 20;
const BACKDROP_PADDING = 16;

let projectsRoot: string;
let firstFolder: string;
let manyDir: string;
let emptyDir: string;
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
  manyDir = path.join(projectsRoot, 'many');
  emptyDir = path.join(projectsRoot, 'empty');
  await mkdir(emptyDir);
  for (let i = 0; i < 40; i++) await mkdir(path.join(manyDir, `sub-${String(i).padStart(2, '0')}`), { recursive: true });
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

// plan-new_session_popup: the New Session popup has the size and the place of the Resume popup.
const folderField = (page: Page) => newSessionDialog(page).getByRole('textbox', { name: 'Working Directory Path' });
const startButton = (page: Page) => newSessionDialog(page).getByRole('button', { name: 'Start Session', exact: true });
const newSessionCancel = (page: Page) => newSessionDialog(page).getByRole('button', { name: 'Cancel', exact: true });
const newSessionTitle = (page: Page) => newSessionDialog(page).getByRole('heading', { name: 'New Claude Code Session' });

/** Opens the New Session popup and lists `folder`: `many` has 40 subfolders, `empty` has none. */
async function openNewSession(page: Page, folder: string): Promise<void> {
  await railButton(page, 'New Claude Code Session').click();
  await expect(newSessionDialog(page)).toBeVisible();
  await expect(folderField(page)).toBeFocused();
  await folderField(page).fill(folder);
  await folderField(page).press('Enter');
  await expect(newSessionDialog(page)).not.toContainText('Loading…');
  await expect(newSessionDialog(page).getByRole('button', { name: '..', exact: true })).toBeVisible();
}

/** The height rule of the popups: content height up to 70 % of the window, at least 280 px, at most the backdrop. */
const heightCap = (windowHeight: number) => Math.min(Math.max(0.7 * windowHeight, 280), windowHeight - 2 * BACKDROP_PADDING);

/** The nearest scrolling ancestor of the "Folders" area of the New Session popup. */
const newSessionScroller = (page: Page) =>
  newSessionDialog(page)
    .getByRole('radiogroup', { name: 'Recent Projects' })
    .evaluate((group) => {
      let el: Element | null = group;
      while (el) {
        const overflow = getComputedStyle(el).overflowY;
        if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight) {
          return { found: true, clientHeight: el.clientHeight, isFrame: el.getAttribute('role') === 'dialog' };
        }
        el = el.parentElement;
      }
      return { found: false, clientHeight: 0, isFrame: false };
    });

async function resumeFrame(page: Page) {
  await openResume(page);
  const frame = await box(dialog(page));
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  return frame;
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 700, height: 500 },
  { width: 520, height: 360 },
]) {
  // plan-new_session_popup/REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7
  test(`in a ${viewport.width}x${viewport.height} window the New Session popup has the width, height and place of the Resume popup`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');

    const resume = await resumeFrame(page);
    await openNewSession(page, manyDir);
    const frame = await box(newSessionDialog(page));

    expect(frame.width, 'same width').toBeCloseTo(resume.width, 0);
    expect(frame.height, 'same height').toBeCloseTo(resume.height, 0);
    expect(frame.x, 'same left edge').toBeCloseTo(resume.x, 0);
    expect(frame.y, 'same top edge').toBeCloseTo(resume.y, 0);
    // plan-new_session_popup/REQ-7: the Resume popup keeps its values
    expect(resume.width).toBeCloseTo(Math.min(672, viewport.width - 2 * BACKDROP_PADDING), 0);
    expect(resume.height).toBeCloseTo(heightCap(viewport.height), 0);

    // plan-new_session_popup/REQ-5: the list scrolls inside the popup, the rest stays in view
    const scroller = await newSessionScroller(page);
    expect(scroller.found, 'the folder lists scroll inside the popup').toBe(true);
    expect(scroller.isFrame, 'the frame itself does not scroll').toBe(false);
    expect(scroller.clientHeight, 'the scrolling area keeps room for one row').toBeGreaterThanOrEqual(56);
    expect(await newSessionDialog(page).evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
    const fixed = [newSessionTitle(page), folderField(page), newSessionCancel(page), startButton(page)];
    const before = await Promise.all(fixed.map(box));
    for (const [i, locator] of fixed.entries()) await expectInViewport(page, locator, `fixed part ${i}`);

    const lastFolder = newSessionDialog(page).getByRole('button', { name: 'sub-39', exact: true });
    await expect(lastFolder).not.toBeInViewport();
    const area = await box(newSessionDialog(page).getByRole('radiogroup', { name: 'Recent Projects' }));
    await page.mouse.move(area.x + area.width / 2, Math.min(area.y + 20, frame.y + frame.height - 100));
    for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 600);
    await expect(lastFolder).toBeInViewport();

    const after = await Promise.all(fixed.map(box));
    for (let i = 0; i < fixed.length; i++) expect(after[i]!.y, 'header, field and footer stay where they were').toBeCloseTo(before[i]!.y, 0);
    const scrolled = await box(newSessionDialog(page));
    expect(scrolled.height, 'the popup size does not change while scrolling').toBeCloseTo(frame.height, 0);
    expect(scrolled.y).toBeCloseTo(frame.y, 0);
  });
}

// plan-new_session_popup/REQ-2: with little content both popups follow the same height rule
test('with one project folder both popups stop at their content, under the cap, and their height matches the rule', async ({ page }) => {
  await page.route('**/api/past-sessions', async (route) => {
    const group = { folder: firstFolder, sessions: [{ id: 'e2e-size-unique', label: 'Unique quokka task', lastActivity: new Date(2026, 9, 28).toISOString(), runningElsewhere: false }] };
    await route.fulfill({ json: [group] });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const cap = heightCap(800);

  await railButton(page, 'Resume').click();
  await expect(radios(page)).toHaveCount(1);
  const resume = await box(dialog(page));
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();

  await openNewSession(page, emptyDir);
  const created = await box(newSessionDialog(page));

  for (const [name, frame] of [
    ['Resume', resume],
    ['New Session', created],
  ] as const) {
    expect(frame.height, `${name}: not at the cap`).toBeLessThan(cap - 1);
    expect(frame.width, `${name}: same width rule`).toBeCloseTo(672, 0);
  }
  expect((await newSessionScroller(page)).found, 'nothing scrolls when the content fits').toBe(false);
  expect(created.y + created.height / 2, 'centred in the window').toBeCloseTo(400, 0);
  expect(resume.y + resume.height / 2, 'centred in the window').toBeCloseTo(400, 0);
});

// plan-new_session_popup/REQ-4, REQ-5: the match holds after a resize while the popup is open
test('after the window shrinks to 700x500 the open New Session popup shrinks, keeps its footer in view and matches the Resume popup', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await openNewSession(page, manyDir);
  const large = await box(newSessionDialog(page));
  expect(large.width).toBeCloseTo(672, 0);
  expect(large.height).toBeCloseTo(heightCap(800), 0);

  await page.setViewportSize({ width: 700, height: 500 });
  const small = await box(newSessionDialog(page));
  expect(small.width, 'shrinks with the window').toBeCloseTo(700 - 2 * BACKDROP_PADDING, 0);
  expect(small.height, 'shrinks with the window').toBeCloseTo(heightCap(500), 0);
  await expectInViewport(page, startButton(page), 'Start Session');
  await expectInViewport(page, newSessionCancel(page), 'Cancel');
  await expectInViewport(page, folderField(page), 'path field');
  const scroller = await newSessionScroller(page);
  expect(scroller.found, 'the list scrolls inside the popup').toBe(true);
  expect(scroller.isFrame).toBe(false);

  await page.keyboard.press('Escape');
  await expect(newSessionDialog(page)).toBeHidden();
  const resume = await resumeFrame(page);
  expect(small.width).toBeCloseTo(resume.width, 0);
  expect(small.height).toBeCloseTo(resume.height, 0);
  expect(small.x).toBeCloseTo(resume.x, 0);
  expect(small.y).toBeCloseTo(resume.y, 0);
});

// plan-new_session_popup/REQ-6: the popup still starts a session from a "Recent" project
test('in a small window the user chooses a Recent project and starts the session', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 500 });
  await page.goto('/');
  await railButton(page, 'New Claude Code Session').click();
  await expect(newSessionDialog(page)).toBeVisible();

  const row = newSessionDialog(page).getByRole('radio', { name: 'project-0', exact: true });
  await row.click();
  await expect(row).toBeChecked();
  await expect(folderField(page)).toHaveValue(firstFolder);
  await expectInViewport(page, startButton(page), 'Start Session');

  const started = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/sessions' && r.request().method() === 'POST');
  await startButton(page).click();
  const response = await started;
  expect(response.ok()).toBe(true);
  startedIds.push(((await response.json()) as { id: string }).id);
  await expect(newSessionDialog(page)).toBeHidden();
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
