// REQ tests of plan-wsl_support, batch ended-external-sessions, against the real server process.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FAKE_CLI, type WsClient, connectWs, delay, tempDir, waitFor, writeHistorySession, userEntry } from './test-support.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
// ExternalSessionScanner scans every 2 seconds: one full scan plus margin.
const ONE_SCAN = 2600;
const TEST_TIMEOUT = 30_000;

let server: ChildProcess;
let port: number;
let base: string;
let projectsRoot: string;
// Fixture Claude Code folder (CLAUDE_CONFIG_DIR): the tests never touch the real ~/.claude.
let claudeDir: string;
let dataDir: string;
const clients: WsClient[] = [];
const terminals: ChildProcess[] = [];

interface Summary {
  id: string;
  folder: string;
  label: string;
  state: 'working' | 'needs_input' | 'idle' | 'ended';
  external?: true;
  resumable?: true;
  favorite?: true;
}

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
  projectsRoot = await tempDir('ai-client-ended-ext-projects-');
  claudeDir = await tempDir('ai-client-ended-ext-claude-');
  dataDir = await tempDir('ai-client-ended-ext-data-');
  port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(path.join(repoRoot, 'node_modules/.bin/tsx'), ['src/server/main.ts'], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(port), AI_CLIENT_CLAUDE_CLI: FAKE_CLI, CLAUDE_CONFIG_DIR: claudeDir, AI_CLIENT_DATA_DIR: dataDir },
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
  for (const terminal of terminals) terminal.kill('SIGKILL');
  server.kill('SIGTERM');
  await delay(200);
  await rm(projectsRoot, { recursive: true, force: true });
  await rm(claudeDir, { recursive: true, force: true });
  await rm(dataDir, { recursive: true, force: true });
});

async function listSessions(): Promise<Summary[]> {
  const response = await fetch(`${base}/api/sessions`);
  expect(response.status).toBe(200);
  return (await response.json()) as Summary[];
}

const summaryOf = async (id: string) => (await listSessions()).find((s) => s.id === id);

async function waitForSummary(id: string, check: (s: Summary | undefined) => boolean, label: string, timeoutMs = 8000): Promise<Summary | undefined> {
  const deadline = Date.now() + timeoutMs;
  let summary = await summaryOf(id);
  while (!check(summary)) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for: ${label} (last: ${JSON.stringify(summary)})`);
    await delay(100);
    summary = await summaryOf(id);
  }
  return summary;
}

async function projectFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  return folder;
}

/** Saves the conversation of `sessionId` where SessionHistory finds it. */
const saveConversation = (sessionId: string, folder: string, firstMessage: string) =>
  writeHistorySession(claudeDir, folder.replace(/[^A-Za-z0-9]/g, '-'), sessionId, [userEntry(firstMessage, folder)]);

/** Simulates Claude Code in another terminal: a live process, its sessions/<pid>.json and the <pid>.<hash>.key FIFO. */
async function externalTerminal(sessionId: string, folder: string, status = 'idle'): Promise<{ end(): Promise<void> }> {
  const child = spawn('sleep', ['120'], { stdio: 'ignore' });
  terminals.push(child);
  const pid = child.pid ?? 0;
  const sessionsDir = path.join(claudeDir, 'sessions');
  await mkdir(sessionsDir, { recursive: true });
  execFileSync('mkfifo', [path.join(sessionsDir, `${pid}.9f8e7d6c.key`)]);
  await writeFile(
    path.join(sessionsDir, `${pid}.json`),
    JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status, updatedAt: Date.now() }),
  );
  return {
    end: async () => {
      child.kill('SIGKILL');
      await new Promise((resolve) => child.once('exit', resolve));
    },
  };
}

/** An external entry whose terminal was closed, waited until the list shows it ended. */
async function endedExternal(sessionId: string, options: { saved?: boolean } = {}): Promise<{ folder: string; summary: Summary }> {
  const folder = await projectFolder(sessionId);
  if (options.saved !== false) await saveConversation(sessionId, folder, `Work on ${sessionId}`);
  const terminal = await externalTerminal(sessionId, folder);
  await waitForSummary(sessionId, (s) => s?.state === 'idle', `${sessionId} listed`);
  await terminal.end();
  const summary = await waitForSummary(sessionId, (s) => s?.state === 'ended', `${sessionId} ended`);
  return { folder, summary: summary as Summary };
}

const post = (url: string, body?: object) =>
  fetch(`${base}${url}`, {
    method: 'POST',
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
const put = (url: string, body: object) =>
  fetch(`${base}${url}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function attach(id: string): Promise<WsClient> {
  const client = connectWs(`ws://127.0.0.1:${port}/api/sessions/${id}/attach`, { Origin: base });
  clients.push(client);
  await waitFor(() => client.text().includes('READY'), 'fake CLI banner');
  return client;
}

const resumeArgs = (client: WsClient) => JSON.parse(client.text().match(/ARGS:(\[[^\]]*\])/)?.[1] ?? 'null') as string[] | null;

