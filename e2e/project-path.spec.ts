// e2e of plan-resume_favorites, batch project-path. Each test sees in the popup only its own sessions,
// and removes the marks it set before it ends: the e2e data folder is kept between runs.
/// <reference lib="dom" />
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

const SESSIONS_PER_GROUP = 10;
const LONG_TAIL = 'tail-project';

let projectsRoot: string;
let testRoot: string;
const transcripts: string[] = [];
/** Claude Code session ids whose mark is removed after the test. */
const marked: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-project-path-'));
});

test.beforeEach(async () => {
  testRoot = await mkdtemp(path.join(projectsRoot, 'test-'));
});

test.afterEach(async ({ request }) => {
  for (const id of marked.splice(0)) await request.put(`/api/past-sessions/${id}/favorite`, { data: { favorite: false } });
});

test.afterAll(async () => {
  for (const file of transcripts.splice(0)) await rm(file, { force: true });
  await rm(projectsRoot, { recursive: true, force: true });
});

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Resume Session' });
const searchBar = (page: Page) => dialog(page).getByRole('textbox', { name: 'Search Past Sessions' });
const toggle = (page: Page) => dialog(page).getByRole('button', { name: 'Only Favorites', exact: true });
const pastSessions = (page: Page) => dialog(page).getByRole('radiogroup', { name: 'Past Sessions' });
const pastGroup = (page: Page, folder: string) => dialog(page).getByRole('region', { name: folder, exact: true });
const groupHeading = (page: Page, folder: string) => pastGroup(page, folder).getByRole('heading', { level: 3 });
const radios = (page: Page) => dialog(page).getByRole('radio');

const own = (folder: unknown) => typeof folder === 'string' && folder.startsWith(testRoot + path.sep);

/** Shows in the popup only the sessions of the current test. */
async function showOnlyOwnSessions(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname === '/api/past-sessions',
    async (route) => {
      const response = await route.fetch();
      const groups = (await response.json()) as { folder?: unknown }[];
      await route.fulfill({ response, json: groups.filter((g) => own(g.folder)) });
    },
  );
}

/** A past session with only its transcript, marked as favorite when asked. */
async function pastSession(request: APIRequestContext, folder: string, label: string, modified: Date, favorite: boolean): Promise<void> {
  await mkdir(folder, { recursive: true });
  const id = randomUUID();
  const dir = path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'));
  await mkdir(dir, { recursive: true });
  const common = { cwd: folder, sessionId: id, isSidechain: false };
  const lines = [
    { ...common, type: 'user', message: { role: 'user', content: label } },
    { ...common, type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] } },
  ];
  const file = path.join(dir, `${id}.jsonl`);
  await writeFile(file, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  await utimes(file, modified, modified);
  transcripts.push(file);
  if (favorite) {
    marked.push(id);
    expect((await request.put(`/api/past-sessions/${id}/favorite`, { data: { favorite: true } })).ok()).toBe(true);
  }
}

/**
 * Two projects, one with a long folder path. Each has SESSIONS_PER_GROUP favorite "task" sessions and two plain
 * "chore" sessions, so the list scrolls also with the search "task" or the favorites filter on.
 */
async function twoProjects(request: APIRequestContext): Promise<{ long: string; short: string }> {
  const segment = 'a-rather-long-folder-name-for-the-sticky-heading';
  const long = path.join(testRoot, `${segment}-1`, `${segment}-2`, `${segment}-3`, LONG_TAIL);
  const short = path.join(testRoot, 'short');
  let minute = 0;
  for (const [folder, name] of [[long, 'Long'], [short, 'Short']] as const) {
    for (let i = 1; i <= SESSIONS_PER_GROUP; i++) await pastSession(request, folder, `${name} task ${i}`, new Date(Date.now() - ++minute * 60_000), true);
    for (let i = 1; i <= 2; i++) await pastSession(request, folder, `${name} chore ${i}`, new Date(Date.now() - ++minute * 60_000), false);
  }
  return { long, short };
}

async function openPopup(page: Page): Promise<void> {
  await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).not.toContainText('Loading…');
}

