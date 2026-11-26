// e2e of plan-remote_notifications, batch remote-notification, in the desktop app. Each launch gets its own HOME, free port and Claude folder,
// and a private D-Bus session bus whose notification server and tray host are fakes. A local fake ntfy server stands in for the phone:
// nothing reaches ntfy.sh. There is no shortcut for the 60-second wait, so each test waits one real minute.
import { type ChildProcess, type ChildProcessByStdio, execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { type IncomingHttpHeaders, type Server, createServer } from 'node:http';
import { createRequire } from 'node:module';
import net, { type AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { Message, type MessageBus, Variant, sessionBus } from '@jellybrick/dbus-next';
import { type ElectronApplication, type Page, _electron, expect, test } from '@playwright/test';
import { killLeftovers } from './leftovers';
import { settingsButton, settingsPopup } from './settings';
import { quitDesktop } from './desktop-quit';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const electronBinary = createRequire(import.meta.url)('electron') as string;
const fakeClaude = fileURLToPath(new URL('../test-support/fake-claude.mjs', import.meta.url));
const NAME = 'org.freedesktop.Notifications';
const OBJECT_PATH = '/org/freedesktop/Notifications';
const WATCHER = 'org.kde.StatusNotifierWatcher';
const WATCHER_PATH = '/StatusNotifierWatcher';
const PROPERTIES = 'org.freedesktop.DBus.Properties';

const REMOTE = 'Send a remote notification after 60 seconds of waiting';
const TOKEN = 'tk_remote_e2e_secret';
// plan-remote_notifications/REQ-19: 60 seconds of waiting.
const REMOTE_DELAY = 60_000;
// The wait for a remote notification: the 60 seconds plus a margin that a loaded machine cannot exhaust.
// The 5-second bound of REQ-28 is proved by the unit tests of RemoteRule and RemoteNotifier, not here.
const REMOTE_WAIT = REMOTE_DELAY + 45_000;

let daemon: ChildProcessByStdio<null, Readable, null>;
let busAddress: string;
let service: MessageBus;
let nextId = 90;
const notifyCalls: { summary: string; body: string }[] = [];
const apps: ElectronApplication[] = [];
const ports: number[] = [];
const dirs: string[] = [];
const ntfyServers: Server[] = [];
const sleepers: ChildProcess[] = [];

/** The fake notification server and tray host: they answer what the app asks, and record each Notify. */
function handle(msg: Message): boolean {
  const reply = (signature = '', values: unknown[] = []) => {
    service.send(Message.newMethodReturn(msg, signature, values));
    return true;
  };
  if (msg.path === WATCHER_PATH) {
    if (msg.interface === WATCHER) return reply();
    const properties: Record<string, Variant> = {
      IsStatusNotifierHostRegistered: new Variant('b', true),
      ProtocolVersion: new Variant('i', 0),
      RegisteredStatusNotifierItems: new Variant('as', []),
    };
    if (msg.interface === PROPERTIES && msg.member === 'GetAll') return reply('a{sv}', [properties]);
    if (msg.interface === PROPERTIES && msg.member === 'Get') {
      const value = properties[(msg.body as [string, string])[1]];
      return value ? reply('v', [value]) : false;
    }
    return false;
  }
  if (msg.interface !== NAME || msg.path !== OBJECT_PATH) return false;
  if (msg.member === 'GetCapabilities') return reply('as', [['body', 'actions', 'persistence']]);
  if (msg.member === 'Notify') {
    const body = msg.body as unknown[];
    notifyCalls.push({ summary: body[3] as string, body: body[4] as string });
    return reply('u', [(nextId += 1)]);
  }
  if (msg.member === 'CloseNotification') return reply();
  return false;
}

test.beforeAll(async () => {
  execFileSync('npx', ['tsc', '-b', 'tsconfig.desktop.build.json'], { cwd: repoRoot, stdio: 'ignore' });
  expect(existsSync(path.join(repoRoot, 'dist/web/index.html'))).toBe(true);
  daemon = spawn('dbus-daemon', ['--session', '--nofork', '--print-address=1', `--address=unix:tmpdir=${os.tmpdir()}`], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  busAddress = await new Promise<string>((resolve, reject) => {
    daemon.once('error', reject);
    daemon.stdout.once('data', (data: Buffer) => resolve(data.toString().trim().split('\n')[0] ?? ''));
  });
  expect(busAddress).toMatch(/^unix:path=/);
  service = sessionBus({ busAddress });
  service.addMethodHandler(handle);
  // 4 = DO_NOT_QUEUE; 1 = primary owner.
  expect(await service.requestName(NAME, 4)).toBe(1);
  expect(await service.requestName(WATCHER, 4)).toBe(1);
});

test.afterAll(() => {
  service?.disconnect();
  daemon?.kill('SIGTERM');
});

test.beforeEach(() => {
  notifyCalls.length = 0;
});

test.afterEach(async () => {
  for (const app of apps.splice(0)) await quitDesktop(app);
  for (const server of ntfyServers.splice(0)) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  for (const sleeper of sleepers.splice(0)) sleeper.kill('SIGKILL');
  for (const port of ports.splice(0)) await stopListeners(port);
  for (const dir of dirs.splice(0)) {
    killLeftovers(dir);
    await rm(dir, { recursive: true, force: true });
  }
});

async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  await new Promise((resolve) => server.close(resolve));
  ports.push(address.port);
  return address.port;
}

function listenerPids(port: number): number[] {
  const out = execFileSync('ss', ['-Hltnp', `sport = :${port}`], { encoding: 'utf8' });
  return [...out.matchAll(/pid=(\d+)/g)].map((match) => Number(match[1]));
}

async function stopListeners(port: number): Promise<void> {
  for (const pid of listenerPids(port)) {
    if (pid === process.pid) continue;
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      continue;
    }
    await expect
      .poll(() => listenerPids(port).includes(pid), { timeout: 5000 })
      .toBe(false)
      .catch(() => process.kill(pid, 'SIGKILL'));
  }
}

interface Desktop {
  app: ElectronApplication;
  window: Page;
  port: number;
  home: string;
  /** Everything the main process wrote to its standard output and standard error. */
  output: string[];
}

/** Launches the app on its own HOME; `prepare` runs on that HOME before the launch. */
async function readyDesktop(prepare?: (home: string) => Promise<void>): Promise<Desktop> {
  const port = await freePort();
  const home = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-remote-send-'));
  dirs.push(home);
  await prepare?.(home);
  const base = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  delete base.ELECTRON_RUN_AS_NODE;
  const env = {
    ...base,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    XDG_CACHE_HOME: path.join(home, '.cache'),
    XDG_DATA_HOME: path.join(home, '.local/share'),
    PORT: String(port),
    AI_CLIENT_NODE: process.execPath,
    CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
    AI_CLIENT_CLAUDE_CLI: fakeClaude,
    DBUS_SESSION_BUS_ADDRESS: busAddress,
  };
  const app = await _electron.launch({ executablePath: electronBinary, args: ['.'], cwd: repoRoot, env });
  apps.push(app);
  const output: string[] = [];
  app.process().stdout?.on('data', (data: Buffer) => output.push(data.toString()));
  app.process().stderr?.on('data', (data: Buffer) => output.push(data.toString()));
  const window = await app.firstWindow();
  await expect(window.getByRole('region', { name: 'Session List' })).toBeVisible({ timeout: 20_000 });
  return { app, window, port, home, output };
}

const panel = (page: Page) => settingsPopup(page).getByRole('tabpanel', { name: 'Notifications' });

/** Sets the topic URL and the token, and turns the remote switch on, as the user does in the settings. */
async function turnRemoteOn(page: Page, topicUrl: string, token: string): Promise<void> {
  await settingsButton(page).click();
  await settingsPopup(page).getByRole('tab', { name: 'Notifications', exact: true }).click();
  await panel(page).getByRole('textbox', { name: 'Topic URL', exact: true }).fill(topicUrl);
  await panel(page).getByLabel('Access token (optional)', { exact: true }).fill(token);
  const remoteSwitch = panel(page).getByRole('switch', { name: REMOTE, exact: true });
  await remoteSwitch.click();
  await expect(remoteSwitch).toHaveAttribute('aria-checked', 'true');
  await settingsPopup(page).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
}

interface NtfyRequest {
  at: number;
  headers: IncomingHttpHeaders;
  body: { topic?: string; title?: string; message?: string; priority?: number };
}

/** A fake ntfy server on a free local port: it records each request and answers with `status`. With `hold`, it answers only on `release()`. */
async function fakeNtfy(status = 200, hold = false) {
  const received: NtfyRequest[] = [];
  const answered: number[] = [];
  const held: (() => void)[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      received.push({ at: Date.now(), headers: request.headers, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as NtfyRequest['body'] });
      const answer = () => {
        answered.push(Date.now());
        response.writeHead(status, { 'Content-Type': 'application/json' }).end('{}');
      };
      if (hold) held.push(answer);
      else answer();
    });
  });
  ntfyServers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const release = () => {
    for (const answer of held.splice(0)) answer();
  };
  return { topicUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/my-topic`, received, answered, release };
}

async function startSession(port: number, folder: string): Promise<string> {
  await mkdir(folder, { recursive: true });
  const response = await fetch(`http://127.0.0.1:${port}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: folder }),
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

async function hook(port: number, id: string, event: Record<string, unknown>): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${port}/api/sessions/${id}/hook-events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
  });
  expect(response.ok).toBe(true);
}

