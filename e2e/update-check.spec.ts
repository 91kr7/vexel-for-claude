// e2e of plan-settings_dialog, batch update-check: the "Updates" tab of the settings popup in the browser page.
// The groups that need a release start their own server, pointed at a local fake release source: no run calls GitHub.
import { type ChildProcess, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Page, expect, test } from '@playwright/test';
import { settingsButton, settingsPopup } from './settings';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const fakeClaude = fileURLToPath(new URL('../test-support/fake-claude.mjs', import.meta.url));
const installed = (JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string }).version;
const [major, minor] = installed.split('.').map(Number) as [number, number];
const next = `${major}.${minor + 1}.0`;

const notice = (page: Page) => page.getByRole('status', { name: 'Update Available' });
const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const checkButton = (page: Page) => settingsPopup(page).getByRole('button', { name: /^(Check for Updates|Checking…)$/ });

interface FakeSource {
  url: string;
  releasePage: (tag: string) => string;
  tag: string;
  /** While set, the latest release requests wait for it. */
  hold: Promise<void> | undefined;
  latestCalls: number;
  close(): Promise<void>;
}

/** A local stand-in for the GitHub latest release endpoint, its release list and the release pages it links. */
async function fakeSource(tag: string): Promise<FakeSource> {
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/releases/latest') {
      source.latestCalls += 1;
      await source.hold;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ tag_name: source.tag, html_url: source.releasePage(source.tag) }));
      return;
    }
    if (pathname === '/releases') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('[]');
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(`<!doctype html><title>Release</title><h1>Release ${pathname}</h1>`);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  const source: FakeSource = {
    url: `http://127.0.0.1:${port}/releases/latest`,
    releasePage: (releaseTag) => `http://127.0.0.1:${port}/release/${releaseTag}`,
    tag,
    hold: undefined,
    latestCalls: 0,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
  return source;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address() as net.AddressInfo;
      probe.close(() => resolve(address.port));
    });
  });
}

