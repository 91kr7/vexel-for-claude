// REQ tests of plan-claude_sessions_client against the real server process.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, readdir, readlink, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  FAKE_CLI,
  type WsClient,
  connectWs,
  delay,
  hex,
  snapshotTree,
  tempDir,
  userEntry,
  waitFor,
  writeHistorySession,
} from './test-support.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
let server: ChildProcess;
let port: number;
let base: string;
let projectsRoot: string;
let project: string;
// Fixture Claude Code folder (CLAUDE_CONFIG_DIR): the tests never touch the real ~/.claude.
let claudeDir: string;
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
  claudeDir = await tempDir('ai-client-claude-');
  port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(path.join(repoRoot, 'node_modules/.bin/tsx'), ['src/server/main.ts'], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(port), AI_CLIENT_CLAUDE_CLI: FAKE_CLI, FAKE_CLI_MARK: 'server-env', CLAUDE_CONFIG_DIR: claudeDir },
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

describe('plan-claude_sessions_client/REQ-23 stop a session', () => {
  const stopSession = (id: string, headers: Record<string, string> = {}) =>
    fetch(`${base}/api/sessions/${id}/stop`, { method: 'POST', headers });

  it('the stop request ends the CLI; the session stays listed as ended and the pages get the change', async () => {
    const events = connectWs(`ws://127.0.0.1:${port}/api/sessions/events`, { Origin: base });
    clients.push(events);
    await new Promise<void>((resolve) => events.socket.once('open', () => resolve()));
    const id = await startSession();
    const client = await attach(id);
    const response = await stopSession(id);
    expect(response.status).toBe(202);
    expect(await response.text()).toBe('');
    await client.closed;
    await waitForState(id, 'ended');
    const pushedStates = events.frames
      .map((frame) => JSON.parse(frame) as { type: string; session: SessionSummary })
      .filter((frame) => frame.type === 'session' && frame.session.id === id)
      .map((frame) => frame.session.state);
    expect(pushedStates.at(-1)).toBe('ended');
  });

  it('stopping an ended session is accepted, an unknown session is rejected', async () => {
    const id = await startSession();
    const client = await attach(id);
    input(client, '/exit\r');
    await client.closed;
    await waitForState(id, 'ended');
    const again = await stopSession(id);
    expect(again.status).toBe(202);
    expect(await again.text()).toBe('');
    const unknown = await stopSession('no-such-session');
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'session_not_found' });
  });

  it('a page of another origin cannot stop a session', async () => {
    const id = await startSession();
    const client = await attach(id);
    const response = await stopSession(id, { origin: 'http://evil.example' });
    expect(response.status).toBe(403);
    await delay(500);
    expect(client.closeCode).toBeUndefined();
    expect((await summaryOf(id))?.state).toBe('idle');
  });
});

interface PastSessionGroup {
  folder: string;
  sessions: { id: string; label: string; lastActivity: string; runningElsewhere: boolean }[];
}

async function pastSessions(): Promise<PastSessionGroup[]> {
  const response = await fetch(`${base}/api/past-sessions`);
  expect(response.status).toBe(200);
  return (await response.json()) as PastSessionGroup[];
}

const pastIds = async () => (await pastSessions()).flatMap((group) => group.sessions.map((session) => session.id));
const resumePast = (id: string) => fetch(`${base}/api/past-sessions/${id}/resume`, { method: 'POST' });

async function historyFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  return folder;
}

/** A session file shaped like the ones Claude Code writes for a session started in a terminal. */
async function terminalSession(id: string, folder: string, firstMessage: string, modified: Date): Promise<string> {
  const common = { cwd: folder, sessionId: id, version: '2.1.0', gitBranch: 'main', userType: 'external', isSidechain: false };
  return writeHistorySession(
    claudeDir,
    folder.replaceAll('/', '-'),
    id,
    [
      { type: 'file-history-snapshot', messageId: 'm0', snapshot: {} },
      { ...common, type: 'user', isMeta: true, message: { role: 'user', content: '<local-command-caveat>Caveat</local-command-caveat>' } },
      { ...common, type: 'user', message: { role: 'user', content: firstMessage } },
      { ...common, type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Fatto.' }] } },
      { ...common, type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] } },
    ],
    modified,
  );
}

