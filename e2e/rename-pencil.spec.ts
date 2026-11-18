// e2e of plan-session_list_improvements, batch rename-pencil: the place of "Rename" (REQ-40 to REQ-43), checked with bounding boxes.
// The server runs the fake CLI and reads the fixture Claude Code folder E2E_CLAUDE_DIR (playwright.config.ts).
/// <reference lib="dom" />
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';
import { STAYING_ENTRY } from './motion';

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
const WIDTH_KEY = 'ai-client.list-width';
// The external scanner reads the sessions folder every 2 seconds.
const SCAN = { timeout: 10_000 };
// The server keeps 80 characters of a prompt as the label: wide letters make it longer than any list width.
const LONG_LABEL = 'WMWMWMWMW '.repeat(7).trim();

type Box = { x: number; y: number; width: number; height: number };

let projectsRoot: string;
/** Folder of the current test: sessions of other tests and spec files stay on the server and must not show. */
let testRoot: string;
const createdIds: string[] = [];
const transcripts: string[] = [];
const terminals: { process: ChildProcess; files: string[] }[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-rename-pencil-'));
  await mkdir(SESSIONS_DIR, { recursive: true });
});

test.beforeEach(async () => {
  testRoot = await mkdtemp(path.join(projectsRoot, 'test-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const { process, files } of terminals.splice(0)) {
    process.kill('SIGKILL');
    for (const file of files) await rm(file, { force: true });
  }
});

test.afterAll(async () => {
  for (const file of transcripts.splice(0)) await rm(file, { force: true });
  await rm(projectsRoot, { recursive: true, force: true });
});

test.use({ viewport: { width: 1440, height: 900 } });

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const byFolder = (page: Page, folder: string) => page.getByTitle(folder, { exact: true });
const item = (page: Page, folder: string) => list(page).getByRole('listitem').filter({ has: byFolder(page, folder) });
const entry = (page: Page, folder: string) => list(page).locator(STAYING_ENTRY).filter({ has: byFolder(page, folder) });
const renameButton = (page: Page, folder: string) => item(page, folder).getByRole('button', { name: 'Rename', exact: true });
const starOf = (page: Page, folder: string) => item(page, folder).getByRole('button', { name: /^(Mark as Favorite|Remove Favorite)$/ });
const nameField = (page: Page, folder: string) => item(page, folder).getByRole('textbox', { name: 'Session Name', exact: true });
const isRenameRequest = (r: { url(): string; method(): string }) => r.method() === 'PUT' && /^\/api\/sessions\/[^/]+\/name$/.test(new URL(r.url()).pathname);

const box = async (locator: Locator): Promise<Box> => {
  const b = await locator.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
};
const overlap = (a: Box, b: Box) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const centreY = (b: Box) => b.y + b.height / 2;

/** Opacity the user sees: the product of the opacities of the element and its ancestors. */
const seenOpacity = (locator: Locator) =>
  locator.evaluate((el) => {
    let value = 1;
    for (let node: Element | null = el; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
    return value;
  });

/** Shows in the page only the sessions of the current test. */
async function showOnlyOwnSessions(page: Page): Promise<void> {
  const own = (session: { folder?: unknown } | undefined) => typeof session?.folder === 'string' && session.folder.startsWith(testRoot + path.sep);
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

async function openWithWidth(page: Page, width: number): Promise<void> {
  await showOnlyOwnSessions(page);
  await page.addInitScript(([key, value]) => localStorage.setItem(key!, value!), [WIDTH_KEY, String(width)]);
  await page.goto('/');
}

async function newFolder(name: string): Promise<string> {
  const folder = path.join(testRoot, name);
  await mkdir(folder);
  return folder;
}

interface Hosted {
  id: string;
  folder: string;
  prompt: string;
}

/** A hosted session whose first prompt is its label; idle unless `state` says otherwise. */
async function hostedSession(request: APIRequestContext, name: string, state: 'idle' | 'needs_input' | 'ended' = 'idle', prompt = `Fix the ${name} page`): Promise<Hosted> {
  const folder = await newFolder(name);
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  const claudeId = randomUUID();
  await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt, session_id: claudeId });
  if (state === 'needs_input') await postHook(request, id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  else await postHook(request, id, { hook_event_name: 'Stop' });
  if (state === 'ended') {
    await transcript(claudeId, folder, prompt);
    expect((await request.post(`/api/sessions/${id}/stop`)).ok()).toBe(true);
    await expect
      .poll(async () => ((await (await request.get('/api/sessions')).json()) as { id: string; state: string }[]).find((s) => s.id === id)?.state, { message: `session ${name} ends` })
      .toBe('ended');
  }
  return { id, folder, prompt };
}

async function postHook(request: APIRequestContext, id: string, event: Record<string, string>): Promise<void> {
  const response = await request.post(`/api/sessions/${id}/hook-events`, { data: event });
  expect(response.status()).toBe(204);
}

/** Writes the transcript Claude Code leaves for a conversation, so the history lists it and can resume it. */
async function transcript(claudeId: string, folder: string, firstMessage: string): Promise<void> {
  const dir = path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'));
  await mkdir(dir, { recursive: true });
  const common = { cwd: folder, sessionId: claudeId, isSidechain: false };
  const lines = [
    { ...common, type: 'user', message: { role: 'user', content: firstMessage } },
    { ...common, type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] } },
  ];
  const file = path.join(dir, `${claudeId}.jsonl`);
  await writeFile(file, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  transcripts.push(file);
}

/** Simulates Claude Code in another terminal that waits for a permission. */
async function externalNeedingInput(sessionId: string, folder: string): Promise<void> {
  const process = spawn('sleep', ['300'], { stdio: 'ignore' });
  const pid = process.pid ?? 0;
  const key = path.join(SESSIONS_DIR, `${pid}.5a6b7c8d.key`);
  const file = path.join(SESSIONS_DIR, `${pid}.json`);
  terminals.push({ process, files: [key, file] });
  execFileSync('mkfifo', [key]);
  await writeFile(file, JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status: 'waiting', waitingFor: 'permission', updatedAt: Date.now() }));
}

