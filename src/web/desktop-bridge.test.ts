// Tests of plan-mac_title_bar, batches title-bar and window-buttons: useDesktopBridge spec, `isDesktopWindow` (REQ-6, REQ-14) and the window functions (REQ-16, REQ-17, REQ-18, REQ-25). Also plan-input_sound, batch needs-input-sound: `onSoundRequest`; plan-remote_notifications, batch notifications-section: the remote settings.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  closeWindow,
  type DesktopBridge,
  desktopFilePathLookup,
  isDesktopWindow,
  minimizeWindow,
  onSoundRequest,
  quitApp,
  readRemoteSettings,
  saveRemoteSettings,
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

// plan-app_processes/REQ-26, REQ-34: the quit request quits the desktop app and does nothing in a browser
describe('quitApp', () => {
  it('calls quitApp of the bridge once', () => {
    const spy = vi.fn();
    vi.stubGlobal('window', { desktopBridge: { ...bridge, quitApp: spy } });
    quitApp();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does nothing in a browser, with no bridge', () => {
    vi.stubGlobal('window', {});
    expect(() => quitApp()).not.toThrow();
  });

  it('does nothing with a bridge that has no quitApp', () => {
    vi.stubGlobal('window', { desktopBridge: bridge });
    expect(() => quitApp()).not.toThrow();
  });
});

// plan-input_sound/REQ-1: the sound requests of the bridge reach the page listener until it unsubscribes
describe('onSoundRequest', () => {
  function soundBridge() {
    const listeners = new Set<() => void>();
    vi.stubGlobal('window', {
      desktopBridge: {
        ...bridge,
        onPlaySound: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
    });
    return () => listeners.forEach((listener) => listener());
  }

  it('calls the listener once for each sound request, until unsubscribe', () => {
    const requestSound = soundBridge();
    const listener = vi.fn();
    const unsubscribe = onSoundRequest(listener);

    requestSound();
    requestSound();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith();

    unsubscribe();
    requestSound();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does nothing in a browser, with no bridge', () => {
    vi.stubGlobal('window', {});
    const listener = vi.fn();
    const unsubscribe = onSoundRequest(listener);
    expect(() => unsubscribe()).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it('does nothing with a bridge that has no onPlaySound', () => {
    vi.stubGlobal('window', { desktopBridge: bridge });
    const listener = vi.fn();
    const unsubscribe = onSoundRequest(listener);
    expect(() => unsubscribe()).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
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

// plan-remote_notifications/REQ-11, REQ-12: the page reads and saves the remote settings through the bridge; it never rejects
describe('remote settings', () => {
  const DEFAULTS = { enabled: false, topicUrl: '', token: '' };
  const SET = { enabled: true, topicUrl: 'https://ntfy.sh/my-topic', token: 'tk' };

  it('reads the answer of the bridge', async () => {
    vi.stubGlobal('window', { desktopBridge: { ...bridge, readRemoteSettings: () => Promise.resolve(SET) } });
    expect(await readRemoteSettings()).toEqual(SET);
  });

  it.each([
    ['in a browser, with no bridge', () => ({})],
    ['with a bridge that has no readRemoteSettings', () => ({ desktopBridge: bridge })],
    ['when the read of the bridge fails', () => ({ desktopBridge: { ...bridge, readRemoteSettings: () => Promise.reject(new Error('ipc')) } })],
  ])('reads the defaults %s', async (_name, page) => {
    vi.stubGlobal('window', page());
    expect(await readRemoteSettings()).toEqual(DEFAULTS);
  });

  it('saves through the bridge and resolves when the bridge has saved', async () => {
    let done: () => void = () => {};
    const save = vi.fn(() => new Promise<void>((resolve) => (done = resolve)));
    vi.stubGlobal('window', { desktopBridge: { ...bridge, saveRemoteSettings: save } });
    let resolved = false;
    const saving = saveRemoteSettings(SET).then(() => (resolved = true));
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(SET);
    expect(resolved).toBe(false);
    done();
    await saving;
    expect(resolved).toBe(true);
  });

  it.each([
    ['in a browser, with no bridge', () => ({})],
    ['with a bridge that has no saveRemoteSettings', () => ({ desktopBridge: bridge })],
    ['when the save of the bridge fails', () => ({ desktopBridge: { ...bridge, saveRemoteSettings: () => Promise.reject(new Error('ipc')) } })],
  ])('resolves %s', async (_name, page) => {
    vi.stubGlobal('window', page());
    await expect(saveRemoteSettings(SET)).resolves.toBeUndefined();
  });
});