async function resumeAndAttach(pastId: string): Promise<{ id: string; client: WsClient }> {
  const response = await resumePast(pastId);
  expect(response.status).toBe(201);
  const { id } = (await response.json()) as { id: string };
  return { id, client: await attach(id) };
}

describe('plan-claude_sessions_client/REQ-25 resume a past session chosen by project folder', () => {
  it('the past sessions come grouped by folder, the most recent first, and the chosen one resumes in its folder', async () => {
    const alpha = await historyFolder('hist-alpha');
    const beta = await historyFolder('hist-beta');
    await terminalSession('req25-a-old', alpha, 'Alfa vecchia', new Date('2026-10-01T10:00:00Z'));
    await terminalSession('req25-b', beta, 'Beta', new Date('2026-10-03T10:00:00Z'));
    await terminalSession('req25-a-new', alpha, 'Alfa nuova', new Date('2026-10-02T10:00:00Z'));

    const groups = (await pastSessions()).filter((group) => [alpha, beta].includes(group.folder));
    expect(groups.map((group) => [group.folder, group.sessions.map((session) => [session.id, session.label])])).toEqual([
      [beta, [['req25-b', 'Beta']]],
      [alpha, [['req25-a-new', 'Alfa nuova'], ['req25-a-old', 'Alfa vecchia']]],
    ]);
    expect(groups[0]?.sessions[0]?.lastActivity).toBe('2026-10-03T10:00:00.000Z');

    const { id, client } = await resumeAndAttach('req25-a-new');
    expect(client.text()).toContain(`CWD:${alpha}`);
    expect(settingsArgs(client)?.slice(2)).toEqual(['--resume', 'req25-a-new']);
    expect(await summaryOf(id)).toMatchObject({ id, folder: alpha, state: 'idle' });
  });

  it('a hosted session that has not ended is not offered again, and comes back once it ends', async () => {
    const folder = await historyFolder('hist-hosted');
    await terminalSession('req25-hosted', folder, 'Ospitata', new Date('2026-10-04T10:00:00Z'));
    const { id, client } = await resumeAndAttach('req25-hosted');
    input(client, 'HOOK Stop\r');
    await waitFor(() => client.text().includes('LINE:HOOK Stop'), 'hook fired');
    expect(await pastIds()).not.toContain('req25-hosted');
    input(client, '/exit\r');
    await client.closed;
    await waitForState(id, 'ended');
    expect(await pastIds()).toContain('req25-hosted');
  });

  it('an unknown session or a missing folder is refused and starts no session', async () => {
    const folder = await historyFolder('hist-gone');
    await terminalSession('req25-gone', folder, 'Cartella sparita', new Date('2026-10-05T10:00:00Z'));
    await rm(folder, { recursive: true });
    const countBefore = (await listSessions()).length;

    const unknown = await resumePast('req25-no-such-session');
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'session_not_found' });
    const gone = await resumePast('req25-gone');
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual({ error: 'folder_not_found' });
    expect((await listSessions()).length).toBe(countBefore);
  });
});

describe('plan-claude_sessions_client/REQ-26 a session started from the terminal can be resumed', () => {
  it('a terminal session is offered with its first message and resumes in the client', async () => {
    const folder = await historyFolder('hist-terminal');
    await terminalSession('req26-terminal', folder, 'Aggiungi i test di integrazione', new Date('2026-10-06T10:00:00Z'));
    const group = (await pastSessions()).find((g) => g.folder === folder);
    expect(group?.sessions).toEqual([
      { id: 'req26-terminal', label: 'Aggiungi i test di integrazione', lastActivity: '2026-10-06T10:00:00.000Z', runningElsewhere: false },
    ]);
    const { client } = await resumeAndAttach('req26-terminal');
    expect(settingsArgs(client)).toContain('req26-terminal');
  });
});

describe('plan-claude_sessions_client/REQ-13 the label of a resumed session', () => {
  it('is the start of its first user message, and later messages do not change it', async () => {
    const folder = await historyFolder('hist-label');
    const first = `Rivedi   il modulo\n di pagamento ${'z'.repeat(100)}`;
    await terminalSession('req13-resumed', folder, first, new Date('2026-10-07T10:00:00Z'));
    const { id, client } = await resumeAndAttach('req13-resumed');
    const label = `Rivedi il modulo di pagamento ${'z'.repeat(50)}`;
    expect((await summaryOf(id))?.label).toBe(label);
    input(client, 'Nuovo messaggio\r');
    await waitFor(() => client.text().includes('LINE:Nuovo messaggio'), 'new message');
    expect((await summaryOf(id))?.label).toBe(label);
  });
});