/**
 * Hovers the container and checks "Rename" against it: at the right end of the label row, level with `row2`,
 * under the first row (`row1`), and clear of `row2`, the star and the ended actions.
 */
async function expectOnLabelRow(page: Page, folder: string, container: Locator, row1: Locator, row2: Locator): Promise<{ rename: Box; row2: Box }> {
  await container.hover();
  await expect.poll(() => seenOpacity(renameButton(page, folder))).toBe(1);
  const [outer, first, second, rename, star] = [await box(container), await box(row1), await box(row2), await box(renameButton(page, folder)), await box(starOf(page, folder))];
  expect(outer.x + outer.width - (rename.x + rename.width), 'at the right end').toBeLessThan(16);
  expect(Math.abs(centreY(rename) - centreY(second)), 'level with the label row').toBeLessThanOrEqual(3);
  expect(rename.y, 'under the first row').toBeGreaterThanOrEqual(first.y + first.height - 1);
  expect(second.x + second.width, 'the text ends before "Rename"').toBeLessThanOrEqual(rename.x + 0.5);
  expect(overlap(rename, star), 'clear of the star').toBe(false);
  expect(overlap(rename, first), 'clear of the first row text').toBe(false);
  return { rename, row2: second };
}

// plan-session_list_improvements/REQ-40, REQ-43 — scenario "The pencil sits on the label row of a row"
test('a row shows "Rename" at the right end of its label row, level with the label, and nothing at the right end of the first row', async ({ page, request }) => {
  const session = await hostedSession(request, 'pencil-row');
  await openWithWidth(page, 260);
  await expect(entry(page, session.folder)).toHaveCount(1);
  await page.mouse.move(1, 1);
  expect(await seenOpacity(renameButton(page, session.folder)), 'hidden with no hover and no focus').toBe(0);

  const row = entry(page, session.folder);
  const { rename } = await expectOnLabelRow(page, session.folder, row, row.getByTitle(session.folder, { exact: true }), row.getByTitle(session.prompt, { exact: true }));
  expect([rename.width, rename.height], 'the pencil keeps its 20 px').toEqual([20, 20]);
  const outer = await box(item(page, session.folder));
  expect(rename.y - outer.y, 'nothing in the top right corner: the pencil is not on the first row').toBeGreaterThan(16);
});

