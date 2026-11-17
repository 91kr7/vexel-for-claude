// Unit tests of ColorDissolve (module app), plan-ui_transitions batch theme-change.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const motion = vi.hoisted(() => ({ enterMs: 200 }));
vi.mock('../motion/ExitPresence', () => ({
  motionDurationMs: (token: string) => (token === '--motion-duration-enter' ? motion.enterMs : 150),
}));

import { dissolveColors } from './color-dissolve';

type Update = () => unknown;

/** A browser view transition API that records each started transition and lets the test run its update. */
function fakeViewTransitions(result: () => Record<string, unknown> = settledTransition) {
  const updates: Update[] = [];
  const startViewTransition = vi.fn((update: Update) => {
    updates.push(update);
    return result();
  });
  return { updates, startViewTransition };
}

function settledTransition() {
  return {
    ready: Promise.resolve(),
    finished: Promise.resolve(),
    updateCallbackDone: Promise.resolve(),
    skipTransition: vi.fn(),
  };
}

/** What a browser gives for a transition cut short by a newer one: every promise rejects. */
function skippedTransition() {
  const aborted = () => Promise.reject(new DOMException('Skipped', 'AbortError'));
  return { ready: aborted(), finished: aborted(), updateCallbackDone: aborted(), skipTransition: vi.fn() };
}

/** Frames that run only when the test fires them. */
function manualFrames() {
  const pending: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    pending.push(cb);
    return pending.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  return {
    fire: () => {
      for (const cb of pending.splice(0)) cb(0);
    },
  };
}

async function settles(promise: unknown): Promise<boolean> {
  let done = false;
  void Promise.resolve(promise).then(
    () => (done = true),
    () => (done = true),
  );
  for (let i = 0; i < 5; i++) await Promise.resolve();
  return done;
}

describe('ColorDissolve', () => {
  beforeEach(() => {
    motion.enterMs = 200;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('applies the change at once when there is no page', () => {
    vi.stubGlobal('document', undefined);
    const apply = vi.fn();
    dissolveColors(apply);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('applies the change at once when the browser has no view transitions', () => {
    vi.stubGlobal('document', { documentElement: {} });
    const apply = vi.fn();
    dissolveColors(apply);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  // plan-ui_transitions/REQ-25
  it('with reduced motion applies the change at once, with no cross-fade', () => {
    motion.enterMs = 0;
    const api = fakeViewTransitions();
    vi.stubGlobal('document', { documentElement: {}, startViewTransition: api.startViewTransition });
    manualFrames();
    const apply = vi.fn();
    dissolveColors(apply);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(api.startViewTransition).not.toHaveBeenCalled();
  });

  // plan-ui_transitions/REQ-14: the change runs inside a whole-page view transition, after the old picture is taken
  it('with motion on runs the change inside one view transition, never before the old picture is taken', async () => {
    const api = fakeViewTransitions();
    vi.stubGlobal('document', { documentElement: {}, startViewTransition: api.startViewTransition });
    const frames = manualFrames();
    const apply = vi.fn();
    dissolveColors(apply);
    expect(api.startViewTransition).toHaveBeenCalledTimes(1);
    expect(apply, 'the old picture is not taken yet').not.toHaveBeenCalled();

    const captured = api.updates[0]!();
    expect(apply).toHaveBeenCalledTimes(1);
    frames.fire();
    expect(await settles(captured), 'the new picture is taken once a frame has passed').toBe(true);
  });

  it('with no window to watch presses on, still dissolves and does not throw', () => {
    vi.stubGlobal('window', undefined);
    const api = fakeViewTransitions();
    vi.stubGlobal('document', { documentElement: {}, startViewTransition: api.startViewTransition });
    manualFrames();
    const apply = vi.fn();
    expect(() => dissolveColors(apply)).not.toThrow();
    expect(api.startViewTransition).toHaveBeenCalledTimes(1);
    void api.updates[0]!();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  // plan-ui_transitions/REQ-15: the areas that recolour after the change get one frame before the new picture
  it('takes the new picture one frame after the change, not before', async () => {
    const api = fakeViewTransitions();
    vi.stubGlobal('document', { documentElement: {}, startViewTransition: api.startViewTransition });
    const frames = manualFrames();
    dissolveColors(vi.fn());
    const captured = api.updates[0]!();
    expect(await settles(captured), 'no new picture before the next frame').toBe(false);
    frames.fire();
    expect(await settles(captured)).toBe(true);
  });

  it('takes the new picture at most 100 ms after the change when no frame comes', async () => {
    vi.useFakeTimers();
    const api = fakeViewTransitions();
    vi.stubGlobal('document', { documentElement: {}, startViewTransition: api.startViewTransition });
    manualFrames();
    dissolveColors(vi.fn());
    const captured = api.updates[0]!();
    await vi.advanceTimersByTimeAsync(100);
    expect(await settles(captured)).toBe(true);
  });

  // plan-ui_transitions/REQ-28
  it('runs every change of two quick calls, in call order', async () => {
    const api = fakeViewTransitions();
    vi.stubGlobal('document', { documentElement: {}, startViewTransition: api.startViewTransition });
    const frames = manualFrames();
    const order: string[] = [];
    dissolveColors(() => order.push('first'));
    dissolveColors(() => order.push('second'));
    for (const update of api.updates) void update();
    frames.fire();
    expect(order).toEqual(['first', 'second']);
  });

  it('does not throw and leaves no failed promise when a newer change cuts it short', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const api = fakeViewTransitions(skippedTransition);
      vi.stubGlobal('document', { documentElement: {}, startViewTransition: api.startViewTransition });
      const frames = manualFrames();
      const apply = vi.fn();
      expect(() => dissolveColors(apply)).not.toThrow();
      void api.updates[0]!();
      frames.fire();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(apply).toHaveBeenCalledTimes(1);
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
