// REQ tests of plan-settings_dialog against the real server process: a local fake stands in for the GitHub release source.
import { type ChildProcess, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import http from 'node:http';
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
  latestCalls: number;
  tag: string;
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

async function fakeSource(tag: string): Promise<FakeSource> {
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    response.writeHead(200, { 'content-type': 'application/json' });
    if (pathname.endsWith('/releases/latest')) {
      source.latestCalls += 1;
      response.end(JSON.stringify({ tag_name: source.tag, html_url: `https://github.com/owner/name/releases/tag/${source.tag}` }));
      return;
    }
    response.end('[]');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  const source: FakeSource = {
    url: `http://127.0.0.1:${port}/repos/owner/name/releases/latest`,
    latestCalls: 0,
    tag,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
  sources.push(source);
  return source;
}

async function startServer(sourceUrl: string): Promise<string> {
  const port = await freePort();
  const dir = await tempDir('ai-client-update-check-');
  dirs.push(dir);
  children.push(
    // Node runs the server itself, not the tsx wrapper: the kill of afterEach then reaches the server.
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
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${base}/api/health`).catch(() => undefined);
    if (response?.ok) return base;
    await delay(20);
  }
  throw new Error('the server did not answer');
}

const updateCheck = (base: string) => fetch(`${base}/api/update-check`, { method: 'POST' });

describe('update check of the running server', () => {
  // plan-settings_dialog/REQ-45, REQ-47, REQ-52: the user's check asks the source again; the launch result stays as it was
  it('runs a new check on each request and leaves the launch result unchanged', async () => {
    const source = await fakeSource(nextTag);
    const base = await startServer(source.url);
    await waitFor(() => source.latestCalls === 1, 'the start asks the release source', 10_000);
    const launch = await (await fetch(`${base}/api/newer-version`)).json();
    expect(launch).toMatchObject({ status: 'newer', newerVersion: nextTag.slice(1) });

    source.tag = `v${installed}`;
    const response = await updateCheck(base);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'current', installedVersion: installed });
    expect(source.latestCalls).toBe(2);

    source.tag = nextTag;
    expect(await (await updateCheck(base)).json()).toMatchObject({ status: 'newer', installedVersion: installed, newerVersion: nextTag.slice(1) });
    expect(source.latestCalls).toBe(3);
    expect(await (await fetch(`${base}/api/newer-version`)).json()).toEqual(launch);
    await delay(200);
    expect(source.latestCalls).toBe(3);
  }, 30_000);

  // plan-settings_dialog/REQ-50, REQ-52: an unreachable source is silent at launch and a failure for the user's check
  it('answers failed to the user while the launch result stays none when the source refuses', async () => {
    const base = await startServer(`http://127.0.0.1:${await freePort()}/releases/latest`);
    const launch = await fetch(`${base}/api/newer-version`);
    expect(launch.status).toBe(200);
    expect(await launch.json()).toEqual({ status: 'none' });
    const response = await updateCheck(base);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'failed' });
  }, 30_000);

  // spec UpdateCheckRoute: LocalAccessGuard applies, so another site cannot start a check
  it('refuses a request from another origin with 403 and asks nothing of the source', async () => {
    const source = await fakeSource(nextTag);
    const base = await startServer(source.url);
    await waitFor(() => source.latestCalls === 1, 'the start asks the release source', 10_000);
    const response = await fetch(`${base}/api/update-check`, { method: 'POST', headers: { origin: 'https://evil.example' } });
    expect(response.status).toBe(403);
    await delay(200);
    expect(source.latestCalls).toBe(1);
  }, 30_000);
});
