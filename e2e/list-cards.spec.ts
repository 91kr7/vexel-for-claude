// e2e of plan-dark_blue_theme, batch list-cards: the lists outside the session list take the look of the session cards.
// The tests write past conversations in the fixture Claude Code folder, so this spec runs in the claude-dir group.
/// <reference lib="dom" />
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';
import { settingsButton, settingsPopup } from './settings';

type Theme = 'light' | 'dark';
const THEMES: Theme[] = ['dark', 'light'];
const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeEach(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await mkdir(path.join(E2E_CLAUDE_DIR, 'projects'), { recursive: true });
  projectsRoot = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-list-cards-')));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  await rm(projectsRoot, { recursive: true, force: true });
});

test.afterAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
});

const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const sessionList = (page: Page) => page.getByRole('region', { name: 'Session List' });
const explorer = (page: Page) => page.getByRole('main').getByRole('region', { name: 'Git Explorer', exact: true });

const style = (locator: Locator, property: string) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);

/** What the browser computes for a CSS value set on `property` of a probe element. */
const computed = (page: Page, property: string, value: string) =>
  page.evaluate(
    ([p, v]) => {
      const probe = document.createElement('span');
      probe.style.setProperty(p, v);
      probe.style.display = 'block';
      probe.style.position = 'absolute';
      document.body.append(probe);
      const result = getComputedStyle(probe).getPropertyValue(p);
      probe.remove();
      return result;
    },
    [property, value] as const,
  );
const colourOf = (page: Page, value: string) => computed(page, 'color', value);

async function openIn(page: Page, theme: Theme = 'dark', look: 'macos' | 'windows11' = 'macos'): Promise<void> {
  await page.addInitScript(
    ([t, l]) => {
      localStorage.setItem('ai-client.theme', t);
      localStorage.setItem('ai-client.look', l);
    },
    [theme, look] as const,
  );
  await page.goto('/');
  await expect(rail(page)).toBeVisible();
}

async function pointerAway(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
}

/** A project folder with one past conversation whose first prompt is `prompt`. */
async function pastConversation(name: string, prompt = `Work in ${name}`): Promise<{ folder: string; prompt: string }> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder, { recursive: true });
  const id = randomUUID();
  const dir = path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'));
  await mkdir(dir, { recursive: true });
  const common = { cwd: folder, sessionId: id, isSidechain: false };
  const lines = [
    { ...common, type: 'user', message: { role: 'user', content: prompt } },
    { ...common, type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] } },
  ];
  await writeFile(path.join(dir, `${id}.jsonl`), lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  return { folder, prompt };
}

/**
 * The accent bar of an entry on its left edge: an accent-coloured left border plus an inset accent shadow,
 * or a 3.5 px accent pseudo-element. Null when the entry has no accent on its left edge.
 */
function accentBarOf(entry: Locator, accent: string) {
  return entry.evaluate((el, accentColour) => {
    const s = getComputedStyle(el);
    const border = s.borderLeftColor === accentColour ? parseFloat(s.borderLeftWidth) : 0;
    const shadows = s.boxShadow === 'none' ? [] : s.boxShadow.split(/,(?![^(]*\))/).map((part) => part.trim());
    const inset = shadows
      .filter((part) => part.endsWith('inset') && part.startsWith(accentColour))
      .map((part) => parseFloat(part.slice(accentColour.length).trim().split(/\s+/)[0] ?? '0'))
      .reduce((sum, x) => sum + Math.max(x, 0), 0);
    for (const name of ['::before', '::after']) {
      const p = getComputedStyle(el, name);
      if (p.content !== 'none' && p.display !== 'none' && p.backgroundColor === accentColour && Math.abs(parseFloat(p.width) - 3.5) < 0.1) return { width: 3.5 };
    }
    if (!inset && !border) return null;
    return { width: border + inset };
  }, accent);
}

async function expectBorder(entry: Locator, colour: string, what: string): Promise<void> {
  for (const side of SIDES) {
    expect(await style(entry, `border-${side}-width`), `${what}: 1 px ${side} border`).toBe('1px');
    expect(await style(entry, `border-${side}-style`), `${what}: ${side} border style`).toBe('solid');
    // Polled: the colour may still be in its transition.
    await expect.poll(() => style(entry, `border-${side}-color`), { message: `${what}: ${side} border colour` }).toBe(colour);
  }
}

