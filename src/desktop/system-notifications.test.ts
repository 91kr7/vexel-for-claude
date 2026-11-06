import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type NotificationServer, type ServerNotification, SystemNotifications } from './system-notifications.js';

class FakeServer implements NotificationServer {
  capabilityList: string[] = ['body', 'actions'];
  readonly notified: ServerNotification[] = [];
  readonly closedIds: number[] = [];
  disconnects = 0;
  inFlight = 0;
  maxInFlight = 0;
  /** Replaces the reply of the next notify calls. */
  notifyReply?: () => Promise<number>;
  private nextId = 100;
  private readonly actionListeners: ((id: number, actionKey: string) => void)[] = [];
  private readonly closedListeners: ((id: number) => void)[] = [];

  async capabilities(): Promise<string[]> {
    return this.capabilityList;
  }

  async notify(notification: ServerNotification): Promise<number> {
    this.notified.push(notification);
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    try {
      if (this.notifyReply) return await this.notifyReply();
      await new Promise((resolve) => setTimeout(resolve, 5));
      return notification.replacesId !== 0 ? notification.replacesId : (this.nextId += 1);
    } finally {
      this.inFlight -= 1;
    }
  }

  async closeNotification(id: number): Promise<void> {
    this.closedIds.push(id);
  }

  onActionInvoked(listener: (id: number, actionKey: string) => void): void {
    this.actionListeners.push(listener);
  }

  onNotificationClosed(listener: (id: number) => void): void {
    this.closedListeners.push(listener);
  }

  disconnect(): void {
    this.disconnects += 1;
  }

  invokeAction(id: number, actionKey: string): void {
    for (const listener of this.actionListeners) listener(id, actionKey);
  }

  reportClosed(id: number): void {
    for (const listener of this.closedListeners) listener(id);
  }

  lastId(): number {
    return this.nextId;
  }
}

const APP = { appName: 'Vexel for Claude', iconPath: '/opt/vexel/icons/vexel-for-claude.png' };
const request = (sessionId: string, body = 'Permission for Bash') => ({
  sessionId,
  kind: 'needs_input' as const,
  title: `${sessionId} · Fix the login form`,
  body,
});

let server: FakeServer;
let connect: ReturnType<typeof vi.fn<() => Promise<NotificationServer>>>;

