// e2e of plan-session_notifications, batches needs-input-notification and turn-end-notification: "open this session" on an external session, with a fake bridge injected in the page.
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

const SESSION_ID = 'e2e-bridge-external';
const FOLDER = '/tmp/ai-client-e2e-bridge-external/billing';
let terminalProcess: ChildProcess;
let sessionFile: string;

// A Claude Code session run in a terminal: its session file names a live process (a `sleep` stands in for the CLI).
test.beforeAll(async () => {
  terminalProcess = spawn('sleep', ['300'], { stdio: 'ignore' });
  await mkdir(path.join(E2E_CLAUDE_DIR, 'sessions'), { recursive: true });
  sessionFile = path.join(E2E_CLAUDE_DIR, 'sessions', `${terminalProcess.pid}.json`);
  await writeFile(
    sessionFile,
    JSON.stringify({ pid: terminalProcess.pid, sessionId: SESSION_ID, cwd: FOLDER, kind: 'interactive', status: 'idle', updatedAt: Date.now() }),
  );
});

test.afterAll(async () => {
  terminalProcess.kill('SIGKILL');
  await rm(sessionFile, { force: true });
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder = FOLDER) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const header = (page: Page) => page.getByRole('main').locator('.session-header');

type BridgeProbe = { reports: (string | null)[]; open(sessionId: string): void };

/** A fake desktop bridge: it records the open sessions the page reports, and `e2eBridge.open` sends "open this session". */
async function installFakeBridge(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const listeners = new Set<(sessionId: string) => void>();
    const reports: (string | null)[] = [];
    Object.assign(window, {
      desktopBridge: {
        reportOpenSession: (sessionId: string | null) => {
          reports.push(sessionId);
        },
        onOpenSession: (listener: (sessionId: string) => void) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      },
      e2eBridge: {
        reports,
        open: (sessionId: string) => {
          for (const listener of listeners) listener(sessionId);
        },
      },
    });
  });
}

const openFromDesktop = (page: Page, sessionId: string) =>
  page.evaluate((id) => (window as unknown as { e2eBridge: BridgeProbe }).e2eBridge.open(id), sessionId);
const reports = (page: Page) => page.evaluate(() => [...(window as unknown as { e2eBridge: BridgeProbe }).e2eBridge.reports]);

// plan-session_notifications/REQ-13, scenario "A click on the notification opens the session" (page side)
test('"open this session" from the desktop app opens a listed external session, as a list click does', async ({ page }) => {
  await installFakeBridge(page);
  await page.goto('/');
  await expect(entry(page)).toBeVisible({ timeout: 10_000 });

  await openFromDesktop(page, SESSION_ID);

  await expect(header(page).getByRole('heading', { level: 2 })).toHaveText('billing');
  await expect(header(page).getByText('Read-only', { exact: true })).toBeVisible();
  await expect.poll(() => reports(page)).toEqual([null, SESSION_ID]);
});

// plan-session_notifications/REQ-20, scenario "A click on a gone session only shows the window" (page side)
test('"open this session" for an external session that left the list opens nothing', async ({ page }) => {
  const goneId = 'e2e-bridge-external-gone';
  const goneFolder = '/tmp/ai-client-e2e-bridge-external/closed-terminal';
  const goneProcess = spawn('sleep', ['300'], { stdio: 'ignore' });
  const goneFile = path.join(E2E_CLAUDE_DIR, 'sessions', `${goneProcess.pid}.json`);
  try {
    await writeFile(
      goneFile,
      JSON.stringify({ pid: goneProcess.pid, sessionId: goneId, cwd: goneFolder, kind: 'interactive', status: 'idle', updatedAt: Date.now() }),
    );
    await installFakeBridge(page);
    await page.goto('/');
    await expect(entry(page, goneFolder)).toBeVisible({ timeout: 10_000 });

    // The user closes that terminal: the session leaves the list.
    goneProcess.kill('SIGKILL');
    await expect(entry(page, goneFolder)).toHaveCount(0, { timeout: 10_000 });

    await openFromDesktop(page, goneId);
    await page.waitForTimeout(300);
    await expect(header(page)).toHaveCount(0);

    await entry(page).click();
    await expect(header(page).getByRole('heading', { level: 2 })).toHaveText('billing');
    await openFromDesktop(page, goneId);
    await page.waitForTimeout(300);
    await expect(header(page).getByRole('heading', { level: 2 })).toHaveText('billing');
    expect(await reports(page)).toEqual([null, SESSION_ID]);
  } finally {
    goneProcess.kill('SIGKILL');
    await rm(goneFile, { force: true });
  }
});
