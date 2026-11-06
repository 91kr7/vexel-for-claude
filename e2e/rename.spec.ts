// e2e of plan-session_list_improvements, batch rename. The server runs the fake CLI, reads the fixture Claude Code folder E2E_CLAUDE_DIR
// and keeps the names in its own data folder (playwright.config.ts). Every session gets a unique Claude Code session id, so names never collide.
/// <reference lib="dom" />
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, type Response, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
// The external scanner reads the sessions folder every 2 seconds.
const SCAN = { timeout: 10_000 };

let projectsRoot: string;
/** Folder of the current test: sessions of other tests and spec files stay on the server and must not show. */
let testRoot: string;
const createdIds: string[] = [];
const transcripts: string[] = [];
const terminals: { process: ChildProcess; files: string[] }[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-rename-'));
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

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const byFolder = (page: Page, folder: string) => page.getByTitle(folder, { exact: true });
const item = (page: Page, folder: string) => list(page).getByRole('listitem').filter({ has: byFolder(page, folder) });
const entry = (page: Page, folder: string) => list(page).locator('.session-entry').filter({ has: byFolder(page, folder) });
const renameButton = (page: Page, folder: string) => item(page, folder).getByRole('button', { name: 'Rename', exact: true });
const nameField = (page: Page, folder: string) => item(page, folder).getByRole('textbox', { name: 'Session Name', exact: true });
const header = (page: Page) => page.getByRole('main').locator('.session-header');
const resumeDialog = (page: Page) => page.getByRole('dialog', { name: 'Resume Session' });
const warning = (page: Page) => page.getByRole('alertdialog', { name: 'Session Running in a Terminal' });
const terminal = (page: Page) => page.locator('.xterm-rows');
const isRenameRequest = (r: { url(): string; method(): string }) => r.method() === 'PUT' && /^\/api\/sessions\/[^/]+\/name$/.test(new URL(r.url()).pathname);

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

/** Collects the rename requests the page sends. */
function renameRequests(page: Page): unknown[] {
  const bodies: unknown[] = [];
  page.on('request', (r) => {
    if (isRenameRequest(r)) bodies.push(r.postDataJSON());
  });
  return bodies;
}

async function newFolder(name: string): Promise<string> {
  const folder = path.join(testRoot, name);
  await mkdir(folder);
  return folder;
}

interface Hosted {
  id: string;
  claudeId: string;
  folder: string;
  prompt: string;
}

/** A hosted session that got a first prompt, so its default label is that prompt; idle unless `state` says otherwise. */
async function hostedSession(request: APIRequestContext, name: string, state: 'idle' | 'needs_input' | 'ended' = 'idle'): Promise<Hosted> {
  const folder = await newFolder(name);
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  const claudeId = randomUUID();
  const prompt = `Fix the ${name} page`;
  await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt, session_id: claudeId });
  if (state === 'needs_input') await postHook(request, id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  else await postHook(request, id, { hook_event_name: 'Stop' });
  if (state === 'ended') {
    await transcript(claudeId, folder, prompt);
    expect((await request.post(`/api/sessions/${id}/stop`)).ok()).toBe(true);
    await expect.poll(() => summaryOf(request, id).then((s) => s?.state), { message: `session ${name} ends` }).toBe('ended');
  }
  return { id, claudeId, folder, prompt };
}

async function postHook(request: APIRequestContext, id: string, event: Record<string, string>): Promise<void> {
  const response = await request.post(`/api/sessions/${id}/hook-events`, { data: event });
  expect(response.status()).toBe(204);
}

async function summaryOf(request: APIRequestContext, id: string): Promise<{ state: string; label: string } | undefined> {
  const sessions = (await (await request.get('/api/sessions')).json()) as { id: string; state: string; label: string }[];
  return sessions.find((s) => s.id === id);
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

/** Simulates Claude Code in another terminal: a live process, its `sessions/<pid>.json` and the `<pid>.<hash>.key` FIFO. */
async function runInTerminal(sessionId: string, folder: string): Promise<void> {
  const process = spawn('sleep', ['300'], { stdio: 'ignore' });
  const pid = process.pid ?? 0;
  const key = path.join(SESSIONS_DIR, `${pid}.5a6b7c8d.key`);
  const file = path.join(SESSIONS_DIR, `${pid}.json`);
  terminals.push({ process, files: [key, file] });
  execFileSync('mkfifo', [key]);
  await writeFile(file, JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status: 'idle', updatedAt: Date.now() }));
}

