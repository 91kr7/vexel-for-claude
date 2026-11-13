// e2e of plan-wsl_support, batch ended-external-sessions. Each external session is a live `sleep` process with its fixture files in E2E_CLAUDE_DIR.
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
const ONE_SCAN_MS = 2600;

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

// The page shows only the sessions of the running test: ended external entries of other specs stay in the server memory.
test.beforeEach(async ({ page }) => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-ended-external-'));
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
const entry = (page: Page, folder: string) => list(page).locator('.session-entry').filter({ has: byFolder(page, folder) });
const action = (page: Page, folder: string, name: 'Resume' | 'Dismiss') => item(page, folder).getByRole('button', { name, exact: true });
const groupItems = (page: Page, title: string) => list(page).getByRole('heading', { level: 2, name: title, exact: true }).locator('xpath=following::ul[1]/li');
const endedItem = (page: Page, folder: string) => groupItems(page, 'Ended').filter({ has: byFolder(page, folder) });
const terminal = (page: Page) => page.locator('.xterm-rows');
const messageArea = (page: Page) => page.locator('.conversation-view .conversation-items');
const warning = (page: Page) => page.getByRole('alertdialog', { name: 'Session Running in a Terminal' });
const anyDialog = (page: Page) => page.locator('[role="dialog"], [role="alertdialog"]');
const noOpenSession = (page: Page) => page.getByRole('main').getByText('No open session.', { exact: true });

async function newFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  return folder;
}

/** Writes the transcript Claude Code leaves for a conversation, so it can be resumed. */
async function transcript(sessionId: string, folder: string, firstMessage: string): Promise<void> {
  const dir = path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'));
  await mkdir(dir, { recursive: true });
  const common = { cwd: folder, sessionId, isSidechain: false };
  const lines = [
    { ...common, type: 'user', message: { role: 'user', content: firstMessage } },
    { ...common, type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] } },
  ];
  const file = path.join(dir, `${sessionId}.jsonl`);
  await writeFile(file, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  fixtureFiles.push(file);
}

/** Simulates Claude Code in another terminal; `close()` ends it as a closed terminal does. */
async function runInTerminal(sessionId: string, folder: string): Promise<{ close(): void }> {
  const process = spawn('sleep', ['300'], { stdio: 'ignore' });
  terminals.push(process);
  const pid = process.pid ?? 0;
  const file = path.join(SESSIONS_DIR, `${pid}.json`);
  const key = path.join(SESSIONS_DIR, `${pid}.5a6b7c8d.key`);
  fixtureFiles.push(file, key);
  execFileSync('mkfifo', [key]);
  await writeFile(file, JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status: 'idle', updatedAt: Date.now() }));
  return { close: () => process.kill('SIGKILL') };
}

