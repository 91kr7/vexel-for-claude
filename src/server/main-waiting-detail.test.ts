// REQ tests of plan-remote_notifications, batch remote-notification: the waiting detail of the attention events, against the real server process.
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FAKE_CLI, type WsClient, connectWs, delay, tempDir, waitFor } from './test-support.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const FIVE_SECONDS = 5000;
const TEST_TIMEOUT = 30_000;

let server: ChildProcess;
let base: string;
let port: number;
let projectsRoot: string;
let claudeDir: string;
const clients: WsClient[] = [];

interface AttentionEvent {
  sessionId: string;
  kind: string;
  waitingTool?: string;
  waitingDetail?: unknown;
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
  projectsRoot = await tempDir('ai-client-detail-projects-');
  claudeDir = await tempDir('ai-client-detail-claude-');
  port = await freePort();
  base = `http://127.0.0.1:${port}`;
  // The real Node process, not the tsx wrapper: the stop signal must reach the server (knowledge base `tests-stop-their-processes`).
  server = spawn(process.execPath, ['--import', 'tsx', 'src/server/main.ts'], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(port), AI_CLIENT_CLAUDE_CLI: FAKE_CLI, CLAUDE_CONFIG_DIR: claudeDir },
    stdio: 'ignore',
  });
  const deadline = Date.now() + 20_000;
  while (!(await fetch(`${base}/api/health`).then((r) => r.ok, () => false))) {
    if (Date.now() > deadline) throw new Error('server did not start');
    await delay(200);
  }
}, 30_000);

afterAll(async () => {
  for (const client of clients) client.socket.terminate();
  const exited = new Promise((resolve) => server.once('exit', resolve));
  server.kill('SIGTERM');
  await Promise.race([exited, delay(10_000)]);
  if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
  await rm(projectsRoot, { recursive: true, force: true });
  await rm(claudeDir, { recursive: true, force: true });
}, 20_000);

async function attention(): Promise<WsClient> {
  const client = connectWs(`ws://127.0.0.1:${port}/api/attention`);
  clients.push(client);
  await waitFor(() => client.frames.length >= 1, 'list frame on connect');
  return client;
}

const needsInputEvents = (client: WsClient, sessionId: string) =>
  client.frames
    .map((frame) => JSON.parse(frame) as { type: string; event?: AttentionEvent })
    .flatMap((frame) => (frame.type === 'event' && frame.event?.sessionId === sessionId && frame.event.kind === 'needs_input' ? [frame.event] : []));

async function startSession(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder, { recursive: true });
  const response = await fetch(`${base}/api/sessions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: folder }) });
  expect(response.status).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

async function hook(id: string, event: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${base}/api/sessions/${id}/hook-events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
  });
  expect(response.ok).toBe(true);
}

describe('plan-remote_notifications/REQ-31 a permission request', { timeout: TEST_TIMEOUT }, () => {
  it('gives a needs_input event with the tool and the whole command', async () => {
    const client = await attention();
    const id = await startSession('permission');
    const command = `npm run build && ${'echo step && '.repeat(400)}npm test`;
    await hook(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Build it' });
    await hook(id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command, description: 'Build and test' } });

    await waitFor(() => needsInputEvents(client, id).length >= 1, 'needs-input event', FIVE_SECONDS);
    expect(needsInputEvents(client, id)).toEqual([expect.objectContaining({ waitingTool: 'Bash', waitingDetail: { kind: 'argument', text: command } })]);
  });

  it('gives the file path of the last PreToolUse when the permission comes as a permission_prompt notification', async () => {
    const client = await attention();
    const id = await startSession('permission-prompt');
    await hook(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Fix the form' });
    await hook(id, { hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: '/home/dev/app/src/login.ts', old_string: 'a', new_string: 'b' } });
    await hook(id, { hook_event_name: 'Notification', notification_type: 'permission_prompt' });

    await waitFor(() => needsInputEvents(client, id).length >= 1, 'needs-input event', FIVE_SECONDS);
    expect(needsInputEvents(client, id)).toEqual([
      expect.objectContaining({ waitingTool: 'Edit', waitingDetail: { kind: 'argument', text: '/home/dev/app/src/login.ts' } }),
    ]);
  });

  it('gives no waiting detail when the hook event has no tool input', async () => {
    const client = await attention();
    const id = await startSession('no-input');
    await hook(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Deploy' });
    await hook(id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });

    await waitFor(() => needsInputEvents(client, id).length >= 1, 'needs-input event', FIVE_SECONDS);
    expect(needsInputEvents(client, id)[0]).not.toHaveProperty('waitingDetail');
  });

  it('a new wait after an answer gives the detail of the new request', async () => {
    const client = await attention();
    const id = await startSession('two-waits');
    await hook(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Deploy' });
    await hook(id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'npm run build' } });
    await waitFor(() => needsInputEvents(client, id).length >= 1, 'first event', FIVE_SECONDS);
    await hook(id, { hook_event_name: 'PostToolUse', tool_name: 'Bash' });
    await hook(id, { hook_event_name: 'PermissionRequest', tool_name: 'Write', tool_input: { file_path: '/home/dev/app/deploy.log', content: 'ok' } });

    await waitFor(() => needsInputEvents(client, id).length >= 2, 'second event', FIVE_SECONDS);
    expect(needsInputEvents(client, id).map((event) => event.waitingDetail)).toEqual([
      { kind: 'argument', text: 'npm run build' },
      { kind: 'argument', text: '/home/dev/app/deploy.log' },
    ]);
  });
});

describe('plan-remote_notifications/REQ-32 a question from Claude', { timeout: TEST_TIMEOUT }, () => {
  it('gives a needs_input event with the questions and their options', async () => {
    const client = await attention();
    const id = await startSession('question');
    await hook(id, { hook_event_name: 'UserPromptSubmit', prompt: 'Pick a library' });
    await hook(id, {
      hook_event_name: 'PreToolUse',
      tool_name: 'AskUserQuestion',
      tool_input: {
        questions: [
          { question: 'Which library?', header: 'Library', multiSelect: false, options: [{ label: 'React', description: 'UI' }, { label: 'Vue', description: 'UI' }] },
          { question: 'Add tests?', header: 'Tests', multiSelect: false, options: [{ label: 'Yes' }, { label: 'No' }] },
        ],
      },
    });

    await waitFor(() => needsInputEvents(client, id).length >= 1, 'needs-input event', FIVE_SECONDS);
    expect(needsInputEvents(client, id)[0]?.waitingDetail).toEqual({
      kind: 'questions',
      questions: [
        { question: 'Which library?', options: ['React', 'Vue'] },
        { question: 'Add tests?', options: ['Yes', 'No'] },
      ],
    });
  });
});