/** Waits for a resume answer and stops the new session after the test. */
async function resumed(response: Promise<Response>): Promise<string> {
  const answer = await response;
  expect(answer.status()).toBe(201);
  const { id } = (await answer.json()) as { id: string };
  createdIds.push(id);
  return id;
}

/** Renames through the list with the mouse: hover, "Rename", select all, type, Enter. */
async function renameFromList(page: Page, folder: string, name: string): Promise<void> {
  await item(page, folder).hover();
  await renameButton(page, folder).click();
  await nameField(page, folder).fill(name);
  const answer = page.waitForResponse((r) => isRenameRequest(r.request()));
  await nameField(page, folder).press('Enter');
  expect((await answer).status()).toBe(204);
  await expect(nameField(page, folder)).toHaveCount(0);
}

/** The folders of the list entries, top to bottom. */
const listOrder = (page: Page) => list(page).getByRole('listitem').evaluateAll((items) => items.map((li) => li.querySelector('[title^="/"]')?.getAttribute('title') ?? ''));

/** Opacity the user sees: the product of the opacities of the element and its ancestors. */
const seenOpacity = (page: Page, folder: string) =>
  renameButton(page, folder).evaluate((el) => {
    let value = 1;
    for (let node: Element | null = el; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
    return value;
  });

/** Whether the focused element draws the focus ring colour as an outline or a box-shadow. */
async function focusedShowsRing(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.color = 'var(--color-focus-ring)';
    document.body.append(probe);
    const ring = getComputedStyle(probe).color;
    probe.remove();
    const el = document.activeElement;
    if (!el) return false;
    const s = getComputedStyle(el);
    return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor === ring) || s.boxShadow.includes(ring);
  });
}

// plan-session_list_improvements/REQ-25, REQ-26, REQ-34, REQ-38, REQ-39 — scenario "The user names a session from the list"
test('the keyboard renames an open session: the entry and the header show the name, and the entry keeps its place', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const first = await hostedSession(request, 'alpha');
  const target = await hostedSession(request, 'release');
  const last = await hostedSession(request, 'omega');
  const sent = renameRequests(page);
  await page.goto('/');
  await entry(page, target.folder).click();
  await expect(header(page)).toContainText(target.prompt);
  await expect(item(page, first.folder)).toHaveCount(1);
  await expect(item(page, last.folder)).toHaveCount(1);
  const before = await listOrder(page);

  // "Rename" is hidden until the focus inside the entry is visible from the keyboard
  await page.mouse.move(1, 1);
  await expect.poll(() => seenOpacity(page, target.folder)).toBe(0);
  await entry(page, target.folder).focus();
  await page.keyboard.press('Tab');
  await expect(renameButton(page, target.folder)).toBeFocused();
  await expect.poll(() => seenOpacity(page, target.folder)).toBe(1);
  expect(await focusedShowsRing(page), '"Rename" shows the focus ring').toBe(true);

  await page.keyboard.press('Enter');
  const field = nameField(page, target.folder);
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(target.prompt);
  expect(await field.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, target.prompt.length]);

  await page.keyboard.type('Release fix');
  await page.keyboard.press('Enter');

  await expect(field).toHaveCount(0);
  await expect(entry(page, target.folder)).toContainText('Release fix');
  await expect(header(page)).toContainText('Release fix');
  await expect(renameButton(page, target.folder)).toBeFocused();
  expect(sent).toEqual([{ name: 'Release fix' }]);
  expect(await listOrder(page)).toEqual(before);
  expect((await summaryOf(request, target.id))?.label).toBe('Release fix');
});

