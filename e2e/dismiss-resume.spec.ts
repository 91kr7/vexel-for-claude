// e2e of plan-session_list_improvements, batch dismiss-resume. The server runs the fake CLI and reads the fixture Claude Code folder E2E_CLAUDE_DIR.
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
/** Folder of the current test: sessions of earlier tests and other spec files stay on the server and must not show. */
let testRoot: string;
const createdIds: string[] = [];
const transcripts: string[] = [];
const terminals: { process: ChildProcess; files: string[] }[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-dismiss-resume-'));
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
const action = (page: Page, folder: string, name: 'Resume' | 'Dismiss') => item(page, folder).getByRole('button', { name, exact: true });
const groupItems = (page: Page, title: string) => list(page).getByRole('heading', { level: 2, name: title, exact: true }).locator('xpath=following::ul[1]/li');
const terminal = (page: Page) => page.locator('.xterm-rows');
const warning = (page: Page) => page.getByRole('alertdialog', { name: 'Session Running in a Terminal' });
const anyDialog = (page: Page) => page.locator('[role="dialog"], [role="alertdialog"]');
const isEntryRequest = (url: string, method: string, verb: 'resume' | 'dismiss') => method === 'POST' && new RegExp(`^/api/sessions/[^/]+/${verb}$`).test(new URL(url).pathname);

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

async function newFolder(name: string): Promise<string> {
  const folder = path.join(testRoot, name);
  await mkdir(folder);
  return folder;
}

async function startViaApi(request: APIRequestContext, folder: string): Promise<string> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  return id;
}

async function postHook(request: APIRequestContext, id: string, event: Record<string, string>): Promise<void> {
  const response = await request.post(`/api/sessions/${id}/hook-events`, { data: event });
  expect(response.status()).toBe(204);
}

async function stateOf(request: APIRequestContext, id: string): Promise<string | undefined> {
  const sessions = (await (await request.get('/api/sessions')).json()) as { id: string; state: string }[];
  return sessions.find((s) => s.id === id)?.state;
}

/** Writes the transcript Claude Code leaves for a conversation, so the history can resume it. */
async function transcript(claudeId: string, folder: string, firstMessage: string): Promise<void> {
  const dir = path.join(E2E_CLAUDE_DIR, 'projects', folder.replaceAll('/', '-'));
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

interface EndedSession {
  id: string;
  claudeId: string;
  folder: string;
  prompt: string;
}

/** A hosted session that ended: with a conversation (a prompt and its transcript) unless `conversation` is false. */
async function endedSession(request: APIRequestContext, name: string, conversation = true): Promise<EndedSession> {
  const folder = await newFolder(name);
  const id = await startViaApi(request, folder);
  const claudeId = randomUUID();
  const prompt = `Fix the ${name} page`;
  if (conversation) {
    await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt, session_id: claudeId });
    await transcript(claudeId, folder, prompt);
  } else {
    await postHook(request, id, { hook_event_name: 'SessionStart', session_id: claudeId });
  }
  expect((await request.post(`/api/sessions/${id}/stop`)).ok()).toBe(true);
  await expect.poll(() => stateOf(request, id), { message: `session ${name} ends` }).toBe('ended');
  return { id, claudeId, folder, prompt };
}

/** Simulates Claude Code running a conversation in another terminal. With a folder, it is also listed as an external session. */
async function runInTerminal(sessionId: string, folder?: string): Promise<void> {
  const process = spawn('sleep', ['300'], { stdio: 'ignore' });
  const pid = process.pid ?? 0;
  const file = path.join(SESSIONS_DIR, `${pid}.json`);
  const key = path.join(SESSIONS_DIR, `${pid}.5a6b7c8d.key`);
  terminals.push({ process, files: [key, file] });
  if (folder === undefined) {
    await writeFile(file, JSON.stringify({ pid, sessionId }));
    return;
  }
  execFileSync('mkfifo', [key]);
  await writeFile(file, JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status: 'idle', updatedAt: Date.now() }));
}

/** Waits for the answer of the entry "Resume" and stops the new session after the test. */
async function resumed(response: Promise<Response>): Promise<string> {
  const answer = await response;
  expect(answer.status()).toBe(201);
  const { id } = (await answer.json()) as { id: string };
  createdIds.push(id);
  return id;
}

const resumeResponse = (page: Page) => page.waitForResponse((r) => isEntryRequest(r.url(), r.request().method(), 'resume'));

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

