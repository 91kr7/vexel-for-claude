// REQ tests of plan-release_changelog against the real server process: a local fake stands in for the GitHub release source.
import { type ChildProcess, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import http, { type IncomingHttpHeaders, type ServerResponse } from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { FAKE_CLI, delay, tempDir, waitFor } from './test-support.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const installed = (JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string }).version;
const [major, minor] = installed.split('.').map(Number) as [number, number];
const next = `${major}.${minor + 1}.0`;
const later = `${major}.${minor + 2}.0`;
const latest = `${major}.${minor + 3}.0`;

interface SeenRequest {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: string;
}

type ListAnswer = unknown[] | { status: number } | 'hang';

interface FakeSource {
  url: string;
  seen: SeenRequest[];
  list: ListAnswer;
  close(): Promise<void>;
}

const children: ChildProcess[] = [];
const sources: FakeSource[] = [];
const dirs: string[] = [];

afterEach(async () => {
  for (const child of children.splice(0)) child.kill('SIGKILL');
  for (const source of sources.splice(0)) await source.close();
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
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

const release = (version: string, body: unknown, extra: Record<string, unknown> = {}) => ({
  tag_name: `v${version}`,
  html_url: `https://github.com/owner/name/releases/tag/v${version}`,
  body,
  draft: false,
  prerelease: false,
  ...extra,
});

/** The latest release endpoint answers `latestTag`; the release list answers `list`. */
async function fakeSource(latestTag: string, list: ListAnswer): Promise<FakeSource> {
  const open: ServerResponse[] = [];
  const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      source.seen.push({ method: request.method ?? '', url: request.url ?? '', headers: request.headers, body });
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      if (pathname === '/repos/owner/name/releases/latest') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ tag_name: latestTag, html_url: `https://github.com/owner/name/releases/tag/${latestTag}` }));
        return;
      }
      if (pathname !== '/repos/owner/name/releases') {
        response.writeHead(404).end();
        return;
      }
      if (source.list === 'hang') {
        open.push(response);
        return;
      }
      if (!Array.isArray(source.list)) {
        response.writeHead(source.list.status).end();
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(source.list));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  const source: FakeSource = {
    url: `http://127.0.0.1:${port}/repos/owner/name/releases/latest`,
    seen: [],
    list,
    close: () =>
      new Promise((resolve) => {
        for (const response of open) response.destroy();
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
  sources.push(source);
  return source;
}

const listRequests = (source: FakeSource) => source.seen.filter((request) => request.url.startsWith('/repos/owner/name/releases?'));

async function startServer(sourceUrl: string): Promise<string> {
  const port = await freePort();
  const dir = await tempDir('ai-client-changelog-');
  dirs.push(dir);
  children.push(
    // Node runs the server itself, not the tsx wrapper: the SIGKILL of the cleanup then reaches the server.
    spawn(process.execPath, ['--import', 'tsx', 'src/server/main.ts'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        PORT: String(port),
        AI_CLIENT_CLAUDE_CLI: FAKE_CLI,
        CLAUDE_CONFIG_DIR: path.join(dir, 'claude'),
        AI_CLIENT_DATA_DIR: path.join(dir, 'data'),
        AI_CLIENT_RELEASE_SOURCE_URL: sourceUrl,
      },
      stdio: 'ignore',
    }),
  );
  return `http://127.0.0.1:${port}`;
}

async function waitHealthy(base: string, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(`${base}/api/health`).catch(() => undefined);
    if (response?.ok) return;
    await delay(20);
  }
  throw new Error('the server did not answer');
}

const newerVersion = async (base: string) => (await fetch(`${base}/api/newer-version`)).json() as Promise<Record<string, unknown>>;

/** Polls the route until its answer is `newer`, then lets the changelog step settle. */
async function settledNewer(base: string, source: FakeSource): Promise<Record<string, unknown>> {
  await waitFor(() => listRequests(source).length > 0, 'the start asks the release list', 10_000);
  const deadline = Date.now() + 10_000;
  let body = await newerVersion(base);
  while (Date.now() < deadline && !('changelogs' in body)) {
    await delay(50);
    body = await newerVersion(base);
  }
  return body;
}