// plan-session_list_improvements/REQ-34 — scenario "Esc cancels the edit"; blur cancels too, and an unchanged Enter sends nothing
test('Esc, a blur and an unchanged Enter keep the name and send nothing', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const session = await hostedSession(request, 'esc');
  await page.goto('/');
  await renameFromList(page, session.folder, 'Release fix');
  await expect(entry(page, session.folder)).toContainText('Release fix');
  const sent = renameRequests(page);

  await renameButton(page, session.folder).click();
  await nameField(page, session.folder).fill('Something else');
  await page.keyboard.press('Escape');
  await expect(nameField(page, session.folder)).toHaveCount(0);
  await expect(entry(page, session.folder)).toContainText('Release fix');
  await expect(renameButton(page, session.folder)).toBeFocused();

  await renameButton(page, session.folder).click();
  await nameField(page, session.folder).fill('Something else');
  // during the edit a click on the entry opens nothing; the blur it causes cancels the edit
  await byFolder(page, session.folder).click();
  await expect(nameField(page, session.folder)).toHaveCount(0);
  await expect(header(page)).toHaveCount(0);
  await expect(entry(page, session.folder)).toContainText('Release fix');

  await item(page, session.folder).hover();
  await renameButton(page, session.folder).click();
  await nameField(page, session.folder).press('Enter');
  await expect(nameField(page, session.folder)).toHaveCount(0);

  expect(sent).toEqual([]);
  expect((await summaryOf(request, session.id))?.label).toBe('Release fix');
});

// plan-session_list_improvements/REQ-31 — scenario "An empty name brings back the default label"
test('a name of spaces only brings back the start of the first prompt', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const session = await hostedSession(request, 'empty');
  await page.goto('/');
  await renameFromList(page, session.folder, 'Release fix');
  await expect(entry(page, session.folder)).toContainText('Release fix');

  await renameFromList(page, session.folder, '     ');

  await expect(entry(page, session.folder)).toContainText(session.prompt);
  await expect(entry(page, session.folder)).not.toContainText('Release fix');
});

// plan-session_list_improvements/REQ-32, REQ-33 — scenario "Spaces and length"
test('the field stops at 200 characters, and the name shows without the spaces at the start and end', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const session = await hostedSession(request, 'length');
  await page.goto('/');
  await item(page, session.folder).hover();
  await renameButton(page, session.folder).click();
  const field = nameField(page, session.folder);
  await page.keyboard.type(`  Nightly build  ${'x'.repeat(250)}`);
  const typed = await field.inputValue();
  expect([...typed]).toHaveLength(200);
  expect(typed.startsWith('  Nightly build  ')).toBe(true);

  await field.press('Enter');
  await expect(field).toHaveCount(0);
  const expected = typed.trim();
  await expect.poll(async () => (await summaryOf(request, session.id))?.label).toBe(expected);
  await expect(entry(page, session.folder).getByTitle(expected, { exact: true })).toHaveCount(1);

  // trailing spaces go too
  await renameFromList(page, session.folder, '  Nightly build  ');
  await expect(entry(page, session.folder).getByTitle('Nightly build', { exact: true })).toHaveCount(1);
});

// SessionNameEditor spec: a failed request shows the error and keeps the field open with the typed text
test('a failed rename shows "Could not rename the session." and keeps the field open', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const session = await hostedSession(request, 'failure');
  await page.route((url) => /\/api\/sessions\/[^/]+\/name$/.test(url.pathname), (route) => route.fulfill({ status: 500, json: { error: 'boom' } }));
  await page.goto('/');
  await item(page, session.folder).hover();
  await renameButton(page, session.folder).click();
  await nameField(page, session.folder).fill('Release fix');
  await nameField(page, session.folder).press('Enter');

  await expect(item(page, session.folder).getByText('Could not rename the session.', { exact: true })).toBeVisible();
  await expect(nameField(page, session.folder)).toHaveValue('Release fix');
  expect((await summaryOf(request, session.id))?.label).toBe(session.prompt);
});

// plan-session_list_improvements/REQ-25 — the hosted needs-input card has "Rename" too
test('the needs-input card renames its session', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const session = await hostedSession(request, 'card', 'needs_input');
  await page.goto('/');
  await expect(list(page).locator('.session-card').filter({ has: byFolder(page, session.folder) })).toHaveCount(1);

  await renameFromList(page, session.folder, 'Release fix');

  await expect(entry(page, session.folder)).toContainText('Release fix');
  expect((await summaryOf(request, session.id))?.state).toBe('needs_input');
});