async function sessionOf(port: number, id: string): Promise<{ state: string; label: string } | undefined> {
  const sessions = (await (await fetch(`http://127.0.0.1:${port}/api/sessions`)).json()) as { id: string; state: string; label: string }[];
  return sessions.find((session) => session.id === id);
}

/** Writes the Claude Code session file of a session in a terminal, kept alive by a `sleep` process. */
async function terminalSession(claudeDir: string, sessionId: string, cwd: string, status: string): Promise<(status: string) => Promise<void>> {
  const sleeper = spawn('sleep', ['600'], { stdio: 'ignore' });
  sleepers.push(sleeper);
  const pid = sleeper.pid!;
  await mkdir(path.join(claudeDir, 'sessions'), { recursive: true });
  await mkdir(cwd, { recursive: true });
  const write = (next: string) =>
    writeFile(path.join(claudeDir, 'sessions', `${pid}.json`), JSON.stringify({ pid, sessionId, cwd, kind: 'interactive', status: next, updatedAt: Date.now() }));
  await write(status);
  return write;
}

const windowState = async (app: ElectronApplication) =>
  (await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((window) => ({ visible: window.isVisible(), focused: window.isFocused() }))))[0];
const closeWindow = (app: ElectronApplication) => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
const focusWindow = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]!;
    window.show();
    window.focus();
  });
