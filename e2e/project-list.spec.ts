// e2e of plan-recent_projects, batch project-list. The server reads the fixture Claude Code folder E2E_CLAUDE_DIR.
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

let projectsRoot: string;

test.beforeEach(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await mkdir(path.join(E2E_CLAUDE_DIR, 'projects'), { recursive: true });
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-projects-'));
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
const pastSessionsRequest = (url: string) => new URL(url).pathname === '/api/past-sessions';

/** Writes a session as Claude Code leaves it after a session in the terminal, and creates its folder unless told not to. */
async function project(name: string, modified: Date, options: { onDisk?: boolean; id?: string } = {}): Promise<string> {
  const folder = path.join(projectsRoot, name);
  if (options.onDisk !== false) await mkdir(folder, { recursive: true });
  const id = options.id ?? `${name}-session`;
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
  const loaded = page.waitForResponse((r) => pastSessionsRequest(r.url()));
  await railButton(page, 'Projects').click();
  await loaded;
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
const seenOpacity = (page: Page, folder: string) =>
  row(page, folder).evaluate((el) => {
    let value = 1;
    for (let node: Element | null = el; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
    return value;
  });

// plan-recent_projects/REQ-1, REQ-2, REQ-3, REQ-4, REQ-6, REQ-7, REQ-11, REQ-13 — scenario "the user sees the past projects in the side column"
test('"Projects" shows every project folder, the most recent first, with path and last activity, as the "Recent" list of the new-session dialog', async ({ page }) => {
  const newest = await project('newest-app', hoursAgo(1));
  const middle = await project('middle-api', hoursAgo(30));
  const terminalOnly = await project('terminal-only', hoursAgo(80));
  await page.goto('/');

  const projects = railButton(page, 'Projects');
  await expect(projects).toBeVisible();
  await openProjects(page);

  await expect(panel(page).getByRole('heading', { level: 1, name: 'Projects', exact: true })).toBeVisible();
  await expect(panel(page).getByRole('heading', { name: 'Sessions', exact: true })).toHaveCount(0);
  await expect(rows(page)).toHaveCount(3);
  const shown = await rows(page).evaluateAll((els) => els.map((el) => el.querySelector('[title]')?.getAttribute('title')));
  expect(shown).toEqual([newest, middle, terminalOnly]);
  for (const [folder, name] of [
    [newest, 'newest-app'],
    [middle, 'middle-api'],
    [terminalOnly, 'terminal-only'],
  ]) {
    await expect(row(page, folder!)).toContainText(name!);
    await expect(row(page, folder!)).toContainText('Last activity');
    await expect(row(page, folder!).locator('time')).toHaveCount(1);
  }
  await expect(projects).toHaveAttribute('aria-current', 'page');
  await expect(railButton(page, 'Sessions')).not.toHaveAttribute('aria-current', /.+/);
  // The list was loaded once: a new opening by mouse puts the focus on the first row, with the ring.
  await railButton(page, 'Sessions').click();
  await openProjects(page);
  await expect(rows(page).first()).toBeFocused();
  expect(await focusedShowsRing(page), 'focus ring on the first row after a mouse click').toBe(true);

  await railButton(page, 'New Claude Code Session').click();
  const recent = page.getByRole('radiogroup', { name: 'Recent Projects' });
  await expect(recent.getByRole('radio')).toHaveCount(3);
  for (const folder of [newest, middle, terminalOnly]) await expect(recent.getByText(folder, { exact: true })).toHaveCount(1);
});

// plan-recent_projects/REQ-1: same tooltip behaviour as the other rail buttons
test('"Projects" sits between "Sessions" and "Resume" and shows its name in a tooltip on hover', async ({ page }) => {
  await page.goto('/');
  const names = await rail(page).getByRole('button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim()));
  expect(names).toEqual(['New Claude Code Session', 'Sessions', 'Projects', 'Resume']);
  const projects = railButton(page, 'Projects');
  const tooltip = projects.getByText('Projects', { exact: true });
  await projects.hover();
  await expect.poll(async () => Number(await tooltip.evaluate((el) => getComputedStyle(el).opacity))).toBe(1);

  // The active style moves to "Projects" and is the one "Sessions" had.
  const look = (name: string) =>
    railButton(page, name).evaluate((el) => {
      const s = getComputedStyle(el);
      return { size: [el.getBoundingClientRect().width, el.getBoundingClientRect().height], background: s.backgroundColor, border: s.borderTopColor, color: s.color, shadow: s.boxShadow };
    });
  await page.mouse.move(600, 600);
  const sessionsActive = await look('Sessions');
  await openProjects(page);
  await page.mouse.move(600, 600);
  await expect.poll(() => look('Projects')).toEqual(sessionsActive);
  await expect.poll(async () => look('Sessions')).toEqual(await look('Resume'));
});

// plan-recent_projects/REQ-5, REQ-8 — scenario "the list is still there after a restart and shows new projects"
test('after a reload the list shows its folders again, and a new folder appears at the next opening', async ({ page }) => {
  const first = await project('first', hoursAgo(5));
  const second = await project('second', hoursAgo(3));
  await page.goto('/');
  await openProjects(page);
  await expect(rows(page)).toHaveCount(2);

  await page.reload();
  const third = await project('third', hoursAgo(0.1));
  await openProjects(page);
  await expect(rows(page)).toHaveCount(3);
  const shown = await rows(page).evaluateAll((els) => els.map((el) => el.querySelector('[title]')?.getAttribute('title')));
  expect(shown).toEqual([third, second, first]);

  await railButton(page, 'Sessions').click();
  const fourth = await project('fourth', hoursAgo(0.05));
  await openProjects(page);
  await expect(rows(page)).toHaveCount(4);
  await expect(row(page, fourth)).toHaveCount(1);
});

// plan-recent_projects/REQ-10 — scenario "a deleted folder stays in the list, marked"
test('a deleted folder stays in the list, dimmed, with "Folder not found" and aria-disabled', async ({ page }) => {
  const kept = await project('kept', hoursAgo(1));
  const deleted = await project('deleted', hoursAgo(2));
  await rm(deleted, { recursive: true });
  await page.goto('/');
  await openProjects(page);

  await expect(rows(page)).toHaveCount(2);
  await expect(row(page, deleted)).toHaveAttribute('aria-disabled', 'true');
  await expect(row(page, deleted)).toContainText('Folder not found');
  expect(await seenOpacity(page, deleted)).toBeCloseTo(0.55, 2);
  await expect(row(page, kept)).not.toContainText('Folder not found');
  expect(await seenOpacity(page, kept)).toBe(1);
  // A click on the unavailable row does nothing (plan-recent_projects/REQ-15).
  await row(page, deleted).click({ force: true });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(rows(page)).toHaveCount(2);
});

// plan-recent_projects/REQ-9 — scenario "no project yet"
test('with no saved conversation the list shows "No projects yet", and the focus stays on "Projects"', async ({ page }) => {
  await page.goto('/');
  await openProjects(page);
  await expect(panel(page)).toContainText('No projects yet');
  await expect(rows(page)).toHaveCount(0);
  await expect(railButton(page, 'Projects')).toBeFocused();
});

test('a failed load shows "Could not load the projects."', async ({ page }) => {
  await page.route((url) => pastSessionsRequest(url.toString()), (route) => route.fulfill({ status: 500, body: '' }));
  await page.goto('/');
  await railButton(page, 'Projects').click();
  await expect(panel(page)).toContainText('Could not load the projects.');
  await expect(rows(page)).toHaveCount(0);
});

// plan-recent_projects/REQ-11, REQ-12 — scenario "a long list opens at once and works from the keyboard"
test('with hundreds of folders, a second opening from the keyboard shows the list at once with the focus ring on the first row', async ({ page }) => {
  const count = 300;
  for (let i = 0; i < count; i += 1) await project(`many-${String(i).padStart(3, '0')}`, hoursAgo(i + 1), { onDisk: i % 50 !== 0 });
  await page.goto('/');
  await openProjects(page);
  await expect(rows(page)).toHaveCount(count);
  await railButton(page, 'Sessions').click();
  await expect(rows(page)).toHaveCount(0);

  // The second load answers late: the list must show at once from the last loaded content.
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    (url) => pastSessionsRequest(url.toString()),
    async (route) => {
      await held;
      await route.continue();
    },
  );
  await railButton(page, 'Resume').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(railButton(page, 'Projects')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(rows(page)).toHaveCount(count, { timeout: 1_000 });
  await expect(panel(page)).not.toContainText('Loading…');
  await expect(rows(page).first()).toBeFocused();
  expect(await focusedShowsRing(page)).toBe(true);
  release();

  // Tab reaches the next rows, unavailable ones included; each row's favorite button comes after the row button.
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAccessibleName(/Favorite$/);
  await page.keyboard.press('Tab');
  await expect(rows(page).nth(1)).toBeFocused();
  await rows(page).nth(49).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(rows(page).nth(50)).toBeFocused();
  await expect(rows(page).nth(50)).toHaveAttribute('aria-disabled', 'true');
  expect(await focusedShowsRing(page)).toBe(true);

  // Only the rows scroll: the title stays in place.
  const title = panel(page).getByRole('heading', { level: 1, name: 'Projects', exact: true });
  const before = await title.boundingBox();
  await rows(page).last().scrollIntoViewIfNeeded();
  await expect(rows(page).last()).toBeInViewport();
  expect(await title.boundingBox()).toEqual(before);
});

// plan-recent_projects/REQ-2 — scenario "the user goes back to the sessions"
test('"Sessions" brings the session list back with the active style', async ({ page }) => {
  await project('some-project', hoursAgo(1));
  await page.goto('/');
  await openProjects(page);
  await expect(rows(page)).toHaveCount(1);

  await railButton(page, 'Sessions').click();
  await expect(panel(page).getByRole('heading', { level: 1, name: 'Sessions', exact: true })).toBeVisible();
  await expect(panel(page).getByRole('heading', { name: 'Projects', exact: true })).toHaveCount(0);
  await expect(rows(page)).toHaveCount(0);
  await expect(railButton(page, 'Sessions')).toHaveAttribute('aria-current', 'page');
  await expect(railButton(page, 'Projects')).not.toHaveAttribute('aria-current', /.+/);
});

// AppLayout shortcut focus-list: Alt+L switches back to the sessions view
test('Alt+L in the projects view brings the session list back', async ({ page }) => {
  await project('some-project', hoursAgo(1));
  await page.goto('/');
  await openProjects(page);
  await expect(rows(page)).toHaveCount(1);
  await page.keyboard.press('Alt+l');
  await expect(panel(page).getByRole('heading', { level: 1, name: 'Sessions', exact: true })).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  await expect(railButton(page, 'Sessions')).toHaveAttribute('aria-current', 'page');
});