// plan-session_list_improvements/REQ-25 — scenario "An external session gets a name"
test('an external session gets a name', async ({ page }) => {
  await showOnlyOwnSessions(page);
  const folder = await newFolder('terminal');
  await runInTerminal(randomUUID(), folder);
  await page.goto('/');
  await expect(entry(page, folder)).toBeVisible(SCAN);

  await renameFromList(page, folder, 'Terminal job');

  await expect(entry(page, folder)).toContainText('Terminal job');
});

// plan-session_list_improvements/REQ-35, REQ-37 — scenario "Every open page gets the new name", and a reload keeps it
test('a second page gets the new name without a reload, and a reload keeps it', async ({ page, context, request }) => {
  const second = await context.newPage();
  for (const p of [page, second]) await showOnlyOwnSessions(p);
  const session = await hostedSession(request, 'tabs');
  await page.goto('/');
  await second.goto('/');
  await second.evaluate(() => ((window as unknown as { noReload: boolean }).noReload = true));
  await expect(entry(second, session.folder)).toContainText(session.prompt);

  await renameFromList(page, session.folder, 'Release fix');

  await expect(entry(second, session.folder)).toContainText('Release fix');
  expect(await second.evaluate(() => (window as unknown as { noReload?: boolean }).noReload)).toBe(true);

  await page.reload();
  await expect(entry(page, session.folder)).toContainText('Release fix');
});

// plan-session_list_improvements/REQ-29, REQ-30, REQ-36 — scenarios "The name shows in the resume history" and "The name survives reload, restart and resume"
test('the history shows and finds the name of an ended session, and its resume keeps the name in the list and the header', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const session = await hostedSession(request, 'history', 'ended');
  await page.goto('/');
  await renameFromList(page, session.folder, 'Release fix');

  await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(resumeDialog(page)).not.toContainText('Loading…');
  await resumeDialog(page).getByRole('textbox', { name: 'Search Past Sessions', exact: true }).fill('release');
  const past = resumeDialog(page).getByRole('region', { name: session.folder }).getByRole('radio');
  await expect(past).toHaveCount(1);
  await expect(past).toHaveAccessibleName('Release fix');

  await past.click();
  const answer = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/past-sessions/${session.claudeId}/resume`);
  await resumeDialog(page).getByRole('button', { name: 'Resume', exact: true }).click();
  const newId = await resumed(answer);

  await expect(terminal(page)).toContainText(`"--resume","${session.claudeId}"`);
  await expect(header(page)).toContainText('Release fix');
  await expect(list(page).locator('.session-entry[aria-current="true"]')).toContainText('Release fix');
  expect((await summaryOf(request, newId))?.label).toBe('Release fix');
});

// plan-session_list_improvements/REQ-36: "Resume" of the ended entry keeps the name
test('"Resume" of a named ended entry starts a session with the same name', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const session = await hostedSession(request, 'list-resume', 'ended');
  await page.goto('/');
  await renameFromList(page, session.folder, 'Release fix');

  const answer = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/sessions/${session.id}/resume`);
  await item(page, session.folder).getByRole('button', { name: 'Resume', exact: true }).click();
  const newId = await resumed(answer);

  expect((await summaryOf(request, newId))?.label).toBe('Release fix');
  await expect(item(page, session.folder)).toHaveCount(1);
  await expect(entry(page, session.folder)).toContainText('Release fix');
});

// plan-session_list_improvements/REQ-36: "Resume Here" of a named external session keeps the name
test('"Resume Here" of a named external session starts a hosted session with the same name', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const folder = await newFolder('takeover');
  const claudeId = randomUUID();
  await transcript(claudeId, folder, 'Run the nightly job');
  await runInTerminal(claudeId, folder);
  await page.goto('/');
  await expect(entry(page, folder)).toBeVisible(SCAN);
  await renameFromList(page, folder, 'Terminal job');

  await entry(page, folder).click();
  await page.getByRole('button', { name: 'Resume Here' }).click();
  const answer = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/past-sessions/${claudeId}/resume`);
  await warning(page).getByRole('button', { name: 'Resume Anyway' }).click();
  const newId = await resumed(answer);

  await expect(terminal(page)).toContainText(`"--resume","${claudeId}"`);
  expect((await summaryOf(request, newId))?.label).toBe('Terminal job');
  await expect(header(page)).toContainText('Terminal job');
});
