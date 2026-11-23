// e2e of plan-app_processes, batch terminate-process: "Terminate" in the "Processes" menu of the settings popup.
// The e2e server is the current instance: its confirmation is only opened and cancelled. Every process confirmed here
// is started by this file, checked by PID in the dialog before the confirm, and stopped by its PID only
// (knowledge base no-kill-by-pattern).
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';

// A route handler can still wait on the server when a test ends: its error then must not fail the test.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const FAKE_CLI = path.join(repoRoot, 'test-support/fake-claude.mjs');
const OWN_TEXT = 'This is the instance you are using. Terminating it closes the app and ends every session it hosts.';
const HOSTS_TEXT = 'The sessions it hosts end too.';

let root: string;
const createdIds: string[] = [];
const startedPids: number[] = [];

test.beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-terminate-'));
});

test.afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const pid of startedPids.splice(0)) await stopPid(pid);
});

const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const popup = (page: Page) => page.getByRole('dialog', { name: 'Settings', exact: true });
const region = (page: Page) => popup(page).getByRole('region', { name: 'Process List' });
const rows = (page: Page) => region(page).getByRole('list', { name: 'Processes' }).getByRole('listitem');
const rowOf = (page: Page, pid: number) => rows(page).filter({ hasText: new RegExp(`PID ${pid}(?!\\d)`) });
const rowWith = (page: Page, text: string) => rows(page).filter({ hasText: text });
const terminateIn = (row: Locator) => row.getByRole('button', { name: 'Terminate', exact: true });
const confirmation = (page: Page) => page.getByRole('alertdialog', { name: 'Terminate the Process?' });
const confirmButton = (page: Page) => confirmation(page).getByRole('button', { name: 'Terminate', exact: true });
const cancelButton = (page: Page) => confirmation(page).getByRole('button', { name: 'Cancel', exact: true });
const sessionEntry = (page: Page, folder: string) =>
  page.getByRole('region', { name: 'Session List' }).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const hasFocusVisible = (locator: Locator) => locator.evaluate((element) => element.matches(':focus-visible'));

async function openProcesses(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Session List' })).toBeVisible();
  await rail(page).getByRole('button', { name: 'Settings', exact: true }).click();
  await popup(page).getByRole('tab', { name: 'Processes', exact: true }).click();
  await expect(rowWith(page, 'This instance')).toHaveCount(1);
}