async function expectCardCorners(entry: Locator, what: string): Promise<void> {
  for (const corner of ['top-left', 'bottom-right']) {
    expect(await style(entry, `border-${corner}-radius`), `${what}: 7 px corners`).toBe('7px');
  }
}

/** An entry of a card list at rest, as an inactive session card: 7 px corners, 1 px subtle border, card surface. */
async function expectRestingCard(page: Page, entry: Locator, what: string): Promise<void> {
  await expectCardCorners(entry, what);
  await expect.poll(() => style(entry, 'background-color'), { message: `${what}: card surface` }).toBe(await colourOf(page, 'var(--role-card)'));
  await expectBorder(entry, await colourOf(page, 'var(--role-border-subtle)'), what);
  expect(await accentBarOf(entry, await colourOf(page, 'var(--role-accent)')), `${what}: no accent bar`).toBeNull();
}

/** A dense row at rest: the card corners, no surface and no visible border, so no separator lines. */
async function expectRestingRow(entry: Locator, what: string): Promise<void> {
  await expectCardCorners(entry, what);
  await expect.poll(() => style(entry, 'background-color'), { message: `${what}: no surface at rest` }).toBe(TRANSPARENT);
  for (const side of SIDES) {
    const visible = async () => {
      const width = parseFloat(await style(entry, `border-${side}-width`));
      const colour = await style(entry, `border-${side}-color`);
      return width === 0 || colour === TRANSPARENT ? 'none' : `${width}px ${colour}`;
    };
    await expect.poll(visible, { message: `${what}: no visible ${side} border at rest` }).toBe('none');
  }
}

/** The hover of an inactive session card: active card surface, strong border, primary text. */
async function expectHovered(page: Page, entry: Locator, what: string): Promise<void> {
  await entry.hover();
  await expect.poll(() => style(entry, 'background-color'), { message: `${what}: hover surface` }).toBe(await colourOf(page, 'var(--role-card-active)'));
  await expectBorder(entry, await colourOf(page, 'var(--role-border-strong)'), `hovered ${what}`);
  await expect.poll(() => style(entry, 'color'), { message: `${what}: primary text on hover` }).toBe(await colourOf(page, 'var(--text-primary)'));
}

/** The look of the open session card: active surface, accent border, 3.5 px accent bar, card shadow, primary text. */
async function expectActive(page: Page, entry: Locator, what: string): Promise<void> {
  await expect.poll(() => style(entry, 'background-color'), { message: `${what}: active card surface` }).toBe(await colourOf(page, 'var(--role-card-active)'));
  await expectCardCorners(entry, what);
  await expectBorder(entry, await colourOf(page, 'var(--role-accent)'), what);
  const bar = await accentBarOf(entry, await colourOf(page, 'var(--role-accent)'));
  expect(bar, `${what}: accent bar on the left`).not.toBeNull();
  expect(Math.abs(bar!.width - 3.5), `${what}: accent bar width ${bar!.width}`).toBeLessThanOrEqual(0.05);
  expect(await style(entry, 'box-shadow'), `${what}: card shadow`).toContain(await computed(page, 'box-shadow', 'var(--shadow-card)'));
  await expect.poll(() => style(entry, 'color'), { message: `${what}: primary text` }).toBe(await colourOf(page, 'var(--text-primary)'));
}

async function expectTabular(page: Page, number: Locator, what: string): Promise<void> {
  await expect(number, what).toBeVisible();
  expect(await style(number, 'font-family'), `${what}: monospace font`).toBe(await computed(page, 'font-family', 'var(--font-mono)'));
  expect(await style(number, 'font-variant-numeric'), `${what}: tabular figures`).toContain('tabular-nums');
}

/** The focused element shows a ring drawn inside its edge: an outline with an inward offset, or an inset box-shadow. */
function ringInside(target: Locator) {
  return target.evaluate((el) => {
    const s = getComputedStyle(el);
    const outlineWidth = s.outlineStyle !== 'none' ? parseFloat(s.outlineWidth) : 0;
    const outline = outlineWidth > 0 && s.outlineColor !== 'rgba(0, 0, 0, 0)';
    if (outline) return { ring: true, inside: parseFloat(s.outlineOffset) + outlineWidth <= 0.01, detail: `outline ${s.outlineWidth} offset ${s.outlineOffset}` };
    const shadows = s.boxShadow === 'none' ? [] : s.boxShadow.split(/,(?![^(]*\))/).map((part) => part.trim());
    const outer = shadows.filter((part) => !part.endsWith('inset') && /0px 0px 0px [\d.]+px$/.test(part));
    return { ring: shadows.some((part) => part.endsWith('inset')) || outer.length > 0, inside: outer.length === 0, detail: s.boxShadow };
  });
}

