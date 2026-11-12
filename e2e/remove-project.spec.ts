// e2e of plan-project_list_actions, batch remove-project. The server reads the fixture Claude Code folder E2E_CLAUDE_DIR.
// Each test uses new project folders, so the removals of earlier runs in the shared e2e data folder never match them.
import { access, mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

let projectsRoot: string;
const startedIds: string[] = [];

test.beforeEach(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await mkdir(path.join(E2E_CLAUDE_DIR, 'projects'), { recursive: true });
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-remove-projects-'));
});

test.afterEach(async ({ request }) => {
  for (const id of startedIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  await rm(projectsRoot, { recursive: true, force: true });
});

test.afterAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
});

const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const railButton = (page: Page, name: string) => rail(page).getByRole('button', { name, exact: true });
const panel = (page: Page) => page.getByRole('region', { name: 'Session List' });
const rows = (page: Page) => panel(page).locator('.project-row');
const row = (page: Page, folder: string) => rows(page).filter({ has: page.getByTitle(folder, { exact: true }) });
const item = (page: Page, folder: string) => panel(page).locator('li').filter({ has: page.getByTitle(folder, { exact: true }) });
const removeButton = (page: Page, folder: string) => item(page, folder).getByRole('button', { name: 'Remove from Projects', exact: true });
const favoriteButton = (page: Page, folder: string) => item(page, folder).getByRole('button', { name: /Favorite$/ });
const star = (page: Page, folder: string) => row(page, folder).getByRole('img', { name: 'Favorite', exact: true });
const shownFolders = (page: Page) => rows(page).evaluateAll((els) => els.map((el) => el.querySelector('[title^="/"]')?.getAttribute('title')));
const isRemoveRequest = (url: URL) => url.pathname === '/api/projects/remove';
const isPastSessionsRequest = (url: string) => new URL(url).pathname === '/api/past-sessions';

/** Writes a session as Claude Code leaves it after a session in the terminal, and creates its folder unless told not to. */
async function session(folder: string, id: string, modified: Date): Promise<string> {
  const dir = path.join(E2E_CLAUDE_DIR, 'projects', folder.replaceAll('/', '-'));
  await mkdir(dir, { recursive: true });
  const common = { cwd: folder, sessionId: id, isSidechain: false };
  const lines = [
    { ...common, type: 'user', message: { role: 'user', content: `Work in ${path.basename(folder)}` } },
    { ...common, type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] } },
  ];
  const file = path.join(dir, `${id}.jsonl`);
  await writeFile(file, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  await utimes(file, modified, modified);
  return file;
}

async function project(name: string, modified: Date, options: { onDisk?: boolean } = {}): Promise<string> {
  const folder = path.join(projectsRoot, name);
  if (options.onDisk !== false) await mkdir(folder, { recursive: true });
  await session(folder, `${name}-session`, modified);
  return folder;
}

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

/** Claude Code used in the folder from a terminal, after the removal. */
async function terminalActivity(folder: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  await session(folder, `${path.basename(folder)}-terminal`, new Date());
}

async function openProjects(page: Page): Promise<void> {
  const loaded = page.waitForResponse((r) => isPastSessionsRequest(r.url()));
  await railButton(page, 'Projects').click();
  await loaded;
}

/** Projects A, B and C, A the most recent, with the list open. */
async function threeProjects(page: Page, options: { cOnDisk?: boolean } = {}) {
  const a = await project('alpha', hoursAgo(1));
  const b = await project('bravo', hoursAgo(2));
  const c = await project('charlie', hoursAgo(3), { onDisk: options.cOnDisk });
  await page.goto('/');
  await openProjects(page);
  await expect(rows(page)).toHaveCount(3);
  expect(await shownFolders(page)).toEqual([a, b, c]);
  return { a, b, c };
}

async function removeWithMouse(page: Page, folder: string): Promise<void> {
  await row(page, folder).hover({ force: true });
  const done = page.waitForResponse((r) => isRemoveRequest(new URL(r.url())));
  await removeButton(page, folder).click();
  expect((await done).status()).toBe(204);
}

async function computedColour(page: Page, cssValue: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement('div');
    probe.style.color = value;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, cssValue);
}

/** Whether the focused element draws the focus ring colour as an outline or a box-shadow. */
async function focusedShowsRing(page: Page): Promise<boolean> {
  const ring = await computedColour(page, 'var(--color-focus-ring)');
  return page.evaluate((ringColour) => {
    const el = document.activeElement;
    if (!el) return false;
    const s = getComputedStyle(el);
    const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor === ringColour;
    return outline || s.boxShadow.includes(ringColour);
  }, ring);
}

