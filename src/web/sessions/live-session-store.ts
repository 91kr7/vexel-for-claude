import { useEffect, useState, useSyncExternalStore } from 'react';

export type SessionState = 'working' | 'needs_input' | 'idle' | 'ended';

export interface SessionSummary {
  id: string;
  folder: string;
  label: string;
  state: SessionState;
  lastActivity: string;
  external?: true;
}

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
  #stopCurrent: (() => void) | undefined;

  constructor(origin: string) {
    this.#origin = origin;
  }

  start(): void {
    this.stop();
    const socket = new WebSocket(`${this.#origin.replace(/^http/, 'ws')}/api/sessions/events`);
    const listeners = new AbortController();
    let pending: SessionEvent[] | undefined = [];

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
          .then((response) => response.json() as Promise<SessionSummary[]>)
          .then((sessions) => {
            if (listeners.signal.aborted) return;
            const events = pending ?? [];
            pending = undefined;
            this.#sessions = sessions;
            this.#apply(events);
          })
          .catch(() => {});
      },
      { signal: listeners.signal },
    );

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

export function useLiveSessions(): readonly SessionSummary[] {
  const [store] = useState(() => new LiveSessionStore(window.location.origin));
  useEffect(() => {
    store.start();
    return () => store.stop();
  }, [store]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
