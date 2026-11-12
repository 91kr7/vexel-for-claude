// e2e of plan-project_list_actions, batch favorite-project. The server reads the fixture Claude Code folder E2E_CLAUDE_DIR.
// Each test uses new project folders, so the marks of earlier runs in the shared e2e data folder never match them.
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

let projectsRoot: string;

test.beforeEach(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await mkdir(path.join(E2E_CLAUDE_DIR, 'projects'), { recursive: true });
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-favorite-projects-'));
});

test.afterEach(async () => {
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
const markButton = (page: Page, folder: string) => item(page, folder).getByRole('button', { name: 'Mark as Favorite', exact: true });
const removeButton = (page: Page, folder: string) => item(page, folder).getByRole('button', { name: 'Remove Favorite', exact: true });
const star = (page: Page, folder: string) => row(page, folder).getByRole('img', { name: 'Favorite', exact: true });
const shownFolders = (page: Page) => rows(page).evaluateAll((els) => els.map((el) => el.querySelector('[title^="/"]')?.getAttribute('title')));
const isFavoriteRequest = (url: URL) => url.pathname === '/api/projects/favorite';

/** Writes a session as Claude Code leaves it after a session in the terminal, and creates its folder unless told not to. */
async function project(name: string, modified: Date, options: { onDisk?: boolean } = {}): Promise<string> {
  const folder = path.join(projectsRoot, name);
  if (options.onDisk !== false) await mkdir(folder, { recursive: true });
  const id = `${name}-session`;
  const dir = path.join(E2E_CLAUDE_DIR, 'projects', folder.replaceAll('/', '-'));
  await mkdir(dir, { recursive: true });
  const common = { cwd: folder, sessionId: id, isSidechain: false };
  const lines = [
    { ...common, type: 'user', message: { role: 'user', content: `Work in ${name}` } },
    { ...common, type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] } },
  ];
  const file = path.join(dir, `${id}.jsonl`);
  await writeFile(file, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  await utimes(file, modified, modified);
  return folder;
}

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

async function openProjects(page: Page): Promise<void> {
  const loaded = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/past-sessions');
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

// plan-project_list_actions/REQ-23, REQ-24, REQ-25, REQ-26, REQ-31, REQ-32 — scenario "a favorite project moves to the top of the list"
test('Tab then Enter on "Mark as Favorite" of C puts C at the top with a star; A and B keep their order', async ({ page }) => {
  const { a, b, c } = await threeProjects(page);
  await expect(star(page, a)).toHaveCount(0);

  await row(page, c).focus();
  await page.keyboard.press('Tab');
  await expect(markButton(page, c)).toBeFocused();
  expect(await focusedShowsRing(page), 'focus ring on "Mark as Favorite"').toBe(true);
  await expect.poll(() => seenOpacity(markButton(page, c)), 'the focused button is shown').toBe(1);
  await expect(markButton(page, c)).toHaveAttribute('title', 'Mark as Favorite');

  await page.keyboard.press('Enter');
  await expect(star(page, c)).toBeVisible();
  await expect.poll(() => shownFolders(page)).toEqual([c, a, b]);
  await expect(star(page, a)).toHaveCount(0);
  await expect(star(page, b)).toHaveCount(0);
  await expect(removeButton(page, c)).toHaveCount(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

// plan-project_list_actions/REQ-31: Space presses the button too
test('Space on the focused favorite button marks the project', async ({ page }) => {
  const { b } = await threeProjects(page);
  await row(page, b).focus();
  await page.keyboard.press('Tab');
  await expect(markButton(page, b)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(star(page, b)).toBeVisible();
  await expect.poll(() => shownFolders(page)).toEqual([b, expect.any(String), expect.any(String)]);
});

// plan-project_list_actions/REQ-25, REQ-26 — scenario "two favorites are ordered by last activity"
test('with C favorite, marking B gives B, then C, both with a star, then A', async ({ page }) => {
  const { a, b, c } = await threeProjects(page);
  await row(page, c).hover();
  await markButton(page, c).click();
  await expect.poll(() => shownFolders(page)).toEqual([c, a, b]);

  await row(page, b).hover();
  await markButton(page, b).click();
  await expect.poll(() => shownFolders(page)).toEqual([b, c, a]);
  await expect(star(page, b)).toBeVisible();
  await expect(star(page, c)).toBeVisible();
  await expect(star(page, a)).toHaveCount(0);
});

// plan-project_list_actions/REQ-23, REQ-26 — scenario "the user removes the mark"
test('"Remove Favorite" on C takes its star away and puts it back by last activity', async ({ page }) => {
  const { a, b, c } = await threeProjects(page);
  await row(page, c).hover();
  await markButton(page, c).click();
  await expect.poll(() => shownFolders(page)).toEqual([c, a, b]);

  await row(page, c).hover();
  await expect(removeButton(page, c)).toHaveAttribute('title', 'Remove Favorite');
  await removeButton(page, c).click();
  await expect.poll(() => shownFolders(page)).toEqual([a, b, c]);
  await expect(star(page, c)).toHaveCount(0);
  await expect(markButton(page, c)).toHaveCount(1);
});

// plan-project_list_actions/REQ-24, REQ-30 — scenario "the star is not only a colour"
test('the star of a favorite row is a filled star shape with the name and tooltip "Favorite"', async ({ page }) => {
  const { a } = await threeProjects(page);
  await row(page, a).hover();
  await markButton(page, a).click();
  const indicator = star(page, a);
  await expect(indicator).toBeVisible();
  await indicator.hover();
  await expect(indicator).toHaveAttribute('title', 'Favorite');
  const shape = await indicator.locator('svg').evaluate((svg) => ({ filled: svg.classList.contains('icon-filled'), fill: getComputedStyle(svg).fill }));
  expect(shape.filled).toBe(true);
  expect(shape.fill).not.toBe('none');
  // The star sits after the folder name, inside the row.
  const nameBox = await row(page, a).getByText('alpha', { exact: true }).boundingBox();
  const starBox = await indicator.boundingBox();
  expect(starBox!.x).toBeGreaterThanOrEqual(nameBox!.x + nameBox!.width - 0.5);
});

// plan-project_list_actions/REQ-27 — scenario "the mark works on a folder that no longer exists"
test('"Mark as Favorite" on a "Folder not found" row puts it at the top with a star, still marked "Folder not found"', async ({ page }) => {
  const { a, b, c } = await threeProjects(page, { cOnDisk: false });
  await expect(row(page, c)).toContainText('Folder not found');

  await row(page, c).hover({ force: true });
  await expect.poll(() => seenOpacity(markButton(page, c)), 'the button of an unavailable row is not dimmed').toBe(1);
  await markButton(page, c).click();
  await expect(star(page, c)).toBeVisible();
  await expect.poll(() => shownFolders(page)).toEqual([c, a, b]);
  await expect(row(page, c)).toContainText('Folder not found');
  await expect(row(page, c)).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

// plan-project_list_actions/REQ-28, REQ-29 — scenario "the mark reaches the other pages and survives a restart" (browser pages only; the desktop app runs in the Electron group)
test('a mark set in one page shows in another open page with no reload, and stays after a reload', async ({ page, context }) => {
  const { a, b, c } = await threeProjects(page);
  const other = await context.newPage();
  await other.goto('/');
  await openProjects(other);
  await expect(rows(other)).toHaveCount(3);

  let otherLoads = 0;
  other.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/past-sessions') otherLoads += 1;
  });
  await row(page, b).hover();
  await markButton(page, b).click();
  await expect(star(other, b)).toBeVisible();
  await expect.poll(() => shownFolders(other)).toEqual([b, a, c]);
  expect(otherLoads, 'no new load of the list in the other page').toBe(0);

  await other.reload();
  await openProjects(other);
  await expect(star(other, b)).toBeVisible();
  await expect.poll(() => shownFolders(other)).toEqual([b, a, c]);

  // Clear the mark from the other page: the first page follows.
  await row(other, b).hover();
  await removeButton(other, b).click();
  await expect(star(page, b)).toHaveCount(0);
  await expect.poll(() => shownFolders(page)).toEqual([a, b, c]);
});

// plan-project_list_actions/REQ-23 — scenario "the mark cannot be changed"
test('when the server does not answer, the row shows "Could not change the favorite mark." under it and no star', async ({ page }) => {
  const { c } = await threeProjects(page);
  await page.route(isFavoriteRequest, (route) => route.abort('connectionrefused'));
  await row(page, c).hover();
  await markButton(page, c).click();
  const error = item(page, c).getByRole('alert');
  await expect(error).toHaveText('Could not change the favorite mark.');
  await expect(star(page, c)).toHaveCount(0);
  const rowBox = await row(page, c).boundingBox();
  const errorBox = await error.boundingBox();
  expect(errorBox!.y).toBeGreaterThanOrEqual(rowBox!.y + rowBox!.height - 0.5);

  // A new press clears the error.
  await page.unroute(isFavoriteRequest);
  await row(page, c).hover();
  await markButton(page, c).click();
  await expect(error).toHaveCount(0);
  await expect(star(page, c)).toBeVisible();
});

// ProjectList "Shows" and ProjectFavoriteButton "Shows": the button place, its visibility and its busy state
test('the favorite button is hidden until hover, sits 4 px left of the remove button centred on the row, right of "▶ New session"', async ({ page }) => {
  const { a, b } = await threeProjects(page);
  await page.mouse.move(5, 5);
  await expect.poll(() => seenOpacity(markButton(page, a)), 'hidden with no hover and no focus').toBe(0);

  await row(page, a).hover();
  const button = markButton(page, a);
  await expect.poll(() => seenOpacity(button)).toBe(1);
  const rowBox = (await row(page, a).boundingBox())!;
  const buttonBox = (await button.boundingBox())!;
  expect(buttonBox.width).toBeCloseTo(20, 0);
  expect(buttonBox.height).toBeCloseTo(20, 0);
  expect(buttonBox.y + buttonBox.height / 2, 'centred on the height of the row button').toBeCloseTo(rowBox.y + rowBox.height / 2, 0);
  const removeBox = (await item(page, a).getByRole('button', { name: 'Remove from Projects', exact: true }).boundingBox())!;
  expect(removeBox.x - (buttonBox.x + buttonBox.width), '4 px left of the remove button').toBeCloseTo(4, 0);
  const label = row(page, a).getByText('New session');
  await expect(label).toBeVisible();
  const labelBox = (await label.boundingBox())!;
  expect(labelBox.x + labelBox.width, '"▶ New session" left of the favorite button').toBeLessThanOrEqual(buttonBox.x + 0.5);
  await page.screenshot({ path: test.info().outputPath('favorite-button-hover.png') });

  // While its request runs, the button stays shown and busy.
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(isFavoriteRequest, async (route) => {
    await held;
    await route.continue();
  });
  await button.click();
  await page.mouse.move(5, 5);
  const busy = item(page, a).getByRole('button', { name: /Favorite$/ });
  await expect(busy).toHaveAttribute('aria-busy', 'true');
  await expect(busy).toHaveAttribute('aria-disabled', 'true');
  expect(await seenOpacity(busy)).toBe(1);
  release();
  await expect(star(page, a)).toBeVisible();
  await expect(rows(page)).toHaveCount(3);
  expect(await shownFolders(page)).toContain(b);
});
