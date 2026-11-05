import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tempDir } from '../test-support.js';
import { buildHookSettings, hookCommand, writeHookSettings } from './hook-settings.js';

const SERVER_URL = 'http://127.0.0.1:45678';
const FORWARDER = fileURLToPath(new URL('./hook-forwarder.mjs', import.meta.url));

interface RecordedRequest {
  method: string;
  url: string;
  contentType: string | undefined;
  body: string;
}

interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
  elapsedMs: number;
}

function runHookCommand(command: string, stdin: string, env: Record<string, string | undefined>): Promise<CommandResult> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', command], { env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr, elapsedMs: Date.now() - started }));
    child.stdin.end(stdin);
  });
}

describe('buildHookSettings', () => {
  const settings = buildHookSettings(SERVER_URL) as { hooks: Record<string, { matcher?: string; hooks: unknown[] }[]> };
  const handler = { type: 'command', command: hookCommand(SERVER_URL), timeout: 10 };

  // plan-claude_sessions_client/REQ-14: the settings file holds only hooks
  it('has only the key hooks, with the six events', () => {
    expect(Object.keys(settings)).toEqual(['hooks']);
    expect(Object.keys(settings.hooks).sort()).toEqual(
      ['Notification', 'PermissionRequest', 'PostToolUse', 'PreToolUse', 'Stop', 'UserPromptSubmit'].sort(),
    );
  });

  // plan-claude_sessions_client/REQ-14: matchers of HookSettings
  it('uses the matchers of the contract and one command hook per event', () => {
    const expectedMatcher: Record<string, string | undefined> = {
      UserPromptSubmit: undefined,
      PreToolUse: '*',
      PostToolUse: '*',
      PermissionRequest: '*',
      Notification: 'permission_prompt|elicitation_dialog|idle_prompt',
      Stop: undefined,
    };
    for (const [event, matcher] of Object.entries(expectedMatcher)) {
      const groups = settings.hooks[event] ?? [];
      expect(groups, event).toHaveLength(1);
      expect(groups[0]?.matcher, event).toBe(matcher);
      expect(groups[0]?.hooks, event).toEqual([handler]);
    }
  });
});

describe('hookCommand', () => {
  // plan-claude_sessions_client/REQ-14: node, forwarder and server url, each single-quoted
  it('is the quoted node executable, forwarder path and server url', () => {
    expect(hookCommand(SERVER_URL)).toBe(`'${process.execPath}' '${FORWARDER}' '${SERVER_URL}'`);
  });
});

describe('writeHookSettings', () => {
  // plan-claude_sessions_client/REQ-14: written in the given folder, mode 0600, with the built content
  it('writes hook-settings.json in the given folder with mode 0600', async () => {
    const dir = await tempDir('ai-client-hooks-test-');
    const file = await writeHookSettings(SERVER_URL, dir);
    expect(file).toBe(path.join(dir, 'hook-settings.json'));
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(buildHookSettings(SERVER_URL));
  });

  // plan-claude_sessions_client/REQ-14: default folder is private, under the temp folder, outside ~/.claude
  it('without a folder, writes in a new ai-client-hooks-* folder under the system temp folder', async () => {
    const first = await writeHookSettings(SERVER_URL);
    const second = await writeHookSettings(SERVER_URL);
    for (const file of [first, second]) {
      expect(path.isAbsolute(file)).toBe(true);
      expect(path.dirname(path.dirname(file))).toBe(os.tmpdir());
      expect(path.basename(path.dirname(file))).toMatch(/^ai-client-hooks-/);
      expect(path.basename(file)).toBe('hook-settings.json');
      expect(file.startsWith(path.join(os.homedir(), '.claude'))).toBe(false);
      expect((await stat(file)).mode & 0o777).toBe(0o600);
    }
    expect(path.dirname(first)).not.toBe(path.dirname(second));
  });
});

describe('hook forwarder', () => {
  const requests: RecordedRequest[] = [];
  let server: http.Server;
  let serverUrl: string;
  let hang = false;

  beforeAll(async () => {
    server = http.createServer((request, response) => {
      let body = '';
      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        requests.push({ method: request.method ?? '', url: request.url ?? '', contentType: request.headers['content-type'], body });
        if (hang) return;
        response.statusCode = 204;
        response.end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as { port: number };
    serverUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const event = JSON.stringify({ session_id: 'claude-1', hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls é' } });

  // plan-claude_sessions_client/REQ-14: stdin is posted unchanged to the hook route of the session
  it('posts stdin unchanged as JSON to /api/sessions/<AI_CLIENT_SESSION_ID>/hook-events, silently, exit 0', async () => {
    requests.length = 0;
    const result = await runHookCommand(hookCommand(serverUrl), event, { AI_CLIENT_SESSION_ID: 'client-42' });
    expect(result).toMatchObject({ code: 0, stdout: '', stderr: '' });
    expect(requests).toEqual([
      { method: 'POST', url: '/api/sessions/client-42/hook-events', contentType: 'application/json', body: event },
    ]);
  });

  // plan-claude_sessions_client/REQ-14: no session id, nothing posted
  it('posts nothing without AI_CLIENT_SESSION_ID, and exits 0 silently', async () => {
    requests.length = 0;
    const result = await runHookCommand(hookCommand(serverUrl), event, { AI_CLIENT_SESSION_ID: undefined });
    expect(result).toMatchObject({ code: 0, stdout: '', stderr: '' });
    expect(requests).toEqual([]);
  });

  // plan-claude_sessions_client/REQ-14: no server url, nothing posted
  it('posts nothing without a server url, and exits 0 silently', async () => {
    requests.length = 0;
    const result = await runHookCommand(`'${process.execPath}' '${FORWARDER}'`, event, { AI_CLIENT_SESSION_ID: 'client-42' });
    expect(result).toMatchObject({ code: 0, stdout: '', stderr: '' });
    expect(requests).toEqual([]);
  });

  // plan-claude_sessions_client/REQ-14: a hook never changes Claude's behavior, server down included
  it('exits 0 silently when the server is not reachable', async () => {
    const result = await runHookCommand(hookCommand('http://127.0.0.1:1'), event, { AI_CLIENT_SESSION_ID: 'client-42' });
    expect(result).toMatchObject({ code: 0, stdout: '', stderr: '' });
  });

  // plan-claude_sessions_client/REQ-14: gives up after 3 seconds
  it('gives up after about 3 seconds when the server does not answer, and exits 0 silently', async () => {
    hang = true;
    try {
      const result = await runHookCommand(hookCommand(serverUrl), event, { AI_CLIENT_SESSION_ID: 'client-42' });
      expect(result).toMatchObject({ code: 0, stdout: '', stderr: '' });
      expect(result.elapsedMs).toBeGreaterThanOrEqual(2500);
      expect(result.elapsedMs).toBeLessThan(6000);
    } finally {
      hang = false;
    }
  }, 15_000);
});
