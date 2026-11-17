// e2e of plan-release_changelog, batch notice-changelogs: the changelogs in the newer version notice, in the browser page.
// Each group starts its own server, pointed at a local fake release source: no run calls GitHub.
import { type ChildProcess, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Locator, type Page, expect, test } from '@playwright/test';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const fakeClaude = fileURLToPath(new URL('../test-support/fake-claude.mjs', import.meta.url));
const installed = (JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string }).version;
const [major, minor] = installed.split('.').map(Number) as [number, number];
const next = `${major}.${minor + 1}.0`;
const latest = `${major}.${minor + 2}.0`;
const candidate = `${major}.${minor + 3}.0-rc.1`;

const notice = (page: Page) => page.getByRole('status', { name: 'Update Available' });
const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const block = (page: Page, version: string) => notice(page).getByRole('region', { name: `Version ${version}` });
const changelogArea = (page: Page) => notice(page).locator('.update-notice-changelogs');

interface FakeSource {
  url: string;
  page: (name: string) => string;
  close(): Promise<void>;
}

/** The latest release endpoint gives `latestTag`; the release list gives `releases`, or `null` for a 500. */
async function fakeSource(latestTag: string, releases: unknown[] | null): Promise<FakeSource> {
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/releases/latest') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ tag_name: latestTag, html_url: source.page(`release-${latestTag}`) }));
      return;
    }
    if (pathname === '/releases') {
      if (releases === null) {
        response.writeHead(500).end();
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(releases));
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(`<!doctype html><title>Page</title><h1>Page ${pathname}</h1>`);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  const source: FakeSource = {
    url: `http://127.0.0.1:${port}/releases/latest`,
    page: (name) => `http://127.0.0.1:${port}/page/${name}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
  return source;
}

const release = (version: string, body: string | null, extra: Record<string, unknown> = {}) => ({
  tag_name: `v${version}`,
  html_url: `https://github.com/owner/name/releases/tag/v${version}`,
  body,
  draft: false,
  prerelease: false,
  ...extra,
});

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

interface Launch {
  base: string;
  stop(): Promise<void>;
}

/** One launch: a built server with its own empty Claude Code and data folders, and its fake source. */
async function launch(source: FakeSource): Promise<Launch> {
  const home = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-changelog-'));
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
      AI_CLIENT_RELEASE_SOURCE_URL: source.url,
    },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  const stop = async () => {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve));
      server.kill('SIGTERM');
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
      if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
    }
    await source.close();
    await rm(home, { recursive: true, force: true });
  };
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const answer = await fetch(`${base}/api/health`).catch(() => undefined);
    if (answer?.ok) {
      // The changelogs come after the check: wait until the route carries them, or settles without them.
      const routeDeadline = Date.now() + 10_000;
      while (Date.now() < routeDeadline) {
        const body = (await (await fetch(`${base}/api/newer-version`)).json()) as Record<string, unknown>;
        if ('changelogs' in body) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return { base, stop };
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await stop();
  throw new Error('the e2e release server did not start');
}

/** Waits for the enter effect of the element (plan-ui_transitions/REQ-3): its place is measured at rest. */
async function settled(target: Locator): Promise<void> {
  await target.evaluate((el) =>
    Promise.all(
      el
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished),
    ),
  );
}

test.describe('changelogs of the missing versions', () => {
  test.describe.configure({ mode: 'serial' });
  let app: Launch;

  test.beforeAll(async () => {
    const source = await fakeSource(`v${latest}`, [
      release(next, '## Fixes\n\n- the **list** keeps its order\n- see [the guide](https://example.com/guide)'),
      release(candidate, 'candidate notes', { prerelease: true }),
      release(latest, '# Highlights\n\nA *new* look.\n\n* faster start\n* `--flag` option'),
      release(installed, 'installed notes'),
    ]);
    app = await launch(source);
  });

  test.afterAll(async () => {
    await app?.stop();
  });

  test('REQ-7, REQ-8, REQ-9, REQ-16: the notice shows each newer release, newest first, as formatted text', async ({ page }) => {
    await page.goto(app.base);
    await expect(list(page)).toBeVisible();
    await expect(notice(page)).toContainText(`Version ${latest} is available. You have ${installed}.`);
    const newest = block(page, latest);
    const older = block(page, next);
    await expect(newest).toBeVisible();
    await expect(older).toBeVisible();
    const top = async (locator: typeof newest) => (await locator.boundingBox())!.y;
    expect(await top(newest)).toBeLessThan(await top(older));

    await expect(newest.getByRole('heading', { name: 'Highlights' })).toBeVisible();
    await expect(newest.locator('em')).toHaveText('new');
    await expect(newest.getByRole('listitem')).toHaveText(['faster start', '--flag option']);
    await expect(older.getByRole('heading', { name: 'Fixes' })).toBeVisible();
    await expect(older.locator('strong')).toHaveText('list');
    const shown = (await notice(page).innerText()).replace(/\s+/g, ' ');
    expect(shown).not.toMatch(/#|\*|\]\(/);
    expect(shown).not.toContain(candidate);
    expect(shown).not.toContain('candidate notes');
    expect(shown).not.toContain('installed notes');
    await expect(notice(page).getByRole('region', { name: `Version ${installed}` })).toHaveCount(0);
  });

  test('REQ-10, REQ-15: a changelog link opens in a new tab and the page stays', async ({ page }) => {
    await page.goto(app.base);
    const link = block(page, next).getByRole('link', { name: 'the guide' });
    await expect(link).toHaveAttribute('href', 'https://example.com/guide');
    await expect(link).toHaveAttribute('target', '_blank');
    await page.context().route('https://example.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Guide</title>' }),
    );
    const [tab] = await Promise.all([page.context().waitForEvent('page'), link.click()]);
    await tab.waitForLoadState();
    expect(tab.url()).toBe('https://example.com/guide');
    expect(page.url()).toBe(`${app.base}/`);
    await expect(list(page)).toBeVisible();
    await tab.close();
  });
});

