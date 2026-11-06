// SystemNotifications with its default server, on a private D-Bus bus with a fake notification server:
// nothing ever reaches the user's session bus or display.
import { type ChildProcessByStdio, spawn } from 'node:child_process';
import os from 'node:os';
import type { Readable } from 'node:stream';
import { Message, type MessageBus, sessionBus, type Variant } from '@jellybrick/dbus-next';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemNotifications } from './system-notifications.js';

const NAME = 'org.freedesktop.Notifications';
const OBJECT_PATH = '/org/freedesktop/Notifications';
const REPLY_LIMIT_MS = 5000;

interface NotifyCall {
  sender: string;
  appName: string;
  replacesId: number;
  appIcon: string;
  summary: string;
  body: string;
  actions: string[];
  hints: Record<string, Variant>;
  expireTimeout: number;
}

const fake = {
  capabilities: ['body', 'actions'],
  // When true, the fake server never replies to Notify.
  silent: false,
  notifyCalls: [] as NotifyCall[],
  closeCalls: [] as number[],
  nextId: 40,
};

let daemon: ChildProcessByStdio<null, Readable, null>;
let busAddress: string;
let service: MessageBus;
let previousAddress: string | undefined;

function handle(msg: Message): boolean {
  if (msg.interface !== NAME || msg.path !== OBJECT_PATH) return false;
  const body = msg.body as unknown[];
  switch (msg.member) {
    case 'GetCapabilities':
      service.send(Message.newMethodReturn(msg, 'as', [fake.capabilities]));
      return true;
    case 'Notify': {
      const [appName, replacesId, appIcon, summary, text, actions, hints, expireTimeout] = body as [
        string,
        number,
        string,
        string,
        string,
        string[],
        Record<string, Variant>,
        number,
      ];
      fake.notifyCalls.push({ sender: msg.sender ?? '', appName, replacesId, appIcon, summary, body: text, actions, hints, expireTimeout });
      if (fake.silent) return true;
      const id = replacesId !== 0 ? replacesId : (fake.nextId += 1);
      service.send(Message.newMethodReturn(msg, 'u', [id]));
      return true;
    }
    case 'CloseNotification':
      fake.closeCalls.push(body[0] as number);
      service.send(Message.newMethodReturn(msg, '', []));
      return true;
    default:
      return false;
  }
}

const emitSignal = (name: 'ActionInvoked' | 'NotificationClosed', signature: string, args: unknown[]) =>
  service.send(Message.newSignal(OBJECT_PATH, NAME, name, signature, args));

