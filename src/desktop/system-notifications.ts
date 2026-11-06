import type { EventEmitter } from 'node:events';
import { Message, MessageType, sessionBus, Variant } from '@jellybrick/dbus-next';

export type NotificationKind = 'needs_input';
export type NotificationUrgency = 'low' | 'normal' | 'critical';

export interface NotificationRequest {
  sessionId: string;
  kind: NotificationKind;
  title: string;
  body: string;
}

export interface ServerNotification {
  replacesId: number;
  appName: string;
  appIcon: string;
  summary: string;
  body: string;
  actions: string[];
  urgency: NotificationUrgency;
  expireTimeoutMs: number;
}

export interface NotificationServer {
  capabilities(): Promise<string[]>;
  notify(notification: ServerNotification): Promise<number>;
  closeNotification(id: number): Promise<void>;
  onActionInvoked(listener: (id: number, actionKey: string) => void): void;
  onNotificationClosed(listener: (id: number) => void): void;
  disconnect(): void;
}

export interface SystemNotificationsOptions {
  appName: string;
  iconPath: string;
  connect?: () => Promise<NotificationServer>;
}

const SERVICE = 'org.freedesktop.Notifications';
const OBJECT_PATH = '/org/freedesktop/Notifications';
const CALL_TIMEOUT_MS = 5_000;
const DEFAULT_ACTION = 'default';
const URGENCY_LEVEL: Record<NotificationUrgency, number> = { low: 0, normal: 1, critical: 2 };
const LOOK: Record<NotificationKind, Pick<ServerNotification, 'urgency' | 'expireTimeoutMs'>> = {
  needs_input: { urgency: 'critical', expireTimeoutMs: 0 },
};

function escapeMarkup(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('No reply from the notification server.')), CALL_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function connectDbusNotificationServer(): Promise<NotificationServer> {
  const bus = sessionBus();
  // The typings omit 'error', and an unheard 'error' would crash the app.
  (bus as EventEmitter).on('error', (error: unknown) => console.warn('Notification bus error:', error));
  const call = async (member: string, signature = '', body: unknown[] = []): Promise<unknown[]> => {
    const message = new Message({ destination: SERVICE, path: OBJECT_PATH, interface: SERVICE, member, signature, body });
    const reply = await withTimeout(bus.call(message));
    return reply?.body ?? [];
  };
  const signalListeners = new Map<string, (body: unknown[]) => void>();
  bus.on('message', (message: Message) => {
    if (message.type === MessageType.SIGNAL && message.interface === SERVICE) signalListeners.get(message.member)?.(message.body);
  });
  try {
    await withTimeout(
      bus.call(
        new Message({
          destination: 'org.freedesktop.DBus',
          path: '/org/freedesktop/DBus',
          interface: 'org.freedesktop.DBus',
          member: 'AddMatch',
          signature: 's',
          body: [`type='signal',sender='${SERVICE}',interface='${SERVICE}',path='${OBJECT_PATH}'`],
        }),
      ),
    );
  } catch (error) {
    bus.disconnect();
    throw error;
  }

  return {
    async capabilities() {
      const [capabilities] = await call('GetCapabilities');
      return Array.isArray(capabilities) ? capabilities.filter((item): item is string => typeof item === 'string') : [];
    },
    async notify(notification) {
      const hints = { urgency: new Variant('y', URGENCY_LEVEL[notification.urgency]) };
      const [id] = await call('Notify', 'susssasa{sv}i', [
        notification.appName,
        notification.replacesId,
        notification.appIcon,
        notification.summary,
        notification.body,
        notification.actions,
        hints,
        notification.expireTimeoutMs,
      ]);
      if (typeof id !== 'number') throw new Error('The notification server gave no notification id.');
      return id;
    },
    async closeNotification(id) {
      await call('CloseNotification', 'u', [id]);
    },
    onActionInvoked(listener) {
      signalListeners.set('ActionInvoked', ([id, actionKey]) => {
        if (typeof id === 'number' && typeof actionKey === 'string') listener(id, actionKey);
      });
    },
    onNotificationClosed(listener) {
      signalListeners.set('NotificationClosed', ([id]) => {
        if (typeof id === 'number') listener(id);
      });
    },
    disconnect() {
      bus.disconnect();
    },
  };
}

interface Connection {
  server: NotificationServer;
  bodyMarkup: boolean;
}

export class SystemNotifications {
  readonly #appName: string;
  readonly #iconPath: string;
  readonly #connect: () => Promise<NotificationServer>;
  readonly #idsBySession = new Map<string, number>();
  readonly #clickListeners = new Set<(sessionId: string) => void>();
  #connection: Promise<Connection> | undefined;
  #queue: Promise<void> = Promise.resolve();

  constructor(options: SystemNotificationsOptions) {
    this.#appName = options.appName;
    this.#iconPath = options.iconPath;
    this.#connect = options.connect ?? connectDbusNotificationServer;
  }

  show(request: NotificationRequest): Promise<void> {
    return this.#enqueue(async () => {
      const { server, bodyMarkup } = await this.#server();
      const id = await server.notify({
        replacesId: this.#idsBySession.get(request.sessionId) ?? 0,
        appName: this.#appName,
        appIcon: this.#iconPath,
        summary: request.title,
        body: bodyMarkup ? escapeMarkup(request.body) : request.body,
        actions: [DEFAULT_ACTION, 'Open'],
        ...LOOK[request.kind],
      });
      this.#idsBySession.set(request.sessionId, id);
    });
  }

  close(sessionId: string): Promise<void> {
    return this.#enqueue(async () => {
      const id = this.#idsBySession.get(sessionId);
      if (id === undefined) return;
      this.#idsBySession.delete(sessionId);
      const { server } = await this.#server();
      await server.closeNotification(id);
    });
  }

  onClick(listener: (sessionId: string) => void): () => void {
    this.#clickListeners.add(listener);
    return () => this.#clickListeners.delete(listener);
  }

  #enqueue(operation: () => Promise<void>): Promise<void> {
    const run = this.#queue.then(operation).catch((error: unknown) => {
      console.warn('System notification failed:', error);
      this.#dropConnection();
    });
    this.#queue = run;
    return run;
  }

  #server(): Promise<Connection> {
    this.#connection ??= this.#open();
    return this.#connection;
  }

  async #open(): Promise<Connection> {
    const server = await this.#connect();
    server.onActionInvoked((id, actionKey) => {
      const sessionId = this.#sessionOf(id);
      if (actionKey !== DEFAULT_ACTION || sessionId === undefined) return;
      for (const listener of this.#clickListeners) listener(sessionId);
    });
    server.onNotificationClosed((id) => {
      const sessionId = this.#sessionOf(id);
      if (sessionId !== undefined) this.#idsBySession.delete(sessionId);
    });
    try {
      return { server, bodyMarkup: (await server.capabilities()).includes('body-markup') };
    } catch (error) {
      server.disconnect();
      throw error;
    }
  }

  #dropConnection(): void {
    const connection = this.#connection;
    this.#connection = undefined;
    connection?.then(
      ({ server }) => server.disconnect(),
      () => undefined,
    );
  }

  #sessionOf(id: number): string | undefined {
    for (const [sessionId, knownId] of this.#idsBySession) if (knownId === id) return sessionId;
    return undefined;
  }
}
