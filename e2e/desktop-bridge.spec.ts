// e2e of plan-session_notifications, batch needs-input-notification: the page side of the desktop bridge, with a fake bridge injected in the page.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-bridge-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const mainArea = (page: Page) => page.getByRole('main');
const header = (page: Page) => mainArea(page).locator('.session-header');
const terminal = (page: Page) => page.locator('.xterm-rows');

async function startSession(request: APIRequestContext, name: string): Promise<{ id: string; folder: string }> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder, { recursive: true });
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  return { id, folder };
}

type BridgeProbe = { reports: (string | null)[]; open(sessionId: string): void };

/** Plays the DesktopBridge preload: records each reported open session and lets the test send "open this session". */
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

const reports = (page: Page) => page.evaluate(() => [...(window as unknown as { e2eBridge: BridgeProbe }).e2eBridge.reports]);
const openFromDesktop = (page: Page, sessionId: string) =>
  page.evaluate((id) => (window as unknown as { e2eBridge: BridgeProbe }).e2eBridge.open(id), sessionId);

async function expectOpen(page: Page, folder: string): Promise<void> {
  await expect(header(page).getByRole('heading', { level: 2 })).toHaveText(path.basename(folder));
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
}

// plan-session_notifications/REQ-12: the page tells the desktop app which session is open
test('the page reports no open session at start, then each session the user opens', async ({ page, request }) => {
  const first = await startSession(request, 'bridge-report-one');
  const second = await startSession(request, 'bridge-report-two');
  await installFakeBridge(page);
  await page.goto('/');
  await expect(entry(page, first.folder)).toBeVisible();
  await expect.poll(() => reports(page)).toEqual([null]);

  await entry(page, first.folder).click();
  await expectOpen(page, first.folder);
  await expect.poll(() => reports(page)).toEqual([null, first.id]);

  await entry(page, second.folder).click();
  await expectOpen(page, second.folder);
  await expect.poll(() => reports(page)).toEqual([null, first.id, second.id]);
});

// plan-session_notifications/REQ-13, scenario "A click on the notification opens the session" (page side)
test('"open this session" from the desktop app opens a listed hosted session, as a list click does', async ({ page, request }) => {
  const target = await startSession(request, 'bridge-open-hosted');
  await installFakeBridge(page);
  await page.goto('/');
  await expect(entry(page, target.folder)).toBeVisible();

  await openFromDesktop(page, target.id);

  await expectOpen(page, target.folder);
  await expect.poll(() => reports(page)).toEqual([null, target.id]);
});

// plan-session_notifications/REQ-20 (served by AppLayout in this batch): a session the list does not have is not opened
test('"open this session" for a session the list does not have changes nothing', async ({ page, request }) => {
  const shown = await startSession(request, 'bridge-unknown');
  await installFakeBridge(page);
  await page.goto('/');
  await expect(entry(page, shown.folder)).toBeVisible();

  await openFromDesktop(page, 'no-such-session');
  await expect(mainArea(page).getByRole('button', { name: 'Resume Session' })).toBeVisible();
  await expect(header(page)).toHaveCount(0);

  await entry(page, shown.folder).click();
  await expectOpen(page, shown.folder);
  await openFromDesktop(page, 'no-such-session');
  await page.waitForTimeout(300);
  await expectOpen(page, shown.folder);
  expect(await reports(page)).toEqual([null, shown.id]);
});

// useDesktopBridge: in a browser, with no bridge, it does nothing
test('in a browser with no desktop bridge, the page opens sessions and raises no error', async ({ page, request }) => {
  const target = await startSession(request, 'bridge-none');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');

  await entry(page, target.folder).click();

  await expectOpen(page, target.folder);
  expect(await page.evaluate(() => 'desktopBridge' in window)).toBe(false);
  expect(errors).toEqual([]);
});
