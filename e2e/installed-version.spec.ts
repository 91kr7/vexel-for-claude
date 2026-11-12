// e2e of plan-update_check, batch installed-version: the installed version in the top bar.
// The e2e server's release source refuses the connection, as with no network; the specs that need a release
// start their own server against a local fake source. No run calls GitHub.
import { type ChildProcess, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import http, { type ServerResponse } from 'node:http';
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

const topBar = (page: Page) => page.getByRole('banner');
const brandSuffix = (page: Page) => topBar(page).getByText('for Claude', { exact: true });
const versionText = (page: Page) => topBar(page).getByText(`v${installed}`, { exact: true });
const anyVersionText = (page: Page) => topBar(page).getByText(/^v\d+\.\d+\.\d+$/);
const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const notice = (page: Page) => page.getByRole('status', { name: 'Update Available' });
const isInstalledVersionRoute = (url: URL) => url.pathname === '/api/installed-version';

interface FakeSource {
  url: string;
  /** Answers the requests held so far, and every later one at once. */
  release(): void;
  close(): Promise<void>;
}

/** A local stand-in for the GitHub latest release endpoint; with `hold` it answers only after `release()`. */
async function fakeSource(tag: string, hold: boolean): Promise<FakeSource> {
  let held = hold;
  const waiting: ServerResponse[] = [];
  const answer = (response: ServerResponse) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ tag_name: tag, html_url: `http://127.0.0.1:9/release/${tag}` }));
  };
  const server = http.createServer((_request, response) => (held ? waiting.push(response) : answer(response)));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/releases/latest`,
    release: () => {
      held = false;
      for (const response of waiting.splice(0)) answer(response);
    },
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
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

/** The window area at a point, as Chromium builds it for Electron: the last element that declares a value over it wins. */
function regionAt(page: Page, x: number, y: number): Promise<string> {
  return page.evaluate(
    ([px, py]) => {
      let region = 'none';
      for (const element of document.querySelectorAll('*')) {
        const value = getComputedStyle(element).getPropertyValue('-webkit-app-region');
        if (value !== 'drag' && value !== 'no-drag') continue;
        const box = element.getBoundingClientRect();
        if (px >= box.left && px < box.right && py >= box.top && py < box.bottom) region = value;
      }
      return region;
    },
    [x, y] as const,
  );
}

test.describe('the top bar with the e2e server', () => {
  // plan-update_check/REQ-13, REQ-15: the e2e server has no reachable release source
  test('REQ-13, REQ-15: the version shows as "v<installed>" right after "for Claude", with no notice', async ({ page }) => {
    await page.goto('/');
    await expect(list(page)).toBeVisible();
    await expect(versionText(page)).toBeVisible();
    await expect(anyVersionText(page)).toHaveCount(1);
    await expect(notice(page)).toHaveCount(0);

    const suffix = (await brandSuffix(page).boundingBox())!;
    const version = (await versionText(page).boundingBox())!;
    expect(Math.abs(version.x - (suffix.x + suffix.width) - 8)).toBeLessThanOrEqual(1);
    expect(Math.abs(version.y + version.height - (suffix.y + suffix.height))).toBeLessThanOrEqual(1);

    const styleOf = (element: Element) => {
      const style = getComputedStyle(element);
      return { fontFamily: style.fontFamily, fontSize: style.fontSize, color: style.color };
    };
    expect(await versionText(page).evaluate(styleOf)).toEqual(await brandSuffix(page).evaluate(styleOf));
    expect((await versionText(page).evaluate(styleOf)).fontSize).toBe('10px');
  });

  // plan-update_check/REQ-13, spec TopBar: plain text, not a control
  test('REQ-13: the version is plain text, not a control', async ({ page }) => {
    await page.goto('/');
    await expect(versionText(page)).toBeVisible();
    await expect(topBar(page).getByRole('button', { name: `v${installed}` })).toHaveCount(0);
    await expect(topBar(page).getByRole('link', { name: `v${installed}` })).toHaveCount(0);
    const focusable = await versionText(page).evaluate((element) => element.closest('button, a, [tabindex]') !== null);
    expect(focusable).toBe(false);
  });

  // spec TopBar: while the version is null the bar shows no version text and keeps its layout
  test('no version text while the answer is pending, and the bar does not move when it comes', async ({ page }) => {
    let answer!: () => void;
    const held = new Promise<void>((resolve) => (answer = resolve));
    await page.route(isInstalledVersionRoute, async (route) => {
      await held;
      await route.continue();
    });
    await page.goto('/');
    await expect(list(page)).toBeVisible();
    await expect(anyVersionText(page)).toHaveCount(0);
    const newSession = topBar(page).getByRole('button', { name: 'New Session' });
    const before = {
      bar: await topBar(page).boundingBox(),
      suffix: await brandSuffix(page).boundingBox(),
      newSession: await newSession.boundingBox(),
    };
    answer();
    await expect(versionText(page)).toBeVisible();
    expect(await topBar(page).boundingBox()).toEqual(before.bar);
    expect(await brandSuffix(page).boundingBox()).toEqual(before.suffix);
    expect(await newSession.boundingBox()).toEqual(before.newSession);
  });

  // spec TopBar, spec useInstalledVersion: failure gives no version text
  test('no version text and no error when the version request fails', async ({ page }) => {
    await page.route(isInstalledVersionRoute, (route) => route.fulfill({ status: 500, json: { error: 'internal' } }));
    const answered = page.waitForResponse((response) => response.url().endsWith('/api/installed-version'));
    await page.goto('/');
    await answered;
    await expect(list(page)).toBeVisible();
    await expect(brandSuffix(page)).toBeVisible();
    await expect(anyVersionText(page)).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  // plan-update_check/REQ-13, spec TopBar "Desktop window": a fake `window.desktopBridge` makes the page behave as there
  test('REQ-13: in the desktop window the version shows and stays in the drag area', async ({ page }) => {
    await page.addInitScript(() => {
      Object.assign(window, { desktopBridge: { reportOpenSession: () => {}, onOpenSession: () => () => {} } });
    });
    await page.goto('/');
    await expect(versionText(page)).toBeVisible();
    const suffix = (await brandSuffix(page).boundingBox())!;
    const version = (await versionText(page).boundingBox())!;
    expect(Math.abs(version.x - (suffix.x + suffix.width) - 8)).toBeLessThanOrEqual(1);
    const points: [number, number][] = [
      [version.x + version.width / 2, version.y + version.height / 2],
      [version.x + 1, version.y + 1],
      [version.x + version.width - 1, version.y + version.height - 1],
    ];
    for (const [x, y] of points) expect(await regionAt(page, x, y)).toBe('drag');
  });
});

test.describe('the top bar with a release source', () => {
  let home: string;

  test.beforeEach(async () => {
    home = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-installed-'));
  });

  test.afterEach(async () => {
    if (home) await rm(home, { recursive: true, force: true });
  });

  // plan-update_check/REQ-14
  test('REQ-14: the top bar and the notice show the same installed version', async ({ page }) => {
    const source = await fakeSource(`v${next}`, false);
    const app = await launch(source.url, home);
    try {
      await page.goto(app.base);
      await expect(versionText(page)).toBeVisible();
      await expect(notice(page)).toContainText(`Version ${next} is available. You have ${installed}.`);
      const shown = (await anyVersionText(page).textContent())!.slice(1);
      const noticed = /You have (\d+\.\d+\.\d+)\./.exec((await notice(page).textContent())!)![1];
      expect(shown).toBe(noticed);
    } finally {
      await app.stop();
      await source.close();
    }
  });

  // plan-update_check/REQ-15
  test('REQ-15: the version shows before the release check answers, the notice only after', async ({ page }) => {
    const source = await fakeSource(`v${next}`, true);
    const app = await launch(source.url, home);
    try {
      await page.goto(app.base);
      await expect(list(page)).toBeVisible();
      await expect(versionText(page)).toBeVisible({ timeout: 2000 });
      await expect(notice(page)).toHaveCount(0);
      source.release();
      await expect(notice(page)).toContainText(`You have ${installed}.`);
      await expect(versionText(page)).toBeVisible();
    } finally {
      await app.stop();
      await source.close();
    }
  });
});