describe('plan-claude_sessions_client/REQ-27 a session still running in a terminal is flagged', () => {
  it('runningElsewhere is true while the terminal process lives, false once it has ended', async () => {
    const folder = await historyFolder('hist-running');
    await terminalSession('req27-running', folder, 'In terminale', new Date('2026-10-08T10:00:00Z'));
    await terminalSession('req27-closed', folder, 'Chiusa', new Date('2026-10-07T10:00:00Z'));
    const terminal = spawn('sleep', ['60'], { stdio: 'ignore' });
    const finished = spawn('true', [], { stdio: 'ignore' });
    await new Promise((resolve) => finished.once('exit', resolve));
    await mkdir(path.join(claudeDir, 'sessions'), { recursive: true });
    await writeFile(path.join(claudeDir, 'sessions', `${terminal.pid}.json`), JSON.stringify({ pid: terminal.pid, sessionId: 'req27-running' }));
    await writeFile(path.join(claudeDir, 'sessions', `${finished.pid}.json`), JSON.stringify({ pid: finished.pid, sessionId: 'req27-closed' }));
    try {
      const flags = () => pastSessions().then((groups) => groups.find((g) => g.folder === folder)?.sessions.map((s) => [s.id, s.runningElsewhere]));
      expect(await flags()).toEqual([
        ['req27-running', true],
        ['req27-closed', false],
      ]);
      terminal.kill('SIGKILL');
      await new Promise((resolve) => terminal.once('exit', resolve));
      expect(await flags()).toEqual([
        ['req27-running', false],
        ['req27-closed', false],
      ]);
    } finally {
      terminal.kill('SIGKILL');
    }
  });
});

describe('plan-claude_sessions_client/REQ-28 the client does not change the session history', () => {
  it('listing, resuming, using and ending a session leave every history file with the same content and modification time', async () => {
    const folder = await historyFolder('hist-intact');
    await terminalSession('req28-intact', folder, 'Storia intatta', new Date('2026-10-09T10:00:00Z'));
    await writeHistorySession(claudeDir, 'odd', 'req28-odd', ['{broken', userEntry('<command-name>/clear</command-name>')]);
    const before = await snapshotTree(claudeDir);

    await pastSessions();
    const { id, client } = await resumeAndAttach('req28-intact');
    input(client, 'Un nuovo messaggio\r');
    await waitFor(() => client.text().includes('LINE:Un nuovo messaggio'), 'new message');
    await waitForState(id, 'working');
    input(client, '/exit\r');
    await client.closed;
    await waitForState(id, 'ended');
    await pastSessions();

    // The fake CLI writes nothing, so any difference comes from the client.
    expect(await snapshotTree(claudeDir)).toEqual(before);
  });
});

interface ExternalSummary extends SessionSummary {
  external?: true;
}

interface ExternalTerminal {
  pid: number;
  sessionId: string;
  folder: string;
  update(fields: { status?: string; updatedAt?: number }): Promise<void>;
  end(): Promise<void>;
}

const terminals: ChildProcess[] = [];
const claudeProject = (folder: string) => folder.replace(/[^A-Za-z0-9]/g, '-');
const assistantEntry = (text: string) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } });

/** Simulates Claude Code in another terminal: a live process, its sessions/<pid>.json and the <pid>.<hash>.key FIFO next to it. */
async function externalTerminal(
  sessionId: string,
  folder: string,
  fields: { kind?: string; status?: string; updatedAt?: number } = {},
): Promise<ExternalTerminal> {
  const process = spawn('sleep', ['120'], { stdio: 'ignore' });
  terminals.push(process);
  const pid = process.pid ?? 0;
  const sessionsDir = path.join(claudeDir, 'sessions');
  await mkdir(sessionsDir, { recursive: true });
  execFileSync('mkfifo', [path.join(sessionsDir, `${pid}.9f8e7d6c.key`)]);
  let data = { pid, sessionId, cwd: folder, kind: 'interactive', status: 'idle', updatedAt: Date.now(), ...fields };
  const write = () => writeFile(path.join(sessionsDir, `${pid}.json`), JSON.stringify(data));
  await write();
  return {
    pid,
    sessionId,
    folder,
    update: async (changes) => {
      data = { ...data, ...changes };
      await write();
    },
    end: async () => {
      process.kill('SIGKILL');
      await new Promise((resolve) => process.once('exit', resolve));
    },
  };
}

