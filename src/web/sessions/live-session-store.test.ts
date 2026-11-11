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

  serverClose(code = 1006): void {
    this.readyState = 3;
    this.#emit('close', Object.assign(new Event('close'), { code, wasClean: code === 1000 }));
  }

  fail(): void {
    this.#emit('error', new Event('error'));
    this.serverClose();
  }

  #emit(type: 'open' | 'message' | 'close' | 'error', event: Event): void {
    for (const listener of [...(this.#listeners.get(type) ?? [])]) listener(event);
    this[`on${type}`]?.(event);
  }
}

interface PendingLoad {
  url: string;
  resolve(sessions: SessionSummary[]): void;
  answer(status: number): void;
  fail(): void;
}

let loads: PendingLoad[];
const stores: LiveSessionStore[] = [];

const ORIGIN = 'http://127.0.0.1:3000';

const summary = (id: string, state: SessionSummary['state'] = 'idle', label = id): SessionSummary => ({
  id,
  folder: `/projects/${id}`,
  label,
  state,
  lastActivity: '2026-11-05T10:00:00.000Z',
});

const event = (session: SessionSummary) => ({ type: 'session', session });
// The real setTimeout, kept before the reconnection tests fake the timers.
const realSetTimeout = globalThis.setTimeout;
const flush = () => new Promise((resolve) => realSetTimeout(resolve, 0));
// Every store is stopped after its test, so no pending reconnection opens a socket in a later test.
const newStore = (origin = ORIGIN) => {
  const store = new LiveSessionStore(origin);
  stores.push(store);
  return store;
};
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
        new Promise<Response>((resolve, reject) => {
          const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
          loads.push({
            url,
            resolve: (sessions) =>
              resolve(new Response(JSON.stringify(sessions), { status: 200, headers: { 'content-type': 'application/json' } })),
            answer: (status) => resolve(new Response(JSON.stringify({ error: 'internal' }), { status, headers: { 'content-type': 'application/json' } })),
            fail: () => reject(new TypeError('Failed to fetch')),
          });
        }),
    ),
  );
});

