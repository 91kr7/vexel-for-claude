// REQ tests of plan-update_check against the real server process: a local fake stands in for the GitHub release source.
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
const nextTag = `v${major}.${minor + 1}.0`;
const laterTag = `v${major}.${minor + 2}.0`;

interface SeenRequest {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: string;
}

interface FakeSource {
  url: string;
  seen: SeenRequest[];
  /** What the next requests get; `hang` keeps them open. */
  answer: { tag: string } | 'hang';
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

async function fakeSource(answer: FakeSource['answer']): Promise<FakeSource> {
  const open: ServerResponse[] = [];
  const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      source.seen.push({ method: request.method ?? '', url: request.url ?? '', headers: request.headers, body });
      if (source.answer === 'hang') {
        open.push(response);
        return;
      }
      const tag = source.answer.tag;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ tag_name: tag, html_url: `${source.url.replace(/\/releases\/latest$/, '')}/releases/tag/${tag}` }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  const source: FakeSource = {
    url: `http://127.0.0.1:${port}/repos/owner/name/releases/latest`,
    seen: [],
    answer,
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

async function startServer(sourceUrl: string): Promise<string> {
  const port = await freePort();
  const dir = await tempDir('ai-client-release-');
  dirs.push(dir);
  children.push(
    spawn(path.join(repoRoot, 'node_modules/.bin/tsx'), ['src/server/main.ts'], {
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

/** Polls the health route until the server answers. */
async function waitHealthy(base: string, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(`${base}/api/health`).catch(() => undefined);
    if (response?.ok) return;
    await delay(20);
  }
  throw new Error('the server did not answer');
}

const newerVersion = async (base: string) => (await fetch(`${base}/api/newer-version`)).json();

describe('release check at server start', () => {
  // plan-update_check/REQ-1, REQ-4, REQ-5: the start asks the source by itself; the route gives the installed and the newer version
  it('asks the source once at start, with no page request, and the route gives the result', async () => {
    const source = await fakeSource({ tag: nextTag });
    const base = await startServer(source.url);
    await waitHealthy(base);
    await waitFor(() => source.seen.length > 0, 'the start asks the release source', 10_000);
    const body = await newerVersion(base);
    expect(body).toEqual({
      status: 'newer',
      installedVersion: installed,
      newerVersion: nextTag.slice(1),
      releaseUrl: `${source.url.replace(/\/releases\/latest$/, '')}/releases/tag/${nextTag}`,
    });
    expect(source.seen).toHaveLength(1);
  }, 30_000);

  // plan-update_check/REQ-2: reloads and new tabs of the same start read the same result; the source is asked once
  it('runs the check once per start, whatever the source answers later', async () => {
    const source = await fakeSource({ tag: nextTag });
    const base = await startServer(source.url);
    await waitHealthy(base);
    await waitFor(() => source.seen.length > 0, 'the start asks the release source', 10_000);
    const first = await newerVersion(base);
    source.answer = { tag: laterTag };
    const again = await Promise.all([newerVersion(base), newerVersion(base), newerVersion(base)]);
    for (const body of again) expect(body).toEqual(first);
    expect(first).toMatchObject({ newerVersion: nextTag.slice(1) });
    await delay(300);
    expect(source.seen).toHaveLength(1);
  }, 30_000);

  // plan-update_check/REQ-12: the printed request has no credentials and no user, session or folder data
  it('sends a plain GET with no credentials and no user data', async () => {
    const source = await fakeSource({ tag: nextTag });
    const base = await startServer(source.url);
    await waitHealthy(base);
    await waitFor(() => source.seen.length > 0, 'the start asks the release source', 10_000);
    const [request] = source.seen;
    expect(request!.method).toBe('GET');
    expect(request!.url).toBe('/repos/owner/name/releases/latest');
    expect(request!.body).toBe('');
    expect(request!.headers.authorization).toBeUndefined();
    expect(request!.headers.cookie).toBeUndefined();
    expect(request!.headers['proxy-authorization']).toBeUndefined();
    const user = process.env.USER ?? process.env.LOGNAME;
    const printed = JSON.stringify(request);
    if (user) expect(printed).not.toContain(user);
    expect(printed).not.toContain(repoRoot);
    expect(printed).not.toContain('ai-client-release-');
  }, 30_000);

  // plan-update_check/REQ-11: the server listens and serves while the source has not answered yet
  it('does not wait for the source before it listens', async () => {
    const source = await fakeSource('hang');
    const base = await startServer(source.url);
    await waitHealthy(base);
    await waitFor(() => source.seen.length > 0, 'the start asks the release source', 10_000);
    const health = await fetch(`${base}/api/health`);
    expect(health.ok).toBe(true);
    const sessions = await fetch(`${base}/api/sessions`);
    expect(sessions.status).toBe(200);
  }, 30_000);

  // plan-update_check/REQ-9: an unreachable source gives no newer version and no error
  it('gives none when the source refuses the connection', async () => {
    const base = await startServer(`http://127.0.0.1:${await freePort()}/releases/latest`);
    await waitHealthy(base);
    const response = await fetch(`${base}/api/newer-version`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'none' });
  }, 30_000);
});