async function waitForList(check: (sessions: ExternalSummary[]) => boolean, label: string, timeoutMs = 8000): Promise<ExternalSummary[]> {
  const deadline = Date.now() + timeoutMs;
  let sessions = (await listSessions()) as ExternalSummary[];
  while (!check(sessions)) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for: ${label}`);
    await delay(100);
    sessions = (await listSessions()) as ExternalSummary[];
  }
  return sessions;
}

const waitForExternal = async (id: string, check: (session: ExternalSummary) => boolean = () => true) =>
  (await waitForList((sessions) => sessions.some((s) => s.id === id && check(s)), `external entry ${id}`)).find((s) => s.id === id) as ExternalSummary;

/** The pid of the fake CLI that the server hosts in `folder`. */
async function hostedCliPid(folder: string): Promise<number> {
  for (const name of await readdir('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    const cmdline = await readFile(`/proc/${name}/cmdline`, 'utf8').catch(() => '');
    if (!cmdline.includes('fake-claude.mjs')) continue;
    if ((await readlink(`/proc/${name}/cwd`).catch(() => '')) === folder) return Number(name);
  }
  throw new Error(`no hosted CLI in ${folder}`);
}

function conversation(id: string): WsClient {
  const client = connectWs(`ws://127.0.0.1:${port}/api/external-sessions/${id}/conversation`, { Origin: base });
  clients.push(client);
  return client;
}

/** Byte offset where line `index` starts in a transcript written one JSON entry per line. */
const lineStart = (entries: object[], index: number) => entries.slice(0, index).reduce((sum, entry) => sum + Buffer.byteLength(JSON.stringify(entry)) + 1, 0);

const conversationItems = (client: WsClient) =>
  client.frames.flatMap((frame) => (JSON.parse(frame) as { type: string; items: unknown[] }).items);

