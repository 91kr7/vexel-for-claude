// @vitest-environment jsdom
// Tests of plan-terminal_overflow, batch terminal-width: the fit of the terminal (SessionView spec, "Actions" and "Rules and invariants").
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const disposable = () => ({ dispose() {} });

interface Cell {
  width: number;
  height: number;
}

/** The parts of xterm.js that the fit reads: the grid, the cell size in device pixels, and the measure of the cells. */
class FakeTerminal {
  static last: FakeTerminal | undefined;
  cols = 80;
  rows = 24;
  options: Record<string, unknown> = {};
  element: HTMLElement | undefined = undefined;
  /** The cell size that the next measure finds, in device pixels. */
  measuredCell: Cell = { width: 8, height: 16 };
  cell: Cell = { width: 8, height: 16 };
  resizeListeners: ((size: { cols: number; rows: number }) => void)[] = [];
  _core: unknown;
  constructor() {
    const terminal = this;
    this._core = {
      _renderService: {
        get dimensions() {
          return { device: { cell: { ...terminal.cell } } };
        },
        handleDevicePixelRatioChange() {
          terminal.cell = { ...terminal.measuredCell };
        },
      },
    };
    // Members the test does not care about answer with a disposable.
    const proxy = new Proxy(this, {
      get: (target, key, receiver) => (key in target ? Reflect.get(target, key, receiver) : () => disposable()),
    });
    FakeTerminal.last = proxy;
    return proxy;
  }
  open(container: HTMLElement) {
    this.element = document.createElement('div');
    container.append(this.element);
  }
  resize(cols: number, rows: number) {
    if (cols === this.cols && rows === this.rows) return;
    this.cols = cols;
    this.rows = rows;
    for (const listener of this.resizeListeners) listener({ cols, rows });
  }
  onResize(listener: (size: { cols: number; rows: number }) => void) {
    this.resizeListeners.push(listener);
    return disposable();
  }
}

vi.mock('@xterm/xterm', () => ({ Terminal: FakeTerminal }));
vi.mock('@xterm/xterm/css/xterm.css', () => ({}));
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
  sent: { type?: string; cols?: number; rows?: number }[] = [];
  binaryType = 'blob';
  constructor(readonly url: string) {
    super();
    FakeSocket.all.push(this);
  }
  send(payload: string) {
    this.sent.push(JSON.parse(payload) as { type?: string; cols?: number; rows?: number });
  }
  close() {
    this.readyState = FakeSocket.CLOSED;
  }
  serverOpens() {
    this.readyState = FakeSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }
}

/** A running animation or transition, as the Web Animations API gives it. */
class FakeEffect {
  playState: AnimationPlayState = 'running';
  readonly finished: Promise<FakeEffect>;
  private settle!: { resolve: (effect: FakeEffect) => void; reject: (error: unknown) => void };
  constructor() {
    this.finished = new Promise((resolve, reject) => {
      this.settle = { resolve, reject };
    });
    this.finished.catch(() => undefined);
  }
  finish() {
    this.playState = 'finished';
    this.settle.resolve(this);
  }
  cancel() {
    this.playState = 'idle';
    this.settle.reject(new DOMException('The animation was cancelled', 'AbortError'));
  }
}

const { SessionView } = await import('./SessionView');

let root: Root | undefined;
let mainView: HTMLElement;
let panelStyle: HTMLStyleElement;
let observed: { target: Element; callback: () => void }[] = [];
let mediaQueries: (EventTarget & { media: string })[] = [];

class FakeFontFaceSet extends EventTarget {
  load() {
    return Promise.resolve([]);
  }
}

beforeEach(() => {
  FakeSocket.all = [];
  observed = [];
  mediaQueries = [];
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {}
      observe(target: Element) {
        observed.push({ target, callback: this.callback });
      }
      unobserve() {}
      disconnect() {
        observed = observed.filter((entry) => entry.callback !== this.callback);
      }
    },
  );
  vi.stubGlobal('matchMedia', (media: string) => {
    const query = Object.assign(new EventTarget(), { media, matches: false, onchange: null, addListener() {}, removeListener() {} });
    mediaQueries.push(query);
    return query;
  });
  vi.stubGlobal('devicePixelRatio', 1);
  vi.stubGlobal('fetch', () => new Promise(() => {}));
  Object.defineProperty(document, 'fonts', { configurable: true, value: new FakeFontFaceSet() });
  panelStyle = document.createElement('style');
  document.head.append(panelStyle);
  panelSize(500, 300);
  mainView = document.createElement('div');
  mainView.className = 'main-view';
  document.body.append(mainView);
  root = createRoot(mainView);
});

afterEach(() => {
  root?.unmount();
  root = undefined;
  document.body.replaceChildren();
  panelStyle.remove();
  vi.unstubAllGlobals();
});

/** Sizes the terminal panel frame: 12 px padding and a 1 px border inside `width` x `height`. */
function panelSize(width: number, height: number): void {
  panelStyle.textContent = `.session-terminal-panel { box-sizing: border-box; width: ${width}px; height: ${height}px; padding: 12px; border: 1px solid; }`;
}

/** What the ResizeObserver of the panel frame reports after a layout change. */
function panelResized(): void {
  for (const { target, callback } of observed) if (target.matches('.session-terminal-panel')) callback();
}

function newPixelRatio(ratio: number): void {
  vi.stubGlobal('devicePixelRatio', ratio);
  for (const query of mediaQueries.filter((list) => list.media.includes('resolution'))) query.dispatchEvent(new Event('change'));
}

function playing(element: Element, effects: FakeEffect[]): void {
  Object.assign(element, { getAnimations: () => effects.filter((effect) => effect.playState === 'running') });
}