afterEach(() => {
  for (const store of stores.splice(0)) store.stop();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('LiveSessionStore', () => {
  // plan-claude_sessions_client/REQ-11: the list starts empty
  it('starts with an empty list', () => {
    expect(newStore().getSnapshot()).toEqual([]);
  });

  // plan-claude_sessions_client/REQ-15: opens the events channel on the same origin
  it('start opens ws on an http origin and wss on an https origin', () => {
    newStore().start();
    expect(lastSocket().url).toBe('ws://127.0.0.1:3000/api/sessions/events');
    newStore('https://claude.local:8443').start();
    expect(lastSocket().url).toBe('wss://claude.local:8443/api/sessions/events');
  });

  // plan-claude_sessions_client/REQ-11, REQ-20: when the socket opens, the list is loaded from the server
  it('loads GET /api/sessions only once the socket is open, and replaces the list with it', async () => {
    const store = newStore();
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
    const store = newStore();
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
    const store = newStore();
    await loaded(store, [summary('a'), summary('b')]);
    lastSocket().receive(event(summary('a', 'working', 'Nuova etichetta')));
    lastSocket().receive(event(summary('z', 'idle')));
    expect(ids(store)).toEqual(['a:working', 'b:idle', 'z:idle']);
    expect(store.getSnapshot()[0]?.label).toBe('Nuova etichetta');
  });

  // plan-favorite_session/REQ-8: a session event carries the mark, and a later event without it removes it
  it('shows the favorite mark of a session event and drops it when a later event has none', async () => {
    const store = newStore();
    await loaded(store, [summary('a')]);
    lastSocket().receive(event({ ...summary('a'), favorite: true }));
    expect(store.getSnapshot()[0]?.favorite).toBe(true);
    lastSocket().receive(event(summary('a')));
    expect(store.getSnapshot()[0]?.favorite).toBeUndefined();
  });

  // plan-claude_sessions_client/REQ-15: listeners are called after each change and can unsubscribe
  it('calls listeners after each change until they unsubscribe', async () => {
    const store = newStore();
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
    const store = newStore();
    await loaded(store, [summary('a')]);
    const first = store.getSnapshot();
    expect(store.getSnapshot()).toBe(first);
    lastSocket().receive(event(summary('a', 'working')));
    expect(store.getSnapshot()).not.toBe(first);
    expect(first.map((s) => s.state)).toEqual(['idle']);
  });

  // plan-claude_sessions_client/REQ-15: frames that are not session events are ignored
  it('ignores frames that are not { type: "session" }', async () => {
    const store = newStore();
    await loaded(store, [summary('a')]);
    const before = store.getSnapshot();
    lastSocket().receive({ type: 'other', session: summary('x') });
    lastSocket().receive({ session: summary('y') });
    expect(store.getSnapshot()).toBe(before);
  });

  // plan-claude_sessions_client/REQ-15: a frame that is not JSON is ignored
  it('ignores a frame that is not JSON', async () => {
    const store = newStore();
    await loaded(store, [summary('a')]);
    const before = store.getSnapshot();
    expect(() => lastSocket().receive('not json')).not.toThrow();
    expect(store.getSnapshot()).toBe(before);
  });

  // plan-claude_sessions_client/REQ-15: stop closes the socket; later frames and the pending load change nothing
  it('stop closes the socket, and later frames and the pending load change nothing', async () => {
    const store = newStore();
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
    const store = newStore();
    await loaded(store, [summary('a')]);
    const previous = lastSocket();
    await loaded(store, [summary('a'), summary('b')]);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(previous.closeCalls).toBe(1);
    previous.receive(event(summary('old', 'working')));
    expect(ids(store)).toEqual(['a:idle', 'b:idle']);
  });

  // plan-claude_sessions_client/REQ-32: an external session that ends leaves the list
  it('a session-removed event removes the entry with that id; an unknown id changes nothing', async () => {
    const store = newStore();
    await loaded(store, [summary('a'), summary('b'), summary('c')]);
    const listener = vi.fn();
    store.subscribe(listener);
    lastSocket().receive({ type: 'session-removed', id: 'b' });
    expect(ids(store)).toEqual(['a:idle', 'c:idle']);
    expect(listener).toHaveBeenCalled();
    const before = store.getSnapshot();
    lastSocket().receive({ type: 'session-removed', id: 'unknown' });
    expect(store.getSnapshot()).toEqual(before);
  });

  // plan-claude_sessions_client/REQ-32
  it('applies a session-removed event received while loading after the loaded list', async () => {
    const store = newStore();
    store.start();
    lastSocket().open();
    await flush();
    lastSocket().receive({ type: 'session-removed', id: 'gone' });
    await flush();
    loads[0]?.resolve([summary('kept'), summary('gone')]);
    await flush();
    expect(ids(store)).toEqual(['kept:idle']);
  });

  // plan-claude_sessions_client/REQ-29: the external marker of the server is kept, from the load and from the events
  it('keeps the external: true marker of external entries', async () => {
    const store = newStore();
    await loaded(store, [summary('hosted'), { ...summary('ext-1'), external: true }]);
    lastSocket().receive(event({ ...summary('ext-2', 'working'), external: true }));
    expect(store.getSnapshot().map((s) => [s.id, s.external])).toEqual([
      ['hosted', undefined],
      ['ext-1', true],
      ['ext-2', true],
    ]);
  });

  describe('load status', () => {
    // plan-claude_sessions_client-ui_redesign/REQ-29, LiveSessionStore: loading from start() until the first list
    it('is loading from start until the first list arrives, then ready', async () => {
      const store = newStore();
      store.start();
      expect(store.getStatus()).toBe('loading');
      lastSocket().open();
      await flush();
      expect(store.getStatus()).toBe('loading');
      loads[0]?.resolve([summary('a')]);
      await flush();
      expect(store.getStatus()).toBe('ready');
    });

    // plan-claude_sessions_client-ui_redesign/REQ-29, LiveSessionStore: an empty first list is a loaded list
    it('is ready after an empty first list', async () => {
      const store = newStore();
      await loaded(store, []);
      expect(store.getStatus()).toBe('ready');
    });

    // plan-claude_sessions_client-ui_redesign/REQ-30, LiveSessionStore: a network error on the list request
    it('is error when the list request fails, and the list stays as it was', async () => {
      const store = newStore();
      store.start();
      lastSocket().open();
      await flush();
      loads[0]?.fail();
      await flush();
      expect(store.getStatus()).toBe('error');
      expect(store.getSnapshot()).toEqual([]);
    });

    // plan-claude_sessions_client-ui_redesign/REQ-30, LiveSessionStore: a non-2xx answer to the list request
    it.each([404, 500, 503])('is error when the list request answers %i, and the list stays as it was', async (status) => {
      const store = newStore();
      store.start();
      lastSocket().open();
      await flush();
      loads[0]?.answer(status);
      await flush();
      expect(store.getStatus()).toBe('error');
      expect(store.getSnapshot()).toEqual([]);
    });

    // plan-claude_sessions_client-ui_redesign/REQ-30, LiveSessionStore: the events socket closes while the store runs
    it('turns to error when the events socket closes, and keeps the entries already received', async () => {
      const store = newStore();
      await loaded(store, [summary('a')]);
      lastSocket().serverClose(1006);
      expect(store.getStatus()).toBe('error');
      expect(ids(store)).toEqual(['a:idle']);
    });

    // plan-claude_sessions_client-ui_redesign/REQ-30, LiveSessionStore: the events socket fails while the store runs
    it('turns to error when the events socket fails', async () => {
      const store = newStore();
      await loaded(store, [summary('a')]);
      lastSocket().fail();
      expect(store.getStatus()).toBe('error');
    });

    // plan-claude_sessions_client-ui_redesign/REQ-30, LiveSessionStore: a socket that never opens is an error too
    it('turns to error when the events socket closes before the list loads', async () => {
      const store = newStore();
      store.start();
      lastSocket().serverClose(1006);
      await flush();
      expect(store.getStatus()).toBe('error');
    });

    // LiveSessionStore: a socket closed by stop() is not an error
    it('stop does not change the status, even when the socket then reports its close', async () => {
      const store = newStore();
      await loaded(store, [summary('a')]);
      const socket = lastSocket();
      store.stop();
      socket.serverClose(1005);
      await flush();
      expect(store.getStatus()).toBe('ready');
    });

    // LiveSessionStore: stop() during the load keeps the status loading
    it('stop during the load keeps the status loading, whatever the pending load does', async () => {
      const store = newStore();
      store.start();
      lastSocket().open();
      await flush();
      store.stop();
      loads[0]?.fail();
      await flush();
      expect(store.getStatus()).toBe('loading');
    });

    // LiveSessionStore: a status change calls the subscribe listeners
    it('calls the listeners when the status changes, also with no change of the list', async () => {
      const store = newStore();
      await loaded(store, [summary('a')]);
      const listener = vi.fn();
      store.subscribe(listener);
      lastSocket().serverClose(1006);
      expect(listener).toHaveBeenCalled();
      expect(store.getStatus()).toBe('error');
    });
  });

  describe('reconnection', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    });

    const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms);

    /** Opens the last socket and answers its list load with `sessions`. */
    async function connect(sessions: SessionSummary[]): Promise<void> {
      lastSocket().open();
      await flush();
      loads.at(-1)?.resolve(sessions);
      await flush();
    }

    // plan-claude_sessions_client/REQ-46: a lost events socket gives a new connection 2 s later
    it('opens a new events socket 2 s after the events socket closes, on the same address', async () => {
      const store = newStore();
      await loaded(store, [summary('a')]);
      lastSocket().serverClose(1006);
      await wait(1900);
      expect(FakeWebSocket.instances).toHaveLength(1);
      await wait(100);
      expect(FakeWebSocket.instances).toHaveLength(2);
      expect(lastSocket().url).toBe('ws://127.0.0.1:3000/api/sessions/events');
    });

    // plan-claude_sessions_client/REQ-46: attempts go on every 2 s while they fail, and the status stays error
    it('tries again every 2 s while the attempts fail, and stays error during the attempts', async () => {
      const store = newStore();
      await loaded(store, [summary('a')]);
      lastSocket().serverClose(1006);
      for (let attempt = 2; attempt <= 5; attempt += 1) {
        await wait(2000);
        expect(FakeWebSocket.instances).toHaveLength(attempt);
        lastSocket().serverClose(1006);
        await flush();
        expect(store.getStatus()).toBe('error');
      }
      expect(ids(store)).toEqual(['a:idle']);
    });

    // plan-claude_sessions_client/REQ-46: an attempt whose socket opens but whose list load fails is a failed attempt too
    it.each([
      ['a network error', (load: PendingLoad) => load.fail()],
      ['a 503 answer', (load: PendingLoad) => load.answer(503)],
    ])('tries again 2 s after an attempt whose list load fails with %s', async (_name, failLoad) => {
      const store = newStore();
      await loaded(store, [summary('a')]);
      lastSocket().serverClose(1006);
      await wait(2000);
      lastSocket().open();
      await flush();
      failLoad(loads.at(-1)!);
      await flush();
      expect(store.getStatus()).toBe('error');
      await wait(2000);
      expect(FakeWebSocket.instances).toHaveLength(3);
    });

    // LiveSessionStore: a failed list load of the first connection also starts the attempts
    it('tries a new connection 2 s after the first list load fails', async () => {
      const store = newStore();
      store.start();
      lastSocket().open();
      await flush();
      loads[0]?.fail();
      await flush();
      await wait(2000);
      expect(FakeWebSocket.instances).toHaveLength(2);
      await connect([summary('a')]);
      expect(store.getStatus()).toBe('ready');
      expect(ids(store)).toEqual(['a:idle']);
    });

    // plan-claude_sessions_client/REQ-47: the status stays error until the list of the new connection arrives, then ready
    it('stays error while the new socket loads the list, then turns ready', async () => {
      const store = newStore();
      await loaded(store, [summary('a')]);
      lastSocket().serverClose(1006);
      await wait(2000);
      const listener = vi.fn();
      store.subscribe(listener);
      lastSocket().open();
      await flush();
      expect(store.getStatus()).toBe('error');
      expect(loads.map((load) => load.url)).toEqual([`${ORIGIN}/api/sessions`, `${ORIGIN}/api/sessions`]);
      loads.at(-1)?.resolve([summary('a')]);
      await flush();
      expect(store.getStatus()).toBe('ready');
      expect(listener).toHaveBeenCalled();
    });

    // plan-claude_sessions_client/REQ-48: the list of the new connection replaces the whole list
    it('replaces the whole list with the list of the new connection: gone entries leave, new states apply', async () => {
      const store = newStore();
      await loaded(store, [summary('a', 'needs_input'), summary('b', 'working'), summary('c')]);
      lastSocket().serverClose(1006);
      await wait(2000);
      await connect([summary('b', 'needs_input'), summary('d', 'needs_input')]);
      expect(ids(store)).toEqual(['b:needs_input', 'd:needs_input']);
    });

    // plan-claude_sessions_client/REQ-48: an empty list from the new backend empties the list
    it('empties the list when the new connection loads an empty list', async () => {
      const store = newStore();
      await loaded(store, [summary('a'), summary('b')]);
      lastSocket().serverClose(1006);
      await wait(2000);
      await connect([]);
      expect(store.getSnapshot()).toEqual([]);
      expect(store.getStatus()).toBe('ready');
    });

    // plan-claude_sessions_client/REQ-48: events received while the new connection loads apply after its list
    it('applies the events received while the new connection loads after its list', async () => {
      const store = newStore();
      await loaded(store, [summary('a')]);
      lastSocket().serverClose(1006);
      await wait(2000);
      lastSocket().open();
      await flush();
      lastSocket().receive(event(summary('n', 'working')));
      lastSocket().receive({ type: 'session-removed', id: 'x' });
      await flush();
      loads.at(-1)?.resolve([summary('x'), summary('y')]);
      await flush();
      expect(ids(store)).toEqual(['y:idle', 'n:working']);
    });

    // plan-claude_sessions_client/REQ-48: once connected again, live events apply again
    it('applies the live events of the new socket, and ignores the frames of the closed one', async () => {
      const store = newStore();
      await loaded(store, [summary('a')]);
      const closed = lastSocket();
      closed.serverClose(1006);
      await wait(2000);
      await connect([summary('a')]);
      lastSocket().receive(event(summary('a', 'working')));
      closed.receive(event(summary('old', 'working')));
      expect(ids(store)).toEqual(['a:working']);
    });

    // plan-claude_sessions_client/REQ-52: every disconnection gives error and attempts again, every return gives ready
    it('turns error and ready again at every disconnection and return', async () => {
      const store = newStore();
      await loaded(store, [summary('a')]);
      for (let cycle = 1; cycle <= 3; cycle += 1) {
        lastSocket().serverClose(1006);
        expect(store.getStatus()).toBe('error');
        await wait(2000);
        lastSocket().serverClose(1006);
        await wait(2000);
        await connect([summary(`s${cycle}`)]);
        expect(store.getStatus()).toBe('ready');
        expect(ids(store)).toEqual([`s${cycle}:idle`]);
      }
      expect(FakeWebSocket.instances).toHaveLength(7);
    });

    // LiveSessionStore: stop() cancels a pending reconnection
    it('opens no new socket after stop() while a reconnection is pending', async () => {
      const store = newStore();
      await loaded(store, [summary('a')]);
      lastSocket().serverClose(1006);
      await wait(1000);
      store.stop();
      await wait(10_000);
      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    // LiveSessionStore: stop() during an attempt closes its socket and ends the attempts
    it('stop() during an attempt closes its socket and opens no other', async () => {
      const store = newStore();
      await loaded(store, [summary('a')]);
      lastSocket().serverClose(1006);
      await wait(2000);
      const attempt = lastSocket();
      store.stop();
      expect(attempt.closeCalls).toBeGreaterThanOrEqual(1);
      attempt.serverClose(1006);
      await wait(10_000);
      expect(FakeWebSocket.instances).toHaveLength(2);
    });

    // LiveSessionStore: a socket closed by stop() is not a disconnection
    it('does not reconnect after stop() closes a working socket', async () => {
      const store = newStore();
      await loaded(store, [summary('a')]);
      const socket = lastSocket();
      store.stop();
      socket.serverClose(1005);
      await wait(10_000);
      expect(FakeWebSocket.instances).toHaveLength(1);
    });
  });
});
