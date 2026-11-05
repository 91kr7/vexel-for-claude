// REQ tests of plan-claude_sessions_client against the real server process.
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
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
const settingsArgs = (client: WsClient) => JSON.parse(client.text().match(/ARGS:(\[[^\]]*\])/)?.[1] ?? 'null') as string[] | null;

interface SessionSummary {
  id: string;
  folder: string;
  label: string;
  state: 'working' | 'needs_input' | 'idle' | 'ended';
  lastActivity: string;
}

async function listSessions(): Promise<SessionSummary[]> {
  const response = await fetch(`${base}/api/sessions`);
  expect(response.status).toBe(200);
  return (await response.json()) as SessionSummary[];
}

async function summaryOf(id: string): Promise<SessionSummary | undefined> {
  return (await listSessions()).find((session) => session.id === id);
}

async function waitForState(id: string, state: SessionSummary['state']): Promise<void> {
  const deadline = Date.now() + 8000;
  let last: SessionSummary | undefined;
  while (Date.now() < deadline) {
    last = await summaryOf(id);
    if (last?.state === state) return;
    await delay(50);
  }
  throw new Error(`session ${id} is ${last?.state}, expected ${state}`);
}

const postHookEvent = (id: string, body: string) =>
  fetch(`${base}/api/sessions/${id}/hook-events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
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
  it('the CLI runs in the project folder with only a hooks settings file, and the server environment', async () => {
    const client = await attach(await startSession());
    expect(client.text()).toContain(`CWD:${project}`);
    const args = settingsArgs(client);
    expect(args?.[0]).toBe('--settings');
    expect(args).toHaveLength(2);
    const settingsFile = args?.[1] ?? '';
    expect(path.dirname(path.dirname(settingsFile))).toBe(os.tmpdir());
    expect(settingsFile).toMatch(/\/ai-client-hooks-[^/]+\/hook-settings\.json$/);
    expect(Object.keys(JSON.parse(await readFile(settingsFile, 'utf8')) as object)).toEqual(['hooks']);
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
    for (const url of ['/api/health', '/', '/api/folders', '/api/sessions']) {
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

  it('rejects a hook event posted from a page of another origin', async () => {
    const id = await startSession();
    const response = await fetch(`${base}/api/sessions/${id}/hook-events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://evil.example' },
      body: JSON.stringify({ hook_event_name: 'PermissionRequest' }),
    });
    expect(response.status).toBe(403);
    expect((await summaryOf(id))?.state).toBe('idle');
  });

  it('refuses the session events WebSocket from another origin', async () => {
    expect(await foreignWebSocketStatus('/api/sessions/events')).toBe(403);
  });

  it('refuses a WebSocket attach from another origin', async () => {
    const id = await startSession();
    expect(await foreignWebSocketStatus(`/api/sessions/${id}/attach`)).toBe(403);
  });
});