// plan-session_list_improvements/REQ-41 — scenario "The pencil sits on the label row of the needs-input card"
test('the needs-input card shows "Rename" at the right end of its label row, under the star row', async ({ page, request }) => {
  const session = await hostedSession(request, 'pencil-card', 'needs_input');
  await openWithWidth(page, 260);
  const card = list(page).locator('.session-card').filter({ has: byFolder(page, session.folder) });
  await expect(card).toHaveCount(1);
  const { rename } = await expectOnLabelRow(page, session.folder, card, card.getByTitle(session.folder, { exact: true }), card.getByTitle(session.prompt, { exact: true }));
  const star = await box(starOf(page, session.folder));
  expect(rename.y, 'under the star row').toBeGreaterThanOrEqual(star.y + star.height - 1);
});

// plan-session_list_improvements/REQ-42 — scenario "A long label is cut before the pencil"
for (const width of [180, 480]) {
  test(`in a list ${width} px wide a long label is cut with an ellipsis before "Rename", in a row and in a card`, async ({ page, request }) => {
    const row = await hostedSession(request, 'pencil-long-row', 'idle', LONG_LABEL);
    const card = await hostedSession(request, 'pencil-long-card', 'needs_input', LONG_LABEL);
    await openWithWidth(page, width);
    await expect(entry(page, row.folder)).toHaveCount(1);
    await expect(entry(page, card.folder)).toHaveCount(1);
    expect((await box(list(page))).width, 'the list has the saved width').toBeCloseTo(width, -1);

    for (const { folder } of [row, card]) {
      const container = folder === row.folder ? entry(page, folder) : list(page).locator('.session-card').filter({ has: byFolder(page, folder) });
      const label = container.getByTitle(LONG_LABEL, { exact: true });
      await container.hover();
      await expect.poll(() => seenOpacity(renameButton(page, folder)), folder).toBe(1);
      const cut = await label.evaluate((el) => ({ cut: el.scrollWidth > el.clientWidth, overflow: getComputedStyle(el).textOverflow }));
      expect(cut, `${folder}: the label is cut with an ellipsis`).toEqual({ cut: true, overflow: 'ellipsis' });
      const [labelBox, rename, star, outer] = [await box(label), await box(renameButton(page, folder)), await box(starOf(page, folder)), await box(container)];
      expect(labelBox.x + labelBox.width, `${folder}: the label ends before "Rename"`).toBeLessThanOrEqual(rename.x + 0.5);
      expect(overlap(rename, star), `${folder}: "Rename" does not cover the star`).toBe(false);
      expect(rename.x, `${folder}: "Rename" stays inside the entry`).toBeGreaterThanOrEqual(outer.x);
      expect(rename.x + rename.width, `${folder}: "Rename" stays inside the entry`).toBeLessThanOrEqual(outer.x + outer.width);
    }
  });
}

// plan-session_list_improvements/REQ-42 — the room is kept at all times, so the cut of the label does not change when the pencil appears
test('the label keeps the same cut with and without the pointer on the entry', async ({ page, request }) => {
  const session = await hostedSession(request, 'pencil-cut', 'idle', LONG_LABEL);
  await openWithWidth(page, 180);
  const label = entry(page, session.folder).getByTitle(LONG_LABEL, { exact: true });
  await expect(label).toHaveCount(1);
  await page.mouse.move(1, 1);
  const before = await box(label);
  await entry(page, session.folder).hover();
  await expect.poll(() => seenOpacity(renameButton(page, session.folder))).toBe(1);
  const after = await box(label);
  expect(after.width, 'same label width').toBeCloseTo(before.width, 1);
});

