import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveSessionStore, type SessionSummary } from './live-session-store';

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

  #emit(type: 'open' | 'message', event: Event): void {
    for (const listener of [...(this.#listeners.get(type) ?? [])]) listener(event);
    if (type === 'open') this.onopen?.(event);
    else this.onmessage?.(event);
  }
}

interface PendingLoad {
  url: string;
  resolve(sessions: SessionSummary[]): void;
}

let loads: PendingLoad[];

const ORIGIN = 'http://127.0.0.1:3000';

const summary = (id: string, state: SessionSummary['state'] = 'idle', label = id): SessionSummary => ({
  id,
  folder: `/projects/${id}`,
  label,
  state,
  lastActivity: '2026-11-05T10:00:00.000Z',
});

const event = (session: SessionSummary) => ({ type: 'session', session });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const ids = (store: LiveSessionStore) => store.getSnapshot().map((s) => `${s.id}:${s.state}`);
const lastSocket = () => {
  const socket = FakeWebSocket.instances.at(-1);
  if (!socket) throw new Error('no socket opened');
  return socket;
};

async function loaded(store: LiveSessionStore, sessions: SessionSummary[]): Promise<void> {
  store.start();
  lastSocket().open();
  await flush();
  loads.at(-1)?.resolve(sessions);
  await flush();
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  loads = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (input: string | URL | Request) =>
        new Promise<Response>((resolve) => {
          const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
          loads.push({
            url,
            resolve: (sessions) =>
              resolve(new Response(JSON.stringify(sessions), { status: 200, headers: { 'content-type': 'application/json' } })),
          });
        }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LiveSessionStore', () => {
  // plan-claude_sessions_client/REQ-11: the list starts empty
  it('starts with an empty list', () => {
    expect(new LiveSessionStore(ORIGIN).getSnapshot()).toEqual([]);
  });

  // plan-claude_sessions_client/REQ-15: opens the events channel on the same origin
  it('start opens ws on an http origin and wss on an https origin', () => {
    new LiveSessionStore(ORIGIN).start();
    expect(lastSocket().url).toBe('ws://127.0.0.1:3000/api/sessions/events');
    new LiveSessionStore('https://claude.local:8443').start();
    expect(lastSocket().url).toBe('wss://claude.local:8443/api/sessions/events');
  });

  // plan-claude_sessions_client/REQ-11, REQ-20: when the socket opens, the list is loaded from the server
  it('loads GET /api/sessions only once the socket is open, and replaces the list with it', async () => {
    const store = new LiveSessionStore(ORIGIN);
    const listener = vi.fn();
    store.subscribe(listener);
    store.start();
    await flush();
    expect(loads).toEqual([]);
    lastSocket().open();
    await flush();
    expect(loads.map((load) => load.url)).toEqual([`${ORIGIN}/api/sessions`]);
    loads[0]?.resolve([summary('a'), summary('b', 'working')]);
    await flush();
    expect(store.getSnapshot()).toEqual([summary('a'), summary('b', 'working')]);
    expect(listener).toHaveBeenCalled();
  });

  // plan-claude_sessions_client/REQ-15: events received while loading are applied after the load
  it('applies the events received while loading after the loaded list', async () => {
    const store = new LiveSessionStore(ORIGIN);
    store.start();
    lastSocket().open();
    await flush();
    lastSocket().receive(event(summary('a', 'needs_input')));
    lastSocket().receive(event(summary('c', 'working')));
    await flush();
    loads[0]?.resolve([summary('a'), summary('b')]);
    await flush();
    expect(ids(store)).toEqual(['a:needs_input', 'b:idle', 'c:working']);
  });

  // plan-claude_sessions_client/REQ-15: a known id is replaced in place, an unknown id is added at the end
  it('replaces the entry of a known id in place and adds an unknown id at the end', async () => {
    const store = new LiveSessionStore(ORIGIN);
    await loaded(store, [summary('a'), summary('b')]);
    lastSocket().receive(event(summary('a', 'working', 'Nuova etichetta')));
    lastSocket().receive(event(summary('z', 'idle')));
    expect(ids(store)).toEqual(['a:working', 'b:idle', 'z:idle']);
    expect(store.getSnapshot()[0]?.label).toBe('Nuova etichetta');
  });

  // plan-claude_sessions_client/REQ-15: listeners are called after each change and can unsubscribe
  it('calls listeners after each change until they unsubscribe', async () => {
    const store = new LiveSessionStore(ORIGIN);
    await loaded(store, [summary('a')]);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    lastSocket().receive(event(summary('a', 'working')));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    lastSocket().receive(event(summary('a', 'idle')));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // plan-claude_sessions_client/REQ-15: getSnapshot keeps the same array until a change
  it('getSnapshot returns the same array until the next change', async () => {
    const store = new LiveSessionStore(ORIGIN);
    await loaded(store, [summary('a')]);
    const first = store.getSnapshot();
    expect(store.getSnapshot()).toBe(first);
    lastSocket().receive(event(summary('a', 'working')));
    expect(store.getSnapshot()).not.toBe(first);
    expect(first.map((s) => s.state)).toEqual(['idle']);
  });

  // plan-claude_sessions_client/REQ-15: frames that are not session events are ignored
  it('ignores frames that are not { type: "session" }', async () => {
    const store = new LiveSessionStore(ORIGIN);
    await loaded(store, [summary('a')]);
    const before = store.getSnapshot();
    lastSocket().receive({ type: 'other', session: summary('x') });
    lastSocket().receive({ session: summary('y') });
    expect(store.getSnapshot()).toBe(before);
  });

  // plan-claude_sessions_client/REQ-15: a frame that is not JSON is ignored
  it('ignores a frame that is not JSON', async () => {
    const store = new LiveSessionStore(ORIGIN);
    await loaded(store, [summary('a')]);
    const before = store.getSnapshot();
    expect(() => lastSocket().receive('not json')).not.toThrow();
    expect(store.getSnapshot()).toBe(before);
  });

  // plan-claude_sessions_client/REQ-15: stop closes the socket; later frames and the pending load change nothing
  it('stop closes the socket, and later frames and the pending load change nothing', async () => {
    const store = new LiveSessionStore(ORIGIN);
    store.start();
    const socket = lastSocket();
    socket.open();
    await flush();
    store.stop();
    expect(socket.closeCalls).toBe(1);
    loads[0]?.resolve([summary('a')]);
    socket.receive(event(summary('b')));
    await flush();
    expect(store.getSnapshot()).toEqual([]);
  });

  // plan-claude_sessions_client/REQ-15: start again replaces the previous connection
  it('start again stops the previous connection and ignores its frames', async () => {
    const store = new LiveSessionStore(ORIGIN);
    await loaded(store, [summary('a')]);
    const previous = lastSocket();
    await loaded(store, [summary('a'), summary('b')]);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(previous.closeCalls).toBe(1);
    previous.receive(event(summary('old', 'working')));
    expect(ids(store)).toEqual(['a:idle', 'b:idle']);
  });
});