const checkResult = {
  status: 'newer',
  installedVersion: installed,
  newerVersion: latest,
  releaseUrl: `https://github.com/owner/name/releases/tag/v${latest}`,
};

describe('release changelogs at server start', () => {
  // plan-release_changelog/REQ-7, REQ-8, REQ-13: newer published releases, newest first, a release with no description has no text
  it('adds the changelogs of the newer published releases, newest first, to the route answer', async () => {
    const source = await fakeSource(`v${latest}`, [
      release(next, 'notes of next'),
      release(`${major}.${minor + 4}.0`, 'draft notes', { draft: true }),
      release(`${major}.${minor + 4}.0-rc.1`, 'rc notes', { prerelease: true }),
      release(latest, '## Latest\n\n- item'),
      release(later, ''),
      release(installed, 'installed notes'),
    ]);
    const base = await startServer(source.url);
    await waitHealthy(base);
    const body = await settledNewer(base, source);
    expect(body).toEqual({
      ...checkResult,
      changelogs: [{ version: latest, text: '## Latest\n\n- item' }, { version: later }, { version: next, text: 'notes of next' }],
    });
    expect(JSON.stringify(body)).not.toContain('rc notes');
    expect(JSON.stringify(body)).not.toContain('draft notes');
  }, 30_000);

  // plan-release_changelog/REQ-17: the printed list request has no credentials and no user, session or folder data
  it('reads the list with a plain GET, no credentials and no user data', async () => {
    const source = await fakeSource(`v${latest}`, [release(latest, 'x')]);
    const base = await startServer(source.url);
    await waitHealthy(base);
    await settledNewer(base, source);
    const requests = listRequests(source);
    expect(requests.length).toBeGreaterThan(0);
    const user = process.env.USER ?? process.env.LOGNAME;
    for (const request of requests) {
      expect(request.method).toBe('GET');
      expect(request.body).toBe('');
      expect(request.headers.authorization).toBeUndefined();
      expect(request.headers.cookie).toBeUndefined();
      expect(request.headers['proxy-authorization']).toBeUndefined();
      const printed = JSON.stringify(request);
      if (user) expect(printed).not.toContain(user);
      expect(printed).not.toContain(repoRoot);
      expect(printed).not.toContain('ai-client-changelog-');
    }
  }, 30_000);

  // plan-release_changelog/REQ-14: the list cannot be read -> the answer of the check alone, no error
  it.each<[string, ListAnswer]>([
    ['a 500', { status: 500 }],
    ['a 404', { status: 404 }],
  ])('keeps the check result without changelogs when the list answers %s', async (_name, list) => {
    const source = await fakeSource(`v${latest}`, list);
    const base = await startServer(source.url);
    await waitHealthy(base);
    await waitFor(() => listRequests(source).length > 0, 'the start asks the release list', 10_000);
    await delay(300);
    const response = await fetch(`${base}/api/newer-version`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(checkResult);
  }, 30_000);

  // plan-release_changelog/REQ-16: the listen and the session list do not wait for the release list
  it('serves the session list while the release list has not answered', async () => {
    const source = await fakeSource(`v${latest}`, 'hang');
    const base = await startServer(source.url);
    await waitHealthy(base);
    await waitFor(() => listRequests(source).length > 0, 'the start asks the release list', 10_000);
    const sessions = await fetch(`${base}/api/sessions`);
    expect(sessions.status).toBe(200);
  }, 30_000);

  // plan-release_changelog/REQ-7: changelogs only after a newer check, once per start
  it('reads the list once per start, and not at all when no release is newer', async () => {
    const source = await fakeSource(`v${latest}`, [release(latest, 'x')]);
    const base = await startServer(source.url);
    await waitHealthy(base);
    await settledNewer(base, source);
    await Promise.all([newerVersion(base), newerVersion(base), newerVersion(base)]);
    await delay(300);
    expect(listRequests(source)).toHaveLength(1);

    const none = await fakeSource(`v${installed}`, [release(installed, 'x')]);
    const other = await startServer(none.url);
    await waitHealthy(other);
    await waitFor(() => none.seen.length > 0, 'the start asks the release source', 10_000);
    await delay(500);
    expect(await newerVersion(other)).toEqual({ status: 'none' });
    expect(listRequests(none)).toHaveLength(0);
  }, 40_000);
});
