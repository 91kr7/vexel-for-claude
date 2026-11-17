// @vitest-environment jsdom
// Tests of plan-ui_transitions, batch session-switch: input typed while the connection opens (SessionView spec, "Actions").
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const disposable = () => ({ dispose() {} });

class FakeTerminal {
  static last: FakeTerminal | undefined;
  cols = 100;
  rows = 30;
  options: Record<string, unknown> = {};
  dataListener: ((data: string) => void) | undefined = undefined;
  constructor() {
    // Members the test does not care about answer with a disposable.
    const proxy = new Proxy(this, {
      get: (target, key, receiver) => (key in target ? Reflect.get(target, key, receiver) : () => disposable()),
    });
    FakeTerminal.last = proxy;
    return proxy;
  }
  onData(listener: (data: string) => void) {
    this.dataListener = listener;
    return disposable();
  }
  type(data: string) {
    this.dataListener?.(data);
  }
}

vi.mock('@xterm/xterm', () => ({ Terminal: FakeTerminal }));
vi.mock('@xterm/xterm/css/xterm.css', () => ({}));
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit() {} proposeDimensions() { return undefined; } activate() {} dispose() {} } }));
vi.mock('@xterm/addon-search', () => ({
  SearchAddon: class {
    onDidChangeResults = () => disposable();
    activate() {}
    dispose() {}
  },
}));
vi.mock('./web-address-links', () => ({ loadWebAddressLinks: () => disposable() }));

class FakeSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static all: FakeSocket[] = [];
  readyState = FakeSocket.CONNECTING;
  sent: { type?: string; data?: string }[] = [];
  binaryType = 'blob';
  constructor(readonly url: string) {
    super();
    FakeSocket.all.push(this);
  }
  send(payload: string) {
    if (this.readyState !== FakeSocket.OPEN) throw new Error('send on a socket that is not open');
    this.sent.push(JSON.parse(payload) as { type?: string; data?: string });
  }
  close(code = 1000) {
    if (this.readyState === FakeSocket.CLOSED) return;
    this.readyState = FakeSocket.CLOSED;
    this.dispatchEvent(Object.assign(new Event('close'), { code }));
  }
  serverOpens() {
    this.readyState = FakeSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }
  serverDrops() {
    this.readyState = FakeSocket.CLOSED;
    this.dispatchEvent(Object.assign(new Event('close'), { code: 1006 }));
  }
}

const { SessionView } = await import('./SessionView');

let root: Root | undefined;

beforeEach(() => {
  FakeSocket.all = [];
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('fetch', () => new Promise(() => {}));
  // jsdom has no FontFaceSet: the terminal opens once the font is "loaded".
  Object.defineProperty(document, 'fonts', { configurable: true, value: { load: () => Promise.resolve([]) } });
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  root?.unmount();
  root = undefined;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

const socketOf = (id: string) => FakeSocket.all.filter((socket) => socket.url.includes(`/api/sessions/${id}/attach`));
/** Shows the view of a session and waits for its terminal to open its first connection. */
async function show(sessionId: string): Promise<void> {
  flushSync(() => root?.render(<SessionView sessionId={sessionId} onLeaveTerminal={() => {}} />));
  await vi.waitFor(() => expect(socketOf(sessionId).length).toBeGreaterThan(0));
}
const typed = (socket: FakeSocket) => socket.sent.filter((frame) => frame.type === 'input').map((frame) => frame.data);
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('SessionView input while the connection opens', () => {
  // plan-ui_transitions/REQ-33: kept while connecting, sent in typing order right after the resize of the open connection
  it('keeps the keys typed while the first connection opens and sends them in order right after the resize', async () => {
    await show('s1');
    const [socket] = socketOf('s1');
    expect(socket).toBeDefined();
    FakeTerminal.last!.type('a');
    FakeTerminal.last!.type('b');
    FakeTerminal.last!.type('c');
    expect(socket!.sent, 'nothing goes out before the connection opens').toEqual([]);

    socket!.serverOpens();
    expect(socket!.sent.map((frame) => frame.type)).toEqual(['resize', 'input', 'input', 'input']);
    expect(typed(socket!)).toEqual(['a', 'b', 'c']);
  });

  // plan-ui_transitions/REQ-33: the kept keys go out once; later keys follow them directly
  it('sends the kept keys once, and keys typed after the opening go out at once after them', async () => {
    await show('s1');
    const [socket] = socketOf('s1');
    FakeTerminal.last!.type('x');
    socket!.serverOpens();
    FakeTerminal.last!.type('y');
    expect(typed(socket!)).toEqual(['x', 'y']);
  });

  // plan-ui_transitions/REQ-11, REQ-33: a new sessionId drops the kept keys, so they never reach another session
  it('drops the kept keys on a new sessionId: neither session receives them', async () => {
    await show('s1');
    const [first] = socketOf('s1');
    FakeTerminal.last!.type('q');
    await show('s2');
    const [second] = socketOf('s2');
    expect(second).toBeDefined();
    second!.serverOpens();
    expect(typed(second!), 'the new session gets no key of the old one').toEqual([]);
    expect(first!.sent, 'the old connection sent nothing').toEqual([]);
    expect(first!.readyState).toBe(FakeSocket.CLOSED);
  });

  // plan-ui_transitions/REQ-33: the leaving view's unmount drops its kept keys
  it('drops the kept keys when the view goes before its connection opens', async () => {
    await show('s1');
    const [socket] = socketOf('s1');
    FakeTerminal.last!.type('z');
    flushSync(() => root?.render(null));
    expect(socket!.sent).toEqual([]);
  });

  // plan-ui_transitions/REQ-33 on a new attempt: keys typed while no attempt opens are lost; keys typed while the new attempt opens are kept
  it('keeps the keys typed while a new attempt opens, and loses those typed while no attempt was opening', async () => {
    await show('s1');
    const [first] = socketOf('s1');
    first!.serverOpens();
    first!.serverDrops();
    FakeTerminal.last!.type('lost');
    await vi.waitFor(() => expect(socketOf('s1')).toHaveLength(2), { timeout: 4000, interval: 50 });
    const retry = socketOf('s1')[1]!;
    FakeTerminal.last!.type('k');
    FakeTerminal.last!.type('m');
    retry.serverOpens();
    expect(retry.sent.map((frame) => frame.type)).toEqual(['resize', 'input', 'input']);
    expect(typed(retry)).toEqual(['k', 'm']);
    await pause(0);
  });
});