interface Sample {
  scrollTop: number;
  /** Folder path (tooltip) of the topmost heading still in view, or null. */
  topHeading: string | null;
  /** Group of the first row that is still, at least in part, inside the area. */
  firstRowGroup: string | null;
  /** Distance of that heading's top edge from the area's top edge. */
  headingOffset: number | null;
  /** Whether the heading's section has reached the area's top edge: its rows are scrolling past it. */
  sectionAtTop: boolean;
  /** Whether that heading's bottom edge is its section's bottom edge: the next group pushes it away. */
  pushed: boolean;
  /** Whether the heading is drawn over whatever lies under it. */
  drawnOnTop: boolean;
}

/** Scrolls the past sessions area from top to bottom and records, at each step, which heading is at the top. */
async function scrollSamples(page: Page): Promise<Sample[]> {
  return pastSessions(page).evaluate((area) => {
    const samples: Sample[] = [];
    const max = area.scrollHeight - area.clientHeight;
    for (let top = 0; ; top = Math.min(top + 12, max)) {
      area.scrollTop = top;
      const box = area.getBoundingClientRect();
      const heading = [...area.querySelectorAll('h3')].find((h) => h.getBoundingClientRect().bottom > box.top + 1) ?? null;
      const firstRow = [...area.querySelectorAll('.list-card')].find((row) => row.getBoundingClientRect().bottom > box.top + 1);
      const h = heading?.getBoundingClientRect();
      const section = heading?.closest('section')?.getBoundingClientRect();
      const probe = h ? document.elementFromPoint(box.left + box.width / 3, (Math.max(h.top, box.top) + h.bottom) / 2) : null;
      samples.push({
        scrollTop: area.scrollTop,
        topHeading: heading?.getAttribute('title') ?? null,
        firstRowGroup: firstRow?.closest('section')?.getAttribute('aria-label') ?? null,
        headingOffset: h ? h.top - box.top : null,
        sectionAtTop: !!section && section.top <= box.top + 0.5,
        pushed: !!h && !!section && Math.abs(h.bottom - section.bottom) <= 0.5,
        drawnOnTop: !!heading && probe?.closest('h3') === heading,
      });
      if (top >= max) break;
    }
    return samples;
  });
}

/** Checks plan-resume_favorites/REQ-20 over a full scroll: the heading at the top is always the group of the first rows in view. */
async function expectStickyHeadings(page: Page, folders: { long: string; short: string }): Promise<void> {
  const area = pastSessions(page);
  expect(await area.evaluate((el) => el.scrollHeight > el.clientHeight + 100), 'the list scrolls').toBe(true);
  const order = await dialog(page).getByRole('region').evaluateAll((sections) => sections.map((s) => s.getAttribute('aria-label')));
  expect([...order].sort()).toEqual([folders.long, folders.short].sort());

  const samples = await scrollSamples(page);
  for (const s of samples) {
    expect(s.topHeading, `the first heading in view names the group of the first rows at scrollTop ${s.scrollTop}`).toBe(s.firstRowGroup);
    expect(s.drawnOnTop, `the heading is drawn over the rows at scrollTop ${s.scrollTop}`).toBe(true);
    // While its rows scroll past the top, the heading stays at the top, unless the end of its group pushes it away.
    if (s.sectionAtTop && !s.pushed) expect(Math.abs(s.headingOffset ?? 99), `the heading sticks to the top at scrollTop ${s.scrollTop}`).toBeLessThanOrEqual(1);
  }
  expect(samples.filter((s) => s.sectionAtTop && !s.pushed && s.scrollTop > 0).length, 'the heading sticks during the scroll').toBeGreaterThan(5);
  expect(samples.some((s) => s.pushed && (s.headingOffset ?? 0) < -1), 'the first heading is pushed away').toBe(true);
  const shown = samples.map((s) => s.topHeading).filter((h, i, all) => h !== all[i - 1]);
  expect(shown, 'the heading changes once, at the second group').toEqual(order);
}

