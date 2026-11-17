// e2e of plan-ui_restyle, batch project-row. The server reads the fixture Claude Code folder E2E_CLAUDE_DIR.
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';
import { pageSettled } from './motion';

let projectsRoot: string;

test.beforeEach(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await mkdir(path.join(E2E_CLAUDE_DIR, 'projects'), { recursive: true });
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-project-row-'));
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
const row = (page: Page, folder: string) => rows(page).filter({ has: page.getByText(folder, { exact: true }) });
const item = (page: Page, folder: string) => panel(page).locator('li').filter({ has: page.locator('.project-row').getByText(folder, { exact: true }) });
const pathText = (page: Page, folder: string) => row(page, folder).getByText(folder, { exact: true });
const nameText = (page: Page, folder: string) => row(page, folder).getByText(path.basename(folder), { exact: true });
const starButton = (page: Page, folder: string) => item(page, folder).getByRole('button', { name: /^(Mark as Favorite|Remove Favorite)$/ });
const markButton = (page: Page, folder: string) => item(page, folder).getByRole('button', { name: 'Mark as Favorite', exact: true });
const unmarkButton = (page: Page, folder: string) => item(page, folder).getByRole('button', { name: 'Remove Favorite', exact: true });
const removeButton = (page: Page, folder: string) => item(page, folder).getByRole('button', { name: 'Remove from Projects', exact: true });
const nameDialog = (page: Page) => page.getByRole('dialog', { name: 'New session' });
const searchField = (page: Page) => panel(page).getByRole('textbox', { name: 'Search projects' });
const isFavoriteRequest = (url: URL) => url.pathname === '/api/projects/favorite';

async function project(name: string, modified: Date): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder, { recursive: true });
  const id = `${path.basename(name)}-session`;
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

/** Projects A and B, A the most recent, with the list open and the pointer away from the rows. */
async function twoProjects(page: Page) {
  const a = await project('alpha', hoursAgo(1));
  const b = await project('bravo', hoursAgo(2));
  await page.goto('/');
  await openProjects(page);
  await expect(rows(page)).toHaveCount(2);
  await page.mouse.move(5, 5);
  return { a, b };
}

/** The value the browser computes for a CSS property set to `value` on a probe element. */
async function computed(page: Page, property: 'color' | 'backgroundColor', value: string): Promise<string> {
  return page.evaluate(
    ([prop, val]) => {
      const probe = document.createElement('div');
      probe.style[prop as 'color'] = val!;
      document.body.append(probe);
      const result = getComputedStyle(probe)[prop as 'color'];
      probe.remove();
      return result;
    },
    [property, value],
  );
}

