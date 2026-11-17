// @vitest-environment jsdom
// Unit tests of ColorDissolve (module app), plan-ui_transitions batch theme-change: a pointer press during the dissolve.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../motion/ExitPresence', () => ({ motionDurationMs: () => 200 }));

import { dissolveColors } from './color-dissolve';

const PRESS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'] as const;
type PressType = (typeof PRESS)[number];
type Listener = (event: Event) => void;

/** The window listeners the page has, so a test can play what the browser does with a real press. */
let windowListeners: { type: string; listener: Listener; capture: boolean }[] = [];
let skipTransition: ReturnType<typeof vi.fn>;
let finishTransition: () => void;

/**
 * During a view transition the browser sends a press to the root: this is that trusted event, as the window
 * capture listeners get it. jsdom cannot make a trusted event, so a proxy reports one.
 */
function browserPress(type: PressType, x = 40, y = 20): void {
  const init = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 };
  const real = type.startsWith('pointer') ? new PointerEvent(type, init) : new MouseEvent(type, init);
  const root = document.documentElement;
  const event = new Proxy(real, {
    get(target, prop) {
      if (prop === 'isTrusted') return true;
      if (prop === 'target' || prop === 'srcElement') return root;
      const value = Reflect.get(target, prop, target) as unknown;
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
  for (const entry of windowListeners.filter((l) => l.type === type && l.capture)) entry.listener(event);
}

function startDissolve(): void {
  skipTransition = vi.fn();
  let resolveFinished!: () => void;
  const finished = new Promise<void>((resolve) => (resolveFinished = resolve));
  finishTransition = resolveFinished;
  Object.assign(document, {
    startViewTransition: (update: () => Promise<void>) => {
      void update();
      return { ready: Promise.resolve(), updateCallbackDone: Promise.resolve(), finished, skipTransition };
    },
  });
  dissolveColors(() => document.documentElement.setAttribute('data-theme', 'light'));
}

function underPointer(element: Element): void {
  Object.assign(document, { elementFromPoint: () => element });
}

function received(element: Element): string[] {
  const seen: string[] = [];
  for (const type of PRESS) element.addEventListener(type, () => seen.push(type));
  return seen;
}

describe('ColorDissolve, a pointer press during the dissolve (plan-ui_transitions/REQ-26)', () => {
  beforeEach(() => {
    windowListeners = [];
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    const isCapture = (options?: boolean | AddEventListenerOptions | EventListenerOptions) =>
      typeof options === 'boolean' ? options : !!options?.capture;
    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
      windowListeners.push({ type, listener: listener as Listener, capture: isCapture(options) });
      add(type, listener, options);
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((type, listener, options) => {
      windowListeners = windowListeners.filter((l) => !(l.type === type && l.listener === listener && l.capture === isCapture(options)));
      remove(type, listener, options);
    });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
    document.body.innerHTML = '<button id="target">Settings</button><div id="plain">text</div>';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'startViewTransition');
    Reflect.deleteProperty(document, 'elementFromPoint');
    document.body.innerHTML = '';
  });

  it('a press ends the dissolve at once', () => {
    const button = document.getElementById('target')!;
    underPointer(button);
    startDissolve();
    browserPress('pointerdown');
    expect(skipTransition).toHaveBeenCalledTimes(1);
  });

  it('the whole press (down, up, click) reaches the element under the pointer, at the same point', () => {
    const button = document.getElementById('target')!;
    underPointer(button);
    const seen = received(button);
    const points: [number, number][] = [];
    button.addEventListener('click', (e) => points.push([e.clientX, e.clientY]));
    startDissolve();
    for (const type of PRESS) browserPress(type, 40, 20);
    expect(seen).toEqual([...PRESS]);
    expect(points).toEqual([[40, 20]]);
  });

  it('the element under the pointer takes the focus when it can', () => {
    const button = document.getElementById('target')!;
    underPointer(button);
    startDissolve();
    browserPress('pointerdown');
    browserPress('mousedown');
    expect(document.activeElement).toBe(button);
  });

  it('an element that cannot take the focus does not move it', () => {
    const plain = document.getElementById('plain')!;
    underPointer(plain);
    const seen = received(plain);
    startDissolve();
    browserPress('pointerdown');
    browserPress('mousedown');
    expect(seen).toEqual(['pointerdown', 'mousedown']);
    expect(document.activeElement).toBe(document.body);
  });

  it('the rest of a press that ended the dissolve still reaches the element after the dissolve ends', async () => {
    const button = document.getElementById('target')!;
    underPointer(button);
    const seen = received(button);
    startDissolve();
    browserPress('pointerdown');
    browserPress('mousedown');
    finishTransition();
    await Promise.resolve();
    await Promise.resolve();
    browserPress('pointerup');
    browserPress('mouseup');
    browserPress('click');
    expect(seen).toEqual([...PRESS]);
  });

  it('after the dissolve ends the page stops watching presses', async () => {
    vi.useFakeTimers();
    const button = document.getElementById('target')!;
    underPointer(button);
    const seen = received(button);
    startDissolve();
    browserPress('pointerdown');
    browserPress('mousedown');
    browserPress('pointerup');
    browserPress('mouseup');
    browserPress('click');
    finishTransition();
    await vi.advanceTimersByTimeAsync(1000);
    expect(windowListeners.filter((l) => (PRESS as readonly string[]).includes(l.type)), 'no press listener left').toEqual([]);

    seen.length = 0;
    skipTransition.mockClear();
    browserPress('pointerdown');
    expect(seen, 'a later press is left to the browser').toEqual([]);
    expect(skipTransition).not.toHaveBeenCalled();
  });

  it('a dissolve that ends with no press leaves no press listener', async () => {
    vi.useFakeTimers();
    startDissolve();
    finishTransition();
    await vi.advanceTimersByTimeAsync(1000);
    expect(windowListeners.filter((l) => (PRESS as readonly string[]).includes(l.type))).toEqual([]);
  });
});