/** An external session with a saved conversation, listed in the page, then its terminal closed: it waits for the "Ended" group. */
async function endedExternal(page: Page, name: string, options: { open?: boolean } = {}): Promise<{ sessionId: string; folder: string }> {
  const folder = await newFolder(name);
  const sessionId = randomUUID();
  await transcript(sessionId, folder, `Check the ${name} tests`);
  const session = await runInTerminal(sessionId, folder);
  await page.goto('/');
  await expect(entry(page, folder)).toBeVisible(SCAN);
  if (options.open) {
    await entry(page, folder).click();
    await expect(messageArea(page)).toContainText(`Check the ${name} tests`);
  }
  session.close();
  await expect(endedItem(page, folder)).toHaveCount(1, SCAN);
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

/** After a resume in the client: one entry for the folder, hosted, open, and none in "Ended". */
async function expectOnlyHostedEntry(page: Page, sessionId: string, folder: string): Promise<void> {
  await expect(terminal(page)).toContainText(`"--resume","${sessionId}"`);
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
  await expect(endedItem(page, folder)).toHaveCount(0, SCAN);
  await expect(item(page, folder), 'one entry for the conversation').toHaveCount(1);
  await expect(entry(page, folder)).not.toHaveClass(/\bexternal\b/);
  await expect(entry(page, folder)).toHaveAttribute('aria-current', 'true');
}

async function pastSessionIds(request: APIRequestContext): Promise<string[]> {
  const groups = (await (await request.get('/api/past-sessions')).json()) as { sessions: { id: string }[] }[];
  return groups.flatMap((group) => group.sessions.map((s) => s.id));
}

// plan-wsl_support/REQ-7, REQ-8, REQ-15 — scenario "A closed terminal leaves an ended entry in the list"
test('a closed terminal moves the external entry to "Ended" with its name, star, "Resume" and "Dismiss", and it stays', async ({ page, request }) => {
  const folder = await newFolder('closing');
  const sessionId = randomUUID();
  await transcript(sessionId, folder, 'Check the closing tests');
  const session = await runInTerminal(sessionId, folder);
  await page.goto('/');
  await expect(entry(page, folder)).toBeVisible(SCAN);
  expect((await request.put(`/api/sessions/${sessionId}/name`, { data: { name: 'Nightly build' } })).status()).toBe(204);
  expect((await request.put(`/api/sessions/${sessionId}/favorite`, { data: { favorite: true } })).status()).toBe(204);
  await expect(entry(page, folder)).toContainText('Nightly build');
  await page.evaluate(() => Object.assign(globalThis, { e2eSamePage: true }));

  session.close();

  await expect(endedItem(page, folder)).toHaveCount(1, SCAN);
  const ended = endedItem(page, folder);
  await expect(ended).toContainText('Nightly build');
  await expect(ended.getByRole('img', { name: 'Favorite', exact: true })).toBeVisible();
  await expect(action(page, folder, 'Resume')).toHaveCount(1);
  await expect(action(page, folder, 'Dismiss')).toHaveCount(1);
  await expect(entry(page, folder)).toHaveClass(/\bexternal\b/);
  expect(await page.evaluate(() => 'e2eSamePage' in globalThis)).toBe(true);

  await page.waitForTimeout(ONE_SCAN_MS * 2);
  await expect(endedItem(page, folder)).toHaveCount(1);
  await expect(item(page, folder)).toHaveCount(1);
});

// plan-wsl_support/REQ-9 — scenario "Dismiss removes the ended entry for good"
test('"Dismiss" on the open ended external entry removes it at once, clears the main area, and it stays gone after a reload', async ({ page, request }) => {
  const ended = await endedExternal(page, 'dismissed', { open: true });
  await expect(noOpenSession(page)).toHaveCount(0);

  await action(page, ended.folder, 'Dismiss').click();

  await expect(item(page, ended.folder)).toHaveCount(0);
  await expect(anyDialog(page)).toHaveCount(0);
  await expect(noOpenSession(page)).toBeVisible();

  await page.reload();
  await expect(list(page)).toBeVisible();
  await page.waitForTimeout(ONE_SCAN_MS);
  await expect(item(page, ended.folder)).toHaveCount(0);
  expect(await pastSessionIds(request)).toContain(ended.sessionId);
});

// plan-wsl_support/REQ-10, REQ-12 — scenario "Resume from the entry leaves one hosted entry"
test('"Resume" on an ended external entry opens the conversation as a hosted session, the only entry for it', async ({ page }) => {
  const ended = await endedExternal(page, 'resumed');
  const actions = recordActions(page);

  const response = resumeResponse(page);
  await action(page, ended.folder, 'Resume').click();
  await resumed(response);

  expect(paths(actions)).toEqual([`/api/sessions/${ended.sessionId}/resume`]);
  await expect(anyDialog(page), 'no dialog').toHaveCount(0);
  await expectOnlyHostedEntry(page, ended.sessionId, ended.folder);
});

// plan-wsl_support/REQ-11, REQ-12 — scenario '"Resume Here" on an ended external session shows no warning'
test('"Resume Here" on the open ended external session resumes it at once, with no warning', async ({ page }) => {
  const ended = await endedExternal(page, 'resume-here', { open: true });
  const actions = recordActions(page);

  const response = resumeResponse(page);
  await page.getByRole('button', { name: 'Resume Here', exact: true }).click();
  await resumed(response);

  expect(paths(actions)).toEqual([`/api/past-sessions/${ended.sessionId}/resume`]);
  await expect(warning(page)).toHaveCount(0);
  await expectOnlyHostedEntry(page, ended.sessionId, ended.folder);
});

// plan-wsl_support/REQ-13 — scenario "The shortcuts act as the buttons": Resume
test('Alt+R on the open ended external session resumes it once, with no warning', async ({ page }) => {
  const ended = await endedExternal(page, 'resume-key', { open: true });
  const actions = recordActions(page);

  const response = resumeResponse(page);
  await page.keyboard.press('Alt+KeyR');
  await resumed(response);

  await expect(warning(page)).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(paths(actions), 'one resume request').toHaveLength(1);
  expect(paths(actions)[0]).toMatch(new RegExp(`^/api/(sessions|past-sessions)/${ended.sessionId}/resume$`));
  await expectOnlyHostedEntry(page, ended.sessionId, ended.folder);
});

// plan-wsl_support/REQ-13 — scenario "The shortcuts act as the buttons": Dismiss
test('Alt+Shift+W on the open ended external session removes its entry, as "Dismiss" does', async ({ page }) => {
  const ended = await endedExternal(page, 'dismiss-key', { open: true });
  const actions = recordActions(page);

  await page.keyboard.press('Alt+Shift+KeyW');

  await expect(item(page, ended.folder)).toHaveCount(0);
  expect(paths(actions)).toEqual([`/api/sessions/${ended.sessionId}/dismiss`]);
  await expect(anyDialog(page)).toHaveCount(0);
  await expect(noOpenSession(page)).toBeVisible();
});

// plan-wsl_support/REQ-10 — scenario "A failed resume keeps the entry"
test('a failed "Resume" on an ended external entry shows the error under it, and it stays in "Ended"', async ({ page }) => {
  const ended = await endedExternal(page, 'gone-folder');
  await rm(ended.folder, { recursive: true });

  await action(page, ended.folder, 'Resume').click();

  await expect(item(page, ended.folder).getByRole('alert')).toHaveText('The project folder does not exist.');
  await expect(endedItem(page, ended.folder)).toHaveCount(1);
  await expect(terminal(page)).toHaveCount(0);
});
