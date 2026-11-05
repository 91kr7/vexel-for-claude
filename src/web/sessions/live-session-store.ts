import { useEffect, useState, useSyncExternalStore } from 'react';

export type SessionState = 'working' | 'needs_input' | 'idle' | 'ended';

export interface SessionSummary {
  id: string;
  folder: string;
  label: string;
  state: SessionState;
  lastActivity: string;
}

interface SessionEvent {
  type: 'session';
  session: SessionSummary;
}

function isSessionEvent(value: unknown): value is SessionEvent {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'session';
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
    let pending: SessionSummary[] | undefined = [];

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
        if (pending) pending.push(message.session);
        else this.#upsert([message.session]);
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
            this.#upsert(events);
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

  #upsert(updates: SessionSummary[]): void {
    const next = [...this.#sessions];
    for (const update of updates) {
      const index = next.findIndex((session) => session.id === update.id);
      if (index === -1) next.push(update);
      else next[index] = update;
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