/** Opacity the user sees: the product of the opacities of the element and its ancestors. */
const seenOpacity = (locator: Locator) =>
  locator.evaluate((el) => {
    let value = 1;
    for (let node: Element | null = el; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
    return value;
  });

// plan-project_list_actions/REQ-12, REQ-13, REQ-14, REQ-21, REQ-22 — scenario "the user removes a project from the list"
test('Tab then Enter on "Remove from Projects" of B takes B out at once, with no question; the focus ring goes to C; B stays in "Resume Session"', async ({ page }) => {
  const { a, b, c } = await threeProjects(page);

  await row(page, b).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(removeButton(page, b)).toBeFocused();
  expect(await focusedShowsRing(page), 'focus ring on "Remove from Projects"').toBe(true);
  await expect.poll(() => seenOpacity(removeButton(page, b)), 'the focused button is shown').toBe(1);
  await expect(removeButton(page, b)).toHaveAttribute('title', 'Remove from Projects');

  await page.keyboard.press('Enter');
  await expect.poll(() => shownFolders(page)).toEqual([a, c]);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(row(page, c)).toBeFocused();
  expect(await focusedShowsRing(page), 'focus ring on the row of C').toBe(true);

  // Nothing is deleted: the folder and its Claude Code session are still there.
  await access(b);
  await access(path.join(E2E_CLAUDE_DIR, 'projects', b.replaceAll('/', '-'), 'bravo-session.jsonl'));
  await railButton(page, 'Resume').click();
  const resume = page.getByRole('dialog', { name: 'Resume Session' });
  await expect(resume).toBeVisible();
  await expect(resume.getByRole('region', { name: b }).getByRole('radio')).toHaveCount(1);
});

// plan-project_list_actions/REQ-21: Space presses the button too
test('Space on the focused remove button takes the project out', async ({ page }) => {
  const { a, b, c } = await threeProjects(page);
  await row(page, c).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(removeButton(page, c)).toBeFocused();
  await page.keyboard.press('Space');
  await expect.poll(() => shownFolders(page)).toEqual([a, b]);
  // C was the last row: the focus goes to the previous one.
  await expect(row(page, b)).toBeFocused();
});

// plan-project_list_actions/REQ-15, REQ-17 — scenario "a removed project stays out, but stays in Recent"
test('a removed project stays out after a reload, and the "Recent" list of the new-session dialog still shows it', async ({ page }) => {
  const { a, b, c } = await threeProjects(page);
  await removeWithMouse(page, b);
  await expect.poll(() => shownFolders(page)).toEqual([a, c]);

  await page.reload();
  await openProjects(page);
  await expect(rows(page)).toHaveCount(2);
  expect(await shownFolders(page)).toEqual([a, c]);

  await railButton(page, 'New Claude Code Session').click();
  const recent = page.getByRole('radiogroup', { name: 'Recent Projects' });
  await expect(recent.getByRole('radio')).toHaveCount(3);
  await expect(recent.getByText(b, { exact: true })).toHaveCount(1);
});

// plan-project_list_actions/REQ-16 — scenario "a removed project comes back after work in a terminal"
test('a removed project comes back, in its place by last activity, after Claude Code runs in its folder from a terminal', async ({ page }) => {
  const { a, b, c } = await threeProjects(page);
  await removeWithMouse(page, b);
  await expect.poll(() => shownFolders(page)).toEqual([a, c]);

  await terminalActivity(b);
  await railButton(page, 'Sessions').click();
  await openProjects(page);
  await expect.poll(() => shownFolders(page)).toEqual([b, a, c]);
});

// plan-project_list_actions/REQ-16 — scenario "a removed project comes back with a new session from the client"
test('a removed project comes back after a new session starts in its folder from the "Recent" list', async ({ page }) => {
  const { a, b, c } = await threeProjects(page);
  await removeWithMouse(page, b);
  await expect.poll(() => shownFolders(page)).toEqual([a, c]);

  await railButton(page, 'New Claude Code Session').click();
  const chooser = page.getByRole('dialog', { name: 'New Claude Code Session' });
  await chooser.getByRole('radiogroup', { name: 'Recent Projects' }).getByRole('radio', { name: 'bravo', exact: true }).click();
  await expect(chooser.getByRole('textbox', { name: 'Working Directory Path', exact: true })).toHaveValue(b);
  const started = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/sessions' && r.request().method() === 'POST');
  await chooser.getByRole('button', { name: 'Start Session', exact: true }).click();
  const response = await started;
  expect(response.status()).toBe(201);
  startedIds.push(((await response.json()) as { id: string }).id);
  await expect(chooser).toHaveCount(0);

  await openProjects(page);
  await expect.poll(() => shownFolders(page)).toContain(b);
  await expect(rows(page)).toHaveCount(3);
});

// plan-project_list_actions/REQ-19 — scenario "a removed favorite comes back without its star"
test('a removed favorite comes back without its star, below the favorite projects', async ({ page }) => {
  const { a, b, c } = await threeProjects(page);
  for (const folder of [b, c]) {
    await row(page, folder).hover();
    await favoriteButton(page, folder).click();
    await expect(star(page, folder)).toBeVisible();
  }
  await expect.poll(() => shownFolders(page)).toEqual([b, c, a]);

  await removeWithMouse(page, b);
  await expect.poll(() => shownFolders(page)).toEqual([c, a]);
  await terminalActivity(b);
  await railButton(page, 'Sessions').click();
  await openProjects(page);
  await expect.poll(() => shownFolders(page)).toEqual([c, b, a]);
  await expect(star(page, b)).toHaveCount(0);
  await expect(star(page, c)).toBeVisible();
});

// plan-project_list_actions/REQ-18 — scenario "the user removes a project whose folder no longer exists"
test('"Remove from Projects" on a "Folder not found" row takes the row out', async ({ page }) => {
  const { a, b, c } = await threeProjects(page, { cOnDisk: false });
  await expect(row(page, c)).toContainText('Folder not found');
  await row(page, c).hover({ force: true });
  await expect.poll(() => seenOpacity(removeButton(page, c)), 'the button of an unavailable row is not dimmed').toBe(1);
  await removeWithMouse(page, c);
  await expect.poll(() => shownFolders(page)).toEqual([a, b]);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

// plan-project_list_actions/REQ-20, REQ-22 — scenario "the remove reaches the other pages" (browser pages only; the desktop app runs in the Electron group)
test('a remove in one page takes the project out of another open page, with no reload', async ({ page, context }) => {
  const { a, b, c } = await threeProjects(page);
  const other = await context.newPage();
  await other.goto('/');
  await openProjects(other);
  await expect(rows(other)).toHaveCount(3);

  let otherLoads = 0;
  other.on('request', (request) => {
    if (isPastSessionsRequest(request.url())) otherLoads += 1;
  });
  await removeWithMouse(page, a);
  await expect.poll(() => shownFolders(other)).toEqual([b, c]);
  expect(otherLoads, 'no new load of the list in the other page').toBe(0);
});

// plan-project_list_actions/REQ-13 — scenario "the remove fails"
test('when the server does not answer, the row stays and shows "Could not remove the project." under it', async ({ page }) => {
  const { a, b, c } = await threeProjects(page);
  await page.route(isRemoveRequest, (route) => route.abort('connectionrefused'));
  await row(page, b).hover();
  await removeButton(page, b).click();
  const error = item(page, b).getByRole('alert');
  await expect(error).toHaveText('Could not remove the project.');
  expect(await shownFolders(page)).toEqual([a, b, c]);
  const rowBox = (await row(page, b).boundingBox())!;
  const errorBox = (await error.boundingBox())!;
  expect(errorBox.y).toBeGreaterThanOrEqual(rowBox.y + rowBox.height - 0.5);

  // A new press clears the error.
  await page.unroute(isRemoveRequest);
  await row(page, b).hover();
  await removeButton(page, b).click();
  await expect(error).toHaveCount(0);
  await expect.poll(() => shownFolders(page)).toEqual([a, c]);
});

// ProjectList "Shows" and ProjectRemoveButton "Shows": the button place, its visibility and its busy state
test('the remove button is hidden until hover, sits at the right end centred on the row, right of the favorite button', async ({ page }) => {
  const { a, b, c } = await threeProjects(page);
  await page.mouse.move(5, 5);
  await expect.poll(() => seenOpacity(removeButton(page, a)), 'hidden with no hover and no focus').toBe(0);

  await row(page, a).hover();
  const button = removeButton(page, a);
  await expect.poll(() => seenOpacity(button)).toBe(1);
  const rowBox = (await row(page, a).boundingBox())!;
  const buttonBox = (await button.boundingBox())!;
  const favoriteBox = (await favoriteButton(page, a).boundingBox())!;
  expect(buttonBox.width).toBeCloseTo(20, 0);
  expect(buttonBox.height).toBeCloseTo(20, 0);
  expect(buttonBox.y + buttonBox.height / 2, 'centred on the height of the row button').toBeCloseTo(rowBox.y + rowBox.height / 2, 0);
  expect(buttonBox.x + buttonBox.width, 'inside the right end of the row').toBeLessThanOrEqual(rowBox.x + rowBox.width + 0.5);
  expect(rowBox.x + rowBox.width - (buttonBox.x + buttonBox.width), 'at the right end of the row').toBeLessThan(16);
  expect(buttonBox.x - (favoriteBox.x + favoriteBox.width), 'the favorite button 4 px left of it').toBeCloseTo(4, 0);
  const labelBox = (await row(page, a).getByText('New session').boundingBox())!;
  expect(labelBox.x + labelBox.width, '"▶ New session" left of the favorite button').toBeLessThanOrEqual(favoriteBox.x + 0.5);
  await page.screenshot({ path: test.info().outputPath('remove-button-hover.png') });

  // While its request runs, the button stays shown and busy.
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(isRemoveRequest, async (route) => {
    await held;
    await route.continue();
  });
  await button.click();
  await page.mouse.move(5, 5);
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await expect(button).toHaveAttribute('aria-disabled', 'true');
  expect(await seenOpacity(button)).toBe(1);
  expect(await shownFolders(page)).toEqual([a, b, c]);
  release();
  await expect.poll(() => shownFolders(page)).toEqual([b, c]);
});