describe('plan-claude_sessions_client external sessions', { timeout: 20_000 }, () => {
  afterAll(() => {
    for (const terminal of terminals) terminal.kill('SIGKILL');
  });

  describe('plan-claude_sessions_client/REQ-29 sessions of other terminals are listed as external', () => {
    it('a live interactive session of another terminal is listed after the hosted ones, marked external', async () => {
      const hostedId = await startSession();
      const folder = await historyFolder('ext-listed');
      const terminal = await externalTerminal('req29-listed', folder);
      const sessions = await waitForList((list) => list.some((s) => s.id === 'req29-listed'), 'external entry');
      expect(sessions.find((s) => s.id === 'req29-listed')?.external).toBe(true);
      expect(sessions.find((s) => s.id === hostedId)?.external).toBeUndefined();
      const firstExternal = sessions.findIndex((s) => s.external === true);
      expect(sessions.slice(firstExternal).every((s) => s.external === true)).toBe(true);
      await terminal.end();
    });

    it('a non-interactive session, a session whose process has ended and a session the client hosts are not listed as external', async () => {
      const folder = await historyFolder('ext-filtered');
      const hostedFolder = await historyFolder('ext-hosted');
      await startSession(hostedFolder);
      const hostedPid = await hostedCliPid(hostedFolder);
      await writeFile(
        path.join(claudeDir, 'sessions', `${hostedPid}.json`),
        JSON.stringify({ pid: hostedPid, sessionId: 'req29-hosted', cwd: hostedFolder, kind: 'interactive', status: 'idle', updatedAt: Date.now() }),
      );
      await externalTerminal('req29-print', folder, { kind: 'sdk-cli' });
      const ended = await externalTerminal('req29-ended', folder);
      await ended.end();
      const control = await externalTerminal('req29-control', folder);

      await waitForExternal('req29-control');
      await delay(2500);
      const ids = (await listSessions()).map((s) => s.id);
      expect(ids).not.toContain('req29-hosted');
      expect(ids).not.toContain('req29-print');
      expect(ids).not.toContain('req29-ended');
      await control.end();
    });
  });

  describe('plan-claude_sessions_client/REQ-30 folder, label, state and last activity of an external entry', () => {
    it('shows the folder, the start of the first user message, the state and the time of the last activity', async () => {
      const folder = await historyFolder('ext-data');
      const firstMessage = `Aggiorna la pagina del carrello e   ${'aggiungi i test '.repeat(6)}`;
      await writeHistorySession(claudeDir, claudeProject(folder), 'req30-data', [
        userEntry('<local-command-caveat>Caveat</local-command-caveat>', folder, { isMeta: true }),
        userEntry(firstMessage, folder),
        assistantEntry('Fatto.'),
        userEntry('Un secondo messaggio', folder),
      ]);
      const updatedAt = Date.parse('2026-11-05T08:15:30.000Z');
      const terminal = await externalTerminal('req30-data', folder, { updatedAt });
      expect(await waitForExternal('req30-data')).toEqual({
        id: 'req30-data',
        folder,
        label: firstMessage.replace(/\s+/g, ' ').trim().slice(0, 80),
        state: 'idle',
        lastActivity: '2026-11-05T08:15:30.000Z',
        external: true,
      });
      await terminal.end();
    });

    it('the label is the folder name until the first user message, then the start of that message', async () => {
      const folder = await historyFolder('ext-fresh');
      const terminal = await externalTerminal('req30-fresh', folder);
      expect((await waitForExternal('req30-fresh')).label).toBe('ext-fresh');
      await writeHistorySession(claudeDir, claudeProject(folder), 'req30-fresh', [userEntry('Il primo messaggio', folder)]);
      await waitForExternal('req30-fresh', (s) => s.label === 'Il primo messaggio');
      await terminal.end();
    });
  });

  describe('plan-claude_sessions_client/REQ-31 state of an external session', () => {
    it('working while Claude Code reports busy, idle while it reports idle', async () => {
      const folder = await historyFolder('ext-state');
      const terminal = await externalTerminal('req31-state', folder, { status: 'idle' });
      await waitForExternal('req31-state', (s) => s.state === 'idle');
      await terminal.update({ status: 'busy', updatedAt: Date.now() });
      await waitForExternal('req31-state', (s) => s.state === 'working');
      await terminal.update({ status: 'idle', updatedAt: Date.now() });
      await waitForExternal('req31-state', (s) => s.state === 'idle');
      await terminal.end();
    });
  });

  describe('plan-claude_sessions_client/REQ-32 external sessions come, change and go by themselves', () => {
    it('a connected page receives the new external entry, its state change, its end and its dismissal, with no request of its own', async () => {
      const events = connectWs(`ws://127.0.0.1:${port}/api/sessions/events`, { Origin: base });
      clients.push(events);
      await new Promise<void>((resolve) => events.socket.once('open', () => resolve()));
      const folder = await historyFolder('ext-events');
      const terminal = await externalTerminal('req32-events', folder, { status: 'idle' });
      const mine = () =>
        events.frames
          .map((frame) => JSON.parse(frame) as { type: string; id?: string; session?: ExternalSummary })
          .filter((frame) => frame.id === 'req32-events' || frame.session?.id === 'req32-events');
      await waitFor(() => mine().length > 0, 'external entry added');
      expect(mine()[0]).toEqual({ type: 'session', session: expect.objectContaining({ id: 'req32-events', state: 'idle', external: true }) });

      await terminal.update({ status: 'busy', updatedAt: Date.now() });
      await waitFor(() => mine().some((f) => f.session?.state === 'working'), 'external entry working');

      await terminal.end();
      await waitFor(() => mine().some((f) => f.session?.state === 'ended'), 'external entry ended', 8000);
      expect(mine().at(-1)).toEqual({
        type: 'session',
        session: expect.objectContaining({ id: 'req32-events', state: 'ended', resumable: true, external: true }),
      });
      expect((await listSessions()).find((s) => s.id === 'req32-events')?.state).toBe('ended');

      const dismissed = await fetch(`${base}/api/sessions/req32-events/dismiss`, { method: 'POST' });
      expect(dismissed.status).toBe(204);
      await waitFor(() => mine().some((f) => f.type === 'session-removed'), 'external entry removed');
      expect(mine().at(-1)).toEqual({ type: 'session-removed', id: 'req32-events' });
      expect((await listSessions()).map((s) => s.id)).not.toContain('req32-events');
    });
  });

  describe('plan-claude_sessions_client/REQ-33 the conversation of an external session, read-only as text', () => {
    it('gives the user messages, the replies, the tool calls and the cut tool results of the transcript', async () => {
      const folder = await historyFolder('ext-conversation');
      const lines = [
        userEntry('Elenca i file', folder),
        { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Li elenco.' }, { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls -la' } }] } },
        userEntry([{ type: 'tool_result', tool_use_id: 't1', content: 'a\nb\nc\nd\ne\nf\ng' }], folder),
        assistantEntry('Sono sette file.'),
      ];
      await writeHistorySession(claudeDir, claudeProject(folder), 'req33-talk', lines);
      const terminal = await externalTerminal('req33-talk', folder);
      await waitForExternal('req33-talk');
      const client = conversation('req33-talk');
      await waitFor(() => client.frames.length > 0, 'first frame');
      expect(JSON.parse(client.frames[0] ?? '')).toEqual({
        type: 'items',
        items: [
          { kind: 'user', text: 'Elenca i file' },
          { kind: 'assistant', text: 'Li elenco.' },
          { kind: 'tool_call', name: 'Bash', summary: 'ls -la', id: 't1', ref: { offset: lineStart(lines, 1), block: 1 } },
          { kind: 'tool_result', text: 'a\nb\nc\nd\ne', truncated: true, toolUseId: 't1', ref: { offset: lineStart(lines, 2), block: 0 } },
          { kind: 'assistant', text: 'Sono sette file.' },
        ],
      });
      await terminal.end();
    });

    it('refuses an id that is not an external session, and a page of another origin', async () => {
      const hostedId = await startSession();
      for (const id of ['req33-unknown', hostedId]) {
        const client = conversation(id);
        expect(await client.closed).toBe(4404);
        expect(client.frames).toEqual([]);
      }
      expect(await foreignWebSocketStatus('/api/external-sessions/req33-talk/conversation')).toBe(403);
    });
  });

  describe('plan-claude_sessions_client/REQ-34 the conversation updates live', () => {
    it('the lines Claude Code appends to the transcript reach the open conversation', async () => {
      const folder = await historyFolder('ext-live');
      const file = await writeHistorySession(claudeDir, claudeProject(folder), 'req34-live', [userEntry('Avvia i test', folder)]);
      const terminal = await externalTerminal('req34-live', folder, { status: 'busy' });
      await waitForExternal('req34-live');
      const client = conversation('req34-live');
      await waitFor(() => client.frames.length > 0, 'first frame');
      const lines = [
        userEntry('Avvia i test', folder),
        { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't2', name: 'Bash', input: { command: 'npm test' } }] } },
        assistantEntry('Tutti i test passano.'),
      ];
      await writeFile(file, lines.map((entry) => JSON.stringify(entry)).join('\n') + '\n');
      await waitFor(() => conversationItems(client).length >= 3, 'new items', 5000);
      expect(conversationItems(client)).toEqual([
        { kind: 'user', text: 'Avvia i test' },
        { kind: 'tool_call', name: 'Bash', summary: 'npm test', id: 't2', ref: { offset: lineStart(lines, 1), block: 0 } },
        { kind: 'assistant', text: 'Tutti i test passano.' },
      ]);
      await terminal.end();
    });
  });

  describe('plan-claude_sessions_client/REQ-35 resume an external session in the client', () => {
    it('the external session resumes in its folder with --resume and its id', async () => {
      const folder = await historyFolder('ext-resume');
      await writeHistorySession(claudeDir, claudeProject(folder), 'req35-take', [userEntry('Riprendimi', folder)]);
      const terminal = await externalTerminal('req35-take', folder);
      await waitForExternal('req35-take');
      const { id, client } = await resumeAndAttach('req35-take');
      expect(client.text()).toContain(`CWD:${folder}`);
      expect(settingsArgs(client)?.slice(-2)).toEqual(['--resume', 'req35-take']);
      expect(((await summaryOf(id)) as ExternalSummary | undefined)?.external).toBeUndefined();
      input(client, '/exit\r');
      await client.closed;
      await terminal.end();
    });
  });

  describe('plan-claude_sessions_client/REQ-36 the client writes nothing to an external session', () => {
    it('listing, following and resuming an external session leave its session file and transcript unchanged', async () => {
      const folder = await historyFolder('ext-untouched');
      await writeHistorySession(claudeDir, claudeProject(folder), 'req36-intact', [userEntry('Non toccare', folder), assistantEntry('Va bene.')]);
      const terminal = await externalTerminal('req36-intact', folder, { status: 'busy' });
      const before = await snapshotTree(claudeDir);

      await waitForExternal('req36-intact');
      const events = connectWs(`ws://127.0.0.1:${port}/api/sessions/events`, { Origin: base });
      clients.push(events);
      const client = conversation('req36-intact');
      await waitFor(() => client.frames.length > 0, 'first frame');
      client.send({ type: 'input', data: 'scrivi\r' });
      await delay(2500);
      const { client: resumed } = await resumeAndAttach('req36-intact');
      input(resumed, '/exit\r');
      await resumed.closed;
      await listSessions();

      expect(await snapshotTree(claudeDir)).toEqual(before);
      await terminal.end();
    });
  });
});

