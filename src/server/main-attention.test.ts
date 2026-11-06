// REQ tests of plan-session_notifications, batch needs-input-notification, against the real server process.
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FAKE_CLI, type WsClient, connectWs, delay, tempDir, waitFor } from './test-support.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// REQ-2: every notification within 5 seconds of its state change.
const FIVE_SECONDS = 5000;
// ExternalSessionScanner scans every 2 seconds: one full scan plus margin.
const ONE_SCAN = 2600;
// Server round trips and scanner waits: more than Vitest's default 5 seconds.
const TEST_TIMEOUT = 30_000;

let server: ChildProcess;
let port: number;
let base: string;
let projectsRoot: string;
// Fixture Claude Code folder (CLAUDE_CONFIG_DIR): the tests never touch the real ~/.claude.
let claudeDir: string;
const clients: WsClient[] = [];
const sleepers: ChildProcess[] = [];

interface AttentionEvent {
  id: string;
  sessionId: string;
  kind: string;
  folder: string;
  label: string;
  waitingTool?: string;
}
interface AttentionSession {
  sessionId: string;
  folder: string;
  label: string;
}
type Frame = { type: 'needs-input'; sessions: AttentionSession[] } | { type: 'event'; event: AttentionEvent };

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

beforeAll(async () => {
  projectsRoot = await tempDir('ai-client-attention-projects-');
  claudeDir = await tempDir('ai-client-attention-claude-');
  port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(path.join(repoRoot, 'node_modules/.bin/tsx'), ['src/server/main.ts'], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(port), AI_CLIENT_CLAUDE_CLI: FAKE_CLI, CLAUDE_CONFIG_DIR: claudeDir },
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
  for (const sleeper of sleepers) sleeper.kill('SIGKILL');
  server.kill('SIGTERM');
  await delay(200);
  await rm(projectsRoot, { recursive: true, force: true });
  await rm(claudeDir, { recursive: true, force: true });
});

/** Connects as the desktop app does: no Origin header. Waits for the list frame sent on connect. */
async function attention(): Promise<WsClient> {
  const client = connectWs(`ws://127.0.0.1:${port}/api/attention`);
  clients.push(client);
  await waitFor(() => client.frames.length >= 1, 'list frame on connect');
  return client;
}

const frames = (client: WsClient) => client.frames.map((frame) => JSON.parse(frame) as Frame);
const eventsOf = (client: WsClient, sessionId: string) =>
  frames(client).flatMap((frame) => (frame.type === 'event' && frame.event.sessionId === sessionId ? [frame.event] : []));
const lists = (client: WsClient) => frames(client).flatMap((frame) => (frame.type === 'needs-input' ? [frame.sessions] : []));
const lastList = (client: WsClient) => lists(client).at(-1) ?? [];
const listed = (client: WsClient, sessionId: string) => lastList(client).some((session) => session.sessionId === sessionId);

async function startSession(name: string): Promise<{ id: string; folder: string }> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder, { recursive: true });
  const response = await fetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: folder }),
  });
  expect(response.status).toBe(201);
  return { id: ((await response.json()) as { id: string }).id, folder };
}

async function hook(id: string, event: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${base}/api/sessions/${id}/hook-events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
  });
  expect(response.ok).toBe(true);
}

const prompt = (id: string, text: string) => hook(id, { hook_event_name: 'UserPromptSubmit', prompt: text });
const askPermission = (id: string, tool: string) => hook(id, { hook_event_name: 'PermissionRequest', tool_name: tool });
const stopTurn = (id: string) => hook(id, { hook_event_name: 'Stop' });

/** Writes the Claude Code session file of an external session, kept alive by a `sleep` process. */
async function externalSession(sessionId: string, cwd: string, status: string): Promise<{ pid: number; write(status: string): Promise<void> }> {
  const sleeper = spawn('sleep', ['120'], { stdio: 'ignore' });
  sleepers.push(sleeper);
  const pid = sleeper.pid!;
  await mkdir(path.join(claudeDir, 'sessions'), { recursive: true });
  const write = (next: string) =>
    writeFile(
      path.join(claudeDir, 'sessions', `${pid}.json`),
      JSON.stringify({ pid, sessionId, cwd, kind: 'interactive', status: next, updatedAt: Date.now() }),
    );
  await write(status);
  return { pid, write };
}

async function externalState(sessionId: string): Promise<string | undefined> {
  const response = await fetch(`${base}/api/sessions`);
  const sessions = (await response.json()) as { id: string; state: string }[];
  return sessions.find((session) => session.id === sessionId)?.state;
}

describe('plan-session_notifications/REQ-1, REQ-2, REQ-7, REQ-8 a hosted session that enters needs input', { timeout: TEST_TIMEOUT }, () => {
  it('gives one event within 5 seconds, with its folder, its label and the waiting tool, and enters the list', async () => {
    const client = await attention();
    const { id, folder } = await startSession('ai-client');
    await prompt(id, 'Fix the login form');

    const changedAt = Date.now();
    await askPermission(id, 'Bash');
    await waitFor(() => eventsOf(client, id).length >= 1, 'needs-input event', FIVE_SECONDS);
    expect(Date.now() - changedAt).toBeLessThan(FIVE_SECONDS);

    expect(eventsOf(client, id)).toEqual([
      { id: expect.stringMatching(UUID), sessionId: id, kind: 'needs_input', folder, label: 'Fix the login form', waitingTool: 'Bash' },
    ]);
    expect(lastList(client)).toContainEqual({ sessionId: id, folder, label: 'Fix the login form' });
  });
});