beforeEach(() => {
  server = new FakeServer();
  connect = vi.fn(async () => server);
  // Failures are logged: keep the test output clean.
  for (const method of ['error', 'warn', 'log', 'info'] as const) vi.spyOn(console, method).mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const logged = () => (['error', 'warn', 'log', 'info'] as const).some((method) => vi.mocked(console[method]).mock.calls.length > 0);

describe('SystemNotifications.show', () => {
  it('connects at the first call that needs the server, once', async () => {
    const notifications = new SystemNotifications({ ...APP, connect });
    expect(connect).not.toHaveBeenCalled();
    await notifications.show(request('a'));
    await notifications.show(request('b'));
    expect(connect).toHaveBeenCalledTimes(1);
  });

  // plan-session_notifications/REQ-10: urgent, never expires
  it('sends a needs-input notification with critical urgency, no timeout, the app name and icon, the title and the default action', async () => {
    const notifications = new SystemNotifications({ ...APP, connect });
    await notifications.show(request('a'));
    expect(server.notified).toEqual([
      {
        replacesId: 0,
        appName: 'Vexel for Claude',
        appIcon: '/opt/vexel/icons/vexel-for-claude.png',
        summary: 'a · Fix the login form',
        body: 'Permission for Bash',
        actions: ['default', 'Open'],
        urgency: 'critical',
        expireTimeoutMs: 0,
      },
    ]);
  });

  it('escapes &, < and > in the body when the server reads markup', async () => {
    server.capabilityList = ['body', 'body-markup', 'actions'];
    const notifications = new SystemNotifications({ ...APP, connect });
    await notifications.show({ ...request('a', 'Permission for <mcp> & co'), title: 'x<y> & z' });
    expect(server.notified[0]?.body).toBe('Permission for &lt;mcp&gt; &amp; co');
    expect(server.notified[0]?.summary).toBe('x<y> & z');
  });

  it('sends the body as given when the server does not read markup', async () => {
    const notifications = new SystemNotifications({ ...APP, connect });
    await notifications.show(request('a', 'Permission for <mcp> & co'));
    expect(server.notified[0]?.body).toBe('Permission for <mcp> & co');
  });

  it('replaces in place the notification a session already has, and gives a new one to another session', async () => {
    const notifications = new SystemNotifications({ ...APP, connect });
    await notifications.show(request('a'));
    const firstId = server.lastId();
    await notifications.show(request('a', 'Needs your input'));
    await notifications.show(request('b'));
    expect(server.notified.map((notification) => notification.replacesId)).toEqual([0, firstId, 0]);
  });
});

describe('SystemNotifications.close', () => {
  // plan-session_notifications/REQ-11, REQ-12
  it('closes the notification of the session; afterwards the session has none', async () => {
    const notifications = new SystemNotifications({ ...APP, connect });
    await notifications.show(request('a'));
    const id = server.lastId();
    await notifications.close('a');
    expect(server.closedIds).toEqual([id]);

    await notifications.close('a');
    await notifications.show(request('a'));
    expect(server.closedIds).toEqual([id]);
    expect(server.notified.at(-1)?.replacesId).toBe(0);
  });

  it('does nothing for a session with no notification', async () => {
    const notifications = new SystemNotifications({ ...APP, connect });
    await notifications.show(request('a'));
    await notifications.close('b');
    expect(server.closedIds).toEqual([]);
  });

  it('runs calls one at a time in call order: a close right after a show closes that notification', async () => {
    const notifications = new SystemNotifications({ ...APP, connect });
    const shown = notifications.show(request('a'));
    const replaced = notifications.show(request('a', 'Needs your input'));
    const closed = notifications.close('a');
    await Promise.all([shown, replaced, closed]);
    expect(server.maxInFlight).toBe(1);
    expect(server.notified.map((notification) => notification.replacesId)).toEqual([0, server.lastId()]);
    expect(server.closedIds).toEqual([server.lastId()]);
  });
});

describe('SystemNotifications.onClick', () => {
  // plan-session_notifications/REQ-13
  it('reports the session of a notification clicked (default action)', async () => {
    const notifications = new SystemNotifications({ ...APP, connect });
    const clicks: string[] = [];
    notifications.onClick((sessionId) => clicks.push(sessionId));
    await notifications.show(request('a'));
    const idA = server.lastId();
    await notifications.show(request('b'));
    const idB = server.lastId();

    server.invokeAction(idB, 'default');
    server.invokeAction(idA, 'default');
    expect(clicks).toEqual(['b', 'a']);
  });

  it('reports nothing for another action key or an unknown notification', async () => {
    const notifications = new SystemNotifications({ ...APP, connect });
    const clicks: string[] = [];
    notifications.onClick((sessionId) => clicks.push(sessionId));
    await notifications.show(request('a'));

    server.invokeAction(server.lastId(), 'snooze');
    server.invokeAction(9999, 'default');
    expect(clicks).toEqual([]);
  });

  it('stops reporting after unsubscribe', async () => {
    const notifications = new SystemNotifications({ ...APP, connect });
    const clicks: string[] = [];
    const unsubscribe = notifications.onClick((sessionId) => clicks.push(sessionId));
    await notifications.show(request('a'));

    unsubscribe();
    server.invokeAction(server.lastId(), 'default');
    expect(clicks).toEqual([]);
  });
});

describe('SystemNotifications when the server closes a notification', () => {
  it('no longer counts it as the notification of its session', async () => {
    const notifications = new SystemNotifications({ ...APP, connect });
    await notifications.show(request('a'));
    server.reportClosed(server.lastId());

    await notifications.close('a');
    expect(server.closedIds).toEqual([]);
    await notifications.show(request('a'));
    expect(server.notified.at(-1)?.replacesId).toBe(0);
  });
});

describe('SystemNotifications failures', () => {
  it('never rejects when the connection fails, logs it, and connects again at the next call', async () => {
    connect.mockRejectedValueOnce(new Error('no session bus'));
    const notifications = new SystemNotifications({ ...APP, connect });

    await expect(notifications.show(request('a'))).resolves.toBeUndefined();
    expect(logged()).toBe(true);
    await notifications.show(request('a'));
    expect(connect).toHaveBeenCalledTimes(2);
    expect(server.notified).toHaveLength(1);
  });

  it('never rejects when the server fails, drops the connection, and connects again at the next call', async () => {
    const notifications = new SystemNotifications({ ...APP, connect });
    server.notifyReply = () => Promise.reject(new Error('org.freedesktop.DBus.Error.ServiceUnknown'));

    await expect(notifications.show(request('a'))).resolves.toBeUndefined();
    expect(logged()).toBe(true);
    expect(server.disconnects).toBe(1);

    server.notifyReply = undefined;
    await notifications.show(request('a'));
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('never rejects when closing fails', async () => {
    const notifications = new SystemNotifications({ ...APP, connect });
    await notifications.show(request('a'));
    server.closeNotification = () => Promise.reject(new Error('gone'));
    await expect(notifications.close('a')).resolves.toBeUndefined();
  });
});

const turnEndRequest = (sessionId: string, body = 'Done. The tests pass.') => ({ ...request(sessionId, body), kind: 'turn_end' as const });

describe('SystemNotifications turn-end notifications', () => {
  // plan-session_notifications/REQ-18: normal urgency, the server's usual timeout
  it('sends a turn-end notification with normal urgency and expire timeout -1', async () => {
    const notifications = new SystemNotifications({ ...APP, connect });
    await notifications.show(turnEndRequest('a'));
    expect(server.notified).toEqual([
      {
        replacesId: 0,
        appName: 'Vexel for Claude',
        appIcon: '/opt/vexel/icons/vexel-for-claude.png',
        summary: 'a · Fix the login form',
        body: 'Done. The tests pass.',
        actions: ['default', 'Open'],
        urgency: 'normal',
        expireTimeoutMs: -1,
      },
    ]);
  });

  // plan-session_notifications/REQ-19
  it('replaces in place, with the same id, a notification of the session of another kind', async () => {
    const notifications = new SystemNotifications({ ...APP, connect });
    await notifications.show(request('a'));
    const id = server.lastId();
    await notifications.show(turnEndRequest('a'));
    await notifications.show(request('a', 'Permission for Edit'));

    expect(server.notified.map(({ replacesId, urgency, expireTimeoutMs }) => [replacesId, urgency, expireTimeoutMs])).toEqual([
      [0, 'critical', 0],
      [id, 'normal', -1],
      [id, 'critical', 0],
    ]);
  });

  // plan-session_notifications/REQ-18: once the desktop hides it, the session has no notification
  it('gives a new notification after the server closes the turn-end one', async () => {
    const notifications = new SystemNotifications({ ...APP, connect });
    await notifications.show(turnEndRequest('a'));
    server.reportClosed(server.lastId());
    await notifications.show(request('a'));
    expect(server.notified.map((notification) => notification.replacesId)).toEqual([0, 0]);
  });

  // plan-session_notifications/REQ-20: a click on a turn-end notification reaches the desktop app with its session
  it('reports the session of a clicked turn-end notification', async () => {
    const notifications = new SystemNotifications({ ...APP, connect });
    const clicked: string[] = [];
    notifications.onClick((sessionId) => clicked.push(sessionId));
    await notifications.show(turnEndRequest('gone'));
    server.invokeAction(server.lastId(), 'default');
    expect(clicked).toEqual(['gone']);
  });
});

const sessionEndRequest = (sessionId: string, body = 'Session ended') => ({ ...request(sessionId, body), kind: 'session_end' as const });

describe('SystemNotifications session-end notifications', () => {
  // plan-session_notifications/REQ-24: normal urgency, the server's usual timeout
  it('sends a session-end notification with normal urgency and expire timeout -1', async () => {
    const notifications = new SystemNotifications({ ...APP, connect });
    await notifications.show(sessionEndRequest('a', 'Session ended with an error'));
    expect(server.notified).toEqual([
      {
        replacesId: 0,
        appName: 'Vexel for Claude',
        appIcon: '/opt/vexel/icons/vexel-for-claude.png',
        summary: 'a · Fix the login form',
        body: 'Session ended with an error',
        actions: ['default', 'Open'],
        urgency: 'normal',
        expireTimeoutMs: -1,
      },
    ]);
  });

  // plan-session_notifications/REQ-19, REQ-24: it replaces the session's notification in place
  it('replaces in place, with the same id, the notification of the session of another kind', async () => {
    const notifications = new SystemNotifications({ ...APP, connect });
    await notifications.show(request('a'));
    const id = server.lastId();
    await notifications.show(sessionEndRequest('a'));

    expect(server.notified.map(({ replacesId, urgency, expireTimeoutMs }) => [replacesId, urgency, expireTimeoutMs])).toEqual([
      [0, 'critical', 0],
      [id, 'normal', -1],
    ]);
  });
});
