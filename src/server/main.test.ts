// REQ tests of plan-claude_sessions_client, batch session-interaction, against the real server process.
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FAKE_CLI, type WsClient, connectWs, delay, hex, tempDir, waitFor } from './test-support.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
let server: ChildProcess;
let port: number;
let base: string;
let projectsRoot: string;
let project: string;
const clients: WsClient[] = [];

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

async function startSession(folder = project): Promise<string> {
  const response = await fetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: folder }),
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

async function attach(id: string): Promise<WsClient> {
  const client = connectWs(`ws://127.0.0.1:${port}/api/sessions/${id}/attach`, { Origin: base });
  clients.push(client);
  await waitFor(() => client.text().includes('READY'), 'fake CLI banner');
  return client;
}

const input = (client: WsClient, data: string) => client.send({ type: 'input', data });
const receivedInput = (client: WsClient) => [...client.text().matchAll(/IN:([0-9a-f]+)/g)].map((m) => m[1]).join('');

beforeAll(async () => {
  projectsRoot = await tempDir('ai-client-projects-');
  project = path.join(projectsRoot, 'project-a');
  await mkdir(project);
  port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(path.join(repoRoot, 'node_modules/.bin/tsx'), ['src/server/main.ts'], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(port), AI_CLIENT_CLAUDE_CLI: FAKE_CLI, FAKE_CLI_MARK: 'server-env' },
    stdio: 'ignore',
  });
  let healthy = false;
  const deadline = Date.now() + 20_000;
  while (!healthy && Date.now() < deadline) {
    healthy = await fetch(`${base}/api/health`).then((r) => r.ok, () => false);
    if (!healthy) await delay(200);
  }
  if (!healthy) throw new Error('server did not start');
}, 30_000);

afterAll(async () => {
  for (const client of clients) client.socket.terminate();
  server.kill('SIGTERM');
  await delay(200);
});

