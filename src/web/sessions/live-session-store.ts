import { useEffect, useState, useSyncExternalStore } from 'react';

export type SessionState = 'working' | 'needs_input' | 'idle' | 'ended';

export interface SessionSummary {
  id: string;
  folder: string;
  label: string;
  state: SessionState;
  lastActivity: string;
  external?: true;
  waitingTool?: string;
  resumable?: true;
}

export type LoadStatus = 'loading' | 'ready' | 'error';

type SessionEvent = { type: 'session'; session: SessionSummary } | { type: 'session-removed'; id: string };

function isSessionEvent(value: unknown): value is SessionEvent {
  if (typeof value !== 'object' || value === null) return false;
  const { type, id } = value as { type?: unknown; id?: unknown };
  return type === 'session' || (type === 'session-removed' && typeof id === 'string');
}

export class LiveSessionStore {
  readonly #origin: string;
  readonly #listeners = new Set<() => void>();
  #sessions: readonly SessionSummary[] = [];
  #status: LoadStatus = 'loading';
  #stopCurrent: (() => void) | undefined;

  constructor(origin: string) {
    this.#origin = origin;
  }

  start(): void {
    this.stop();
    const socket = new WebSocket(`${this.#origin.replace(/^http/, 'ws')}/api/sessions/events`);
    const listeners = new AbortController();
    let pending: SessionEvent[] | undefined = [];
    this.#setStatus('loading');

    socket.addEventListener(
      'message',
      (event: MessageEvent) => {
        let message: unknown;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (!isSessionEvent(message)) return;
        if (pending) pending.push(message);
        else this.#apply([message]);
      },
      { signal: listeners.signal },
    );
    socket.addEventListener(
      'open',
      () => {
        void fetch(`${this.#origin}/api/sessions`, { signal: listeners.signal })
          .then((response) => (response.ok ? (response.json() as Promise<SessionSummary[]>) : Promise.reject(new Error())))
          .then((sessions) => {
            if (listeners.signal.aborted) return;
            const events = pending ?? [];
            pending = undefined;
            this.#sessions = sessions;
            if (this.#status === 'loading') this.#status = 'ready';
            this.#apply(events);
          })
          .catch(() => {
            if (!listeners.signal.aborted) this.#setStatus('error');
          });
      },
      { signal: listeners.signal },
    );
    const fail = () => this.#setStatus('error');
    socket.addEventListener('close', fail, { signal: listeners.signal });
    socket.addEventListener('error', fail, { signal: listeners.signal });

    this.#stopCurrent = () => {
      listeners.abort();
      socket.close();
    };
  }

  stop(): void {
    this.#stopCurrent?.();
    this.#stopCurrent = undefined;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): readonly SessionSummary[] => this.#sessions;

  getStatus = (): LoadStatus => this.#status;

  #setStatus(status: LoadStatus): void {
    if (this.#status === status) return;
    this.#status = status;
    for (const listener of this.#listeners) listener();
  }

  #apply(events: SessionEvent[]): void {
    let next = [...this.#sessions];
    for (const event of events) {
      if (event.type === 'session-removed') {
        next = next.filter((session) => session.id !== event.id);
        continue;
      }
      const index = next.findIndex((session) => session.id === event.session.id);
      if (index === -1) next.push(event.session);
      else next[index] = event.session;
    }
    this.#sessions = next;
    for (const listener of this.#listeners) listener();
  }
}

export function useLiveSessions(): { sessions: readonly SessionSummary[]; status: LoadStatus } {
  const [store] = useState(() => new LiveSessionStore(window.location.origin));
  useEffect(() => {
    store.start();
    return () => store.stop();
  }, [store]);
  const sessions = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const status = useSyncExternalStore(store.subscribe, store.getStatus);
  return { sessions, status };
}