const byTitle = (received: NtfyRequest[], title: string) => received.filter((request) => request.body.title === title);

test.describe('Remote notification from the desktop app', () => {
  test.describe.configure({ timeout: 240_000 });

  // Scenarios "The phone shows the command Claude wants to run", "The phone shows Claude's question and its options",
  // "A quick answer sends nothing", "An external session sends a generic notification", "No notification for a session that already waited",
  // "A long command is shortened". The window keeps the focus here; the next test covers the window closed to the tray (REQ-26).
  test('REQ-19, REQ-21, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36: each session waiting 60 seconds posts one notification with its detail', async () => {
    const ntfy = await fakeNtfy();
    let terminalWaits: (status: string) => Promise<void> = () => Promise.resolve();
    const { app, window, port, home } = await readyDesktop(async (prepared) => {
      // REQ-24: a session in a terminal that already needs input before the app starts.
      await terminalSession(path.join(prepared, '.claude'), 'ext-already', path.join(prepared, 'already-waiting'), 'waiting');
      terminalWaits = await terminalSession(path.join(prepared, '.claude'), 'ext-billing', path.join(prepared, 'billing'), 'busy');
    });
    await turnRemoteOn(window, ntfy.topicUrl, TOKEN);
    await focusWindow(app);
    await expect.poll(async () => (await windowState(app))?.focused, 'REQ-26: the window has the focus').toBe(true);

    const deploy = await startSession(port, path.join(home, 'ai-client'));
    const question = await startSession(port, path.join(home, 'docs-site'));
    const quick = await startSession(port, path.join(home, 'quick-fix'));
    const long = await startSession(port, path.join(home, 'long-command'));
    await expect.poll(async () => (await sessionOf(port, 'ext-billing'))?.state, { timeout: 15_000 }).toBe('working');
    await expect.poll(async () => (await sessionOf(port, 'ext-already'))?.state, { timeout: 15_000 }).toBe('needs_input');
    for (const [id, prompt] of [
      [deploy, 'Deploy the app'],
      [question, 'Pick a library'],
      [quick, 'Fix the typo'],
      [long, 'Run the long script'],
    ] as const) {
      await hook(port, id, { hook_event_name: 'UserPromptSubmit', prompt });
    }

    const longCommand = `./scripts/migrate.sh ${'--table customers_and_orders_archive '.repeat(150)}`;
    const enteredAt = Date.now();
    await hook(port, deploy, { hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'npm run deploy -- --prod', description: 'Deploy' } });
    await hook(port, question, {
      hook_event_name: 'PreToolUse',
      tool_name: 'AskUserQuestion',
      tool_input: { questions: [{ question: 'Which library?', header: 'Library', multiSelect: false, options: [{ label: 'React' }, { label: 'Vue' }] }] },
    });
    await hook(port, quick, { hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'sed -i s/teh/the/ README.md' } });
    await hook(port, long, { hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: longCommand } });
    await terminalWaits('waiting');
    await expect.poll(async () => (await sessionOf(port, 'ext-billing'))?.state, { timeout: 15_000 }).toBe('needs_input');

    // REQ-21, REQ-25: the quick session gets its answer and ends its turn well before 60 seconds.
    await hook(port, quick, { hook_event_name: 'PostToolUse', tool_name: 'Bash' });
    await hook(port, quick, { hook_event_name: 'Stop' });

    await expect.poll(() => ntfy.received.length, { timeout: REMOTE_WAIT, intervals: [250] }).toBeGreaterThanOrEqual(4);
    // A margin after the last send: a wrong extra notification would show here.
    await window.waitForTimeout(3_000);

    const label = (await sessionOf(port, 'ext-billing'))?.label;
    const deploySent = byTitle(ntfy.received, 'ai-client · Deploy the app');
    const questionSent = byTitle(ntfy.received, 'docs-site · Pick a library');
    const longSent = byTitle(ntfy.received, 'long-command · Run the long script');
    const externalSent = byTitle(ntfy.received, `billing · ${label}`);
    expect(ntfy.received.map((request) => request.body.title).sort(), 'REQ-21, REQ-24, REQ-25: nothing for the quick and the already-waiting sessions').toEqual(
      ['ai-client · Deploy the app', 'docs-site · Pick a library', 'long-command · Run the long script', `billing · ${label}`].sort(),
    );

    // REQ-19: not before 60 seconds of waiting. The upper bound is the REMOTE_WAIT poll limit above (REQ-28 is proved by the unit tests).
    for (const sent of [deploySent, questionSent, longSent, externalSent]) expect(sent[0]!.at - enteredAt).toBeGreaterThanOrEqual(REMOTE_DELAY);

    for (const request of ntfy.received) {
      expect(request.body.topic).toBe('my-topic');
      expect(request.body.priority, 'REQ-35').toBe(4);
      expect(request.headers.authorization, 'REQ-29').toBe(`Bearer ${TOKEN}`);
    }
    expect(deploySent[0]!.body.message, 'REQ-30, REQ-31, REQ-34').toBe('Permission for Bash\nnpm run deploy -- --prod\nWaiting for 1 min');
    expect(questionSent[0]!.body.message, 'REQ-32').toBe('Claude asks:\nWhich library?\n- React\n- Vue\nWaiting for 1 min');
    expect(externalSent[0]!.body.message, 'REQ-33').toBe('Needs your input\nWaiting for 1 min');

    // REQ-36
    const shortened = longSent[0]!.body.message ?? '';
    expect(Buffer.byteLength(shortened, 'utf8')).toBeLessThanOrEqual(4096);
    expect(shortened.startsWith(`Permission for Bash\n${longCommand.slice(0, 1000)}`)).toBe(true);
    expect(shortened.endsWith('\n[Text shortened]\nWaiting for 1 min')).toBe(true);
  });

  // Scenario "A broken topic changes nothing on the desktop", with the window closed to the tray (REQ-26)
  test('REQ-26, REQ-37, REQ-38, REQ-39: closed to the tray, a pending refused send blocks no system notification, shows nothing, is not sent again and logs no token', async () => {
    // The server holds its answer until the test releases it: the app must not wait for it.
    const ntfy = await fakeNtfy(403, true);
    const { app, window, port, home, output } = await readyDesktop();
    await turnRemoteOn(window, ntfy.topicUrl, TOKEN);
    const id = await startSession(port, path.join(home, 'broken-topic'));
    await closeWindow(app);
    await expect.poll(async () => (await windowState(app))?.visible).toBe(false);

    await hook(port, id, { hook_event_name: 'UserPromptSubmit', prompt: 'Run the migrations' });
    await hook(port, id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'npm run migrate' } });
    await expect.poll(() => notifyCalls.length).toBe(1);
    expect(notifyCalls[0]).toEqual({ summary: 'broken-topic · Run the migrations', body: 'Permission for Bash' });

    await expect.poll(() => ntfy.received.length, { timeout: REMOTE_WAIT, intervals: [250] }).toBe(1);
    expect(ntfy.received[0]!.headers.authorization).toBe(`Bearer ${TOKEN}`);

    // REQ-37: while the send waits for its answer, a new wait still shows its system notification.
    await hook(port, id, { hook_event_name: 'PostToolUse', tool_name: 'Bash' });
    await hook(port, id, { hook_event_name: 'PermissionRequest', tool_name: 'Edit', tool_input: { file_path: '/srv/app/db.ts' } });
    await expect.poll(() => notifyCalls.length).toBe(2);
    expect(ntfy.answered, 'the fake server has not answered yet').toEqual([]);
    expect(notifyCalls[1]).toEqual({ summary: 'broken-topic · Run the migrations', body: 'Permission for Edit' });

    // REQ-38, REQ-39: one log line with the reason, no token, nothing sent again.
    ntfy.release();
    const failures = () => output.join('').split('\n').filter((line) => line.includes('Remote notification not sent'));
    await expect.poll(() => failures().length).toBe(1);
    // On a loaded machine the 10-second publish limit can end the send before the release: then the reason is the timeout.
    expect(['Remote notification not sent: The server refused the access token.', 'Remote notification not sent: The server did not answer within 10 seconds.']).toContain(
      failures()[0],
    );
    await window.waitForTimeout(3_000);
    expect(ntfy.received, 'REQ-38: no retry').toHaveLength(1);
    expect(output.join(''), 'REQ-39').not.toContain(TOKEN);

    // REQ-38: nothing shows in the app.
    await focusWindow(app);
    await expect.poll(async () => (await windowState(app))?.visible).toBe(true);
    await expect(window.getByRole('alert')).toHaveCount(0);
    await expect(window.getByText('Remote notification not sent')).toHaveCount(0);
    await expect(window.getByText('The server refused the access token.')).toHaveCount(0);
  });
});