async function exitHosted(client: WsClient): Promise<void> {
  client.send({ type: 'input', data: '/exit\r' });
  await client.closed;
}

async function pastSessionIds(): Promise<string[]> {
  const response = await fetch(`${base}/api/past-sessions`);
  expect(response.status).toBe(200);
  return ((await response.json()) as { sessions: { id: string }[] }[]).flatMap((group) => group.sessions.map((s) => s.id));
}

describe('plan-wsl_support/REQ-7, REQ-8, REQ-15 a closed terminal leaves an ended entry', { timeout: TEST_TIMEOUT }, () => {
  it('keeps the entry as ended, external and resumable, with its name and favorite mark, over the next scans', async () => {
    const folder = await projectFolder('ws-kept');
    await saveConversation('ws-kept', folder, 'Fix the nightly job');
    const terminal = await externalTerminal('ws-kept', folder);
    await waitForSummary('ws-kept', (s) => s !== undefined, 'external entry listed');
    expect((await put('/api/sessions/ws-kept/name', { name: 'Nightly' })).status).toBe(204);
    expect((await put('/api/sessions/ws-kept/favorite', { favorite: true })).status).toBe(204);
    await waitForSummary('ws-kept', (s) => s?.label === 'Nightly' && s.favorite === true, 'name and favorite');

    await terminal.end();
    const ended = await waitForSummary('ws-kept', (s) => s?.state === 'ended', 'external entry ended');
    expect(ended).toMatchObject({ id: 'ws-kept', folder, label: 'Nightly', state: 'ended', external: true, resumable: true, favorite: true });

    await delay(ONE_SCAN * 2);
    expect(await summaryOf('ws-kept')).toEqual(ended);
  });

  it('an ended entry whose conversation is not saved is not resumable', async () => {
    const { summary } = await endedExternal('ws-unsaved', { saved: false });
    expect(summary.external).toBe(true);
    expect(summary).not.toHaveProperty('resumable');
  });
});

describe('plan-wsl_support/REQ-9 Dismiss of an ended external entry', { timeout: TEST_TIMEOUT }, () => {
  it('409 not_ended while the external session runs, and the entry stays', async () => {
    const folder = await projectFolder('ws-running-dismiss');
    const terminal = await externalTerminal('ws-running-dismiss', folder);
    await waitForSummary('ws-running-dismiss', (s) => s !== undefined, 'external entry listed');
    const response = await post('/api/sessions/ws-running-dismiss/dismiss');
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'not_ended' });
    expect((await summaryOf('ws-running-dismiss'))?.state).toBe('idle');
    await terminal.end();
  });

  it('204 removes the ended entry for good, notifies its removal, and the conversation stays in the history', async () => {
    const events = connectWs(`ws://127.0.0.1:${port}/api/sessions/events`, { Origin: base });
    clients.push(events);
    await new Promise<void>((resolve) => events.socket.once('open', () => resolve()));
    await endedExternal('ws-dismiss');

    const response = await post('/api/sessions/ws-dismiss/dismiss');
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(await summaryOf('ws-dismiss')).toBeUndefined();
    await waitFor(
      () =>
        events.frames.some((frame) => {
          const parsed = JSON.parse(frame) as { type: string; id?: string };
          return parsed.type === 'session-removed' && parsed.id === 'ws-dismiss';
        }),
      'session-removed event',
    );

    await delay(ONE_SCAN);
    expect(await summaryOf('ws-dismiss')).toBeUndefined();
    expect(await pastSessionIds()).toContain('ws-dismiss');

    const again = await post('/api/sessions/ws-dismiss/dismiss');
    expect(again.status).toBe(404);
    expect(await again.json()).toEqual({ error: 'session_not_found' });
  });

  it('404 session_not_found for an id that no one knows', async () => {
    const response = await post('/api/sessions/ws-nobody/dismiss');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'session_not_found' });
  });

  // Gatekeeper decision on REQ-9: a dismissed conversation that runs again in a terminal is a live entry
  it('a dismissed conversation that runs again in a terminal is listed as a running external entry', async () => {
    const { folder } = await endedExternal('ws-again');
    expect((await post('/api/sessions/ws-again/dismiss')).status).toBe(204);
    const terminal = await externalTerminal('ws-again', folder, 'busy');
    const live = await waitForSummary('ws-again', (s) => s !== undefined, 'running entry again');
    expect(live).toMatchObject({ state: 'working', external: true });
    await terminal.end();
  });
});