/** One launch: a built server on a free port, with its own empty Claude Code and data folders. */
async function launch(sourceUrl: string, home: string): Promise<{ base: string; stop: () => Promise<void> }> {
  const port = await freePort();
  const server: ChildProcess = spawn(process.execPath, ['--import', 'tsx', 'src/server/main.ts'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      CLAUDE_CONFIG_DIR: path.join(home, 'claude'),
      AI_CLIENT_DATA_DIR: path.join(home, 'data'),
      AI_CLIENT_CLAUDE_CLI: fakeClaude,
      AI_CLIENT_RELEASE_SOURCE_URL: sourceUrl,
    },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  const stop = async () => {
    if (server.exitCode !== null || server.signalCode !== null) return;
    const exited = new Promise((resolve) => server.once('exit', resolve));
    server.kill('SIGTERM');
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
    if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
  };
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const answer = await fetch(`${base}/api/health`).catch(() => undefined);
    if (answer?.ok) return { base, stop };
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await stop();
  throw new Error('the e2e release server did not start');
}

async function openUpdatesTab(page: Page): Promise<void> {
  await settingsButton(page).click();
  await expect(settingsPopup(page)).toBeVisible();
  await settingsPopup(page).getByRole('tab', { name: 'Updates', exact: true }).click();
}

test.describe('a newer release exists', () => {
  test.describe.configure({ mode: 'serial' });

  let source: FakeSource;
  let home: string;
  let app: { base: string; stop: () => Promise<void> };

  test.beforeAll(async () => {
    source = await fakeSource(`v${next}`);
    home = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-update-check-'));
    app = await launch(source.url, home);
  });

  test.afterAll(async () => {
    await app?.stop();
    await source?.close();
    if (home) await rm(home, { recursive: true, force: true });
  });

  // plan-settings_dialog/REQ-43, REQ-44
  test('REQ-43, REQ-44, REQ-53: the "Updates" menu comes after "Shortcuts" and shows the installed version and the button', async ({ page }) => {
    await page.goto(app.base);
    await settingsButton(page).click();
    const tabs = settingsPopup(page).getByRole('tablist', { name: 'Settings sections' }).getByRole('tab');
    await expect(tabs).toHaveText(['Appearance', 'Shortcuts', 'Updates']);
    await settingsPopup(page).getByRole('tab', { name: 'Updates', exact: true }).click();
    await expect(settingsPopup(page).getByText(`Installed version: v${installed}`, { exact: true })).toBeVisible();
    await expect(checkButton(page)).toHaveText('Check for Updates');
    await expect(checkButton(page)).toBeEnabled();
  });

  // Scenario "The user finds a newer version from the settings": plan-settings_dialog/REQ-45, REQ-46, REQ-48, REQ-49, REQ-51
  test('REQ-45, REQ-46, REQ-48, REQ-49, REQ-51: a check finds the newer version and the closed notice shows again', async ({ page }) => {
    await page.goto(app.base);
    await expect(list(page)).toBeVisible();
    await notice(page).getByRole('button', { name: 'Close Update Notice' }).click();
    await expect(notice(page)).toHaveCount(0);
    const callsBefore = source.latestCalls;

    let release!: () => void;
    source.hold = new Promise((resolve) => (release = resolve));
    await openUpdatesTab(page);
    await checkButton(page).click();
    await expect(checkButton(page)).toHaveText('Checking…');
    await expect(checkButton(page)).toBeDisabled();
    release();
    source.hold = undefined;

    const popup = settingsPopup(page);
    await expect(popup.getByText(`Version ${next} is available. You have ${installed}.`, { exact: true })).toBeVisible();
    await expect(checkButton(page)).toHaveText('Check for Updates');
    await expect(checkButton(page)).toBeEnabled();
    await expect(popup.getByRole('link', { name: 'View Release' })).toHaveAttribute('href', source.releasePage(`v${next}`));
    expect(source.latestCalls).toBe(callsBefore + 1);
    await expect(popup).toBeVisible();

    await popup.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(popup).toHaveCount(0);
    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toContainText(`Version ${next} is available. You have ${installed}.`);
  });

  // plan-settings_dialog/REQ-48: "View Release" opens the release page in a new tab, the page and the popup stay
  test('REQ-48: "View Release" opens the release page in a new tab', async ({ page }) => {
    await page.goto(app.base);
    await openUpdatesTab(page);
    await checkButton(page).click();
    const link = settingsPopup(page).getByRole('link', { name: 'View Release' });
    const [tab] = await Promise.all([page.context().waitForEvent('page'), link.click()]);
    await tab.waitForLoadState();
    expect(tab.url()).toBe(source.releasePage(`v${next}`));
    expect(page.url()).toBe(`${app.base}/`);
    await expect(settingsPopup(page)).toBeVisible();
    await tab.close();
  });

  // Scenario "The client is up to date": plan-settings_dialog/REQ-47, REQ-51
  test('REQ-47: with no newer release the tab shows the installed version as up to date', async ({ page }) => {
    source.tag = `v${installed}`;
    try {
      await page.goto(app.base);
      await openUpdatesTab(page);
      await checkButton(page).click();
      await expect(settingsPopup(page).getByText(`You are up to date (v${installed})`, { exact: true })).toBeVisible();
      await expect(settingsPopup(page).getByRole('link', { name: 'View Release' })).toHaveCount(0);
      await expect(settingsPopup(page)).toBeVisible();
    } finally {
      source.tag = `v${next}`;
    }
  });

  // spec SettingsDialog: the result survives a tab change, a new opening starts with no result
  test('the result stays across a tab change and goes with a new opening', async ({ page }) => {
    await page.goto(app.base);
    await openUpdatesTab(page);
    await checkButton(page).click();
    const result = settingsPopup(page).getByText(`Version ${next} is available. You have ${installed}.`, { exact: true });
    await expect(result).toBeVisible();
    await settingsPopup(page).getByRole('tab', { name: 'Appearance', exact: true }).click();
    await expect(result).toBeHidden();
    await settingsPopup(page).getByRole('tab', { name: 'Updates', exact: true }).click();
    await expect(result).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(settingsPopup(page)).toHaveCount(0);
    await openUpdatesTab(page);
    await expect(checkButton(page)).toHaveText('Check for Updates');
    await expect(result).toHaveCount(0);
  });
});

// Scenario "GitHub does not answer": the default e2e server's release source refuses the connection
test.describe('the release source does not answer', () => {
  test('REQ-50, REQ-52: nothing shows at launch and the check shows the error', async ({ page }) => {
    const launchAnswer = page.waitForResponse((response) => response.url().endsWith('/api/newer-version'));
    await page.goto('/');
    await expect(list(page)).toBeVisible();
    expect(await (await launchAnswer).json()).toEqual({ status: 'none' });
    await expect(notice(page)).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);

    await openUpdatesTab(page);
    await checkButton(page).click();
    await expect(settingsPopup(page).getByRole('alert')).toHaveText('Could not check for updates. Try again later.');
    await expect(checkButton(page)).toBeEnabled();
    await expect(settingsPopup(page)).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
  });
});