/** Opens the confirmation of the row of `pid` and confirms it, after checking that the dialog names that PID. */
async function confirmTerminate(page: Page, pid: number): Promise<void> {
  await terminateIn(rowOf(page, pid)).click();
  await expect(confirmation(page)).toContainText(new RegExp(`PID ${pid}(?!\\d)`));
  await confirmButton(page).click();
  await expect(confirmation(page)).toHaveCount(0);
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

/** Resolves once the child has exited; a child of this runner stays a zombie until then. */
const exited = (child: ChildProcess) =>
  child.exitCode !== null || child.signalCode !== null ? Promise.resolve() : new Promise<void>((resolve) => child.once('exit', () => resolve()));

/** Another app server of this app, on a free port. */
async function startOtherServer(): Promise<{ server: ChildProcess; port: number }> {
  const port = await freePort();
  const own = await mkdtemp(path.join(root, 'server-'));
  const env: Record<string, string | undefined> = {
    ...process.env,
    PORT: String(port),
    CLAUDE_CONFIG_DIR: path.join(own, 'claude'),
    AI_CLIENT_DATA_DIR: path.join(own, 'data'),
    AI_CLIENT_CLAUDE_CLI: undefined,
    AI_CLIENT_TEST_SERVER: undefined,
    AI_CLIENT_LAUNCHER: undefined,
  };
  for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key];
  const server = spawn(process.execPath, ['--import', 'tsx', 'src/server/main.ts'], { cwd: repoRoot, env, stdio: 'ignore' });
  startedPids.push(server.pid as number);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`).catch(() => undefined);
    if (response?.ok) return { server, port };
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('the other server did not answer');
}

/** A process the app lists as a fake Claude (its arguments name the fake CLI), with no app server as parent. */
function startFakeClaude(ignoreSigterm = false): ChildProcess {
  const code = `${ignoreSigterm ? "process.on('SIGTERM', () => {}); " : ''}setInterval(() => {}, 1000)`;
  const child = spawn(process.execPath, ['-e', code, FAKE_CLI], { stdio: 'ignore' });
  startedPids.push(child.pid as number);
  return child;
}

// Scenario "The confirmation names the process", plan-app_processes/REQ-23, REQ-24, REQ-25, REQ-27, REQ-33, REQ-34
// and scenario "Only the confirmed process ends", REQ-29, REQ-31
test.describe('another app server', () => {
  let other: { server: ChildProcess; port: number };

  test.beforeEach(async () => {
    other = await startOtherServer();
  });

  test('Tab and Enter open a rose confirmation that names it, and confirming with the keyboard ends it', async ({ page }) => {
    const pid = other.server.pid as number;
    const bystander = startFakeClaude();
    await openProcesses(page);
    await expect(rowOf(page, bystander.pid as number)).toHaveCount(1);
    const button = terminateIn(rowOf(page, pid));
    await expect(button).toHaveCount(1);

    await region(page).focus();
    for (let presses = 0; presses < 60 && !(await button.evaluate((element) => element === document.activeElement)); presses++)
      await page.keyboard.press('Tab');
    await expect(button).toBeFocused();
    expect(await hasFocusVisible(button)).toBe(true);
    await page.keyboard.press('Enter');

    await expect(confirmation(page)).toBeVisible();
    await expect(confirmation(page)).toContainText(`App server · PID ${pid} · port ${other.port}`);
    await expect(confirmation(page)).toContainText(HOSTS_TEXT);
    await expect(confirmation(page)).not.toContainText(OWN_TEXT);
    await expect(cancelButton(page)).toBeFocused();
    await expect(confirmButton(page)).toHaveClass(/button-danger/);

    let posted: unknown;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/processes/terminate') posted = request.postDataJSON();
    });
    for (let presses = 0; presses < 5 && !(await confirmButton(page).evaluate((element) => element === document.activeElement)); presses++)
      await page.keyboard.press('Tab');
    await expect(confirmButton(page)).toBeFocused();
    expect(await hasFocusVisible(confirmButton(page))).toBe(true);
    await page.keyboard.press('Enter');

    await expect(rowOf(page, pid)).toHaveCount(0, { timeout: 15_000 });
    await exited(other.server);
    expect(posted).toMatchObject({ pid });
    await expect(rowOf(page, bystander.pid as number)).toHaveCount(1);
    await expect(rowWith(page, 'This instance')).toHaveCount(1);
    expect(isAlive(bystander.pid as number)).toBe(true);

    // spec ProcessesSection, "focus after that load": the row left, so "Refresh" has the focus and Esc closes the popup
    await expect(popup(page).getByRole('button', { name: 'Refresh', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(popup(page)).toHaveCount(0);
  });

  test('Esc closes the confirmation and the server keeps running', async ({ page }) => {
    const pid = other.server.pid as number;
    await openProcesses(page);
    await terminateIn(rowOf(page, pid)).click();
    await expect(confirmation(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(confirmation(page)).toHaveCount(0);
    await expect(popup(page)).toBeVisible();
    await expect(rowOf(page, pid)).toHaveCount(1);
    const health = await fetch(`http://127.0.0.1:${other.port}/api/health`);
    expect(health.ok).toBe(true);
  });
});

// Scenario "Only the confirmed process ends", plan-app_processes/REQ-29, REQ-31
test('terminating a hanging fake Claude removes only its row', async ({ page }) => {
  const target = startFakeClaude();
  const bystander = startFakeClaude();
  await openProcesses(page);
  await expect(rowOf(page, target.pid as number)).toContainText('Fake Claude');
  await expect(rowOf(page, target.pid as number)).toContainText('Hanging');
  await expect(rowOf(page, bystander.pid as number)).toHaveCount(1);

  await confirmTerminate(page, target.pid as number);

  // Only rows this test owns: other workers start and stop processes, so the total row count is not stable.
  await expect(rowOf(page, target.pid as number)).toHaveCount(0);
  await expect(rowOf(page, bystander.pid as number)).toHaveCount(1);
  await expect(rowWith(page, 'This instance')).toHaveCount(1);
  await exited(target);
  expect(target.signalCode).toBe('SIGTERM');
  expect(isAlive(bystander.pid as number)).toBe(true);
});

