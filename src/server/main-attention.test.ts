// REQ tests of plan-session_notifications, batches needs-input-notification, turn-end-notification, session-end-notification and tray-signal, against the real server process.
import { type ChildProcess, spawn } from 'node:child_process';
import { appendFile, mkdir, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FAKE_CLI, type WsClient, connectWs, delay, tempDir, waitFor, writeHistorySession } from './test-support.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
// plan-session_notifications/REQ-2
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
  excerpt?: string;
  error?: boolean;
}
interface AttentionSession {
  sessionId: string;
  folder: string;
  label: string;
  waitingSince?: string;
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
    expect(lastList(client)).toContainEqual({ sessionId: id, folder, label: 'Fix the login form', waitingSince: expect.stringMatching(ISO_TIME) });
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
    expect(frames(late)[0]).toEqual({ type: 'needs-input', sessions: expect.arrayContaining([{ sessionId: id, folder, label: 'Deploy', waitingSince: expect.stringMatching(ISO_TIME) }]) });
    await askPermission(id, 'Bash');
    await delay(800);
    expect(eventsOf(late, id)).toEqual([]);
  });
});

describe('plan-session_notifications/REQ-35 when each listed session started to need input', { timeout: TEST_TIMEOUT }, () => {
  const sinceOf = (client: WsClient, sessionId: string) => lists(client).at(-1)?.find((session) => session.sessionId === sessionId)?.waitingSince;

  it('gives each session the time it entered needs input, keeps it while the session waits, and gives a new one when it waits again', async () => {
    const client = await attention();
    const first = await startSession('waits-first');
    const second = await startSession('waits-second');
    await prompt(first.id, 'Migrate the database');
    await prompt(second.id, 'Update the docs');

    const beforeFirst = Date.now();
    await askPermission(first.id, 'Bash');
    await waitFor(() => listed(client, first.id), 'first session in the list', FIVE_SECONDS);
    const afterFirst = Date.now();
    await delay(50);
    const beforeSecond = Date.now();
    await askPermission(second.id, 'Edit');
    await waitFor(() => listed(client, second.id), 'second session in the list', FIVE_SECONDS);
    const afterSecond = Date.now();

    const firstSince = sinceOf(client, first.id);
    const secondSince = sinceOf(client, second.id);
    expect(firstSince).toMatch(ISO_TIME);
    expect(secondSince).toMatch(ISO_TIME);
    expect(Date.parse(firstSince!)).toBeGreaterThanOrEqual(beforeFirst);
    expect(Date.parse(firstSince!)).toBeLessThanOrEqual(afterFirst);
    expect(Date.parse(secondSince!)).toBeGreaterThanOrEqual(beforeSecond);
    expect(Date.parse(secondSince!)).toBeLessThanOrEqual(afterSecond);

    await askPermission(first.id, 'Bash');
    await delay(300);
    const late = await attention();
    expect(sinceOf(late, first.id)).toBe(firstSince);
    expect(sinceOf(late, second.id)).toBe(secondSince);

    await hook(first.id, { hook_event_name: 'PostToolUse' });
    await waitFor(() => !listed(client, first.id), 'first session out of the list', FIVE_SECONDS);
    const beforeAgain = Date.now();
    await askPermission(first.id, 'Bash');
    await waitFor(() => listed(client, first.id), 'first session back in the list', FIVE_SECONDS);
    expect(Date.parse(sinceOf(client, first.id)!)).toBeGreaterThanOrEqual(beforeAgain);
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
    expect(lastList(client)).toContainEqual({ sessionId: 'ext-waiting', folder: cwd, label: 'billing', waitingSince: expect.stringMatching(ISO_TIME) });

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

// Batch turn-end-notification.

/** Writes the transcript of a Claude Code session where TranscriptReader looks first for `cwd`. */
const writeTranscript = (cwd: string, claudeSessionId: string, entries: object[]) =>
  writeHistorySession(claudeDir, cwd.replace(/[^A-Za-z0-9]/g, '-'), claudeSessionId, entries);
const jsonLine = (entry: object) => `${JSON.stringify(entry)}\n`;
const userLine = (text: string) => ({ type: 'user', message: { role: 'user', content: text } });
const claudeLine = (text: string) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } });
const toolCallLine = { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'tu-1', name: 'Bash', input: { command: 'npm test' } }] } };
const toolResultLine = { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu-1', content: '12 passed' }] } };
const interruptLine = { type: 'user', message: { role: 'user', content: [{ type: 'text', text: '[Request interrupted by user for tool use]' }] } };
const turnEndsOf = (client: WsClient, sessionId: string) => eventsOf(client, sessionId).filter((event) => event.kind === 'turn_end');
// Longer than one read, the second read after 1 second, and a margin.
const NO_EVENT_WAIT = 2000;

async function hostedTurn(name: string, claudeSessionId: string, transcript: object[]) {
  const { id, folder } = await startSession(name);
  await hook(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Run the tests', session_id: claudeSessionId });
  const file = await writeTranscript(folder, claudeSessionId, transcript);
  return { id, folder, file };
}

describe('plan-session_notifications/REQ-14, REQ-16, REQ-2 a turn of a hosted session ends', { timeout: TEST_TIMEOUT }, () => {
  it('gives one turn_end event within 5 seconds, with the start of the final response as plain text', async () => {
    const client = await attention();
    const { id, folder } = await hostedTurn('turn-end', 'claude-turn-end', [userLine('Run the tests'), claudeLine('**Done.** The tests pass.')]);

    const changedAt = Date.now();
    await stopTurn(id);
    await waitFor(() => turnEndsOf(client, id).length >= 1, 'turn-end event', FIVE_SECONDS);
    expect(Date.now() - changedAt).toBeLessThan(FIVE_SECONDS);

    expect(eventsOf(client, id)).toEqual([
      { id: expect.stringMatching(UUID), sessionId: id, kind: 'turn_end', folder, label: 'Run the tests', excerpt: 'Done. The tests pass.' },
    ]);
  });

  it('REQ-2: gives the final response written just after the Stop, still within 5 seconds', async () => {
    const client = await attention();
    const { id, file } = await hostedTurn('late-reply', 'claude-late-reply', [userLine('Run the tests'), toolCallLine, toolResultLine]);

    const changedAt = Date.now();
    await stopTurn(id);
    await delay(300);
    await appendFile(file, jsonLine(claudeLine('All 12 tests pass.')));
    await waitFor(() => turnEndsOf(client, id).length >= 1, 'turn-end event', FIVE_SECONDS);
    expect(Date.now() - changedAt).toBeLessThan(FIVE_SECONDS);
    expect(turnEndsOf(client, id)[0]?.excerpt).toBe('All 12 tests pass.');
  });

  it('REQ-16: cuts a long final response to 100 characters', async () => {
    const client = await attention();
    const { id } = await hostedTurn('long-reply', 'claude-long-reply', [userLine('Explain'), claudeLine(`- ${'All good. '.repeat(20)}`)]);

    await stopTurn(id);
    await waitFor(() => turnEndsOf(client, id).length >= 1, 'turn-end event', FIVE_SECONDS);
    const excerpt = turnEndsOf(client, id)[0]?.excerpt ?? '';
    expect([...excerpt]).toHaveLength(100);
    expect(excerpt).toBe(`${'All good. '.repeat(10).slice(0, 99)}…`);
  });
});

describe('plan-session_notifications/REQ-17 a hosted turn with no final text', { timeout: TEST_TIMEOUT }, () => {
  it('gives a turn_end event with no excerpt, within 5 seconds', async () => {
    const client = await attention();
    const { id } = await hostedTurn('no-text', 'claude-no-text', [userLine('Run the tests'), toolCallLine]);

    const changedAt = Date.now();
    await stopTurn(id);
    await waitFor(() => turnEndsOf(client, id).length >= 1, 'turn-end event', FIVE_SECONDS);
    expect(Date.now() - changedAt).toBeLessThan(FIVE_SECONDS);
    expect(turnEndsOf(client, id)[0]).not.toHaveProperty('excerpt');
  });
});

describe('plan-session_notifications/REQ-15 an interrupted turn of a hosted session', { timeout: TEST_TIMEOUT }, () => {
  it('gives no event when the user presses Esc in its terminal', async () => {
    const client = await attention();
    const { id } = await hostedTurn('interrupted', 'claude-interrupted', [userLine('Run the tests'), toolCallLine]);
    const terminal = connectWs(`ws://127.0.0.1:${port}/api/sessions/${id}/attach`);
    clients.push(terminal);
    await waitFor(() => terminal.frames.length >= 1, 'terminal snapshot');

    terminal.send({ type: 'input', data: '\x1b' });
    await expect.poll(() => externalState(id), { timeout: FIVE_SECONDS }).toBe('idle');
    await delay(NO_EVENT_WAIT);

    expect(eventsOf(client, id), 'the transcript ends on a tool call: only the input cause keeps this silent').toEqual([]);
  });
});

describe('plan-session_notifications turn end of external sessions', { timeout: TEST_TIMEOUT }, () => {
  it('REQ-14, REQ-16, REQ-2: an external session that goes from working to idle gives one turn_end event within 5 seconds', async () => {
    const client = await attention();
    const cwd = path.join(projectsRoot, 'invoices');
    await writeTranscript(cwd, 'ext-turn', [userLine('Update the invoices'), claudeLine('**Updated** 3 invoices.')]);
    const session = await externalSession('ext-turn', cwd, 'busy');
    await expect.poll(() => externalState('ext-turn'), { timeout: 10_000 }).toBe('working');

    const changedAt = Date.now();
    await session.write('idle');
    await waitFor(() => turnEndsOf(client, 'ext-turn').length >= 1, 'external turn-end event', FIVE_SECONDS);
    expect(Date.now() - changedAt).toBeLessThan(FIVE_SECONDS);
    expect(eventsOf(client, 'ext-turn')).toEqual([
      expect.objectContaining({ id: expect.stringMatching(UUID), sessionId: 'ext-turn', kind: 'turn_end', folder: cwd, excerpt: 'Updated 3 invoices.' }),
    ]);
  });

  it('REQ-15: an external turn that ends with the interrupt marker gives no event', async () => {
    const client = await attention();
    const cwd = path.join(projectsRoot, 'esc');
    await writeTranscript(cwd, 'ext-esc', [userLine('Refactor'), toolCallLine, interruptLine]);
    const session = await externalSession('ext-esc', cwd, 'busy');
    await expect.poll(() => externalState('ext-esc'), { timeout: 10_000 }).toBe('working');

    await session.write('idle');
    await expect.poll(() => externalState('ext-esc'), { timeout: FIVE_SECONDS }).toBe('idle');
    await delay(NO_EVENT_WAIT);

    expect(eventsOf(client, 'ext-esc')).toEqual([]);
  });

  it('REQ-17: an external turn that ends with a tool call gives an event with no excerpt, within 5 seconds', async () => {
    const client = await attention();
    const cwd = path.join(projectsRoot, 'tool-end');
    await writeTranscript(cwd, 'ext-tool', [userLine('Run the tests'), toolCallLine]);
    const session = await externalSession('ext-tool', cwd, 'busy');
    await expect.poll(() => externalState('ext-tool'), { timeout: 10_000 }).toBe('working');

    const changedAt = Date.now();
    await session.write('idle');
    await waitFor(() => turnEndsOf(client, 'ext-tool').length >= 1, 'external turn-end event', FIVE_SECONDS);
    expect(Date.now() - changedAt).toBeLessThan(FIVE_SECONDS);
    expect(turnEndsOf(client, 'ext-tool')[0]).not.toHaveProperty('excerpt');
  });
});

// Batch session-end-notification.

const sessionEndsOf = (client: WsClient, sessionId: string) => eventsOf(client, sessionId).filter((event) => event.kind === 'session_end');
const typeLine = (terminal: WsClient, text: string) => terminal.send({ type: 'input', data: `${text}\r` });

/** Starts a hosted session that works on a prompt, with its terminal open as in the browser client. */
async function workingSession(name: string): Promise<{ id: string; folder: string; terminal: WsClient }> {
  const { id, folder } = await startSession(name);
  await prompt(id, 'Run the tests');
  const terminal = connectWs(`ws://127.0.0.1:${port}/api/sessions/${id}/attach`);
  clients.push(terminal);
  await waitFor(() => terminal.text().includes('READY'), 'fake CLI banner');
  return { id, folder, terminal };
}

async function cliPid(terminal: WsClient): Promise<number> {
  typeLine(terminal, '/pid');
  await waitFor(() => /PID:\d+/.test(terminal.text()), 'CLI pid');
  return Number(/PID:(\d+)/.exec(terminal.text())?.[1]);
}

describe('plan-session_notifications/REQ-21, REQ-23, REQ-2 a hosted session that ends without the user', { timeout: TEST_TIMEOUT }, () => {
  it('gives one session_end event with an error within 5 seconds when its CLI exits with code 1', async () => {
    const client = await attention();
    const { id, folder, terminal } = await workingSession('crash');

    const endedAt = Date.now();
    typeLine(terminal, '/crash 1');
    await waitFor(() => sessionEndsOf(client, id).length >= 1, 'session-end event', FIVE_SECONDS);
    expect(Date.now() - endedAt).toBeLessThan(FIVE_SECONDS);

    expect(eventsOf(client, id)).toEqual([
      { id: expect.stringMatching(UUID), sessionId: id, kind: 'session_end', folder, label: 'Run the tests', error: true },
    ]);
  });

  it('gives one session_end event with no error within 5 seconds when kill -9 from another terminal ends its CLI', async () => {
    const client = await attention();
    const { id, folder, terminal } = await workingSession('killed');
    const pid = await cliPid(terminal);

    const endedAt = Date.now();
    process.kill(pid, 'SIGKILL');
    await waitFor(() => sessionEndsOf(client, id).length >= 1, 'session-end event', FIVE_SECONDS);
    expect(Date.now() - endedAt).toBeLessThan(FIVE_SECONDS);

    expect(eventsOf(client, id)).toEqual([
      { id: expect.stringMatching(UUID), sessionId: id, kind: 'session_end', folder, label: 'Run the tests', error: false },
    ]);
  });
});

describe('plan-session_notifications/REQ-22 a hosted session that the user ends', { timeout: TEST_TIMEOUT }, () => {
  it('gives no event when the user types /exit in its terminal', async () => {
    const client = await attention();
    const { id, terminal } = await workingSession('exit-command');

    typeLine(terminal, '/exit');
    await expect.poll(() => externalState(id), { timeout: FIVE_SECONDS }).toBe('ended');
    await delay(NO_EVENT_WAIT);

    expect(eventsOf(client, id)).toEqual([]);
  });

  it('gives no event when the user terminates it', async () => {
    const client = await attention();
    const { id } = await workingSession('terminate');

    const response = await fetch(`${base}/api/sessions/${id}/stop`, { method: 'POST' });
    expect(response.ok).toBe(true);
    await expect.poll(() => externalState(id), { timeout: 10_000 }).toBe('ended');
    await delay(NO_EVENT_WAIT);

    expect(eventsOf(client, id)).toEqual([]);
  });
});

describe('plan-session_notifications/REQ-22 the server shuts down, as when the desktop app quits', { timeout: TEST_TIMEOUT }, () => {
  it('ends its hosted sessions and gives no session_end event before it closes', async () => {
    const ownClaudeDir = await tempDir('ai-client-attention-shutdown-claude-');
    const ownPort = await freePort();
    const ownBase = `http://127.0.0.1:${ownPort}`;
    const ownServer = spawn(path.join(repoRoot, 'node_modules/.bin/tsx'), ['src/server/main.ts'], {
      cwd: repoRoot,
      env: { ...process.env, PORT: String(ownPort), AI_CLIENT_CLAUDE_CLI: FAKE_CLI, CLAUDE_CONFIG_DIR: ownClaudeDir },
      stdio: 'ignore',
    });
    try {
      await expect.poll(() => fetch(`${ownBase}/api/health`).then((r) => r.ok, () => false), { timeout: 20_000 }).toBe(true);
      const client = connectWs(`ws://127.0.0.1:${ownPort}/api/attention`);
      clients.push(client);
      await waitFor(() => client.frames.length >= 1, 'list frame on connect');
      const folder = path.join(projectsRoot, 'shutdown');
      await mkdir(folder, { recursive: true });
      const started = await fetch(`${ownBase}/api/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: folder }),
      });
      const { id } = (await started.json()) as { id: string };
      const post = (event: object) =>
        fetch(`${ownBase}/api/sessions/${id}/hook-events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(event) });
      await post({ hook_event_name: 'UserPromptSubmit', prompt: 'Deploy' });
      await post({ hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
      await waitFor(() => listed(client, id), 'session in the list', FIVE_SECONDS);

      ownServer.kill('SIGTERM');
      await client.closed;

      expect(listed(client, id), 'the session ended before the socket closed').toBe(false);
      expect(sessionEndsOf(client, id)).toEqual([]);
    } finally {
      ownServer.kill('SIGKILL');
      await rm(ownClaudeDir, { recursive: true, force: true });
    }
  });
});