async function focusedShowsRing(page: Page): Promise<boolean> {
  const ring = await computed(page, 'color', 'var(--color-focus-ring)');
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

const starShape = (button: Locator) =>
  button.locator('svg').evaluate((svg) => ({ filled: svg.classList.contains('icon-filled'), fill: getComputedStyle(svg).fill }));

/** Records, from page load, every time a star button starts to carry the class "pop", with its computed animation. */
const recordPops = () =>
  `(() => {
    window.__pops = [];
    const hadPop = new WeakMap();
    const check = (el) => {
      const hasPop = el.classList.contains('pop');
      if (hasPop && !hadPop.get(el)) {
        const s = getComputedStyle(el);
        window.__pops.push({ name: el.getAttribute('aria-label'), animation: s.animationName, duration: s.animationDuration });
      }
      hadPop.set(el, hasPop);
    };
    new MutationObserver((records) => {
      const touched = new Set();
      for (const r of records) {
        if (r.type === 'attributes' && r.target instanceof Element) touched.add(r.target);
        for (const node of r.addedNodes) if (node instanceof Element) for (const el of [node, ...node.querySelectorAll('*')]) touched.add(el);
      }
      for (const el of touched) if (el.classList.contains('star-button')) check(el);
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  })()`;
type Pop = { name: string; animation: string; duration: string };
const pops = (page: Page) => page.evaluate(() => (window as unknown as { __pops: Pop[] }).__pops);
const seconds = (duration: string) => (duration.endsWith('ms') ? parseFloat(duration) / 1000 : parseFloat(duration));

// plan-ui_restyle/REQ-12, REQ-20, REQ-23 — scenario "The user removes a project with the X at the right end of the row"
test('a row with a long path shows no "New session" label, no path tooltip, and Remove never covers the path', async ({ page }) => {
  const long = await project(`deep/${'very-long-folder-segment-'.repeat(6)}end/project-with-a-long-name`, hoursAgo(1));
  await page.goto('/');
  await openProjects(page);
  await row(page, long).hover();
  await expect.poll(() => seenOpacity(removeButton(page, long))).toBe(1);

  await expect(item(page, long)).not.toContainText('New session');
  await pathText(page, long).hover();
  const titles = await pathText(page, long).evaluate((el) => {
    const found: string[] = [];
    for (let node: Element | null = el; node && node.tagName !== 'LI'; node = node.parentElement) if (node.hasAttribute('title')) found.push(node.tagName);
    return found;
  });
  expect(titles, 'elements with a title around the path').toEqual([]);

  const pathBox = (await pathText(page, long).boundingBox())!;
  const removeBox = (await removeButton(page, long).boundingBox())!;
  const truncated = await pathText(page, long).evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(truncated, 'the long path is cut').toBe(true);
  expect(pathBox.x + pathBox.width, 'the path ends left of Remove').toBeLessThanOrEqual(removeBox.x + 0.5);
  expect(await row(page, long).evaluate((el) => getComputedStyle(el).paddingRight)).toBe('36px');

  await removeButton(page, long).click();
  await expect(rows(page)).toHaveCount(0);
});

// plan-ui_restyle/REQ-14
test('the star sits right after the folder name, on its first line, inside the row', async ({ page }) => {
  const { a } = await twoProjects(page);
  // The project rows rise in cascade (plan-ui_transitions/REQ-17): they are measured at rest.
  await pageSettled(page);
  await row(page, a).hover();
  const nameBox = (await nameText(page, a).boundingBox())!;
  const starBox = (await starButton(page, a).boundingBox())!;
  const rowBox = (await row(page, a).boundingBox())!;
  const pathBox = (await pathText(page, a).boundingBox())!;
  expect(starBox.x, 'right of the name').toBeGreaterThanOrEqual(nameBox.x + nameBox.width - 0.5);
  expect(starBox.x - (nameBox.x + nameBox.width), 'right after the name').toBeLessThan(12);
  expect(starBox.y + starBox.height / 2, 'on the line of the name').toBeCloseTo(nameBox.y + nameBox.height / 2, 0);
  expect(starBox.y + starBox.height, 'above the path line').toBeLessThanOrEqual(pathBox.y + 2);
  expect(starBox.x).toBeGreaterThanOrEqual(rowBox.x);
  expect(starBox.x + starBox.width).toBeLessThanOrEqual(rowBox.x + rowBox.width);
  expect(starBox.width, 'a 20 px button').toBeCloseTo(20, 0);
  await expect(row(page, a).getByRole('img', { name: 'Favorite', exact: true })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('project-row-hover.png') });
});

// plan-ui_restyle/REQ-15, REQ-16, REQ-28
test('an unmarked star is a hidden outline that shows at 70 % on row hover; a marked star is always shown, filled in amber', async ({ page }) => {
  const { a, b } = await twoProjects(page);
  await expect.poll(() => seenOpacity(markButton(page, b)), 'hidden with no hover and no focus').toBe(0);
  await row(page, b).hover();
  await expect.poll(() => seenOpacity(markButton(page, b)), 'outline at 70 % on row hover').toBeCloseTo(0.7, 2);
  const outline = await starShape(markButton(page, b));
  expect(outline.filled).toBe(false);
  expect(outline.fill).toBe('none');

  await row(page, a).hover();
  await markButton(page, a).click();
  await expect(unmarkButton(page, a)).toHaveCount(1);
  await page.mouse.move(5, 5);
  await expect.poll(() => seenOpacity(unmarkButton(page, a)), 'a marked star stays shown').toBe(1);
  await expect.poll(() => seenOpacity(markButton(page, b))).toBe(0);
  const filled = await starShape(unmarkButton(page, a));
  expect(filled.filled).toBe(true);
  expect(filled.fill).not.toBe('none');
  const amber = await computed(page, 'color', 'var(--amber-400)');
  await expect.poll(() => unmarkButton(page, a).evaluate((el) => getComputedStyle(el).color), 'amber from the theme').toBe(amber);
});

