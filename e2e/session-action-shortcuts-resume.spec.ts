// e2e of plan-keyboard_shortcuts, batch session-actions: Alt+R, and the session action keys on an external session.
// The server reads the fixture Claude Code folder E2E_CLAUDE_DIR: transcripts of saved conversations and live `sleep` processes as terminals.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, type Request, type Response, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
// The external scanner reads the sessions folder every 2 seconds.
const SCAN = { timeout: 10_000 };
const ONE_SECOND = { timeout: 1000 };

let projectsRoot: string;
const createdIds: string[] = [];
const fixtureFiles: string[] = [];
const terminals: ChildProcess[] = [];

test.beforeAll(async () => {
  await mkdir(SESSIONS_DIR, { recursive: true });
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const terminal of terminals.splice(0)) terminal.kill('SIGKILL');
  for (const file of fixtureFiles.splice(0)) await rm(file, { force: true });
});

// The page shows only the sessions of the running test.
test.beforeEach(async ({ page }) => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-action-keys-resume-'));
  const own = (session: { folder?: unknown } | undefined) => typeof session?.folder === 'string' && session.folder.startsWith(projectsRoot + path.sep);
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
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const byFolder = (page: Page, folder: string) => page.getByTitle(folder, { exact: true });
const item = (page: Page, folder: string) => list(page).getByRole('listitem').filter({ has: byFolder(page, folder) });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: byFolder(page, folder) });
const groupItems = (page: Page, title: string) => list(page).getByRole('heading', { level: 2, name: title, exact: true }).locator('xpath=following::ul[1]/li');
const terminal = (page: Page) => page.locator('.xterm-rows');
const messageArea = (page: Page) => page.locator('.conversation-view .conversation-items');
const warning = (page: Page) => page.getByRole('alertdialog', { name: 'Session Running in a Terminal' });
const anyDialog = (page: Page) => page.locator('[role="dialog"], [role="alertdialog"]');

async function newFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
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

/** Writes the transcript Claude Code leaves for a conversation, so it can be resumed. */
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
  fixtureFiles.push(file);
}

/** A hosted session that ended after a prompt, with its saved conversation. */
async function endedSession(request: APIRequestContext, name: string): Promise<{ id: string; claudeId: string; folder: string }> {
  const folder = await newFolder(name);
  const id = await startViaApi(request, folder);
  const claudeId = randomUUID();
  const prompt = `Fix the ${name} page`;
  await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt, session_id: claudeId });
  await transcript(claudeId, folder, prompt);
  expect((await request.post(`/api/sessions/${id}/stop`)).ok()).toBe(true);
  await expect.poll(() => stateOf(request, id), { message: `session ${name} ends` }).toBe('ended');
  return { id, claudeId, folder };
}

/** Simulates Claude Code running a conversation in another terminal. With a folder, it is also listed as an external session. */
async function runInTerminal(sessionId: string, folder?: string): Promise<void> {
  const process = spawn('sleep', ['300'], { stdio: 'ignore' });
  terminals.push(process);
  const pid = process.pid ?? 0;
  const file = path.join(SESSIONS_DIR, `${pid}.json`);
  const key = path.join(SESSIONS_DIR, `${pid}.5a6b7c8d.key`);
  fixtureFiles.push(file, key);
  if (folder === undefined) {
    await writeFile(file, JSON.stringify({ pid, sessionId }));
    return;
  }
  execFileSync('mkfifo', [key]);
  await writeFile(file, JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status: 'idle', updatedAt: Date.now() }));
}

/** An external session with a short conversation, open in the page. */
async function openExternal(page: Page, name: string): Promise<{ sessionId: string; folder: string }> {
  const folder = await newFolder(name);
  const sessionId = randomUUID();
  await transcript(sessionId, folder, 'Check the tests');
  await runInTerminal(sessionId, folder);
  await page.goto('/');
  await entry(page, folder).click(SCAN);
  await expect(messageArea(page)).toContainText('Check the tests');
  return { sessionId, folder };
}

/** Records the POST requests of the session actions: stop, dismiss and resume, hosted and external. */
function recordActions(page: Page): Request[] {
  const requests: Request[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/(stop|dismiss|resume)$/.test(new URL(r.url()).pathname)) requests.push(r);
  });
  return requests;
}

const paths = (requests: Request[]) => requests.map((r) => new URL(r.url()).pathname);

const resumeResponse = (page: Page) => page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/resume'));

/** Waits for a successful resume and stops the new session after the test. */
async function resumed(response: Promise<Response>): Promise<string> {
  const answer = await response;
  expect(answer.status()).toBe(201);
  const { id } = (await answer.json()) as { id: string };
  createdIds.push(id);
  return id;
}