describe('plan-session_notifications/REQ-9 needs input with no known tool', { timeout: TEST_TIMEOUT }, () => {
  it('gives an event with no waiting tool', async () => {
    const client = await attention();
    const { id } = await startSession('ask-question');
    await prompt(id, 'Choose a library');
    await hook(id, { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion' });
    await waitFor(() => eventsOf(client, id).length >= 1, 'needs-input event', FIVE_SECONDS);
    expect(eventsOf(client, id)[0]).not.toHaveProperty('waitingTool');
  });
});

describe('plan-session_notifications/REQ-6 the same state change never notifies twice', { timeout: TEST_TIMEOUT }, () => {
  it('a session that keeps waiting gives no second event; a new entry into needs input gives a new one', async () => {
    const client = await attention();
    const { id } = await startSession('repeat');
    await prompt(id, 'Run the tests');
    await askPermission(id, 'Bash');
    await waitFor(() => eventsOf(client, id).length >= 1, 'first event', FIVE_SECONDS);

    await askPermission(id, 'Bash');
    await hook(id, { hook_event_name: 'Notification', notification_type: 'permission_prompt' });
    await delay(800);
    expect(eventsOf(client, id)).toHaveLength(1);

    await stopTurn(id);
    await prompt(id, 'Again');
    await askPermission(id, 'Edit');
    await waitFor(() => eventsOf(client, id).length >= 2, 'second event', FIVE_SECONDS);
    const [first, second] = eventsOf(client, id);
    expect(second?.waitingTool).toBe('Edit');
    expect(second?.id).not.toBe(first?.id);
  });
});

describe('plan-session_notifications/REQ-5 state changes before the desktop app connects', { timeout: TEST_TIMEOUT }, () => {
  it('a client that connects later gets the current list and no older event, also while the session keeps waiting', async () => {
    const early = await attention();
    const { id, folder } = await startSession('before-start');
    await prompt(id, 'Deploy');
    await askPermission(id, 'Bash');
    await waitFor(() => eventsOf(early, id).length >= 1, 'event on the early client', FIVE_SECONDS);

    const late = await attention();
    expect(frames(late)[0]).toEqual({ type: 'needs-input', sessions: expect.arrayContaining([{ sessionId: id, folder, label: 'Deploy' }]) });
    await askPermission(id, 'Bash');
    await delay(800);
    expect(eventsOf(late, id)).toEqual([]);
  });
});

describe('plan-session_notifications/REQ-11 the session leaves the needs-input list', { timeout: TEST_TIMEOUT }, () => {
  it('when the hosted session gets an answer', async () => {
    const client = await attention();
    const { id } = await startSession('answered');
    await prompt(id, 'Refactor');
    await askPermission(id, 'Bash');
    await waitFor(() => listed(client, id), 'session in the list', FIVE_SECONDS);

    await hook(id, { hook_event_name: 'PostToolUse' });
    await waitFor(() => !listed(client, id), 'session out of the list', FIVE_SECONDS);
  });

  it('when the hosted session ends', async () => {
    const client = await attention();
    const { id } = await startSession('ended');
    await prompt(id, 'Refactor');
    await askPermission(id, 'Bash');
    await waitFor(() => listed(client, id), 'session in the list', FIVE_SECONDS);

    const response = await fetch(`${base}/api/sessions/${id}/stop`, { method: 'POST' });
    expect(response.ok).toBe(true);
    await waitFor(() => !listed(client, id), 'session out of the list', 10_000);
  });
});

describe('plan-session_notifications external sessions', { timeout: TEST_TIMEOUT }, () => {
  it('REQ-1, REQ-2, REQ-11: a known external session that starts waiting gives one event within 5 seconds, with no waiting tool, and leaves the list when it works again', async () => {
    const client = await attention();
    const cwd = path.join(projectsRoot, 'billing');
    const session = await externalSession('ext-waiting', cwd, 'busy');
    await expect.poll(() => externalState('ext-waiting'), { timeout: 10_000 }).toBe('working');

    const changedAt = Date.now();
    await session.write('waiting');
    await waitFor(() => eventsOf(client, 'ext-waiting').length >= 1, 'external event', FIVE_SECONDS);
    expect(Date.now() - changedAt).toBeLessThan(FIVE_SECONDS);
    expect(eventsOf(client, 'ext-waiting')).toEqual([
      { id: expect.stringMatching(UUID), sessionId: 'ext-waiting', kind: 'needs_input', folder: cwd, label: 'billing' },
    ]);
    expect(lastList(client)).toContainEqual({ sessionId: 'ext-waiting', folder: cwd, label: 'billing' });

    await session.write('busy');
    await waitFor(() => !listed(client, 'ext-waiting'), 'external session out of the list', FIVE_SECONDS);
    expect(eventsOf(client, 'ext-waiting')).toHaveLength(1);
  });

  it('REQ-11: an external session that disappears leaves the list', async () => {
    const client = await attention();
    const session = await externalSession('ext-gone', path.join(projectsRoot, 'gone'), 'waiting');
    await waitFor(() => listed(client, 'ext-gone'), 'external session in the list', 10_000);

    const sleeper = sleepers.find((child) => child.pid === session.pid)!;
    sleeper.kill('SIGKILL');
    await waitFor(() => !listed(client, 'ext-gone'), 'external session out of the list', FIVE_SECONDS);
  });

  it('REQ-5, REQ-6: an external session found already waiting gives no event, also while it keeps waiting', async () => {
    const client = await attention();
    const session = await externalSession('ext-already', path.join(projectsRoot, 'already'), 'waiting');
    await waitFor(() => listed(client, 'ext-already'), 'external session in the list', 10_000);

    await session.write('waiting');
    await delay(ONE_SCAN);
    expect(eventsOf(client, 'ext-already')).toEqual([]);
  });
});