// plan-ui_restyle/REQ-17, REQ-24 — scenario "The user marks a project from the star next to its name"
test('a click on the outline star marks the project with a short pop, starts no session, and the pop never plays on load or from another page', async ({ page, context }) => {
  await context.addInitScript(recordPops());
  const { a, b } = await twoProjects(page);
  await row(page, b).hover();
  await markButton(page, b).click();
  await expect(unmarkButton(page, b)).toHaveCount(1);
  await expect.poll(() => pops(page)).toHaveLength(1);
  const [pop] = await pops(page);
  expect(pop!.animation, 'an animation runs').not.toBe('none');
  expect(seconds(pop!.duration), 'a short animation').toBeGreaterThan(0.1);
  expect(seconds(pop!.duration), 'a short animation').toBeLessThanOrEqual(0.6);
  await expect(unmarkButton(page, b)).not.toHaveClass(/\bpop\b/);
  await page.mouse.move(5, 5);
  await expect.poll(() => seenOpacity(unmarkButton(page, b))).toBe(1);
  await expect(nameDialog(page)).toHaveCount(0);

  await row(page, b).hover();
  await unmarkButton(page, b).click();
  await expect(markButton(page, b)).toHaveCount(1);
  expect(await pops(page), 'no pop on unmark').toHaveLength(1);

  const other = await context.newPage();
  await other.goto('/');
  await openProjects(other);
  await row(page, a).hover();
  await markButton(page, a).click();
  await expect(unmarkButton(other, a)).toHaveCount(1);
  expect(await pops(other), 'no pop for a mark from another page').toEqual([]);

  await page.reload();
  await openProjects(page);
  await expect(unmarkButton(page, a)).toHaveCount(1);
  expect(await pops(page), 'no pop on load').toEqual([]);
});

// plan-ui_restyle/REQ-18 — scenario "No pop with reduced motion"
test('with reduced motion the star fills with no animation', async ({ page, context }) => {
  await context.addInitScript(recordPops());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { a } = await twoProjects(page);
  await row(page, a).hover();
  await markButton(page, a).click();
  await expect(unmarkButton(page, a)).toHaveCount(1);
  expect((await starShape(unmarkButton(page, a))).filled).toBe(true);
  for (const pop of await pops(page)) expect(pop.animation, 'no animation under reduced motion').toBe('none');
});