// plan-keyboard_shortcuts/REQ-18 — scenario "The user resumes an ended session from the keyboard"
test('Alt+R on the open ended session resumes it: the new session is open and the ended entry is gone', async ({ page, request }) => {
  const ended = await endedSession(request, 'resume-open');
  await page.goto('/');
  await entry(page, ended.folder).click();
  await expect(entry(page, ended.folder)).toHaveAttribute('aria-current', 'true');
  const actions = recordActions(page);

  const response = resumeResponse(page);
  await page.keyboard.press('Alt+KeyR');
  const newId = await resumed(response);

  expect(newId).not.toBe(ended.id);
  expect(paths(actions)).toEqual([`/api/sessions/${ended.id}/resume`]);
  await expect(anyDialog(page), 'no dialog').toHaveCount(0);
  await expect(terminal(page)).toContainText(`"--resume","${ended.claudeId}"`);
  await expect(terminal(page)).toContainText(`CWD:${ended.folder}`);
  await expect(entry(page, ended.folder)).toHaveAttribute('aria-current', 'true');
  await expect(item(page, ended.folder), 'one entry for the conversation').toHaveCount(1);
  await expect(groupItems(page, 'Ended').filter({ has: byFolder(page, ended.folder) })).toHaveCount(0);
});

// plan-keyboard_shortcuts/REQ-18, plan-session_list_improvements/REQ-4 rule: the shortcut keeps the running-elsewhere warning of "Resume"
test('Alt+R on an ended session whose conversation runs in a terminal shows the warning; "Cancel" resumes nothing', async ({ page, request }) => {
  const ended = await endedSession(request, 'resume-elsewhere');
  await runInTerminal(ended.claudeId);
  const bodies: unknown[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === `/api/sessions/${ended.id}/resume`) bodies.push(r.postDataJSON());
  });
  await page.goto('/');
  await entry(page, ended.folder).click();
  await expect(entry(page, ended.folder)).toHaveAttribute('aria-current', 'true');

  await page.keyboard.press('Alt+KeyR');
  await expect(warning(page)).toBeVisible();
  await warning(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(warning(page)).toBeHidden();
  await page.waitForTimeout(300);

  expect(bodies, 'only the first request, no forced one').toEqual([{}]);
  await expect(groupItems(page, 'Ended').filter({ has: byFolder(page, ended.folder) })).toHaveCount(1);
});

// plan-keyboard_shortcuts/REQ-19, REQ-20 — scenario '"Resume Here" by shortcut keeps its warning'
test('Alt+R on the open external session shows the running-elsewhere warning, and resumes only after "Resume Anyway"', async ({ page }) => {
  const external = await openExternal(page, 'resume-here');
  const actions = recordActions(page);
  await page.keyboard.press('Alt+KeyL');
  await expect(entry(page, external.folder)).toBeFocused();

  await page.keyboard.press('Alt+KeyR');
  await expect(warning(page)).toBeVisible(ONE_SECOND);
  await page.waitForTimeout(500);
  expect(paths(actions), 'nothing is sent before "Resume Anyway"').toEqual([]);
  await expect(messageArea(page)).toBeVisible();

  const response = resumeResponse(page);
  await warning(page).getByRole('button', { name: 'Resume Anyway', exact: true }).click();
  await resumed(response);

  expect(paths(actions)).toEqual([`/api/past-sessions/${external.sessionId}/resume`]);
  await expect(warning(page)).toBeHidden();
  await expect(terminal(page)).toContainText(`"--resume","${external.sessionId}"`);
  await expect(terminal(page)).toContainText(`CWD:${external.folder}`);
});

// plan-keyboard_shortcuts/REQ-20: "Cancel" in the warning of the shortcut sends nothing
test('"Cancel" in the warning opened by Alt+R on an external session sends nothing and keeps the conversation open', async ({ page }) => {
  await openExternal(page, 'resume-here-cancel');
  const actions = recordActions(page);

  await page.keyboard.press('Alt+KeyR');
  await expect(warning(page)).toBeVisible(ONE_SECOND);
  await warning(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(warning(page)).toBeHidden();
  await page.waitForTimeout(300);

  expect(paths(actions)).toEqual([]);
  await expect(messageArea(page)).toContainText('Check the tests');
});

// plan-keyboard_shortcuts/REQ-14, REQ-17, REQ-43, assumption "Stop and rename": stop and dismiss do not apply to an external session
test('Alt+Shift+Q and Alt+Shift+W on the open external session do nothing', async ({ page }) => {
  const external = await openExternal(page, 'external-no-stop');
  const actions = recordActions(page);

  await page.keyboard.press('Alt+Shift+KeyQ');
  await page.keyboard.press('Alt+Shift+KeyW');
  await page.waitForTimeout(300);

  expect(paths(actions)).toEqual([]);
  await expect(anyDialog(page)).toHaveCount(0);
  await expect(item(page, external.folder)).toHaveCount(1);
  await expect(messageArea(page)).toContainText('Check the tests');
});

// plan-keyboard_shortcuts/REQ-16, assumption "Stop and rename": rename applies to an external session too
test('Alt+E on the open external session shows the "Session Name" field in its entry, with the focus', async ({ page }) => {
  const external = await openExternal(page, 'external-rename');

  await page.keyboard.press('Alt+KeyE');

  const field = item(page, external.folder).getByRole('textbox', { name: 'Session Name', exact: true });
  await expect(field).toBeVisible(ONE_SECOND);
  await expect(field).toBeFocused();
});
