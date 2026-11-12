// REQ tests of plan-update_check, batch installed-version, against the real server process.
// A local fake stands in for the GitHub release source: no test calls GitHub.
import { type ChildProcess, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import http, { type ServerResponse } from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { FAKE_CLI, delay, tempDir, waitFor } from './test-support.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const installed = (JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string }).version;
const [major, minor] = installed.split('.').map(Number) as [number, number];
const nextTag = `v${major}.${minor + 1}.0`;

interface FakeSource {
  url: string;
  seen: number;
  /** `hang` keeps every request open until the source closes. */
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
    source.seen += 1;
    if (source.answer === 'hang') {
      open.push(response);
      return;
    }
    const tag = source.answer.tag;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ tag_name: tag, html_url: `http://127.0.0.1/releases/tag/${tag}` }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  const source: FakeSource = {
    url: `http://127.0.0.1:${port}/repos/owner/name/releases/latest`,
    seen: 0,
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
  const dir = await tempDir('ai-client-installed-version-');
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
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${base}/api/health`).catch(() => undefined);
    if (response?.ok) return base;
    await delay(20);
  }
  throw new Error('the server did not answer');
}

const installedVersion = (base: string) => fetch(`${base}/api/installed-version`);

describe('installed version of the server start', () => {
  // plan-update_check/REQ-14: same number as the newer version notice
  it('gives the version of package.json, the same one the release check reports', async () => {
    const source = await fakeSource({ tag: nextTag });
    const base = await startServer(source.url);
    const response = await installedVersion(base);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: installed });
    const newer = (await (await fetch(`${base}/api/newer-version`)).json()) as { status: string; installedVersion?: string };
    expect(newer.status).toBe('newer');
    expect(newer.installedVersion).toBe(installed);
  }, 30_000);

  // plan-update_check/REQ-15: no network, as the refusing port 9 of the test configuration
  it('answers when the release source cannot be reached', async () => {
    const base = await startServer('http://127.0.0.1:9/releases/latest');
    const response = await installedVersion(base);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: installed });
  }, 30_000);

  // plan-update_check/REQ-15: the release check is still running while the version answers
  it('answers at once while the release check waits for the source', async () => {
    const source = await fakeSource('hang');
    const base = await startServer(source.url);
    await waitFor(() => source.seen > 0, 'the start asks the release source', 10_000);
    let newerAnswered = false;
    void fetch(`${base}/api/newer-version`)
      .then(() => (newerAnswered = true))
      .catch(() => undefined);
    const started = Date.now();
    const response = await installedVersion(base);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: installed });
    expect(newerAnswered).toBe(false);
  }, 30_000);

  // spec InstalledVersionRoute: LocalAccessGuard applies as to every route
  it('rejects a request whose Host is not local', async () => {
    const base = await startServer('http://127.0.0.1:9/releases/latest');
    const { port } = new URL(base);
    const status = await new Promise<number>((resolve, reject) => {
      const request = http.get({ host: '127.0.0.1', port, path: '/api/installed-version', headers: { host: 'evil.example' } }, (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      });
      request.once('error', reject);
    });
    expect(status).toBe(403);
  }, 30_000);
});