// Scenario "A hosted session ends as from the session list", plan-app_processes/REQ-28
test('terminating a hosted session removes its row and the session list shows it ended', async ({ page, request }) => {
  const session = await startSession(request, 'hosted-terminate');
  await openProcesses(page);
  const row = rowWith(page, session.folder);
  await expect(row).toContainText('Hosted here');
  const pid = Number(/PID (\d+)/.exec((await row.textContent()) ?? '')?.[1]);
  expect(pid).toBeGreaterThan(0);

  await confirmTerminate(page, pid);

  await expect(rowWith(page, session.folder)).toHaveCount(0, { timeout: 15_000 });
  await popup(page).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(popup(page)).toHaveCount(0);
  await expect(sessionEntry(page, session.folder)).toContainText('Ended');
});

// Scenario "The current instance warns before closing the app", plan-app_processes/REQ-23, REQ-26.
// Never confirmed: the e2e server is the current instance.
test('the confirmation of "This instance" warns that the app closes, and "Cancel" leaves it running', async ({ page }) => {
  let terminateCalls = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/processes/terminate') terminateCalls += 1;
  });
  await openProcesses(page);
  const own = rowWith(page, 'This instance');
  await terminateIn(own).click();
  await expect(confirmation(page)).toContainText(OWN_TEXT);
  await expect(confirmation(page)).toContainText(/Test server · PID \d+ · port \d+/);
  await expect(confirmation(page)).not.toContainText(HOSTS_TEXT);
  await expect(cancelButton(page)).toBeFocused();
  await cancelButton(page).click();
  await expect(confirmation(page)).toHaveCount(0);
  await expect(rowWith(page, 'This instance')).toHaveCount(1);
  expect(terminateCalls).toBe(0);
});

// Scenario "The process does not end", plan-app_processes/REQ-32
test('a process that ignores SIGTERM keeps its row with "The process did not end."', async ({ page }) => {
  test.setTimeout(180_000);
  const stubborn = startFakeClaude(true);
  const pid = stubborn.pid as number;
  await openProcesses(page);

  await confirmTerminate(page, pid);

  await expect(terminateIn(rowOf(page, pid))).toBeDisabled();
  await expect(rowOf(page, pid)).toContainText('The process did not end.', { timeout: 15_000 });
  await expect(terminateIn(rowOf(page, pid))).toBeEnabled();
  expect(isAlive(pid)).toBe(true);
});

// Scenario "A reused PID is safe", plan-app_processes/REQ-30: the page holds an older start time for the PID,
// as when the listed process ended and a new one got its PID.
test('a row whose PID now names another process run sends no signal and the process keeps running', async ({ page }) => {
  const current = startFakeClaude();
  const pid = current.pid as number;
  let rewrites = 0;
  let staleStartedAt = 0;
  await page.route('**/api/processes', async (route) => {
    if (rewrites > 0) return route.fallback();
    const response = await route.fetch();
    const body = (await response.json()) as { processes: Array<{ pid: number; startedAt: number }> };
    for (const row of body.processes)
      if (row.pid === pid) {
        row.startedAt -= 3_600_000;
        staleStartedAt = row.startedAt;
        rewrites += 1;
      }
    await route.fulfill({ response, json: body });
  });
  const answers: unknown[] = [];
  page.on('response', async (response) => {
    if (new URL(response.url()).pathname === '/api/processes/terminate') answers.push(await response.json());
  });
  await openProcesses(page);
  await expect(rowOf(page, pid)).toContainText('Running 1h');

  await confirmTerminate(page, pid);

  await expect.poll(() => answers).toEqual([{ outcome: 'gone' }]);
  await expect(rowOf(page, pid)).not.toContainText('Running 1h');
  await expect(rowOf(page, pid)).toHaveCount(1);
  for (const message of ['The process did not end.', 'You are not allowed', 'Could not terminate']) await expect(rowOf(page, pid)).not.toContainText(message);
  expect(staleStartedAt).toBeGreaterThan(0);
  expect(isAlive(pid)).toBe(true);
  expect(current.signalCode).toBeNull();
});
