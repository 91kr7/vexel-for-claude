// Tests of plan-mac_title_bar, batches title-bar and window-buttons: useDesktopBridge spec, `isDesktopWindow` (REQ-6, REQ-14) and the window functions (REQ-16, REQ-17, REQ-18, REQ-25).
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  closeWindow,
  type DesktopBridge,
  desktopFilePathLookup,
  isDesktopWindow,
  minimizeWindow,
  toggleMaximizeWindow,
} from './desktop-bridge';

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

describe('desktopFilePathLookup', () => {
  // plan-terminal_addons/REQ-46, REQ-54: a browser has no path lookup
  it('gives null in a browser with no desktop bridge', () => {
    vi.stubGlobal('window', {});
    expect(desktopFilePathLookup()).toBeNull();
  });

  // plan-terminal_addons/REQ-46: with the bridge, the lookup gives the bridge's path, an empty string included
  it('gives the path that the bridge reads for the file', () => {
    const paths = new Map([
      ['shot.png', '/home/me/shot.png'],
      ['made-by-page', ''],
    ]);
    const bridge: DesktopBridge = {
      reportOpenSession: () => {},
      onOpenSession: () => () => {},
      getPathForFile: (file) => paths.get(file.name) ?? 'unexpected',
    };
    vi.stubGlobal('window', { desktopBridge: bridge });

    const lookup = desktopFilePathLookup();

    expect(lookup).not.toBeNull();
    expect(lookup!(new File(['x'], 'shot.png'))).toBe('/home/me/shot.png');
    expect(lookup!(new File(['x'], 'made-by-page'))).toBe('');
  });
});
