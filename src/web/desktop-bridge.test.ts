import { afterEach, describe, expect, it, vi } from 'vitest';
import { type DesktopBridge, desktopFilePathLookup } from './desktop-bridge';

afterEach(() => {
  vi.unstubAllGlobals();
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
