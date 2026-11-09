// e2e of plan-keyboard_shortcuts, batch navigation: the focus shortcuts on an external session.
// Each external session is a live `sleep` process with its fixture files in E2E_CLAUDE_DIR.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
// The scanner reads the sessions folder every 2 seconds.
const SCAN = { timeout: 10_000 };
const ONE_SECOND = { timeout: 1000 };

let projectsRoot: string;
const terminals: ChildProcess[] = [];
const createdIds: string[] = [];

test.beforeAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await mkdir(SESSIONS_DIR, { recursive: true });
  await mkdir(path.join(E2E_CLAUDE_DIR, 'projects'), { recursive: true });
});

test.afterEach(async ({ request }) => {
  for (const terminal of terminals.splice(0)) terminal.kill('SIGKILL');
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

test.afterAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
});

// The page shows only the sessions of the running test.
test.beforeEach(async ({ page }) => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-nav-keys-external-'));
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
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const messageArea = (page: Page) => page.locator('.conversation-view .conversation-items');
const terminal = (page: Page) => page.locator('.xterm-rows');
const terminalInput = (page: Page) => page.locator('.xterm-helper-textarea');

async function newFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  return folder;
}

async function startViaApi(request: APIRequestContext, folder: string): Promise<void> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  createdIds.push(((await response.json()) as { id: string }).id);
}

/** Simulates Claude Code in another terminal, with a short transcript. */
async function runInTerminal(sessionId: string, folder: string): Promise<void> {
  const transcript = path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'), `${sessionId}.jsonl`);
  await mkdir(path.dirname(transcript), { recursive: true });
  const user = { type: 'user', cwd: folder, isSidechain: false, message: { role: 'user', content: 'Controlla i test' } };
  const reply = { type: 'assistant', cwd: folder, isSidechain: false, message: { role: 'assistant', content: [{ type: 'text', text: 'Fatto.' }] } };
  await writeFile(transcript, `${JSON.stringify(user)}\n${JSON.stringify(reply)}\n`);
  const process = spawn('sleep', ['300'], { stdio: 'ignore' });
  terminals.push(process);
  const pid = process.pid ?? 0;
  execFileSync('mkfifo', [path.join(SESSIONS_DIR, `${pid}.5a6b7c8d.key`)]);
  await writeFile(path.join(SESSIONS_DIR, `${pid}.json`), JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status: 'idle', updatedAt: Date.now() }));
}

async function showsRing(page: Page, target: Locator): Promise<boolean> {
  const ring = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.color = 'var(--color-focus-ring)';
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });
  return target.evaluate((el, ringColour) => {
    const s = getComputedStyle(el);
    const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor === ringColour;
    return outline || s.boxShadow.includes(ringColour);
  }, ring);
}

// plan-keyboard_shortcuts/REQ-1, REQ-3: on an open external session, Alt+C focuses its message area, with the focus ring
test('Alt+C moves the focus from the list to the conversation of the open external session', async ({ page }) => {
  const folder = await newFolder('external-focus');
  await runInTerminal('e2e-nav-keys-focus', folder);
  await page.goto('/');
  await entry(page, folder).click({ timeout: SCAN.timeout });
  await expect(messageArea(page)).toContainText('Controlla i test');

  await page.keyboard.press('Alt+KeyL');
  await expect(entry(page, folder)).toBeFocused();

  await page.keyboard.press('Alt+KeyC');
  await expect(messageArea(page)).toBeFocused();
  await expect.poll(() => showsRing(page, messageArea(page))).toBe(true);
  expect(await messageArea(page).getAttribute('tabindex'), 'the message area is not in the Tab order').toBe('-1');
});

// plan-keyboard_shortcuts/REQ-10, batches.md decision "Focus after an open by shortcut": the new main view takes the focus from the old one
test('from the terminal, Alt+Down onto an external session puts the focus in its conversation, and Alt+Up back in the terminal', async ({ page, request }) => {
  const hosted = await newFolder('hosted-first');
  const external = await newFolder('external-second');
  await startViaApi(request, hosted);
  await runInTerminal('e2e-nav-keys-switch', external);
  await page.goto('/');
  await expect(entry(page, external)).toBeVisible(SCAN);
  await entry(page, hosted).click();
  await expect(terminal(page)).toContainText('READY');
  await page.locator('.xterm-screen').click();
  await expect(terminalInput(page)).toBeFocused();

  await page.keyboard.press('Alt+ArrowDown');
  await expect(messageArea(page)).toContainText('Controlla i test', ONE_SECOND);
  await expect(entry(page, external)).toHaveAttribute('aria-current', 'true');
  await expect(messageArea(page)).toBeFocused();

  await page.keyboard.press('Alt+ArrowUp');
  await expect(terminal(page)).toContainText(`CWD:${hosted}`, ONE_SECOND);
  await expect(terminalInput(page)).toBeFocused();
  await expect(terminal(page)).not.toContainText('IN:');
});
