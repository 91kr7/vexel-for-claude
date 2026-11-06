import { describe, expect, it, vi } from 'vitest';
import type { LoadStatus, SessionState, SessionSummary } from './live-session-store';
import { SESSION_ORDER_KEY, SessionOrderStore } from './session-order-store';

const session = (id: string, state: SessionState, minute: number): SessionSummary => ({
  id,
  folder: `/projects/${id}`,
  label: id,
  state,
  lastActivity: `2026-11-06T10:${String(minute).padStart(2, '0')}:00.000Z`,
});

function memoryStorage(saved?: string) {
  const values = new Map<string, string>(saved === undefined ? [] : [[SESSION_ORDER_KEY, saved]]);
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => void values.set(key, value)),
  };
}

const savedOrder = (storage: ReturnType<typeof memoryStorage>) => JSON.parse(storage.values.get(SESSION_ORDER_KEY) ?? 'null') as unknown;

describe('SessionOrderStore', () => {
  // session-order-store spec: the order is saved under SESSION_ORDER_KEY
  it('uses the key "ai-client.session-order"', () => {
    expect(SESSION_ORDER_KEY).toBe('ai-client.session-order');
  });

  // session-order-store spec: no saved value, or a value that is not an order, gives an empty order
  it('starts from an empty order when the saved value is missing or not an order', () => {
    const unreadable = [
      undefined,
      'not json {',
      '[]',
      '42',
      'null',
      '"running"',
      '{"unknown-group":["a"]}',
      '{"running":"a"}',
      '{"running":["a",1]}',
    ];
    for (const saved of unreadable) {
      expect(new SessionOrderStore(memoryStorage(saved)).getSnapshot(), `saved value ${String(saved)}`).toEqual({});
    }
  });

  // session-order-store spec: a valid saved order is read under the key
  it('reads a valid saved order', () => {
    const order = { 'needs-input': ['e'], running: ['a', 'b'], external: [], ended: ['z'] };
    expect(new SessionOrderStore(memoryStorage(JSON.stringify(order))).getSnapshot()).toEqual(order);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-5
  it('applies the saved order to the first list after a reload, not the activity order', () => {
    const store = new SessionOrderStore(memoryStorage(JSON.stringify({ running: ['a', 'c', 'b'] })));
    store.update([session('a', 'idle', 1), session('b', 'idle', 59), session('c', 'idle', 3)], 'ready');
    expect(store.getSnapshot()).toEqual({ running: ['a', 'c', 'b'] });
  });

  // session-order-store invariant: a list received while loading or in error never changes the saved order
  it.each<LoadStatus>(['loading', 'error'])('changes and saves nothing while the status is %s', (status) => {
    const storage = memoryStorage(JSON.stringify({ running: ['a', 'b'] }));
    const store = new SessionOrderStore(storage);
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);

    store.update([], status);
    store.update([session('c', 'idle', 1)], status);

    expect(store.getSnapshot()).toBe(before);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-5: a changed order is saved as JSON and the listeners are told
  it('saves a changed order under the key and calls the listeners once', () => {
    const storage = memoryStorage();
    const store = new SessionOrderStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);

    store.update([session('a', 'idle', 1), session('b', 'working', 2)], 'ready');

    expect(store.getSnapshot()).toEqual({ running: ['b', 'a'] });
    expect(savedOrder(storage)).toEqual({ running: ['b', 'a'] });
    expect(storage.setItem).toHaveBeenCalledWith(SESSION_ORDER_KEY, expect.any(String));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-1, REQ-2, REQ-3, REQ-4: the store follows the order rule list after list
  it('keeps places on activity, appends new sessions and moves group changes to the end', () => {
    const storage = memoryStorage();
    const store = new SessionOrderStore(storage);
    store.update([session('a', 'idle', 3), session('b', 'idle', 2), session('c', 'idle', 1)], 'ready');
    expect(store.getSnapshot()).toEqual({ running: ['a', 'b', 'c'] });

    store.update([session('a', 'idle', 3), session('b', 'idle', 2), session('c', 'working', 10)], 'ready');
    expect(store.getSnapshot()).toEqual({ running: ['a', 'b', 'c'] });

    store.update([session('a', 'idle', 3), session('b', 'idle', 2), session('c', 'working', 10), session('d', 'idle', 11)], 'ready');
    expect(store.getSnapshot()).toEqual({ running: ['a', 'b', 'c', 'd'] });

    store.update([session('a', 'idle', 3), session('b', 'needs_input', 12), session('c', 'working', 10), session('d', 'idle', 11)], 'ready');
    expect(store.getSnapshot()).toEqual({ 'needs-input': ['b'], running: ['a', 'c', 'd'] });

    store.update([session('a', 'idle', 3), session('b', 'idle', 13), session('c', 'working', 10), session('d', 'idle', 11)], 'ready');
    expect(store.getSnapshot()).toEqual({ running: ['a', 'c', 'd', 'b'] });
    expect(savedOrder(storage)).toEqual({ running: ['a', 'c', 'd', 'b'] });
  });

  // session-order-store spec: the same order saves nothing and calls no listener; the snapshot stays the same object
  it('saves nothing and calls no listener when the order does not change', () => {
    const storage = memoryStorage(JSON.stringify({ running: ['a', 'b'] }));
    const store = new SessionOrderStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);
    const sessions = [session('a', 'idle', 1), session('b', 'working', 5)];

    store.update(sessions, 'ready');
    const first = store.getSnapshot();
    store.update([session('a', 'working', 9), session('b', 'idle', 6)], 'ready');

    expect(store.getSnapshot()).toBe(first);
    expect(first).toEqual({ running: ['a', 'b'] });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  // session-order-store spec: getSnapshot gives the same object until the next change
  it('gives the same snapshot object until the order changes', () => {
    const store = new SessionOrderStore(memoryStorage());
    const empty = store.getSnapshot();
    expect(store.getSnapshot()).toBe(empty);
    store.update([session('a', 'idle', 1)], 'ready');
    const changed = store.getSnapshot();
    expect(changed).not.toBe(empty);
    expect(store.getSnapshot()).toBe(changed);
  });

  // session-order-store spec: a storage that refuses to save does not stop the new order
  it('still applies the new order when the storage refuses to save', () => {
    const storage = memoryStorage();
    storage.setItem.mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const store = new SessionOrderStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);

    expect(() => store.update([session('a', 'idle', 1), session('b', 'idle', 2)], 'ready')).not.toThrow();

    expect(store.getSnapshot()).toEqual({ running: ['b', 'a'] });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // session-order-store spec: unsubscribe stops the calls of the listener
  it('stops calling a listener after unsubscribe', () => {
    const store = new SessionOrderStore(memoryStorage());
    const kept = vi.fn();
    const dropped = vi.fn();
    store.subscribe(kept);
    const unsubscribe = store.subscribe(dropped);
    unsubscribe();

    store.update([session('a', 'idle', 1)], 'ready');

    expect(kept).toHaveBeenCalledTimes(1);
    expect(dropped).not.toHaveBeenCalled();
  });
});
