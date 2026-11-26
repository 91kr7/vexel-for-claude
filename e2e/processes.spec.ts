// e2e of plan-app_processes, batch processes-list: the "Processes" menu of the settings popup.
// The e2e server is the current instance. Every other process here is started by this file and stopped by its PID only
// (knowledge base no-kill-by-pattern).
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pty from 'node-pty';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const FAKE_CLI = path.join(repoRoot, 'test-support/fake-claude.mjs');
const e2ePort = Number(process.env.E2E_PORT ?? 3100);
const LABEL = 'check the invoice totals';

let root: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-processes-'));
});

test.afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const settingsButton = (page: Page) => rail(page).getByRole('button', { name: 'Settings', exact: true });
const popup = (page: Page) => page.getByRole('dialog', { name: 'Settings', exact: true });
const tab = (page: Page, name: string) => popup(page).getByRole('tab', { name, exact: true });
const refresh = (page: Page) => popup(page).getByRole('button', { name: 'Refresh', exact: true });
const region = (page: Page) => popup(page).getByRole('region', { name: 'Process List' });
const rows = (page: Page) => region(page).getByRole('list', { name: 'Processes' }).getByRole('listitem');
const rowOf = (page: Page, pid: number) => rows(page).filter({ hasText: new RegExp(`PID ${pid}(?!\\d)`) });
const rowWith = (page: Page, text: string) => rows(page).filter({ hasText: text });
const sessionEntry = (page: Page, folder: string) =>
  page.getByRole('region', { name: 'Session List' }).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const terminal = (page: Page) => page.locator('.xterm-rows');
const hasFocusVisible = (locator: Locator) => locator.evaluate((element) => element.matches(':focus-visible'));
const outlineOf = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).outlineStyle);

async function loadPage(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Session List' })).toBeVisible();
}

/** Opens the settings with the keyboard and moves down the menu to "Processes", the item after "Shortcuts". */
async function openProcessesWithKeyboard(page: Page): Promise<void> {
  await settingsButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(tab(page, 'Appearance')).toBeFocused();
  for (const name of ['Shortcuts', 'Processes']) {
    await page.keyboard.press('ArrowDown');
    await expect(tab(page, name)).toBeFocused();
  }
  await expect(tab(page, 'Processes')).toHaveAttribute('aria-selected', 'true');
}

async function openProcesses(page: Page): Promise<void> {
  await settingsButton(page).click();
  await tab(page, 'Processes').click();
  await expect(rows(page).filter({ hasText: 'This instance' })).toHaveCount(1);
}

