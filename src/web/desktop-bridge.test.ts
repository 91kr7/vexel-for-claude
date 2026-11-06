// Tests of plan-mac_title_bar, batch title-bar: useDesktopBridge spec, `isDesktopWindow` (REQ-6, REQ-14).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDesktopWindow } from './desktop-bridge';

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