describe('plan-claude_sessions_client/REQ-1 start a session in a chosen folder', () => {
  it('the folder can be browsed, and a session starts in it and shows its terminal', async () => {
    const listing = await fetch(`${base}/api/folders?path=${encodeURIComponent(projectsRoot)}`);
    expect(listing.status).toBe(200);
    expect(((await listing.json()) as { folders: string[] }).folders).toEqual(['project-a']);
    const client = await attach(await startSession());
    expect(client.text()).toContain('FAKE-CLI');
    expect(client.text()).toContain(`CWD:${project}`);
  });

  it('a folder that does not exist is rejected', async () => {
    const response = await fetch(`${base}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: path.join(projectsRoot, 'missing') }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'folder_not_found' });
  });
});

describe('plan-claude_sessions_client/REQ-2 send a message', () => {
  it('the message reaches the CLI as typed', async () => {
    const client = await attach(await startSession());
    input(client, 'crea un file prova.txt\r');
    await waitFor(() => client.text().includes('LINE:crea un file prova.txt'), 'message');
    expect(receivedInput(client)).toBe(hex('crea un file prova.txt\r'));
  });
});

describe('plan-claude_sessions_client/REQ-3 slash commands', () => {
  it('a slash command reaches the CLI unchanged', async () => {
    const client = await attach(await startSession());
    input(client, '/help\r');
    await waitFor(() => client.text().includes('LINE:/help'), 'slash command');
    expect(receivedInput(client)).toBe(hex('/help\r'));
  });
});

describe('plan-claude_sessions_client/REQ-4 progressive response', () => {
  it('each part of the output arrives while the CLI produces it', async () => {
    const client = await attach(await startSession());
    input(client, 'STREAM\r');
    await waitFor(() => client.text().includes('CHUNK1'), 'first chunk');
    const firstAt = Date.now();
    expect(client.text()).not.toContain('CHUNK5');
    await waitFor(() => client.text().includes('CHUNK5'), 'last chunk');
    expect(Date.now() - firstAt).toBeGreaterThan(800);
  });
});

describe('plan-claude_sessions_client/REQ-5 answer a request from the page', () => {
  it('the user answer reaches the waiting CLI', async () => {
    const client = await attach(await startSession());
    input(client, 'ASK\r');
    await waitFor(() => client.text().includes('PERMISSION?(y/n)'), 'request');
    input(client, 'y');
    await waitFor(() => client.text().includes('ANSWER:y'), 'answer');
  });
});

describe('plan-claude_sessions_client/REQ-6 the client never answers on behalf of the user', () => {
  it('a pending request stays pending while viewers attach, resize and leave', async () => {
    const id = await startSession();
    const client = await attach(id);
    input(client, 'ASK\r');
    await waitFor(() => client.text().includes('PERMISSION?(y/n)'), 'request');
    const sent = receivedInput(client);
    client.send({ type: 'resize', cols: 90, rows: 25 });
    const other = await attach(id);
    other.socket.close();
    await other.closed;
    await delay(1500);
    expect(client.text()).not.toContain('ANSWER:');
    expect(receivedInput(client)).toBe(sent);
  });
});

describe('plan-claude_sessions_client/REQ-7 project permission rules and settings apply', () => {
  it('the CLI runs in the project folder with no arguments and the server environment', async () => {
    const client = await attach(await startSession());
    expect(client.text()).toContain(`CWD:${project}`);
    expect(client.text()).toContain('ARGS:[]');
    expect(client.text()).toContain('MARK:server-env');
  });
});

describe('plan-claude_sessions_client/REQ-8 interrupt the turn', () => {
  it('Esc reaches the CLI', async () => {
    const client = await attach(await startSession());
    input(client, '\x1b');
    await waitFor(() => receivedInput(client) !== '', 'Esc');
    expect(receivedInput(client)).toBe('1b');
  });
});

describe('plan-claude_sessions_client/REQ-9 reachable only from the local machine', () => {
  const externalAddress = Object.values(os.networkInterfaces())
    .flat()
    .find((info) => info?.family === 'IPv4' && !info.internal)?.address;

  it('answers on 127.0.0.1', async () => {
    const response = await fetch(`${base}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it.skipIf(externalAddress === undefined)('does not accept connections on a network address', async () => {
    const error = await new Promise<NodeJS.ErrnoException | null>((resolve) => {
      const socket = net.connect(port, externalAddress ?? '');
      socket.once('connect', () => {
        socket.destroy();
        resolve(null);
      });
      socket.once('error', resolve);
    });
    expect(error?.code).toBe('ECONNREFUSED');
  });

  it('rejects HTTP requests whose Host is not local, the page included', async () => {
    for (const url of ['/api/health', '/', '/api/folders']) {
      const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const socket = net.connect(port, '127.0.0.1', () => {
          socket.write(`GET ${url} HTTP/1.1\r\nHost: 192.168.1.67:${port}\r\nConnection: close\r\n\r\n`);
        });
        let raw = '';
        socket.on('data', (chunk) => (raw += chunk.toString()));
        socket.on('end', () => {
          const [head = '', body = ''] = raw.split('\r\n\r\n');
          resolve({ status: Number(head.split(' ')[1]), body });
        });
        socket.on('error', reject);
      });
      expect(response.status, url).toBe(403);
      expect(JSON.parse(response.body), url).toEqual({ error: 'forbidden' });
    }
  });

  it('rejects requests from a page of another origin', async () => {
    const response = await fetch(`${base}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://evil.example' },
      body: JSON.stringify({ path: project }),
    });
    expect(response.status).toBe(403);
  });

  it('refuses a WebSocket attach from another origin', async () => {
    const id = await startSession();
    const status = await new Promise<number | 'opened'>((resolve) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/api/sessions/${id}/attach`, {
        headers: { Origin: 'http://evil.example' },
      });
      socket.on('open', () => {
        socket.terminate();
        resolve('opened');
      });
      socket.on('unexpected-response', (request, response) => {
        resolve(response.statusCode ?? 0);
        response.destroy();
        request.destroy();
      });
      socket.on('error', () => {});
    });
    expect(status).toBe(403);
  });
});

describe('plan-claude_sessions_client/REQ-10 resume from the terminal', () => {
  it('the CLI keeps its standard session handling: no arguments, closing the page does not stop it, /exit ends it', async () => {
    const id = await startSession();
    const first = await attach(id);
    expect(first.text()).toContain('ARGS:[]');
    first.socket.close();
    await first.closed;
    await delay(300);
    const second = await attach(id);
    input(second, 'hello\r');
    await waitFor(() => second.text().includes('LINE:hello'), 'session still running');
    input(second, '/exit\r');
    expect(await second.closed).toBe(1000);
  });
});