async function startSession(request: APIRequestContext, name: string): Promise<{ id: string; folder: string }> {
  const folder = path.join(await mkdtemp(path.join(root, 's-')), name);
  await mkdir(folder);
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  return { id, folder };
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function stopPid(pid: number | undefined): Promise<void> {
  if (pid === undefined || !isAlive(pid)) return;
  process.kill(pid, 'SIGTERM');
  const deadline = Date.now() + 5000;
  while (isAlive(pid) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
  if (isAlive(pid)) process.kill(pid, 'SIGKILL');
}

/** `<pid>:<startTicks>` of a process that ran and has ended: the marker of a test runner that was stopped. */
async function goneLauncherMarker(): Promise<string> {
  const launcher = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 600000)'], { stdio: 'ignore' });
  const pid = launcher.pid as number;
  const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
  const marker = `${pid}:${stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]}`;
  const exited = new Promise((resolve) => launcher.once('exit', resolve));
  launcher.kill('SIGKILL');
  await exited;
  return marker;
}

/**
 * Another server of the app on a free port. `leftover` → a test server of a stopped run: test marker, fake CLI,
 * and a launcher that no longer runs. Otherwise an app server started by hand.
 */
async function startOtherServer(leftover: boolean): Promise<{ server: ChildProcess; port: number }> {
  const port = await freePort();
  const own = await mkdtemp(path.join(root, 'server-'));
  const env: Record<string, string | undefined> = {
    ...process.env,
    PORT: String(port),
    CLAUDE_CONFIG_DIR: path.join(own, 'claude'),
    AI_CLIENT_DATA_DIR: path.join(own, 'data'),
    AI_CLIENT_CLAUDE_CLI: leftover ? FAKE_CLI : undefined,
    AI_CLIENT_TEST_SERVER: leftover ? '1' : undefined,
    AI_CLIENT_LAUNCHER: leftover ? await goneLauncherMarker() : undefined,
  };
  for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key];
  const server = spawn(process.execPath, ['--import', 'tsx', 'src/server/main.ts'], { cwd: repoRoot, env, stdio: 'ignore' });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`).catch(() => undefined);
    if (response?.ok) return { server, port };
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await stopPid(server.pid);
  throw new Error('the other server did not answer');
}

/** A fake Claude whose parent is no app server: it runs in a terminal of this test process. */
async function startLeftoverFakeClaude(folder: string): Promise<pty.IPty> {
  const fake = pty.spawn(process.execPath, [FAKE_CLI], { cwd: folder, cols: 80, rows: 24 });
  let output = '';
  fake.onData((data) => (output += data));
  await expect.poll(() => output.includes('READY')).toBe(true);
  return fake;
}

// Scenario "The user sees the app processes in the settings"
// plan-app_processes/REQ-1, REQ-2, REQ-5, REQ-8, REQ-10, REQ-13 to REQ-18, REQ-20, REQ-21, REQ-22
test.describe('process list with another server and a hosted session', () => {
  let other: { server: ChildProcess; port: number };

  test.beforeAll(async () => {
    other = await startOtherServer(false);
  });

  test.afterAll(async () => {
    await stopPid(other?.server.pid);
  });

  test('shows this instance, the other server and the hosted session, and the session keeps working', async ({ page, request }) => {
    const session = await startSession(request, 'invoice-app');
    const hook = await request.post(`/api/sessions/${session.id}/hook-events`, { data: { hook_event_name: 'UserPromptSubmit', prompt: LABEL } });
    expect(hook.status()).toBe(204);
    await loadPage(page);
    await openProcessesWithKeyboard(page);

    const own = rowWith(page, 'This instance');
    await expect(own).toHaveCount(1);
    await expect(own).toContainText('Test server');
    await expect(own).toContainText(`Port ${e2ePort}`);
    await expect(own).toContainText(/PID \d+/);
    await expect(own).toContainText(/Running \d+(s|m|h \d\dm|d \d+h)/);
    await expect(own).not.toContainText('Hanging');

    const otherRow = rowWith(page, `Port ${other.port}`);
    await expect(otherRow).toHaveCount(1);
    await expect(otherRow).toContainText(`PID ${other.server.pid}`);
    await expect(otherRow).toContainText('App server');
    await expect(otherRow).toContainText(/Running \d+(s|m)/);
    await expect(otherRow).not.toContainText('This instance');
    await expect(otherRow).not.toContainText('Hanging');

    const sessionRow = rowWith(page, session.folder);
    await expect(sessionRow).toHaveCount(1);
    await expect(sessionRow).toContainText('Fake Claude');
    await expect(sessionRow).toContainText('Hosted here');
    await expect(sessionRow).toContainText(LABEL);
    await expect(sessionRow).toContainText(/PID \d+/);
    await expect(sessionRow).toContainText(/Running \d+/);
    await expect(sessionRow).not.toContainText('Hanging');
    await expect(sessionRow).not.toContainText('Port');

    // The current instance comes first.
    await expect(rows(page).first()).toContainText('This instance');

    await page.keyboard.press('Escape');
    await expect(popup(page)).toHaveCount(0);
    await sessionEntry(page, session.folder).getByTitle(session.folder, { exact: true }).click();
    await expect(terminal(page)).toContainText(`CWD:${session.folder}`);
    await page.locator('.xterm-helper-textarea').focus();
    await page.keyboard.type('still-alive');
    await page.keyboard.press('Enter');
    await expect(terminal(page)).toContainText('LINE:still-alive');
  });
});

// Scenario "Leftovers of a stopped test run show as hanging"
// plan-app_processes/REQ-3, REQ-4, REQ-6, REQ-19
test.describe('leftovers of a stopped test run', () => {
  let leftover: { server: ChildProcess; port: number };
  let fake: pty.IPty;
  let fakeFolder: string;

  test.beforeAll(async () => {
    leftover = await startOtherServer(true);
    fakeFolder = await mkdtemp(path.join(root, 'leftover-'));
    fake = await startLeftoverFakeClaude(fakeFolder);
  });

  test.afterAll(async () => {
    await stopPid(fake?.pid);
    await stopPid(leftover?.server.pid);
  });

  test('shows the test server and the fake Claude, both marked "Hanging"', async ({ page }) => {
    await loadPage(page);
    await openProcesses(page);
    const server = rowOf(page, leftover.server.pid as number);
    await expect(server).toContainText('Test server');
    await expect(server).toContainText(`Port ${leftover.port}`);
    await expect(server).toContainText('Hanging');
    const fakeRow = rowOf(page, fake.pid);
    await expect(fakeRow).toContainText('Fake Claude');
    await expect(fakeRow).toContainText(fakeFolder);
    await expect(fakeRow).toContainText('Hanging');
    await expect(fakeRow).not.toContainText('Hosted here');
    await expect(rowWith(page, 'This instance')).not.toContainText('Hanging');
  });
});

// Scenario "Refresh shows a new process"
// plan-app_processes/REQ-11
test('"Refresh" shows a session started after the list loaded', async ({ page, request }) => {
  await loadPage(page);
  await openProcesses(page);
  const session = await startSession(request, 'late-project');
  await expect(rowWith(page, session.folder)).toHaveCount(0);
  await refresh(page).click();
  await expect(rowWith(page, session.folder)).toHaveCount(1);
  await expect(rowWith(page, session.folder)).toContainText('Hosted here');
});

// plan-app_processes/REQ-10: the list loads each time the menu shows
test('loads the list each time the "Processes" menu shows', async ({ page }) => {
  let calls = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/processes') calls += 1;
  });
  await loadPage(page);
  await settingsButton(page).click();
  expect(calls).toBe(0);
  await tab(page, 'Processes').click();
  await expect.poll(() => calls).toBe(1);
  await tab(page, 'Updates').click();
  await tab(page, 'Processes').click();
  await expect.poll(() => calls).toBe(2);
  await page.keyboard.press('Escape');
  await expect(popup(page)).toHaveCount(0);
  await openProcesses(page);
  await expect.poll(() => calls).toBe(3);
});

// spec ProcessesSection: a failed load shows the error line
test('says "Could not load the processes." when the route fails, and "Refresh" loads again', async ({ page }) => {
  let fail = true;
  await page.route('**/api/processes', (route) => (fail ? route.fulfill({ status: 500, body: '' }) : route.fallback()));
  await loadPage(page);
  await settingsButton(page).click();
  await tab(page, 'Processes').click();
  await expect(region(page).getByRole('alert')).toHaveText(/Could not load the processes\./);
  fail = false;
  await refresh(page).click();
  await expect(rowWith(page, 'This instance')).toHaveCount(1);
  await expect(region(page).getByRole('alert')).toHaveCount(0);
});

// plan-app_processes/REQ-21: "Refresh" and the list work with the keyboard, with a visible focus
test('Tab reaches "Refresh" and the "Process List" region with a visible focus, and Enter on "Refresh" reloads', async ({ page }) => {
  let calls = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/processes') calls += 1;
  });
  await loadPage(page);
  await openProcessesWithKeyboard(page);
  await expect(rowWith(page, 'This instance')).toHaveCount(1);

  await page.keyboard.press('Tab');
  await expect(refresh(page)).toBeFocused();
  expect(await hasFocusVisible(refresh(page))).toBe(true);
  expect(await outlineOf(refresh(page))).not.toBe('none');

  await page.keyboard.press('Tab');
  await expect(region(page)).toBeFocused();
  expect(await hasFocusVisible(region(page))).toBe(true);
  expect(await outlineOf(region(page))).not.toBe('none');

  await page.keyboard.press('Shift+Tab');
  await expect(refresh(page)).toBeFocused();
  const before = calls;
  await page.keyboard.press('Enter');
  await expect.poll(() => calls).toBe(before + 1);
  await expect(rowWith(page, 'This instance')).toHaveCount(1);
});