// plan-resume_favorites/REQ-20 — scenario "The project path stays visible while the list scrolls"
// ResumeDialog (gatekeeper decision, 2026-11-20): the heading has no fill, only the popup glass blur over the rows under it.
test('while the list scrolls, the heading of the first rows in view stays at the top, on the glass blur, and changes at the second group', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const folders = await twoProjects(request);
  await page.goto('/');
  await openPopup(page);
  await expect(radios(page)).toHaveCount(4 * 6);

  const heading = await groupHeading(page, folders.long).evaluate((h) => ({ background: getComputedStyle(h).backgroundColor, blur: getComputedStyle(h).backdropFilter }));
  const blur = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--popup-glass-blur').trim());
  expect(heading, 'the heading has no fill, only the glass blur').toEqual({ background: 'rgba(0, 0, 0, 0)', blur: `blur(${blur})` });

  await expectStickyHeadings(page, folders);
});

// plan-resume_favorites/REQ-20 — the same with search text
test('with search text, the heading of the first rows in view stays at the top and changes at the second group', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const folders = await twoProjects(request);
  await page.goto('/');
  await openPopup(page);
  await searchBar(page).fill('task');
  await expect(radios(page)).toHaveCount(2 * SESSIONS_PER_GROUP);
  await expectStickyHeadings(page, folders);
});

// plan-resume_favorites/REQ-20 — the same with the favorites filter on
test('with "Only Favorites" on, the heading of the first rows in view stays at the top and changes at the second group', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const folders = await twoProjects(request);
  await page.goto('/');
  await openPopup(page);
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(radios(page)).toHaveCount(2 * SESSIONS_PER_GROUP);
  await expectStickyHeadings(page, folders);
});

// plan-resume_favorites/REQ-21 — scenario "The project path stays visible while the list scrolls", the long path
test('a long path stays on one line with an ellipsis and its last folders visible; the tooltip and the section name are the full path', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const folders = await twoProjects(request);
  await page.goto('/');
  await openPopup(page);

  const heading = groupHeading(page, folders.long);
  await expect(heading).toHaveAttribute('title', folders.long);
  await expect(pastGroup(page, folders.long)).toHaveCount(1);
  await expect(heading).toHaveText(folders.long);

  const layout = await heading.evaluate((h, tail) => {
    const box = h.getBoundingClientRect();
    const style = getComputedStyle(h);
    const inner = { left: box.left + parseFloat(style.paddingLeft), right: box.right - parseFloat(style.paddingRight) };
    const walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
    const text = walker.nextNode() as Text;
    const charRect = (from: number, to: number) => {
      const range = document.createRange();
      range.setStart(text, from);
      range.setEnd(text, to);
      return range.getBoundingClientRect();
    };
    const all = text.data;
    const tailRect = charRect(all.length - tail.length, all.length);
    const firstChar = charRect(0, 1);
    const lineTops = new Set([...Array(all.length).keys()].map((i) => Math.round(charRect(i, i + 1).top)));
    return {
      overflows: h.scrollWidth > h.clientWidth,
      lines: lineTops.size,
      textOverflow: style.textOverflow,
      tailInside: tailRect.left >= inner.left - 0.5 && tailRect.right <= inner.right + 0.5,
      startCut: firstChar.right <= inner.left + 0.5 || firstChar.left >= inner.right - 0.5,
    };
  }, LONG_TAIL);
  expect(layout.overflows, 'the fixture path does not fit').toBe(true);
  expect(layout.lines, 'one line').toBe(1);
  expect(layout.textOverflow, 'the cut shows an ellipsis').toBe('ellipsis');
  expect(layout.tailInside, 'the last folder is visible').toBe(true);
  expect(layout.startCut, 'the start of the path is the part cut').toBe(true);

  const short = groupHeading(page, folders.short);
  await expect(short).toHaveAttribute('title', folders.short);
  expect(await short.evaluate((h) => h.scrollWidth <= h.clientWidth), 'a short path fits whole').toBe(true);
  const heights = await Promise.all([heading, short].map((h) => h.evaluate((el) => el.getBoundingClientRect().height)));
  expect(heights[0], 'the long heading is as tall as the short one').toBeCloseTo(heights[1]!, 0);
});