describe('plan-claude_sessions_client-ui_redesign/REQ-21 full content of a tool item of an external session', { timeout: 20_000 }, () => {
  const fullInput = { command: 'npm run build', description: 'Compila il progetto', env: { CI: '1' } };
  const fullOutput = Array.from({ length: 12 }, (_, i) => `riga ${i + 1}`).join('\n');
  const itemContent = (id: string, ref: { offset: number; block: number }, headers: Record<string, string> = {}) =>
    fetch(`${base}/api/external-sessions/${id}/items?offset=${ref.offset}&block=${ref.block}`, { headers });

  it('the references of the conversation give the full tool input and output, also after the session ended, and nothing is written', async () => {
    const folder = await historyFolder('ext-expand');
    await writeHistorySession(claudeDir, claudeProject(folder), 'req21-expand', [
      userEntry('Compila', folder),
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: fullInput }] } },
      userEntry([{ type: 'tool_result', tool_use_id: 't1', content: fullOutput }], folder),
    ]);
    const terminal = await externalTerminal('req21-expand', folder);
    await waitForExternal('req21-expand');
    const before = await snapshotTree(claudeDir);
    const client = conversation('req21-expand');
    await waitFor(() => client.frames.length > 0, 'first frame');
    const [call, result] = conversationItems(client).filter((item) => (item as { kind: string }).kind !== 'user') as {
      kind: string;
      ref: { offset: number; block: number };
    }[];
    expect(call?.kind).toBe('tool_call');
    expect(result?.kind).toBe('tool_result');

    const callResponse = await itemContent('req21-expand', call?.ref ?? { offset: -1, block: -1 });
    expect(callResponse.status).toBe(200);
    expect(await callResponse.json()).toEqual({ text: JSON.stringify(fullInput, null, 2) });
    const resultResponse = await itemContent('req21-expand', result?.ref ?? { offset: -1, block: -1 });
    expect(resultResponse.status).toBe(200);
    expect(await resultResponse.json()).toEqual({ text: fullOutput });

    await terminal.end();
    await waitForList((sessions) => sessions.some((s) => s.id === 'req21-expand' && s.state === 'ended'), 'external entry ended');
    const afterEnd = await itemContent('req21-expand', result?.ref ?? { offset: -1, block: -1 });
    expect(afterEnd.status).toBe(200);
    expect(await afterEnd.json()).toEqual({ text: fullOutput });
    expect(await snapshotTree(claudeDir)).toEqual(before);
  });

  it('a bad reference, a reference to no tool item and an unknown session are refused', async () => {
    const folder = await historyFolder('ext-expand-errors');
    await writeHistorySession(claudeDir, claudeProject(folder), 'req21-errors', [userEntry('Solo testo', folder)]);
    const invalid = await fetch(`${base}/api/external-sessions/req21-errors/items?offset=abc&block=0`);
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: 'invalid_reference' });
    const notTool = await itemContent('req21-errors', { offset: 0, block: 0 });
    expect(notTool.status).toBe(404);
    expect(await notTool.json()).toEqual({ error: 'item_not_found' });
    const unknown = await itemContent('req21-missing', { offset: 0, block: 0 });
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'session_not_found' });
  });

  // plan-claude_sessions_client/REQ-9 holds for the new route
  it('refuses a page of another origin', async () => {
    const response = await itemContent('req21-errors', { offset: 0, block: 0 }, { origin: 'http://evil.example' });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
  });
});