/** Opacity the user sees: the product of the opacities of the button and its ancestors. */
const opacity = (page: Page, folder: string, name: 'Resume' | 'Dismiss') =>
  action(page, folder, name).evaluate((el) => {
    let value = 1;
    for (let node: Element | null = el; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
    return String(value);
  });

test.beforeEach(async ({ page }) => {
  await showOnlyOwnSessions(page);
});

// plan-session_list_improvements/REQ-2, REQ-8, REQ-10, REQ-11 — scenario "The user resumes an ended session with one click"
test('"Resume" on an ended entry opens the resumed session with no dialog, last in "Running", with no ended entry left', async ({ page, request }) => {
  const running = await newFolder('running-first');
  await startViaApi(request, running);
  const ended = await endedSession(request, 'cart');
  await page.goto('/');
  await expect(groupItems(page, 'Ended').filter({ has: byFolder(page, ended.folder) })).toHaveCount(1);
  await expect(groupItems(page, 'Running')).toHaveCount(1);

  const response = resumeResponse(page);
  await action(page, ended.folder, 'Resume').click();
  const newId = await resumed(response);

  expect(newId).not.toBe(ended.id);
  await expect(anyDialog(page)).toHaveCount(0);
  await expect(terminal(page)).toContainText(`"--resume","${ended.claudeId}"`);
  await expect(terminal(page)).toContainText(`CWD:${ended.folder}`);
  await expect(entry(page, ended.folder)).toHaveAttribute('aria-current', 'true');
  await expect(groupItems(page, 'Running')).toHaveCount(2);
  await expect(groupItems(page, 'Running').last()).toContainText(ended.prompt);
  await expect(groupItems(page, 'Running').last().getByTitle(ended.folder, { exact: true })).toHaveCount(1);
  await expect(groupItems(page, 'Ended').filter({ has: byFolder(page, ended.folder) })).toHaveCount(0);
  await expect(item(page, ended.folder)).toHaveCount(1);
});

// plan-session_list_improvements/REQ-1, REQ-3, REQ-4 — scenario "The user dismisses an ended session"
test('"Dismiss" removes the ended entry at once with no confirmation; working, idle and external entries offer neither action', async ({ page, request }) => {
  const ended = await endedSession(request, 'ended');
  const working = await newFolder('working');
  const workingId = await startViaApi(request, working);
  await postHook(request, workingId, { hook_event_name: 'UserPromptSubmit', prompt: 'Keep working', session_id: randomUUID() });
  const idle = await newFolder('idle');
  await startViaApi(request, idle);
  const external = await newFolder('external');
  await runInTerminal(randomUUID(), external);

  await page.goto('/');
  await expect(item(page, external)).toHaveCount(1, SCAN);
  for (const folder of [working, idle, external]) {
    await expect(item(page, folder).getByRole('button', { name: /^(Resume|Dismiss)$/ }), folder).toHaveCount(0);
  }
  await expect(action(page, ended.folder, 'Dismiss')).toHaveCount(1);

  const dismissed = page.waitForResponse((r) => isEntryRequest(r.url(), r.request().method(), 'dismiss'));
  await action(page, ended.folder, 'Dismiss').click();
  expect((await dismissed).status()).toBe(204);

  await expect(item(page, ended.folder)).toHaveCount(0);
  await expect(anyDialog(page)).toHaveCount(0);
  for (const folder of [working, idle, external]) await expect(item(page, folder)).toHaveCount(1);
});

// plan-session_list_improvements/REQ-5, REQ-6 — scenario "A dismissed session does not come back, but stays in the history"
test('a dismissed session stays out of the list after a reload, and the history dialog still resumes it', async ({ page, request }) => {
  const ended = await endedSession(request, 'history');
  await page.goto('/');
  await action(page, ended.folder, 'Dismiss').click();
  await expect(item(page, ended.folder)).toHaveCount(0);

  await page.reload();
  await expect(list(page)).toBeVisible();
  await expect(list(page)).not.toContainText('Loading…');
  await expect(item(page, ended.folder)).toHaveCount(0);
  expect(await stateOf(request, ended.id), 'the server no longer lists it').toBeUndefined();

  await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('button', { name: 'Resume', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Resume Session' });
  await expect(dialog).not.toContainText('Loading…');
  await dialog.getByRole('region', { name: ended.folder }).getByRole('radio', { name: ended.prompt, exact: true }).click();
  const response = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/past-sessions/${ended.claudeId}/resume`);
  await dialog.getByRole('button', { name: 'Resume', exact: true }).click();
  await resumed(response);
  await expect(terminal(page)).toContainText(`"--resume","${ended.claudeId}"`);
});

// plan-session_list_improvements/REQ-7 — scenario "Dismissing the open session clears the main area"
test('dismissing the open ended session brings back the "no open session" state', async ({ page, request }) => {
  const ended = await endedSession(request, 'open');
  await page.goto('/');
  await entry(page, ended.folder).click();
  await expect(entry(page, ended.folder)).toHaveAttribute('aria-current', 'true');
  await expect(terminal(page)).toHaveCount(1);
  await expect(page.getByRole('main').getByText('No open session.')).toHaveCount(0);

  await action(page, ended.folder, 'Dismiss').click();

  await expect(item(page, ended.folder)).toHaveCount(0);
  await expect(page.getByRole('main').getByText('No open session.')).toBeVisible();
  await expect(terminal(page)).toHaveCount(0);
});

// plan-session_list_improvements/REQ-9 — scenario "The session still runs in a terminal"
test('"Resume" warns when the conversation runs in a terminal; "Cancel" sends nothing, "Resume Anyway" resumes it', async ({ page, request }) => {
  const ended = await endedSession(request, 'elsewhere');
  await runInTerminal(ended.claudeId);
  const bodies: unknown[] = [];
  page.on('request', (r) => {
    if (isEntryRequest(r.url(), r.method(), 'resume')) bodies.push(r.postDataJSON());
  });
  await page.goto('/');

  await action(page, ended.folder, 'Resume').click();
  await expect(warning(page)).toBeVisible();
  await warning(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(warning(page)).toBeHidden();
  expect(bodies).toEqual([{}]);
  await expect(groupItems(page, 'Ended').filter({ has: byFolder(page, ended.folder) })).toHaveCount(1);

  await action(page, ended.folder, 'Resume').click();
  await expect(warning(page)).toBeVisible();
  const response = resumeResponse(page);
  await warning(page).getByRole('button', { name: 'Resume Anyway' }).click();
  await resumed(response);

  expect(bodies).toEqual([{}, {}, { force: true }]);
  await expect(warning(page)).toBeHidden();
  await expect(terminal(page)).toContainText(`"--resume","${ended.claudeId}"`);
  await expect(groupItems(page, 'Ended').filter({ has: byFolder(page, ended.folder) })).toHaveCount(0);
});

// plan-session_list_improvements/REQ-12 — scenario "Resume fails"
test('a failed "Resume" shows its error under the entry, which stays in "Ended"', async ({ page, request }) => {
  const deleted = await endedSession(request, 'deleted');
  await rm(deleted.folder, { recursive: true });
  const unknown = await endedSession(request, 'unknown');
  await rm(transcripts.pop()!);
  await page.goto('/');

  await action(page, deleted.folder, 'Resume').click();
  await expect(item(page, deleted.folder).getByRole('alert')).toHaveText('The project folder does not exist.');
  await expect(groupItems(page, 'Ended').filter({ has: byFolder(page, deleted.folder) })).toHaveCount(1);

  await action(page, unknown.folder, 'Resume').click();
  await expect(item(page, unknown.folder).getByRole('alert')).toHaveText('The session no longer exists.');
  await expect(groupItems(page, 'Ended').filter({ has: byFolder(page, unknown.folder) })).toHaveCount(1);
  await expect(terminal(page)).toHaveCount(0);
});

// plan-session_list_improvements/REQ-12, EndedEntryActions: other failures get the generic texts, and a new request clears the old error
test('a network error on "Dismiss" and a server error on "Resume" show the generic texts, one at a time', async ({ page, request }) => {
  const ended = await endedSession(request, 'failing');
  await page.route(/\/api\/sessions\/[^/]+\/dismiss$/, (route) => route.abort());
  await page.route(/\/api\/sessions\/[^/]+\/resume$/, (route) => route.fulfill({ status: 500, json: { error: 'internal' } }));
  await page.goto('/');

  await action(page, ended.folder, 'Dismiss').click();
  await expect(item(page, ended.folder).getByRole('alert')).toHaveText('Could not dismiss the session.');

  await action(page, ended.folder, 'Resume').click();
  await expect(item(page, ended.folder).getByRole('alert')).toHaveText('Could not resume the session.');
  await expect(item(page, ended.folder)).toHaveCount(1);
});

// plan-session_list_improvements/REQ-2 — scenario "A session with no conversation offers only Dismiss"
test('an ended session that never got a prompt offers "Dismiss" and no "Resume"', async ({ page, request }) => {
  const ended = await endedSession(request, 'no-prompt', false);
  await page.goto('/');
  await expect(item(page, ended.folder)).toHaveCount(1);
  await expect(action(page, ended.folder, 'Dismiss')).toHaveCount(1);
  await expect(action(page, ended.folder, 'Resume')).toHaveCount(0);
});

// EndedEntryActions: hidden until hover; while a request runs both are disabled, the pressed one busy, and no other request leaves
test('the actions show on hover, and while "Dismiss" runs both are disabled and a press on "Resume" sends nothing', async ({ page, request }) => {
  const ended = await endedSession(request, 'busy');
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/api\/sessions\/[^/]+\/dismiss$/, async (route) => {
    await gate;
    await route.continue();
  });
  const resumeRequests: string[] = [];
  page.on('request', (r) => {
    if (isEntryRequest(r.url(), r.method(), 'resume')) resumeRequests.push(r.url());
  });
  await page.goto('/');
  await expect(item(page, ended.folder)).toHaveCount(1);
  await page.mouse.move(1, 1);
  await expect.poll(() => opacity(page, ended.folder, 'Dismiss')).toBe('0');

  await item(page, ended.folder).hover();
  await expect.poll(() => opacity(page, ended.folder, 'Dismiss')).toBe('1');
  await expect(action(page, ended.folder, 'Dismiss')).toHaveAttribute('title', 'Dismiss');
  await expect(action(page, ended.folder, 'Resume')).toHaveAttribute('title', 'Resume');

  await action(page, ended.folder, 'Dismiss').click();
  await expect(action(page, ended.folder, 'Dismiss')).toHaveAttribute('aria-busy', 'true');
  await expect(action(page, ended.folder, 'Dismiss')).toHaveAttribute('aria-disabled', 'true');
  await expect(action(page, ended.folder, 'Resume')).toHaveAttribute('aria-disabled', 'true');
  await expect(action(page, ended.folder, 'Resume')).not.toHaveAttribute('aria-busy', 'true');
  await page.mouse.move(1, 1);
  await expect.poll(() => opacity(page, ended.folder, 'Dismiss'), { message: 'shown while the request runs' }).toBe('1');
  await action(page, ended.folder, 'Resume').click({ force: true });
  expect(resumeRequests).toEqual([]);

  release();
  await expect(item(page, ended.folder)).toHaveCount(0);
  expect(resumeRequests).toEqual([]);
});

// plan-session_list_improvements/REQ-13 — scenario "Dismiss and Resume with the keyboard"
test('Tab reaches "Resume" then "Dismiss" with the focus ring, and Enter presses them', async ({ page, request }) => {
  const first = await endedSession(request, 'keyboard-dismiss');
  const second = await endedSession(request, 'keyboard-resume');
  await page.goto('/');
  await expect(item(page, first.folder)).toHaveCount(1);
  await expect(item(page, second.folder)).toHaveCount(1);
  await page.mouse.move(1, 1);

  await entry(page, first.folder).focus();
  await page.keyboard.press('Tab');
  await expect(action(page, first.folder, 'Resume')).toBeFocused();
  await expect.poll(() => opacity(page, first.folder, 'Resume'), { message: 'shown on keyboard focus' }).toBe('1');
  await expect.poll(() => focusedShowsRing(page), { message: '"Resume" shows the focus ring' }).toBe(true);
  await page.keyboard.press('Tab');
  await expect(action(page, first.folder, 'Dismiss')).toBeFocused();
  await expect.poll(() => focusedShowsRing(page), { message: '"Dismiss" shows the focus ring' }).toBe(true);
  await page.keyboard.press('Enter');
  await expect(item(page, first.folder)).toHaveCount(0);

  await entry(page, second.folder).focus();
  await page.keyboard.press('Tab');
  await expect(action(page, second.folder, 'Resume')).toBeFocused();
  await expect.poll(() => focusedShowsRing(page), { message: '"Resume" shows the focus ring' }).toBe(true);
  const response = resumeResponse(page);
  await page.keyboard.press('Enter');
  await resumed(response);
  await expect(terminal(page)).toContainText(`"--resume","${second.claudeId}"`);
  await expect(groupItems(page, 'Ended').filter({ has: byFolder(page, second.folder) })).toHaveCount(0);
});
