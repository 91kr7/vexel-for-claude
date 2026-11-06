// e2e of plan-session_notifications, batch needs-input-notification: "open this session" on an external session, with a fake bridge injected in the page.
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
const entry = (page: Page) => list(page).getByRole('button').filter({ has: page.getByTitle(FOLDER, { exact: true }) });
const header = (page: Page) => page.getByRole('main').locator('.session-header');

type BridgeProbe = { reports: (string | null)[]; open(sessionId: string): void };

// plan-session_notifications/REQ-13, scenario "A click on the notification opens the session" (page side)
test('"open this session" from the desktop app opens a listed external session, as a list click does', async ({ page }) => {
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
  await page.goto('/');
  await expect(entry(page)).toBeVisible({ timeout: 10_000 });

  await page.evaluate((id) => (window as unknown as { e2eBridge: BridgeProbe }).e2eBridge.open(id), SESSION_ID);

  await expect(header(page).getByRole('heading', { level: 2 })).toHaveText('billing');
  await expect(header(page).getByText('Read-only', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => [...(window as unknown as { e2eBridge: BridgeProbe }).e2eBridge.reports])).toEqual([null, SESSION_ID]);
});