async function waitFor(check: () => boolean, label: string, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

beforeAll(async () => {
  daemon = spawn('dbus-daemon', ['--session', '--nofork', '--print-address=1', `--address=unix:tmpdir=${os.tmpdir()}`], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  busAddress = await new Promise<string>((resolve, reject) => {
    daemon.once('error', reject);
    daemon.stdout.once('data', (data: Buffer) => resolve(data.toString().trim().split('\n')[0] ?? ''));
  });
  expect(busAddress).toMatch(/^unix:path=/);
  // The default server reads this variable when it connects: every connection of these tests goes to the private bus.
  previousAddress = process.env.DBUS_SESSION_BUS_ADDRESS;
  process.env.DBUS_SESSION_BUS_ADDRESS = busAddress;
  service = sessionBus({ busAddress });
  service.addMethodHandler(handle);
  // 4 = DO_NOT_QUEUE; 1 = primary owner.
  expect(await service.requestName(NAME, 4)).toBe(1);
});

afterAll(() => {
  service?.disconnect();
  daemon?.kill('SIGTERM');
  if (previousAddress === undefined) delete process.env.DBUS_SESSION_BUS_ADDRESS;
  else process.env.DBUS_SESSION_BUS_ADDRESS = previousAddress;
});

beforeEach(() => {
  expect(process.env.DBUS_SESSION_BUS_ADDRESS).toBe(busAddress);
  fake.capabilities = ['body', 'actions'];
  fake.silent = false;
  fake.notifyCalls.length = 0;
  fake.closeCalls.length = 0;
  // Failures are logged: keep the test output clean.
  for (const method of ['error', 'warn', 'log', 'info'] as const) vi.spyOn(console, method).mockImplementation(() => {});
  return () => vi.restoreAllMocks();
});

const APP = { appName: 'Vexel for Claude', iconPath: '/opt/vexel/icons/vexel-for-claude.png' };
const request = (sessionId: string, body = 'Permission for Bash') => ({
  sessionId,
  kind: 'needs_input' as const,
  title: 'ai-client · Fix the login form',
  body,
});

describe('SystemNotifications on the D-Bus notification server', () => {
  // plan-session_notifications/REQ-10: urgency critical as the byte hint 2, expire timeout 0
  it('sends Notify with the app name, icon, title, body, the default action, critical urgency and no timeout', async () => {
    const notifications = new SystemNotifications(APP);
    await notifications.show(request('a'));

    expect(fake.notifyCalls).toHaveLength(1);
    const call = fake.notifyCalls[0]!;
    expect(call).toMatchObject({
      appName: 'Vexel for Claude',
      replacesId: 0,
      appIcon: '/opt/vexel/icons/vexel-for-claude.png',
      summary: 'ai-client · Fix the login form',
      body: 'Permission for Bash',
      actions: ['default', 'Open'],
      expireTimeout: 0,
    });
    expect(call.hints.urgency?.signature).toBe('y');
    expect(call.hints.urgency?.value).toBe(2);
  });

  it('replaces the notification of a session in place, with the id the server gave', async () => {
    const notifications = new SystemNotifications(APP);
    await notifications.show(request('a'));
    const id = fake.nextId;
    await notifications.show(request('a', 'Needs your input'));
    expect(fake.notifyCalls.map((call) => call.replacesId)).toEqual([0, id]);
  });

  it('escapes the body when GetCapabilities lists body-markup', async () => {
    fake.capabilities = ['body', 'body-markup', 'actions'];
    const notifications = new SystemNotifications(APP);
    await notifications.show(request('a', 'Permission for <mcp> & co'));
    expect(fake.notifyCalls[0]?.body).toBe('Permission for &lt;mcp&gt; &amp; co');
  });

  // plan-session_notifications/REQ-11, REQ-12
  it('closes with CloseNotification and the id of the session notification', async () => {
    const notifications = new SystemNotifications(APP);
    await notifications.show(request('a'));
    const id = fake.nextId;
    await notifications.close('a');
    expect(fake.closeCalls).toEqual([id]);
  });

  // plan-session_notifications/REQ-13
  it('reports a click when the server emits ActionInvoked with the default action', async () => {
    const notifications = new SystemNotifications(APP);
    const clicks: string[] = [];
    notifications.onClick((sessionId) => clicks.push(sessionId));
    await notifications.show(request('a'));

    emitSignal('ActionInvoked', 'us', [fake.nextId, 'default']);
    await waitFor(() => clicks.length > 0, 'click');
    expect(clicks).toEqual(['a']);
  });

  it('forgets a notification when the server emits NotificationClosed', async () => {
    const notifications = new SystemNotifications(APP);
    await notifications.show(request('a'));
    emitSignal('NotificationClosed', 'uu', [fake.nextId, 2]);
    await new Promise((resolve) => setTimeout(resolve, 200));

    await notifications.close('a');
    await notifications.show(request('a'));
    expect(fake.closeCalls).toEqual([]);
    expect(fake.notifyCalls.map((call) => call.replacesId)).toEqual([0, 0]);
  });

  it(
    'counts no reply within 5 seconds as a failure: show resolves, and the next call connects again',
    async () => {
      const notifications = new SystemNotifications(APP);
      fake.silent = true;
      const startedAt = Date.now();
      await expect(notifications.show(request('a'))).resolves.toBeUndefined();
      const elapsed = Date.now() - startedAt;
      expect(elapsed).toBeGreaterThanOrEqual(REPLY_LIMIT_MS - 100);
      expect(elapsed).toBeLessThan(REPLY_LIMIT_MS + 2000);

      fake.silent = false;
      await notifications.show(request('a'));
      expect(fake.notifyCalls).toHaveLength(2);
      expect(fake.notifyCalls[1]?.sender).not.toBe(fake.notifyCalls[0]?.sender);
    },
    15_000,
  );

  it('never rejects when no notification server is on the bus', async () => {
    await service.releaseName(NAME);
    try {
      const notifications = new SystemNotifications(APP);
      await expect(notifications.show(request('a'))).resolves.toBeUndefined();
      await expect(notifications.close('a')).resolves.toBeUndefined();
      expect(fake.notifyCalls).toEqual([]);
    } finally {
      expect(await service.requestName(NAME, 4)).toBe(1);
    }
  });
});

describe('SystemNotifications turn-end notifications on the D-Bus notification server', () => {
  // plan-session_notifications/REQ-18: urgency normal as the byte hint 1, expire timeout -1
  it('sends Notify with normal urgency and the server default timeout', async () => {
    const notifications = new SystemNotifications(APP);
    await notifications.show({ ...request('a', 'Done. The tests pass.'), kind: 'turn_end' });

    expect(fake.notifyCalls).toHaveLength(1);
    const call = fake.notifyCalls[0]!;
    expect(call).toMatchObject({ replacesId: 0, body: 'Done. The tests pass.', actions: ['default', 'Open'], expireTimeout: -1 });
    expect(call.hints.urgency?.signature).toBe('y');
    expect(call.hints.urgency?.value).toBe(1);
  });

  // plan-session_notifications/REQ-19
  it('replaces the needs-input notification of a session in place with the turn-end one', async () => {
    const notifications = new SystemNotifications(APP);
    await notifications.show(request('a'));
    const id = fake.nextId;
    await notifications.show({ ...request('a', 'Claude finished'), kind: 'turn_end' });

    expect(fake.notifyCalls.map((call) => [call.replacesId, call.hints.urgency?.value])).toEqual([
      [0, 2],
      [id, 1],
    ]);
  });
});
