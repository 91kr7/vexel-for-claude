// e2e of plan-update_check, batch newer-version-notice: the newer version notice in the browser page.
// The specs that need a release start their own server, pointed at a local fake release source: no run calls GitHub.
import { type ChildProcess, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import http, { type IncomingHttpHeaders } from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Page, expect, test } from '@playwright/test';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const fakeClaude = fileURLToPath(new URL('../test-support/fake-claude.mjs', import.meta.url));
const installed = (JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string }).version;
const [major, minor] = installed.split('.').map(Number) as [number, number];
const next = `${major}.${minor + 1}.0`;
const later = `${major}.${minor + 2}.0`;

const notice = (page: Page) => page.getByRole('status', { name: 'Update Available' });
const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const noticeText = (version: string) => `Version ${version} is available. You have ${installed}.`;

interface FakeSource {
  url: string;
  releasePage: (tag: string) => string;
  seen: Array<{ url: string; headers: IncomingHttpHeaders }>;
  tag: string;
  close(): Promise<void>;
}

/** A local stand-in for the GitHub latest release endpoint, and for the release pages it links. */
async function fakeSource(tag: string): Promise<FakeSource> {
  const server = http.createServer((request, response) => {
    if (request.url === '/releases/latest') {
      source.seen.push({ url: request.url, headers: request.headers });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ tag_name: source.tag, html_url: source.releasePage(source.tag) }));
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(`<!doctype html><title>Release</title><h1>Release ${request.url}</h1>`);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  const source: FakeSource = {
    url: `http://127.0.0.1:${port}/releases/latest`,
    releasePage: (releaseTag) => `http://127.0.0.1:${port}/release/${releaseTag}`,
    seen: [],
    tag,
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

/** One launch: a built server on `port`, with its own empty Claude Code and data folders. */
async function launch(port: number, sourceUrl: string, home: string): Promise<{ base: string; stop: () => Promise<void> }> {
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

test.describe('a newer release exists', () => {
  test.describe.configure({ mode: 'serial' });

  let source: FakeSource;
  let home: string;
  let port: number;
  let app: { base: string; stop: () => Promise<void> };

  test.beforeAll(async () => {
    source = await fakeSource(`v${next}`);
    home = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-release-'));
    port = await freePort();
    app = await launch(port, source.url, home);
  });

  test.afterAll(async () => {
    await app?.stop();
    await source?.close();
    if (home) await rm(home, { recursive: true, force: true });
  });

  test('REQ-1, REQ-4, REQ-5, REQ-11: the session list appears and the notice shows both versions', async ({ page }) => {
    await page.goto(app.base);
    await expect(list(page)).toBeVisible();
    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toContainText('Update Available');
    await expect(notice(page)).toContainText(noticeText(next));
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(source.seen).toHaveLength(1);
  });

  test('the notice sits under the top bar at the right, at most 320 px wide, and takes no focus', async ({ page }) => {
    await page.goto(app.base);
    await expect(notice(page)).toBeVisible();
    const box = (await notice(page).boundingBox())!;
    const bar = (await page.getByRole('banner').boundingBox())!;
    const width = page.viewportSize()!.width;
    expect(Math.abs(box.y - (bar.y + bar.height + 12))).toBeLessThanOrEqual(1);
    expect(Math.abs(box.x + box.width - (width - 20))).toBeLessThanOrEqual(1);
    expect(box.width).toBeLessThanOrEqual(320);
    const focusInside = await notice(page).evaluate((element) => element.contains(document.activeElement));
    expect(focusInside).toBe(false);
  });

  test('REQ-6: "View Release" opens the release page in a new tab and the page stays', async ({ page }) => {
    await page.goto(app.base);
    const link = notice(page).getByRole('link', { name: 'View Release' });
    await expect(link).toHaveAttribute('href', source.releasePage(`v${next}`));
    const [tab] = await Promise.all([page.context().waitForEvent('page'), link.click()]);
    await tab.waitForLoadState();
    expect(tab.url()).toBe(source.releasePage(`v${next}`));
    expect(page.url()).toBe(`${app.base}/`);
    await expect(list(page)).toBeVisible();
    await tab.close();
  });

  test('REQ-7: "Close Update Notice" hides the notice and moves nothing else', async ({ page }) => {
    await page.goto(app.base);
    await expect(notice(page)).toBeVisible();
    const listBefore = await list(page).boundingBox();
    const mainBefore = await page.getByRole('main').boundingBox();
    await notice(page).getByRole('button', { name: 'Close Update Notice' }).click();
    await expect(notice(page)).toHaveCount(0);
    expect(await list(page).boundingBox()).toEqual(listBefore);
    expect(await page.getByRole('main').boundingBox()).toEqual(mainBefore);
  });

  test('REQ-2: a reload and a new tab show the result of the same launch, after a later release', async ({ page, context }) => {
    await page.goto(app.base);
    await notice(page).getByRole('button', { name: 'Close Update Notice' }).click();
    await expect(notice(page)).toHaveCount(0);
    source.tag = `v${later}`;
    await page.reload();
    await expect(notice(page)).toContainText(noticeText(next));
    const other = await context.newPage();
    await other.goto(app.base);
    await expect(notice(other)).toContainText(noticeText(next));
    expect(source.seen).toHaveLength(1);
    source.tag = `v${next}`;
  });

  test('REQ-8: a notice closed in one launch shows again at the next launch', async ({ page }) => {
    await page.goto(app.base);
    await notice(page).getByRole('button', { name: 'Close Update Notice' }).click();
    await expect(notice(page)).toHaveCount(0);
    await app.stop();
    app = await launch(port, source.url, home);
    await page.goto(app.base);
    await expect(notice(page)).toContainText(noticeText(next));
    expect(source.seen).toHaveLength(2);
  });
});

test.describe('no newer release', () => {
  // REQ-3, REQ-4: the endpoint gives the installed version as the latest published release; a pre-release is never "latest"
  test('REQ-3, REQ-4: no notice when the latest release is the installed version', async ({ page }) => {
    const source = await fakeSource(`v${installed}`);
    const home = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-release-'));
    const app = await launch(await freePort(), source.url, home);
    try {
      const answered = page.waitForResponse((response) => response.url().endsWith('/api/newer-version'));
      await page.goto(app.base);
      await expect(list(page)).toBeVisible();
      expect(await (await answered).json()).toEqual({ status: 'none' });
      expect(source.seen).toHaveLength(1);
      await expect(notice(page)).toHaveCount(0);
    } finally {
      await app.stop();
      await source.close();
      await rm(home, { recursive: true, force: true });
    }
  });

  // REQ-9, REQ-11: the e2e server's release source refuses the connection, as with no network
  test('REQ-9, REQ-11: an unreachable source gives the usual page with no notice and no error', async ({ page }) => {
    const answered = page.waitForResponse((response) => response.url().endsWith('/api/newer-version'));
    await page.goto('/');
    await expect(list(page)).toBeVisible();
    const response = await answered;
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: 'none' });
    await expect(notice(page)).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  // REQ-11: the session list does not wait for the route; the notice comes when the answer comes
  test('REQ-11: the session list shows while the newer version answer is still pending', async ({ page }) => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(
      (url) => url.pathname === '/api/newer-version',
      async (route) => {
        await held;
        await route.fulfill({
          status: 200,
          json: { status: 'newer', installedVersion: installed, newerVersion: next, releaseUrl: 'http://127.0.0.1:9/release' },
        });
      },
    );
    await page.goto('/');
    await expect(list(page)).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
    release();
    await expect(notice(page)).toContainText(noticeText(next));
  });
});
