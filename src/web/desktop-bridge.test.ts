// Tests of plan-mac_title_bar, batches title-bar and window-buttons: useDesktopBridge spec, `isDesktopWindow` (REQ-6, REQ-14) and the window functions (REQ-16, REQ-17, REQ-18, REQ-25).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeWindow, isDesktopWindow, minimizeWindow, toggleMaximizeWindow } from './desktop-bridge';

const bridge = { reportOpenSession: () => {}, onOpenSession: () => () => {} };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isDesktopWindow', () => {
  it('is true when the page has the desktop bridge', () => {
    vi.stubGlobal('window', { desktopBridge: bridge });
    expect(isDesktopWindow()).toBe(true);
  });

  it('is false in a browser, where the page has no desktop bridge', () => {
    vi.stubGlobal('window', {});
    expect(isDesktopWindow()).toBe(false);
  });

  it('is false where there is no window', () => {
    expect(typeof window).toBe('undefined');
    expect(isDesktopWindow()).toBe(false);
  });
});

describe('window functions', () => {
  const windowFunctions = [
    ['closeWindow', closeWindow],
    ['minimizeWindow', minimizeWindow],
    ['toggleMaximizeWindow', toggleMaximizeWindow],
  ] as const;

  // useDesktopBridge contract, REQ-16, REQ-17, REQ-18: each function calls the bridge function of the same name, once
  it.each(windowFunctions)('%s calls the bridge function of the same name and no other', (name, call) => {
    const spies = { closeWindow: vi.fn(), minimizeWindow: vi.fn(), toggleMaximizeWindow: vi.fn() };
    vi.stubGlobal('window', { desktopBridge: { ...bridge, ...spies } });
    call();
    for (const [spyName, spy] of Object.entries(spies)) expect(spy, spyName).toHaveBeenCalledTimes(spyName === name ? 1 : 0);
  });

  // useDesktopBridge contract, REQ-25: in a browser the functions do nothing
  it.each(windowFunctions)('%s does nothing in a browser, with no bridge', (_, call) => {
    vi.stubGlobal('window', {});
    expect(() => call()).not.toThrow();
  });

  // useDesktopBridge contract: a bridge without the window functions makes them do nothing
  it.each(windowFunctions)('%s does nothing with a bridge that has no window functions', (_, call) => {
    vi.stubGlobal('window', { desktopBridge: bridge });
    expect(() => call()).not.toThrow();
  });
});