async function expectFocusInside(page: Page, target: Locator, what: string): Promise<void> {
  await expect(target, `${what} has the focus`).toBeFocused();
  const result = await ringInside(target);
  expect(result.ring, `${what}: focus ring shown (${result.detail})`).toBe(true);
  expect(result.inside, `${what}: focus ring inside the edge (${result.detail})`).toBe(true);
}

const git = (folder: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: folder, encoding: 'utf8' }).trim();

async function repositoryAt(parent: string, relative: string): Promise<string> {
  const root = path.join(parent, relative);
  await mkdir(root, { recursive: true });
  git(root, 'init', '-q', '-b', 'main');
  await writeFile(path.join(root, 'README.md'), 'hello\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'first');
  return root;
}

async function openExplorer(page: Page, request: APIRequestContext, folder: string): Promise<void> {
  const started = await request.post('/api/sessions', { data: { path: folder } });
  expect(started.status()).toBe(201);
  createdIds.push(((await started.json()) as { id: string }).id);
  await openIn(page);
  await sessionList(page).getByTitle(folder, { exact: true }).click();
  await expect(page.locator('.xterm-rows')).toContainText(`CWD:${folder}`);
  await page.getByRole('main').locator('.session-header').getByRole('button', { name: 'Git Explorer', exact: true }).click();
  await expect(explorer(page)).toBeVisible();
}

test.describe('card lists', () => {
  // plan-dark_blue_theme/REQ-44, REQ-45, REQ-46, REQ-48 — scenario "the Resume dialog shows its sessions as cards"
  for (const theme of THEMES) {
    test(`${theme}: Resume search results are cards; the row chosen with the arrow keys is active; a hovered card changes; dates are tabular`, async ({ page }) => {
      const first = await pastConversation('alpha-one', 'Fix the alpha parser');
      const second = await pastConversation('alpha-two', 'Add the alpha cache');
      const hidden = await pastConversation('bravo', 'Rewrite bravo');
      await openIn(page, theme);
      await rail(page).getByRole('button', { name: 'Resume', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Resume Session' });
      await expect(dialog).not.toContainText('Loading…');
      await dialog.getByRole('textbox', { name: 'Search Past Sessions' }).fill('alpha');
      await expect(dialog.getByRole('radio', { name: hidden.prompt, exact: true })).toHaveCount(0);

      const radioA = dialog.getByRole('radio', { name: first.prompt, exact: true });
      const radioB = dialog.getByRole('radio', { name: second.prompt, exact: true });
      const rowA = radioA.locator('xpath=ancestor::label[1]');
      const rowB = radioB.locator('xpath=ancestor::label[1]');
      await pointerAway(page);
      await expectRestingCard(page, rowA, 'result row A');
      await expectRestingCard(page, rowB, 'result row B');
      await expectTabular(page, rowA.locator('time'), 'result row date');

      const [upper] = (await radioA.boundingBox())!.y < (await radioB.boundingBox())!.y ? [radioA, radioB] : [radioB, radioA];
      await upper.focus();
      await page.keyboard.press('ArrowDown');
      await expect(dialog.getByRole('radio', { checked: true })).toHaveCount(1);
      const [activeRow, plainRow] = (await radioA.isChecked()) ? [rowA, rowB] : [rowB, rowA];
      await pointerAway(page);
      await expectActive(page, activeRow, 'chosen result row');
      expect(Number(await style(activeRow, 'font-weight')), 'chosen result row: weight 600').toBeGreaterThanOrEqual(600);
      await expectRestingCard(page, plainRow, 'other result row');

      await expectHovered(page, plainRow, 'other result row');
      await activeRow.hover();
      await expectActive(page, activeRow, 'hovered chosen row');
    });
  }

  // plan-dark_blue_theme/REQ-44, REQ-46, REQ-48 — scenario "the Resume dialog shows its sessions as cards", And: the Projects list
  for (const theme of THEMES) {
    test(`${theme}: project rows are cards with the card hover; a missing folder has no hover; the last activity time is tabular`, async ({ page }) => {
      const present = await pastConversation('charlie');
      const gone = await pastConversation('delta');
      await rm(gone.folder, { recursive: true, force: true });
      await openIn(page, theme);
      await rail(page).getByRole('button', { name: 'Projects', exact: true }).click();
      const rowOf = (folder: string) => sessionList(page).locator('.project-row').filter({ has: page.getByText(folder, { exact: true }) });
      await expect(rowOf(present.folder)).toHaveCount(1);
      await expect(rowOf(gone.folder)).toHaveAttribute('aria-disabled', 'true');
      await pointerAway(page);
      await expectRestingCard(page, rowOf(present.folder), 'project row');
      await expectTabular(page, rowOf(present.folder).locator('time'), 'last activity time');

      await expectHovered(page, rowOf(present.folder), 'project row');
      const goneRow = rowOf(gone.folder);
      await goneRow.hover();
      await expect.poll(() => style(goneRow, 'background-color'), { message: 'missing folder: no hover surface' }).toBe(await colourOf(page, 'var(--role-card)'));
      await expectBorder(goneRow, await colourOf(page, 'var(--role-border-subtle)'), 'hovered missing-folder row');
    });
  }

  // plan-dark_blue_theme/REQ-44, REQ-45, REQ-46, REQ-47 — scenario "the Resume dialog shows its sessions as cards", And: the "Recent" folders
  test('"Recent" folders are cards 6 px apart, the chosen one active; the folder browser rows are dense rows', async ({ page }) => {
    await pastConversation('echo');
    await pastConversation('foxtrot');
    await openIn(page);
    await rail(page).getByRole('button', { name: 'New Claude Code Session', exact: true }).click();
    const chooser = page.getByRole('dialog', { name: 'New Claude Code Session' });
    const recents = chooser.getByRole('radiogroup', { name: 'Recent Projects' });
    const rowOf = (name: string) => recents.locator(':scope > *').filter({ has: page.getByRole('radio', { name, exact: true }) });
    await expect(rowOf('echo')).toHaveCount(1);
    await expect(rowOf('foxtrot')).toHaveCount(1);
    await pointerAway(page);
    await expectRestingCard(page, rowOf('echo'), '"Recent" row echo');
    await expectRestingCard(page, rowOf('foxtrot'), '"Recent" row foxtrot');
    const a = (await rowOf('echo').boundingBox())!;
    const b = (await rowOf('foxtrot').boundingBox())!;
    const [top, bottom] = a.y < b.y ? [a, b] : [b, a];
    expect(Math.abs(bottom.y - (top.y + top.height) - 6), `"Recent" rows 6 px apart: ${bottom.y - (top.y + top.height)}`).toBeLessThanOrEqual(0.5);

    await rowOf('echo').click();
    await expect(chooser.getByRole('radio', { name: 'echo', exact: true })).toBeChecked();
    await pointerAway(page);
    await expectActive(page, rowOf('echo'), 'chosen "Recent" row');
    expect(Number(await style(rowOf('echo'), 'font-weight')), 'chosen "Recent" row: weight 600').toBeGreaterThanOrEqual(600);
    await expectHovered(page, rowOf('foxtrot'), 'other "Recent" row');

    await expect(chooser.getByRole('status').filter({ hasText: 'Loading…' })).toHaveCount(0);
    const parent = chooser.getByRole('button', { name: '..', exact: true });
    await expect(parent).toBeVisible();
    await pointerAway(page);
    await expectRestingRow(parent, 'folder browser row ".."');
    await expectHovered(page, parent, 'folder browser row ".."');
  });

  // plan-dark_blue_theme/REQ-44, REQ-45, REQ-46 — scenario "the Resume dialog shows its sessions as cards", And: the repository list
  test('repository entries are 24 px cards; a pressed entry is active; a hovered entry changes', async ({ page, request }) => {
    const ws = path.join(projectsRoot, 'workspace');
    const api = await repositoryAt(ws, 'api');
    const app = await repositoryAt(ws, 'web/app');
    await openExplorer(page, request, ws);
    const repositories = explorer(page).getByRole('list', { name: 'Repositories', exact: true });
    const entryOf = (root: string) => repositories.getByRole('listitem').filter({ has: page.getByTitle(root, { exact: true }) }).getByRole('button');
    await expect(entryOf(api)).toBeVisible();
    await expect(entryOf(app)).toBeVisible();
    await pointerAway(page);
    for (const [what, root] of [['api', api], ['web/app', app]] as const) {
      await expectRestingCard(page, entryOf(root), `repository ${what}`);
      expect(Math.abs((await entryOf(root).boundingBox())!.height - 24), `repository ${what}: 24 px high`).toBeLessThanOrEqual(0.5);
    }

    await entryOf(api).click();
    await expect(entryOf(api)).toHaveAttribute('aria-pressed', 'true');
    await pointerAway(page);
    await expectActive(page, entryOf(api), 'pressed repository entry');
    await expectHovered(page, entryOf(app), 'unpressed repository entry');
    await entryOf(api).hover();
    await expectActive(page, entryOf(api), 'hovered pressed entry');
  });
});

test.describe('dense lists', () => {
  // plan-dark_blue_theme/REQ-47, REQ-48 — scenario "technical lists share the card style"
  test('changed files and commit rows keep their height with the card surfaces, borders, hover and selected style; hash and date are tabular', async ({ page, request }) => {
    const repo = await repositoryAt(projectsRoot, 'dense-repo');
    await writeFile(path.join(repo, 'a.txt'), 'alpha\n');
    await writeFile(path.join(repo, 'b.txt'), 'beta\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'second');
    await writeFile(path.join(repo, 'a.txt'), 'alpha\nmore\n');
    await writeFile(path.join(repo, 'b.txt'), 'beta\nmore\n');
    await openExplorer(page, request, repo);

    const files = explorer(page).getByRole('listbox', { name: 'Changed files', exact: true });
    const fileA = files.getByRole('option').filter({ hasText: 'a.txt' });
    const fileB = files.getByRole('option').filter({ hasText: 'b.txt' });
    await expect(fileA).toBeVisible();
    const restHeight = (await fileA.boundingBox())!.height;
    await pointerAway(page);
    await expectRestingRow(fileA, 'file row a.txt');
    await expectRestingRow(fileB, 'file row b.txt');

    await fileA.click();
    await expect(fileA).toHaveAttribute('aria-selected', 'true');
    await pointerAway(page);
    await expectActive(page, fileA, 'selected file row');
    expect(Math.abs((await fileA.boundingBox())!.height - restHeight), 'a selected file row keeps its height').toBeLessThanOrEqual(0.5);
    await expectHovered(page, fileB, 'file row b.txt');

    await explorer(page).getByRole('tab', { name: 'History', exact: true }).click();
    const commits = explorer(page).locator('[aria-label="Commits"]').getByRole('button');
    await expect(commits).toHaveCount(2);
    await pointerAway(page);
    for (let i = 0; i < 2; i++) {
      const row = commits.nth(i);
      expect(Math.abs((await row.boundingBox())!.height - 28), `commit row ${i}: 28 px high`).toBeLessThanOrEqual(0.5);
      await expectRestingRow(row, `commit row ${i}`);
      await expectTabular(page, row.locator('.history-commit-hash'), `commit row ${i}: short hash`);
      await expectTabular(page, row.locator('.history-commit-date'), `commit row ${i}: date`);
    }
    await expectHovered(page, commits.nth(1), 'commit row');
    expect(Math.abs((await commits.nth(1).boundingBox())!.height - 28), 'a hovered commit row stays 28 px high').toBeLessThanOrEqual(0.5);

    await commits.first().click();
    const commitFile = explorer(page).getByRole('listbox', { name: 'Changed files', exact: true }).getByRole('option').filter({ hasText: 'a.txt' });
    await expect(commitFile).toBeVisible();
    await commitFile.click();
    await expect(commitFile).toHaveAttribute('aria-selected', 'true');
    await pointerAway(page);
    await expectActive(page, commitFile, 'selected file of a commit');
  });

  // plan-dark_blue_theme/REQ-47 — scenario "technical lists share the card style", And: the Settings menu and shortcut rows
  test('the Settings menu items and the shortcut rows are dense rows; the chosen item is active and bold; no separator lines', async ({ page }) => {
    await openIn(page);
    await settingsButton(page).click();
    const popup = settingsPopup(page);
    await expect(popup).toBeVisible();
    const item = (name: string) => popup.getByRole('tablist', { name: 'Settings sections' }).getByRole('tab', { name, exact: true });
    await item('Appearance').click();
    await expect(item('Appearance')).toHaveAttribute('aria-selected', 'true');
    await pointerAway(page);
    await expectActive(page, item('Appearance'), 'chosen menu item');
    expect(Number(await style(item('Appearance'), 'font-weight')), 'chosen menu item: bold').toBeGreaterThanOrEqual(600);
    await expectRestingRow(item('Shortcuts'), 'menu item Shortcuts');
    await expectHovered(page, item('Shortcuts'), 'menu item Shortcuts');
    await item('Appearance').hover();
    await expectActive(page, item('Appearance'), 'hovered chosen menu item');

    await item('Shortcuts').click();
    const rows = popup.locator('.shortcuts-row');
    await expect(rows.first()).toBeVisible();
    await pointerAway(page);
    const count = await rows.count();
    expect(count, 'some shortcut rows').toBeGreaterThan(2);
    for (let i = 0; i < Math.min(count, 4); i++) await expectRestingRow(rows.nth(i), `shortcut row ${i}`);
    await expectHovered(page, rows.nth(1), 'shortcut row');
  });

  // plan-dark_blue_theme/REQ-47, REQ-48 — scenario "technical lists share the card style", And: the rows of Plan Usage
  test('the Plan Usage limit rows are dense rows with the hover; percentage and reset line are tabular', async ({ page }) => {
    const resetsAt = new Date(Date.now() + 3_600_000).toISOString();
    await page.route(
      (url) => url.pathname === '/api/plan-usage',
      (route) =>
        route.fulfill({
          json: {
            status: 'ok',
            limits: [
              { label: 'Current session', percent: 30, resetsAt },
              { label: 'Current week (all models)', percent: 45, resetsAt },
            ],
          },
        }),
    );
    await openIn(page);
    await page.getByRole('banner').getByRole('button', { name: 'Plan Usage', exact: true }).click();
    const rows = page.getByRole('dialog', { name: 'Plan Usage', exact: true }).getByRole('listitem');
    await expect(rows).toHaveCount(2);
    await pointerAway(page);
    for (let i = 0; i < 2; i++) {
      await expectRestingRow(rows.nth(i), `limit row ${i}`);
      await expectTabular(page, rows.nth(i).locator('.plan-limit-percent'), `limit row ${i}: percentage`);
      await expectTabular(page, rows.nth(i).locator('.plan-limit-reset'), `limit row ${i}: reset line`);
    }
    await expectHovered(page, rows.nth(0), 'limit row');
  });
});

// ListStyles, plan-dark_blue_theme/REQ-4: the keyboard focus ring of a card or dense row is drawn inside its edge
test('keyboard focus on a project card, a file row and a commit row draws the ring inside the edge', async ({ page, request }) => {
  const past = await pastConversation('golf');
  await openIn(page);
  await rail(page).getByRole('button', { name: 'Projects', exact: true }).click();
  const projectRow = sessionList(page).locator('.project-row').filter({ has: page.getByText(past.folder, { exact: true }) });
  await expect(projectRow).toHaveCount(1);
  await projectRow.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expectFocusInside(page, projectRow, 'project card');

  const repo = await repositoryAt(projectsRoot, 'focus-repo');
  await writeFile(path.join(repo, 'a.txt'), 'alpha\n');
  await writeFile(path.join(repo, 'b.txt'), 'beta\n');
  await openExplorer(page, request, repo);
  const options = explorer(page).getByRole('listbox', { name: 'Changed files', exact: true }).getByRole('option');
  await expect(options).toHaveCount(2);
  await options.first().focus();
  await page.keyboard.press('ArrowDown');
  await expectFocusInside(page, options.nth(1), 'file row');

  await explorer(page).getByRole('tab', { name: 'History', exact: true }).click();
  const commit = explorer(page).locator('[aria-label="Commits"]').getByRole('button').first();
  await expect(commit).toBeVisible();
  await commit.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expectFocusInside(page, commit, 'commit row');
});

// ListStyles, Windows11Look: the cards and dense rows take the look's 4 px control corners
test('in the Windows 11 look project cards and Settings menu items take the 4 px control corners', async ({ page }) => {
  const past = await pastConversation('hotel');
  await openIn(page, 'dark', 'windows11');
  await expect(page.locator('html')).toHaveAttribute('data-look', 'windows11');
  expect(await computed(page, 'width', 'var(--radius-control)'), 'the look defines 4 px control corners').toBe('4px');
  await rail(page).getByRole('button', { name: 'Projects', exact: true }).click();
  const projectRow = sessionList(page).locator('.project-row').filter({ has: page.getByText(past.folder, { exact: true }) });
  await expect(projectRow).toHaveCount(1);
  expect(await style(projectRow, 'border-top-left-radius'), 'project card corners').toBe('4px');

  await settingsButton(page).click();
  const menuItem = settingsPopup(page).getByRole('tablist', { name: 'Settings sections' }).getByRole('tab', { name: 'Shortcuts', exact: true });
  await expect(menuItem).toBeVisible();
  expect(await style(menuItem, 'border-top-left-radius'), 'menu item corners').toBe('4px');
});