// plan-session_list_improvements/REQ-40, REQ-43 — scenario "An ended row keeps Dismiss and Resume in its corner"
test('an ended row keeps "Resume" and "Dismiss" in the top right corner of the first row, and "Rename" on the second row clear of them', async ({ page, request }) => {
  const session = await hostedSession(request, 'pencil-ended', 'ended');
  await openWithWidth(page, 260);
  const row = entry(page, session.folder);
  await expect(row).toHaveCount(1);
  const { rename } = await expectOnLabelRow(page, session.folder, row, row.getByTitle(session.folder, { exact: true }), row.getByTitle(session.prompt, { exact: true }));
  const actions = item(page, session.folder).locator('.ended-entry-actions');
  await expect(actions.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Dismiss', exact: true })).toBeVisible();
  const [outer, corner] = [await box(item(page, session.folder)), await box(actions)];
  expect(outer.x + outer.width - (corner.x + corner.width), 'no gap beside the actions for a pencil').toBeLessThan(16);
  expect(corner.y - outer.y, 'at the top').toBeLessThan(16);
  expect(overlap(rename, corner), '"Rename" does not overlap the actions').toBe(false);
  expect(rename.y, '"Rename" is under the actions').toBeGreaterThanOrEqual(corner.y + corner.height - 1);
  const title = await box(row.getByTitle(session.folder, { exact: true }));
  expect(corner.y + corner.height / 2 - (title.y + title.height / 2), 'the actions are on the first row').toBeLessThan(title.height);
});

// plan-session_list_improvements/REQ-40 — scenario "An external session needing input"
test('an external session that needs input shows "Rename" at the right end of its permission row', async ({ page }) => {
  const outside = await newFolder('pencil-external');
  await externalNeedingInput('e2e-pencil-external', outside);
  await openWithWidth(page, 260);
  await expect(entry(page, outside)).toBeVisible(SCAN);
  const row = entry(page, outside);
  const permission = row.locator('.session-entry-permission');
  await expect(permission).toBeVisible();
  await expectOnLabelRow(page, outside, row, row.getByTitle(outside, { exact: true }), permission);
});

// plan-session_list_improvements/REQ-43 — scenario "The pencil keeps its look and its behaviour"
test('Tab reaches "Rename" with its focus ring, Enter opens the editor in place of the label, and the new name shows in place', async ({ page, request }) => {
  const session = await hostedSession(request, 'pencil-keys');
  await openWithWidth(page, 260);
  await expect(entry(page, session.folder)).toHaveCount(1);
  await page.mouse.move(1, 1);
  await entry(page, session.folder).focus();
  await page.keyboard.press('Tab');
  await expect(starOf(page, session.folder)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(renameButton(page, session.folder)).toBeFocused();
  await expect.poll(() => seenOpacity(renameButton(page, session.folder)), 'shown by the keyboard focus').toBe(1);
  const ring = await renameButton(page, session.folder).evaluate((el) => {
    const s = getComputedStyle(el);
    return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
  });
  expect(ring, 'focus ring').toBe(true);
  const sent: unknown[] = [];
  page.on('request', (r) => {
    if (isRenameRequest(r)) sent.push(r.postDataJSON());
  });
  await page.keyboard.press('Enter');
  await expect(nameField(page, session.folder)).toBeFocused();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Release fix');
  await page.keyboard.press('Enter');
  await expect(nameField(page, session.folder)).toHaveCount(0);
  const label = entry(page, session.folder).getByTitle('Release fix', { exact: true });
  await expect(label).toHaveText('Release fix');
  expect(sent).toHaveLength(1);
  const [renamed, rename] = [await box(label), await box(renameButton(page, session.folder))];
  expect(Math.abs(centreY(renamed) - centreY(rename)), 'the pencil is level with the new label').toBeLessThanOrEqual(3);
});

// plan-session_list_improvements/REQ-43 — "Rename" stays hidden while the name editor is open, and the editor takes the label row
test('"Rename" is hidden while the name editor is open, with the pointer on the entry', async ({ page, request }) => {
  const session = await hostedSession(request, 'pencil-edit');
  await openWithWidth(page, 260);
  await entry(page, session.folder).hover();
  await renameButton(page, session.folder).click();
  await expect(nameField(page, session.folder)).toBeFocused();
  await entry(page, session.folder).hover();
  await expect(renameButton(page, session.folder)).toBeHidden();
  const [outer, field] = [await box(item(page, session.folder)), await box(nameField(page, session.folder))];
  expect(field.x + field.width, 'the editor takes the whole row').toBeGreaterThan(outer.x + outer.width - 16);
});
