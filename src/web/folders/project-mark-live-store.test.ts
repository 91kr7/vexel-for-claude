import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectMarkLiveStore } from './project-mark-live-store';

type Listener = (event: Event) => void;

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readyState = 0;
  closeCalls = 0;
  onopen: Listener | null = null;
  onmessage: Listener | null = null;
  onclose: Listener | null = null;
  onerror: Listener | null = null;
  readonly #listeners = new Map<string, Set<Listener>>();

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener, options?: boolean | AddEventListenerOptions): void {
    const set = this.#listeners.get(type) ?? new Set<Listener>();
    this.#listeners.set(type, set);
    set.add(listener);
    if (typeof options === 'object') options.signal?.addEventListener('abort', () => set.delete(listener));
  }

  removeEventListener(type: string, listener: Listener): void {
    this.#listeners.get(type)?.delete(listener);
  }

  send(): void {}

  close(): void {
    this.closeCalls += 1;
    this.readyState = 3;
  }

  open(): void {
    this.readyState = 1;
    this.#emit('open', new Event('open'));
  }

  receive(message: unknown): void {
    const data = typeof message === 'string' ? message : JSON.stringify(message);
    this.#emit('message', new MessageEvent('message', { data }));
  }

  fail(): void {
    this.#emit('error', new Event('error'));
    this.serverClose(1006);
  }

  serverClose(code = 1006): void {
    this.readyState = 3;
    this.#emit('close', Object.assign(new Event('close'), { code, wasClean: code === 1000 }));
  }

  #emit(type: string, event: Event): void {
    const handler = (this as unknown as Record<string, Listener | null>)[`on${type}`];
    handler?.call(this, event);
    for (const listener of this.#listeners.get(type) ?? []) listener.call(this, event);
  }
}

const sockets = () => FakeWebSocket.instances;
const last = () => sockets().at(-1)!;
const favoritesOf = (store: ProjectMarkLiveStore) => [...store.getSnapshot().favorites].sort();
const frame = (favorites: unknown) => ({ type: 'project-marks', favorites });

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function started(origin = 'http://127.0.0.1:3000') {
  const store = new ProjectMarkLiveStore(origin);
  store.start();
  last().open();
  return store;
}