// plan-ui_restyle/REQ-19, REQ-20, REQ-21, REQ-22
test('Remove is a 22 px circle with a 10 px grey X, 8 px from the right end, centred, shown on hover, rose on its own hover', async ({ page }) => {
  const { a } = await twoProjects(page);
  await expect.poll(() => seenOpacity(removeButton(page, a)), 'hidden with no hover and no focus').toBe(0);
  await expect(item(page, a).getByRole('button')).toHaveCount(3);

  await row(page, a).hover();
  const button = removeButton(page, a);
  await expect.poll(() => seenOpacity(button)).toBe(1);
  const rowBox = (await row(page, a).boundingBox())!;
  const box = (await button.boundingBox())!;
  const iconBox = (await button.locator('svg').boundingBox())!;
  expect(box.width).toBeCloseTo(22, 0);
  expect(box.height).toBeCloseTo(22, 0);
  expect(iconBox.width).toBeCloseTo(10, 0);
  expect(iconBox.height).toBeCloseTo(10, 0);
  expect(await button.evaluate((el) => getComputedStyle(el).borderRadius)).toMatch(/^(50%|11px|9999px)$/);
  expect(rowBox.x + rowBox.width - (box.x + box.width), '8 px from the right edge').toBeCloseTo(8, 0);
  expect(box.y + box.height / 2, 'centred on the row height').toBeCloseTo(rowBox.y + rowBox.height / 2, 0);
  const muted = await computed(page, 'color', 'var(--text-muted)');
  expect(await button.evaluate((el) => getComputedStyle(el).color), 'grey X').toBe(muted);
  expect(await button.evaluate((el) => getComputedStyle(el).backgroundColor), 'no background at rest').toBe('rgba(0, 0, 0, 0)');

  await button.hover();
  const roseBg = await computed(page, 'backgroundColor', 'var(--rose-500-15)');
  const rose = await computed(page, 'color', 'var(--rose-400)');
  await expect.poll(() => button.evaluate((el) => getComputedStyle(el).backgroundColor), 'soft red background').toBe(roseBg);
  await expect.poll(() => button.evaluate((el) => getComputedStyle(el).color), 'soft red X').toBe(rose);
  await page.screenshot({ path: test.info().outputPath('project-row-remove-hover.png') });
});

// plan-ui_restyle/REQ-26, REQ-27, REQ-28 — scenario "The star and the X work from the keyboard"
test('Tab goes row, star, Remove; each shows on focus with the ring on a row that is not hovered', async ({ page }) => {
  const { a, b } = await twoProjects(page);
  await searchField(page).focus();
  await page.keyboard.press('Tab');
  await expect(row(page, a)).toBeFocused();
  await expect.poll(() => seenOpacity(markButton(page, a)), 'outline on row focus').toBeCloseTo(0.7, 2);
  await expect.poll(() => seenOpacity(removeButton(page, a)), 'Remove on row focus').toBe(1);
  await expect.poll(() => seenOpacity(markButton(page, b)), 'other rows stay hidden').toBe(0);

  await page.keyboard.press('Tab');
  await expect(markButton(page, a)).toBeFocused();
  await expect(markButton(page, a)).toHaveAccessibleName('Mark as Favorite');
  await expect.poll(() => seenOpacity(markButton(page, a)), 'full opacity on its own focus').toBe(1);
  expect(await focusedShowsRing(page), 'focus ring on the star').toBe(true);
  expect((await starShape(markButton(page, a))).filled).toBe(false);

  await page.keyboard.press('Enter');
  await expect(unmarkButton(page, a)).toHaveCount(1);
  await expect(unmarkButton(page, a)).toHaveAccessibleName('Remove Favorite');
  expect((await starShape(unmarkButton(page, a))).filled).toBe(true);
  await expect(nameDialog(page)).toHaveCount(0);

  await unmarkButton(page, a).focus();
  await page.keyboard.press('Tab');
  await expect(removeButton(page, a)).toBeFocused();
  await expect.poll(() => seenOpacity(removeButton(page, a))).toBe(1);
  expect(await focusedShowsRing(page), 'focus ring on Remove').toBe(true);
});

// plan-ui_restyle/REQ-13, REQ-24 — scenario "A click on the row still starts a session"
test('a click on the star or on Remove starts no session; a click on the row opens the session start', async ({ page }) => {
  const { a, b } = await twoProjects(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(isFavoriteRequest, async (route) => {
    await held;
    await route.continue();
  });
  await row(page, b).hover();
  await markButton(page, b).click();
  await expect(nameDialog(page)).toHaveCount(0);
  release();
  await expect(unmarkButton(page, b)).toHaveCount(1);

  await row(page, a).hover();
  await removeButton(page, a).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(nameDialog(page)).toHaveCount(0);

  const rowBox = (await row(page, b).boundingBox())!;
  await page.mouse.click(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height - 6);
  await expect(nameDialog(page)).toBeVisible();
  await expect(nameDialog(page)).toContainText('bravo');
});
