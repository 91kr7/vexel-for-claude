// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, rerenderLast, run, unmountAll } from '../settings/settings-test-support';
import { type TurnState, type TurnTree, useTurn } from './turn-store';

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
  sent: unknown[] = [];
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

  send(data: unknown): void {
    this.sent.push(data);
  }

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
    run(() => this.#emit('message', new MessageEvent('message', { data })));
  }

  serverClose(code = 1006): void {
    this.readyState = 3;
    run(() => this.#emit('close', Object.assign(new Event('close'), { code, wasClean: code === 1000 })));
  }

  #emit(type: 'open' | 'message' | 'close' | 'error', event: Event): void {
    for (const listener of [...(this.#listeners.get(type) ?? [])]) listener(event);
    this[`on${type}`]?.(event);
  }
}

const sockets = () => FakeWebSocket.instances;
const lastSocket = () => FakeWebSocket.instances.at(-1)!;

function Probe({ sessionId }: { sessionId: string }) {
  return <output>{JSON.stringify(useTurn(sessionId))}</output>;
}

let host: HTMLElement;
const state = () => JSON.parse(host.querySelector('output')!.textContent!) as TurnState;
const tree = () => {
  const current = state();
  if (current.status !== 'loaded') throw new Error(`not loaded: ${current.status}`);
  return current.turn;
};

const turn = (fields: Partial<TurnTree> = {}): TurnTree => ({ number: 1, status: 'running', groups: [], earlier: [], subagents: [], ...fields });
const advance = (ms: number) => run(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
  unmountAll();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useTurn, frames', () => {
  // plan-session_activity/REQ-43: mount → loading and one socket to the turn route of the session, id URL-encoded
  it('starts loading with one socket to the turn route of the session', () => {
    host = mount(<Probe sessionId="a/b c" />);
    expect(state()).toEqual({ status: 'loading' });
    expect(sockets()).toHaveLength(1);
    expect(lastSocket().url).toBe(`ws://${location.host}/api/sessions/a%2Fb%20c/turn`);
  });

  // plan-session_activity/REQ-28, plan-subagent_panel/REQ-1: a turn frame gives the loaded tree, with no steps
  it('gives the tree of a turn frame', () => {
    host = mount(<Probe sessionId="s1" />);
    const first = turn({ groups: [{ subagents: ['a'] }], subagents: [{ id: 'a', state: 'running', groups: [] }] });
    lastSocket().receive({ type: 'turn', turn: first });
    expect(state()).toEqual({ status: 'loaded', turn: first });
  });

  // plan-session_activity/REQ-43, plan-subagent_panel/REQ-2, REQ-10: an update replaces status, groups and the earlier groups, and replaces or adds subagents by id
  it('applies an update to the tree', () => {
    host = mount(<Probe sessionId="s1" />);
    lastSocket().receive({
      type: 'turn',
      turn: turn({
        groups: [{ subagents: ['a'] }],
        subagents: [
          { id: 'a', state: 'running', groups: [] },
          { id: 'b', state: 'running', groups: [] },
        ],
      }),
    });
    lastSocket().receive({
      type: 'update',
      status: 'ended',
      groups: [{ subagents: ['c'] }, { subagents: ['a'] }],
      earlier: [{ subagents: ['y', 'z'] }],
      subagents: [
        { id: 'a', state: 'finished', groups: [] },
        { id: 'c', state: 'running', groups: [] },
      ],
    });
    expect(tree()).toEqual(
      turn({
        status: 'ended',
        groups: [{ subagents: ['c'] }, { subagents: ['a'] }],
        earlier: [{ subagents: ['y', 'z'] }],
        subagents: [
          { id: 'a', state: 'finished', groups: [] },
          { id: 'b', state: 'running', groups: [] },
          { id: 'c', state: 'running', groups: [] },
        ],
      }),
    );
  });

  // useTurn spec: an update that names only some parts keeps the others
  it('keeps the parts that an update does not name', () => {
    host = mount(<Probe sessionId="s1" />);
    const first = turn({ groups: [{ subagents: ['a'] }], earlier: [{ subagents: ['z'] }], subagents: [{ id: 'a', state: 'running', groups: [] }, { id: 'z', state: 'running', groups: [] }] });
    lastSocket().receive({ type: 'turn', turn: first });
    lastSocket().receive({ type: 'update', status: 'ended' });
    expect(tree()).toEqual({ ...first, status: 'ended' });
  });

  // plan-session_activity/REQ-39: a later turn frame replaces the whole tree
  it('replaces the tree with a later turn frame', () => {
    host = mount(<Probe sessionId="s1" />);
    lastSocket().receive({ type: 'turn', turn: turn({ groups: [{ subagents: ['old'] }], subagents: [{ id: 'old', state: 'running', groups: [] }] }) });
    const next = turn({ number: 2, earlier: [{ subagents: ['bg'] }], subagents: [{ id: 'bg', state: 'running', groups: [] }] });
    lastSocket().receive({ type: 'turn', turn: next });
    expect(tree()).toEqual(next);
  });

  // useTurn spec: an update before the first frame, bad JSON and other frame types are ignored
  it('ignores an update before the first frame, bad JSON and frames of another type', () => {
    host = mount(<Probe sessionId="s1" />);
    lastSocket().receive({ type: 'update', status: 'ended' });
    lastSocket().receive('{not json');
    lastSocket().receive({ type: 'session', status: 'ended' });
    expect(state()).toEqual({ status: 'loading' });
    lastSocket().receive({ type: 'turn', turn: turn() });
    lastSocket().receive('{not json');
    lastSocket().receive({ type: 'other', status: 'ended' });
    expect(tree().status).toBe('running');
  });

  // useTurn spec: it sends nothing on the socket
  it('sends nothing on the socket', () => {
    host = mount(<Probe sessionId="s1" />);
    lastSocket().open();
    lastSocket().receive({ type: 'turn', turn: turn() });
    expect(lastSocket().sent).toEqual([]);
  });
});

describe('useTurn, reconnection', () => {
  // plan-session_activity/REQ-41, turn-panel spec: a socket closed before any frame → unavailable, with no new socket
  it('becomes unavailable when the socket closes before any frame, and opens no new socket', () => {
    host = mount(<Probe sessionId="s1" />);
    lastSocket().serverClose();
    expect(state()).toEqual({ status: 'unavailable' });
    advance(10_000);
    expect(sockets()).toHaveLength(1);
  });

  // plan-session_activity/REQ-43: a lost socket after a first frame → a new socket 2 s later, the tree shown meanwhile, replaced by the new first frame
  it('opens a new socket 2 s after a lost one, keeps the tree meanwhile, and takes the first frame of the new socket', () => {
    host = mount(<Probe sessionId="s1" />);
    const first = turn({ groups: [{ subagents: ['before'] }], subagents: [{ id: 'before', state: 'running', groups: [] }] });
    lastSocket().receive({ type: 'turn', turn: first });
    lastSocket().serverClose();
    expect(tree()).toEqual(first);
    advance(1_999);
    expect(sockets()).toHaveLength(1);
    advance(1);
    expect(sockets()).toHaveLength(2);
    expect(lastSocket().url).toBe(sockets()[0]!.url);
    lastSocket().receive({ type: 'update', status: 'ended' });
    expect(tree(), 'an update before the first frame of the new socket is ignored').toEqual(first);
    const fresh = turn({ number: 2, groups: [{ subagents: ['after'] }], subagents: [{ id: 'after', state: 'running', groups: [] }] });
    lastSocket().receive({ type: 'turn', turn: fresh });
    expect(tree()).toEqual(fresh);
  });

  // useTurn spec: failed attempts are retried every 2 s; the tree stays
  it('tries again every 2 s while the attempts fail', () => {
    host = mount(<Probe sessionId="s1" />);
    const first = turn();
    lastSocket().receive({ type: 'turn', turn: first });
    lastSocket().serverClose();
    for (let attempt = 2; attempt <= 4; attempt += 1) {
      advance(2_000);
      expect(sockets()).toHaveLength(attempt);
      lastSocket().serverClose();
      expect(tree()).toEqual(first);
    }
  });

  // useTurn spec: an attempt closed with 4404 ends the attempts
  it('stops trying after an attempt closed with 4404', () => {
    host = mount(<Probe sessionId="s1" />);
    lastSocket().receive({ type: 'turn', turn: turn() });
    lastSocket().serverClose();
    advance(2_000);
    lastSocket().serverClose(4404);
    advance(10_000);
    expect(sockets()).toHaveLength(2);
  });

  // useTurn spec: unmount closes the socket and ends the attempts
  it('closes the socket on unmount and opens no new one', () => {
    host = mount(<Probe sessionId="s1" />);
    lastSocket().receive({ type: 'turn', turn: turn() });
    const socket = lastSocket();
    unmountAll();
    expect(socket.closeCalls).toBeGreaterThan(0);
    advance(10_000);
    expect(sockets()).toHaveLength(1);
  });

  // useTurn spec: unmount during the 2 s wait cancels the new attempt
  it('opens no new socket when unmounted during the wait', () => {
    host = mount(<Probe sessionId="s1" />);
    lastSocket().receive({ type: 'turn', turn: turn() });
    lastSocket().serverClose();
    unmountAll();
    advance(10_000);
    expect(sockets()).toHaveLength(1);
  });

  // useTurn spec: a new session id → loading and one socket for it; the old one closes
  it('goes back to loading with one new socket for a new session id', async () => {
    vi.useRealTimers();
    host = mount(<Probe sessionId="s1" />);
    const old = lastSocket();
    old.receive({ type: 'turn', turn: turn() });
    rerenderLast(<Probe sessionId="s2" />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(state()).toEqual({ status: 'loading' });
    expect(sockets()).toHaveLength(2);
    expect(lastSocket().url).toBe(`ws://${location.host}/api/sessions/s2/turn`);
    expect(old.closeCalls).toBeGreaterThan(0);
    expect(sockets().filter((socket) => socket.readyState !== 3)).toHaveLength(1);
  });
});