describe('ProjectMarkLiveStore', () => {
  it('starts with no marks and opens no socket before start()', () => {
    const store = new ProjectMarkLiveStore('http://127.0.0.1:3000');
    expect(store.getSnapshot().favorites.size).toBe(0);
    expect(sockets()).toHaveLength(0);
  });

  it.each([
    ['http://127.0.0.1:3000', 'ws://127.0.0.1:3000/api/projects/marks'],
    ['https://example.test', 'wss://example.test/api/projects/marks'],
  ])('start() on %s opens %s', (origin, url) => {
    new ProjectMarkLiveStore(origin).start();
    expect(sockets()).toHaveLength(1);
    expect(last().url).toBe(url);
  });

  // plan-project_list_actions/REQ-29: each frame replaces the marks
  it('replaces the marks with the favorites of each project-marks frame', () => {
    const store = started();
    last().receive(frame(['/work/a', '/work/b']));
    expect(favoritesOf(store)).toEqual(['/work/a', '/work/b']);
    last().receive(frame(['/work/c']));
    expect(favoritesOf(store)).toEqual(['/work/c']);
    last().receive(frame([]));
    expect(favoritesOf(store)).toEqual([]);
  });

  it.each([
    ['another type', { type: 'sessions', favorites: ['/work/x'] }],
    ['no type', { favorites: ['/work/x'] }],
    ['favorites not an array', frame('/work/x')],
    ['favorites with a non-string', frame(['/work/x', 3])],
    ['text that is not JSON', 'not json'],
    ['a JSON value that is not an object', '["/work/x"]'],
  ])('ignores a frame with %s', (_name, message) => {
    const store = started();
    last().receive(frame(['/work/a']));
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);
    last().receive(message);
    expect(store.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('calls each listener after each change, until it unsubscribes', () => {
    const store = started();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    last().receive(frame(['/work/a']));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    last().receive(frame(['/work/b']));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('gives the same snapshot object until the next change', () => {
    const store = started();
    const empty = store.getSnapshot();
    expect(store.getSnapshot()).toBe(empty);
    last().receive(frame(['/work/a']));
    const marked = store.getSnapshot();
    expect(marked).not.toBe(empty);
    expect(store.getSnapshot()).toBe(marked);
  });

  it('opens a new socket 2 s after a loss, and keeps the marks until a frame arrives', () => {
    const store = started();
    last().receive(frame(['/work/a']));
    last().serverClose();
    vi.advanceTimersByTime(1_999);
    expect(sockets()).toHaveLength(1);
    expect(favoritesOf(store)).toEqual(['/work/a']);
    vi.advanceTimersByTime(1);
    expect(sockets()).toHaveLength(2);
    expect(last().url).toBe('ws://127.0.0.1:3000/api/projects/marks');
    last().open();
    expect(favoritesOf(store)).toEqual(['/work/a']);
    last().receive(frame(['/work/b']));
    expect(favoritesOf(store)).toEqual(['/work/b']);
  });

  it('tries again every 2 s while the attempts fail', () => {
    started();
    last().serverClose();
    for (let attempt = 2; attempt <= 4; attempt += 1) {
      vi.advanceTimersByTime(2_000);
      expect(sockets()).toHaveLength(attempt);
      last().fail();
    }
    vi.advanceTimersByTime(1_999);
    expect(sockets()).toHaveLength(4);
    vi.advanceTimersByTime(1);
    expect(sockets()).toHaveLength(5);
  });

  it('stop() closes the socket, cancels a pending reconnection, and later frames change nothing', () => {
    const store = started();
    const socket = last();
    store.stop();
    expect(socket.closeCalls).toBeGreaterThan(0);
    socket.receive(frame(['/work/a']));
    expect(favoritesOf(store)).toEqual([]);

    const other = started();
    last().serverClose();
    other.stop();
    vi.advanceTimersByTime(10_000);
    expect(sockets()).toHaveLength(2);
  });

  it('start() again stops the previous connection', () => {
    const store = started();
    const first = last();
    store.start();
    expect(sockets()).toHaveLength(2);
    expect(first.closeCalls).toBeGreaterThan(0);
    first.receive(frame(['/work/old']));
    expect(favoritesOf(store)).toEqual([]);
    first.serverClose();
    vi.advanceTimersByTime(10_000);
    expect(sockets()).toHaveLength(2);
    last().open();
    last().receive(frame(['/work/new']));
    expect(favoritesOf(store)).toEqual(['/work/new']);
  });
});

const removedOf = (store: ProjectMarkLiveStore) => Object.fromEntries(store.getSnapshot().removed);

describe('ProjectMarkLiveStore removals', () => {
  it('starts with no removed folder', () => {
    expect(new ProjectMarkLiveStore('http://127.0.0.1:3000').getSnapshot().removed.size).toBe(0);
  });

  // plan-project_list_actions/REQ-20: each frame replaces the removed folders and their time, as the server sent it
  it('keeps the removed folders of each frame with their removal time, as sent', () => {
    const store = started();
    last().receive({ ...frame(['/work/a']), removed: { '/work/b': '2026-11-10T10:00:00.000Z', '/work/c': '2026-11-11T09:00:00Z' } });
    expect(removedOf(store)).toEqual({ '/work/b': '2026-11-10T10:00:00.000Z', '/work/c': '2026-11-11T09:00:00Z' });
    expect(favoritesOf(store)).toEqual(['/work/a']);
    last().receive({ ...frame([]), removed: { '/work/c': '2026-11-11T09:00:00Z' } });
    expect(removedOf(store)).toEqual({ '/work/c': '2026-11-11T09:00:00Z' });
  });

  it('a frame with no removed gives no removed folder', () => {
    const store = started();
    last().receive({ ...frame([]), removed: { '/work/b': '2026-11-10T10:00:00.000Z' } });
    const listener = vi.fn();
    store.subscribe(listener);
    last().receive(frame(['/work/a']));
    expect(removedOf(store)).toEqual({});
    expect(favoritesOf(store)).toEqual(['/work/a']);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['removed that is an array', ['/work/x']],
    ['removed that is a string', '/work/x'],
    ['removed that is null', null],
    ['removed with a value that is not a string', { '/work/x': 3 }],
  ])('ignores a frame with %s', (_name, removed) => {
    const store = started();
    last().receive({ ...frame(['/work/a']), removed: { '/work/b': '2026-11-10T10:00:00.000Z' } });
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);
    last().receive({ ...frame(['/work/z']), removed });
    expect(store.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('pageProjectMarkLiveStore', () => {
  it('creates the one store of the page on window.location.origin, started on the first call', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:4555' } });
    vi.resetModules();
    const { pageProjectMarkLiveStore } = await import('./project-mark-live-store');
    expect(sockets()).toHaveLength(0);
    const store = pageProjectMarkLiveStore();
    expect(sockets()).toHaveLength(1);
    expect(last().url).toBe('ws://127.0.0.1:4555/api/projects/marks');
    expect(pageProjectMarkLiveStore()).toBe(store);
    expect(sockets()).toHaveLength(1);
  });
});