function foreignWebSocketStatus(route: string): Promise<number | 'opened'> {
  return new Promise((resolve) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}${route}`, { headers: { Origin: 'http://evil.example' } });
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
}

describe('plan-claude_sessions_client/REQ-10 resume from the terminal', () => {
  it('the CLI keeps its standard session handling: only the hooks settings, closing the page does not stop it, /exit ends it', async () => {
    const id = await startSession();
    const first = await attach(id);
    expect(settingsArgs(first)?.[0]).toBe('--settings');
    expect(settingsArgs(first)).toHaveLength(2);
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

describe('plan-claude_sessions_client/REQ-11 every hosted session is listed', () => {
  it('the list holds every started session', async () => {
    const ids = [await startSession(), await startSession()];
    const listed = (await listSessions()).map((session) => session.id);
    expect(listed).toEqual(expect.arrayContaining(ids));
  });
});

describe('plan-claude_sessions_client/REQ-12 folder, label, state and last activity of each entry', () => {
  it('a new session shows its folder, the folder name as label, idle and a recent last activity', async () => {
    const before = Date.now();
    const id = await startSession();
    const entry = await summaryOf(id);
    expect(entry).toMatchObject({ id, folder: project, label: 'project-a', state: 'idle' });
    expect(entry?.lastActivity).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
    expect(Date.parse(entry?.lastActivity ?? '')).toBeGreaterThanOrEqual(before - 1000);
  });

  it('typing in the session moves the last activity forward', async () => {
    const id = await startSession();
    const client = await attach(id);
    const first = (await summaryOf(id))?.lastActivity ?? '';
    await delay(50);
    input(client, 'x');
    await waitFor(() => client.text().includes('IN:78'), 'key echo');
    const second = (await summaryOf(id))?.lastActivity ?? '';
    expect(Date.parse(second)).toBeGreaterThan(Date.parse(first));
  });
});

describe('plan-claude_sessions_client/REQ-13 the label is the start of the first message', () => {
  it('the first message becomes the label, the later ones do not', async () => {
    const id = await startSession();
    const client = await attach(id);
    input(client, 'Prepara le note di rilascio\r');
    await waitFor(() => client.text().includes('LINE:Prepara le note di rilascio'), 'first message');
    input(client, 'Secondo messaggio\r');
    await waitFor(() => client.text().includes('LINE:Secondo messaggio'), 'second message');
    expect((await summaryOf(id))?.label).toBe('Prepara le note di rilascio');
  });
});

describe('plan-claude_sessions_client/REQ-14 state of a session from the CLI hooks', () => {
  it('working while Claude produces a turn, idle when the turn ends', async () => {
    const id = await startSession();
    const client = await attach(id);
    expect((await summaryOf(id))?.state).toBe('idle');
    input(client, 'TURN\r');
    await waitForState(id, 'working');
    await waitFor(() => client.text().includes('TURN-DONE'), 'end of turn', 5000);
    await waitForState(id, 'idle');
  });

  it('needs input on a permission request, working again once answered and on with the tools', async () => {
    const id = await startSession();
    const client = await attach(id);
    input(client, 'PERM\r');
    await waitForState(id, 'needs_input');
    input(client, 'y');
    await waitFor(() => client.text().includes('ANSWER:y'), 'answer');
    await waitForState(id, 'idle');
    input(client, 'HOOK PostToolUse tool_name=Bash\r');
    await waitForState(id, 'working');
  });

  it('needs input on a question to the user, on a permission prompt and on an elicitation dialog', async () => {
    const id = await startSession();
    const client = await attach(id);
    for (const hook of [
      'HOOK PreToolUse tool_name=AskUserQuestion',
      'HOOK Notification notification_type=permission_prompt',
      'HOOK Notification notification_type=elicitation_dialog',
    ]) {
      input(client, 'HOOK Stop\r');
      await waitForState(id, 'idle');
      input(client, `${hook}\r`);
      await waitForState(id, 'needs_input');
    }
  });

  it('a turn left working without Stop is corrected to idle by the idle prompt', async () => {
    const id = await startSession();
    const client = await attach(id);
    input(client, 'HOOK PreToolUse tool_name=Bash\r');
    await waitForState(id, 'working');
    input(client, 'HOOK Notification notification_type=idle_prompt\r');
    await waitForState(id, 'idle');
  });

  it('other notifications leave the state as it is', async () => {
    const id = await startSession();
    const client = await attach(id);
    input(client, 'HOOK PermissionRequest tool_name=Bash\r');
    await waitForState(id, 'needs_input');
    input(client, 'HOOK Notification notification_type=auth_success\r');
    await waitFor(() => client.text().includes('LINE:HOOK Notification'), 'notification line');
    await delay(500);
    expect((await summaryOf(id))?.state).toBe('needs_input');
  });

  for (const [key, data] of [
    ['Esc', '\x1b'],
    ['Ctrl+C', '\x03'],
  ] as const) {
    it(`${key} interrupts a working turn: idle`, async () => {
      const id = await startSession();
      const client = await attach(id);
      input(client, 'WORK\r');
      await waitForState(id, 'working');
      input(client, data);
      await waitForState(id, 'idle');
    });
  }

  it('an arrow key while Claude waits for an answer is not an interrupt', async () => {
    const id = await startSession();
    const client = await attach(id);
    input(client, 'HOOK PermissionRequest tool_name=Bash\r');
    await waitForState(id, 'needs_input');
    input(client, '\x1b[B');
    await waitFor(() => client.text().includes('IN:1b5b42'), 'arrow echo');
    expect((await summaryOf(id))?.state).toBe('needs_input');
  });

  it('ended when the session stops, and it stays in the list', async () => {
    const id = await startSession();
    const client = await attach(id);
    input(client, '/exit\r');
    await client.closed;
    await waitForState(id, 'ended');
    await delay(300);
    expect((await summaryOf(id))?.state).toBe('ended');
  });

  it('the hook route accepts a hook event, and rejects an unknown session or an invalid event', async () => {
    const id = await startSession();
    const accepted = await postHookEvent(id, JSON.stringify({ hook_event_name: 'PermissionRequest', tool_name: 'Bash' }));
    expect(accepted.status).toBe(204);
    expect((await summaryOf(id))?.state).toBe('needs_input');
    const unknown = await postHookEvent('no-such-session', JSON.stringify({ hook_event_name: 'Stop' }));
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'session_not_found' });
    const invalid = await postHookEvent(id, JSON.stringify({ tool_name: 'Bash' }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: 'invalid_event' });
  });
});

describe('plan-claude_sessions_client/REQ-15 the list updates by itself', () => {
  it('a connected page receives the new session and each state change, with no request of its own', async () => {
    const events = connectWs(`ws://127.0.0.1:${port}/api/sessions/events`, { Origin: base });
    clients.push(events);
    await new Promise<void>((resolve) => events.socket.once('open', () => resolve()));
    const id = await startSession();
    const client = await attach(id);
    input(client, 'TURN\r');
    const states = () =>
      events.frames
        .map((frame) => JSON.parse(frame) as { type: string; session: SessionSummary })
        .filter((frame) => frame.type === 'session' && frame.session.id === id)
        .map((frame) => frame.session.state);
    await waitFor(() => states().at(-1) === 'idle' && states().includes('working'), 'working then idle', 6000);
    expect(states()[0]).toBe('idle');
    expect(states().indexOf('working')).toBeGreaterThan(0);
  });
});

describe('plan-claude_sessions_client/REQ-20 sessions survive the page', () => {
  it('a working session keeps running and keeps its state when every page connection closes', async () => {
    const id = await startSession();
    const events = connectWs(`ws://127.0.0.1:${port}/api/sessions/events`, { Origin: base });
    const first = await attach(id);
    input(first, 'WORK\r');
    await waitForState(id, 'working');
    await waitFor(() => first.text().includes('TICK2'), 'turn under way');
    first.socket.close();
    events.socket.close();
    await Promise.all([first.closed, events.closed]);
    await delay(800);
    expect((await summaryOf(id))?.state).toBe('working');
    const second = await attach(id);
    expect(second.frames[0]).toContain('LINE:WORK');
    const ticks = () => [...second.text().matchAll(/TICK(\d+)/g)].map((m) => Number(m[1]));
    const seen = Math.max(...ticks());
    await waitFor(() => Math.max(...ticks()) > seen, 'turn goes on');
  });
});