test.describe('a release without a description, unsafe markup and a long changelog', () => {
  test.describe.configure({ mode: 'serial' });
  let app: Launch;
  const long = Array.from({ length: 80 }, (_, i) => `- change number ${i + 1}`).join('\n');
  const unsafe = [
    '<script>window.changelogRan = true</script>',
    '',
    '<button onclick="window.changelogRan = true">Press me</button>',
    '',
    '![remote picture](https://example.com/picture.png)',
    '',
    '<img src="https://example.com/raw.png" onerror="window.changelogRan = true">',
    '',
    long,
  ].join('\n');

  test.beforeAll(async () => {
    const source = await fakeSource(`v${latest}`, [release(latest, unsafe), release(next, null)]);
    app = await launch(source);
  });

  test.afterAll(async () => {
    await app?.stop();
  });

  test('REQ-13: a release without a description shows only its version', async ({ page }) => {
    await page.goto(app.base);
    await expect(block(page, next)).toBeVisible();
    expect((await block(page, next).innerText()).trim()).toBe(`Version ${next}`);
  });

  test('REQ-11: tags, buttons and images in a changelog stay text and never run', async ({ page }) => {
    const remote: string[] = [];
    page.on('request', (request) => {
      if (request.url().startsWith('https://example.com/')) remote.push(request.url());
    });
    let dialogs = 0;
    page.on('dialog', async (dialog) => {
      dialogs += 1;
      await dialog.dismiss();
    });
    await page.goto(app.base);
    const newest = block(page, latest);
    await expect(newest).toContainText('<script>window.changelogRan = true</script>');
    await expect(newest).toContainText('<button onclick="window.changelogRan = true">Press me</button>');
    await expect(newest).toContainText('<img src="https://example.com/raw.png" onerror="window.changelogRan = true">');
    await expect(newest.locator('script, button, img, iframe')).toHaveCount(0);
    await expect(notice(page).locator('img')).toHaveCount(0);
    await expect(newest).not.toContainText('remote picture');
    await newest.getByText('Press me').click();
    expect(await page.evaluate(() => (window as unknown as { changelogRan?: boolean }).changelogRan)).toBeUndefined();
    expect(dialogs).toBe(0);
    expect(remote).toEqual([]);
  });

  test('REQ-12: a long changelog scrolls inside the notice, and the title and both actions stay visible and work', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 420 });
    await page.goto(app.base);
    await expect(block(page, latest)).toBeVisible();
    await settled(notice(page));
    const box = (await notice(page).boundingBox())!;
    const bar = (await page.getByRole('banner').boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(420 - 12 + 1);
    expect(box.height).toBeLessThanOrEqual(420 - (bar.y + bar.height) - 24 + 1);
    expect(box.width).toBeLessThanOrEqual(320);

    const area = changelogArea(page);
    const sizes = await area.evaluate((element) => ({ scroll: element.scrollHeight, client: element.clientHeight }));
    expect(sizes.scroll).toBeGreaterThan(sizes.client);
    const inView = async (name: 'title' | 'link' | 'close') => {
      const locator =
        name === 'title'
          ? notice(page).getByText('Update Available', { exact: true })
          : name === 'link'
            ? notice(page).getByRole('link', { name: 'View Release' })
            : notice(page).getByRole('button', { name: 'Close Update Notice' });
      const at = (await locator.boundingBox())!;
      return at.y >= box.y - 1 && at.y + at.height <= box.y + box.height + 1;
    };
    for (const name of ['title', 'link', 'close'] as const) expect(await inView(name)).toBe(true);

    await area.hover();
    await page.mouse.wheel(0, 5000);
    await expect.poll(() => area.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect(notice(page).getByText('change number 80')).toBeInViewport();
    for (const name of ['title', 'link', 'close'] as const) expect(await inView(name)).toBe(true);
    expect((await notice(page).boundingBox())!.y).toBeCloseTo(box.y, 0);

    const link = notice(page).getByRole('link', { name: 'View Release' });
    const [tab] = await Promise.all([page.context().waitForEvent('page'), link.click()]);
    await tab.close();
    await notice(page).getByRole('button', { name: 'Close Update Notice' }).click();
    await expect(notice(page)).toHaveCount(0);
  });
});

test.describe('the release list cannot be read', () => {
  // REQ-14, REQ-16: the latest release is read, the list answers 500
  test('REQ-14, REQ-16: the notice looks as before, with no changelog and no error', async ({ page }) => {
    const source = await fakeSource(`v${latest}`, null);
    const app = await launch(source);
    try {
      await page.goto(app.base);
      await expect(list(page)).toBeVisible();
      await expect(notice(page)).toContainText(`Version ${latest} is available. You have ${installed}.`);
      await expect(notice(page).getByRole('link', { name: 'View Release' })).toBeVisible();
      await expect(notice(page).getByRole('button', { name: 'Close Update Notice' })).toBeVisible();
      await expect(changelogArea(page)).toHaveCount(0);
      await expect(notice(page).getByRole('region')).toHaveCount(0);
      await expect(page.getByRole('alert')).toHaveCount(0);
    } finally {
      await app.stop();
    }
  });
});