/** Shows the view, waits for its terminal to open and its connection to open. */
async function connected(): Promise<FakeSocket> {
  flushSync(() => root?.render(<SessionView sessionId="s1" onLeaveTerminal={() => {}} />));
  await vi.waitFor(() => expect(FakeSocket.all.length).toBeGreaterThan(0));
  const socket = FakeSocket.all[0]!;
  socket.serverOpens();
  return socket;
}

const resizes = (socket: FakeSocket) => socket.sent.filter((frame) => frame.type === 'resize').map(({ cols, rows }) => ({ cols, rows }));
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('SessionView fit', () => {
  // SessionView spec, "Fit"; plan-terminal_overflow/REQ-1, REQ-2, REQ-3, REQ-4: 474 x 274 px inside the padding, 8 x 16 px cells
  it('takes the most columns that fit the box inside the panel padding less 14 px of scrollbar, the most rows that fit, and sends them when it connects', async () => {
    const socket = await connected();
    expect(resizes(socket)).toEqual([{ cols: 57, rows: 17 }]);
  });

  // SessionView spec, "Fit": a drawn width equal to the space fits; one pixel less does not
  it.each([
    [519, 59],
    [520, 60],
    [527, 60],
    [528, 61],
  ])('with a %i px panel takes %i columns', async (width, cols) => {
    panelSize(width, 300);
    const socket = await connected();
    expect(resizes(socket)).toEqual([{ cols, rows: 17 }]);
  });

  // SessionView spec, "Fit": at least 2 columns and 1 row
  it('keeps at least 2 columns and 1 row in a panel too small for them', async () => {
    panelSize(40, 30);
    const socket = await connected();
    expect(resizes(socket)).toEqual([{ cols: 2, rows: 1 }]);
  });

  // SessionView spec, "Actions" (the box changes size) and "Rules and invariants" (no-op fit); plan-terminal_overflow/REQ-6, REQ-10
  it('sends one resize when the panel changes size, and none for a fit that gives the current size', async () => {
    const socket = await connected();
    panelResized();
    expect(resizes(socket), 'same size: no resize').toEqual([{ cols: 57, rows: 17 }]);

    panelSize(420, 300);
    panelResized();
    panelResized();
    expect(resizes(socket)).toEqual([
      { cols: 57, rows: 17 },
      { cols: 47, rows: 17 },
    ]);
  });

  // SessionView spec, "Actions": an animation or transition of the main view; plan-terminal_overflow/REQ-5, REQ-9
  it('does not fit while the main view runs an effect, then fits once when it ends', async () => {
    const socket = await connected();
    const fade = new FakeEffect();
    playing(mainView, [fade]);
    for (const width of [480, 460, 440]) {
      panelSize(width, 300);
      panelResized();
    }
    await settle();
    expect(resizes(socket), 'no fit during the effect').toEqual([{ cols: 57, rows: 17 }]);

    fade.finish();
    await settle();
    expect(resizes(socket)).toEqual([
      { cols: 57, rows: 17 },
      { cols: 50, rows: 17 },
    ]);
  });

  // SessionView spec, "Actions": a fit skipped during an effect runs when the effect is cancelled
  it('runs a fit skipped during an effect once when the effect is cancelled', async () => {
    const socket = await connected();
    const transition = new FakeEffect();
    playing(mainView, [transition]);
    panelSize(440, 300);
    panelResized();
    await settle();
    expect(resizes(socket)).toHaveLength(1);

    transition.cancel();
    await settle();
    expect(resizes(socket)).toEqual([
      { cols: 57, rows: 17 },
      { cols: 50, rows: 17 },
    ]);
  });

  // SessionView spec, "Actions": the Git Explorer slide and a main view effect; the fit runs when the last one ends
  it('waits for the last of the Git Explorer slide and the main view effect', async () => {
    const socket = await connected();
    const slide = new FakeEffect();
    const fade = new FakeEffect();
    const gitExplorer = document.createElement('section');
    gitExplorer.className = 'git-explorer-panel';
    document.querySelector('.session-workspace')!.append(gitExplorer);
    playing(gitExplorer, [slide]);
    playing(mainView, [fade]);
    panelSize(440, 300);
    panelResized();

    slide.finish();
    await settle();
    expect(resizes(socket), 'the main view effect still runs').toHaveLength(1);
    fade.finish();
    await settle();
    expect(resizes(socket)).toEqual([
      { cols: 57, rows: 17 },
      { cols: 50, rows: 17 },
    ]);
  });

  // SessionView spec, "Actions": a new device pixel ratio at the same panel size; plan-terminal_overflow/REQ-9
  it('measures the cells again on a new device pixel ratio and fits the panel', async () => {
    const socket = await connected();
    FakeTerminal.last!.measuredCell = { width: 18, height: 32 };
    newPixelRatio(2);
    await settle();
    expect(resizes(socket)).toEqual([
      { cols: 57, rows: 17 },
      { cols: 51, rows: 17 },
    ]);
  });

  // SessionView spec, "Actions": a font load that ends after the terminal opened; a resize only if the size changed
  it('measures the cells again when a font load ends, and sends a resize only when the size changes', async () => {
    const socket = await connected();
    document.fonts.dispatchEvent(new Event('loadingdone'));
    await settle();
    expect(resizes(socket), 'same cells: no resize').toHaveLength(1);

    FakeTerminal.last!.measuredCell = { width: 10, height: 20 };
    document.fonts.dispatchEvent(new Event('loadingdone'));
    await settle();
    expect(resizes(socket)).toEqual([
      { cols: 57, rows: 17 },
      { cols: 46, rows: 13 },
    ]);
  });
});
