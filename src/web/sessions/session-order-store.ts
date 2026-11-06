import { useEffect, useState, useSyncExternalStore } from 'react';
import type { LoadStatus, SessionSummary } from './live-session-store';
import { nextSessionOrder } from './next-session-order';
import type { SessionGroupId, SessionOrder } from './session-order';

export const SESSION_ORDER_KEY = 'ai-client.session-order';

const GROUP_IDS: readonly string[] = ['needs-input', 'running', 'external', 'ended'] satisfies SessionGroupId[];

type OrderStorage = Pick<Storage, 'getItem' | 'setItem'>;

function isSessionOrder(value: unknown): value is SessionOrder {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([groupId, ids]) => GROUP_IDS.includes(groupId) && Array.isArray(ids) && ids.every((id) => typeof id === 'string'),
  );
}

function readOrder(storage: OrderStorage): SessionOrder {
  try {
    const value: unknown = JSON.parse(storage.getItem(SESSION_ORDER_KEY) ?? '{}');
    return isSessionOrder(value) ? value : {};
  } catch {
    return {};
  }
}

export class SessionOrderStore {
  readonly #storage: OrderStorage;
  readonly #listeners = new Set<() => void>();
  #order: SessionOrder;

  constructor(storage: OrderStorage) {
    this.#storage = storage;
    this.#order = readOrder(storage);
  }

  update(sessions: readonly SessionSummary[], status: LoadStatus): void {
    if (status !== 'ready') return;
    const next = nextSessionOrder(this.#order, sessions);
    const serialized = JSON.stringify(next);
    if (serialized === JSON.stringify(this.#order)) return;
    this.#order = next;
    try {
      this.#storage.setItem(SESSION_ORDER_KEY, serialized);
    } catch {
      // The order still applies to this page when the browser refuses to store it.
    }
    for (const listener of this.#listeners) listener();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): SessionOrder => this.#order;
}

export function useSessionOrder(sessions: readonly SessionSummary[], status: LoadStatus): SessionOrder {
  const [store] = useState(() => new SessionOrderStore(window.localStorage));
  useEffect(() => store.update(sessions, status), [store, sessions, status]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