describe('plan-wsl_support/REQ-10, REQ-12 Resume of an ended external entry', { timeout: TEST_TIMEOUT }, () => {
  it('201 resumes the conversation in a new hosted session, and the list holds only the new entry', async () => {
    const { folder } = await endedExternal('ws-resume');

    const response = await post('/api/sessions/ws-resume/resume', {});
    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };

    const list = await listSessions();
    expect(list.find((s) => s.id === 'ws-resume')).toBeUndefined();
    expect(list.find((s) => s.id === id)).toMatchObject({ folder });
    expect(list.find((s) => s.id === id)).not.toHaveProperty('external');

    const client = await attach(id);
    expect(client.text()).toContain(`CWD:${folder}`);
    expect(resumeArgs(client)?.slice(-2)).toEqual(['--resume', 'ws-resume']);

    await delay(ONE_SCAN);
    expect(await summaryOf('ws-resume')).toBeUndefined();
    await exitHosted(client);
  });

  it('409 not_ended for a running external entry, and nothing starts', async () => {
    const folder = await projectFolder('ws-running-resume');
    await saveConversation('ws-running-resume', folder, 'Still running');
    const terminal = await externalTerminal('ws-running-resume', folder);
    await waitForSummary('ws-running-resume', (s) => s !== undefined, 'external entry listed');
    const before = (await listSessions()).length;

    const response = await post('/api/sessions/ws-running-resume/resume', {});
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'not_ended' });
    expect(await listSessions()).toHaveLength(before);
    await terminal.end();
  });

  it('404 folder_not_found when the project folder is gone, and the entry stays ended', async () => {
    const { folder } = await endedExternal('ws-no-folder');
    await rm(folder, { recursive: true });
    const before = (await listSessions()).length;

    const response = await post('/api/sessions/ws-no-folder/resume', {});
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'folder_not_found' });
    expect(await listSessions()).toHaveLength(before);
    expect((await summaryOf('ws-no-folder'))?.state).toBe('ended');
  });

  // REQ-12 covers "Resume here" and a resume from the history: both go through the past-sessions route
  it('a resume through the past-sessions route also removes the ended external entry', async () => {
    await endedExternal('ws-resume-here');

    const response = await post('/api/past-sessions/ws-resume-here/resume');
    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    const client = await attach(id);

    await waitForSummary('ws-resume-here', (s) => s === undefined, 'ended external entry removed', ONE_SCAN * 2);
    expect(await summaryOf(id)).toBeDefined();
    await exitHosted(client);
  });
});

describe('plan-wsl_support/REQ-14 an ended external session gives no system notification', { timeout: TEST_TIMEOUT }, () => {
  it.each(['idle', 'busy', 'waiting'])('gives no attention event when a %s external session ends', async (status) => {
    const attention = connectWs(`ws://127.0.0.1:${port}/api/attention`);
    clients.push(attention);
    await waitFor(() => attention.frames.length >= 1, 'list frame on connect');
    const sessionId = `ws-quiet-${status}`;
    const folder = await projectFolder(sessionId);
    await saveConversation(sessionId, folder, 'Quiet please');
    const terminal = await externalTerminal(sessionId, folder, status);
    await waitForSummary(sessionId, (s) => s !== undefined, 'external entry listed');
    await delay(ONE_SCAN);
    const eventsOf = () =>
      attention.frames
        .map((frame) => JSON.parse(frame) as { type: string; event?: { sessionId: string; kind: string } })
        .filter((frame) => frame.type === 'event' && frame.event?.sessionId === sessionId);
    const before = eventsOf().length;

    await terminal.end();
    await waitForSummary(sessionId, (s) => s?.state === 'ended', 'external entry ended');
    await delay(ONE_SCAN);
    expect(eventsOf().slice(before)).toEqual([]);
  });
});
