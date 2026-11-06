// Tests of plan-mac_title_bar, batch window-buttons: WindowActions spec (REQ-16, REQ-17, REQ-18, REQ-21, REQ-23).
import type { BrowserWindow, IpcMain } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { connectWindowActions } from './window-actions.js';

type Listener = (...args: unknown[]) => unknown;

function fakeIpc() {
  const on = new Map<string, Listener>();
  const handle = new Map<string, Listener>();
  const ipc = {
    on: (channel: string, listener: Listener) => {
      on.set(channel, listener);
      return ipc;
    },
    handle: (channel: string, listener: Listener) => {
      handle.set(channel, listener);
    },
  };
  return {
    ipc: ipc as unknown as Pick<IpcMain, 'on' | 'handle'>,
    send(channel: string, sender: unknown) {
      const listener = on.get(channel);
      expect(listener, `a listener on ${channel}`).toBeDefined();
      listener!({ sender });
    },
    async invoke(channel: string, sender: unknown) {
      const listener = handle.get(channel);
      expect(listener, `a handler on ${channel}`).toBeDefined();
      return await listener!({ sender });
    },
  };
}

function fakeWindow(maximized = false) {
  const events = new Map<string, Listener[]>();
  const state = { maximized, destroyed: false };
  const webContents = { send: vi.fn() };
  const addListener = (event: string, listener: Listener) => {
    events.set(event, [...(events.get(event) ?? []), listener]);
    return window;
  };
  const window = {
    webContents,
    on: addListener,
    addListener,
    once: addListener,
    isDestroyed: () => state.destroyed,
    isMaximized: () => state.maximized,
    close: vi.fn(),
    minimize: vi.fn(),
    maximize: vi.fn(() => {
      state.maximized = true;
    }),
    unmaximize: vi.fn(() => {
      state.maximized = false;
    }),
    hide: vi.fn(),
    show: vi.fn(),
  };
  return {
    window,
    state,
    asWindow: window as unknown as BrowserWindow,
    emit(event: string) {
      for (const listener of events.get(event) ?? []) listener({});
    },
  };
}

function connected(maximized = false) {
  const ipc = fakeIpc();
  const win = fakeWindow(maximized);
  connectWindowActions(win.asWindow, ipc.ipc);
  return { ipc, win, own: win.window.webContents };
}

const CLOSE = 'desktop-bridge:window-close';
const MINIMIZE = 'desktop-bridge:window-minimize';
const TOGGLE = 'desktop-bridge:window-toggle-maximize';
const IS_MAXIMIZED = 'desktop-bridge:window-is-maximized';
const MAXIMIZED = 'desktop-bridge:window-maximized';

describe('connectWindowActions', () => {
  // WindowActions contract, REQ-16: close asks the window's own close, never hides or shows it
  it('close from the window\'s own page calls window.close() and neither hides nor shows the window', () => {
    const { ipc, win, own } = connected();
    ipc.send(CLOSE, own);
    expect(win.window.close).toHaveBeenCalledTimes(1);
    expect(win.window.hide).not.toHaveBeenCalled();
    expect(win.window.show).not.toHaveBeenCalled();
  });

  // WindowActions contract, REQ-17
  it('minimize from the window\'s own page minimizes the window', () => {
    const { ipc, win, own } = connected();
    ipc.send(MINIMIZE, own);
    expect(win.window.minimize).toHaveBeenCalledTimes(1);
    expect(win.window.hide).not.toHaveBeenCalled();
  });

  // WindowActions contract, REQ-18: a window that is not maximized maximizes
  it('toggle maximize on a window that is not maximized maximizes it', () => {
    const { ipc, win, own } = connected(false);
    ipc.send(TOGGLE, own);
    expect(win.window.maximize).toHaveBeenCalledTimes(1);
    expect(win.window.unmaximize).not.toHaveBeenCalled();
  });

  // WindowActions contract, REQ-18: a maximized window restores
  it('toggle maximize on a maximized window restores it', () => {
    const { ipc, win, own } = connected(true);
    ipc.send(TOGGLE, own);
    expect(win.window.unmaximize).toHaveBeenCalledTimes(1);
    expect(win.window.maximize).not.toHaveBeenCalled();
  });

  // WindowActions contract, REQ-21, REQ-23: the state question answers the current maximized state
  it.each([true, false])('the state question answers the current maximized state (%s)', async (maximized) => {
    const { ipc, own } = connected(maximized);
    expect(await ipc.invoke(IS_MAXIMIZED, own)).toBe(maximized);
  });

  // WindowActions rule: a request from another web contents does nothing, and the state question gets false
  it('requests from another web contents do nothing and the state question answers false', async () => {
    const { ipc, win } = connected(true);
    const other = { send: vi.fn() };
    ipc.send(CLOSE, other);
    ipc.send(MINIMIZE, other);
    ipc.send(TOGGLE, other);
    expect(win.window.close).not.toHaveBeenCalled();
    expect(win.window.minimize).not.toHaveBeenCalled();
    expect(win.window.maximize).not.toHaveBeenCalled();
    expect(win.window.unmaximize).not.toHaveBeenCalled();
    expect(await ipc.invoke(IS_MAXIMIZED, other)).toBe(false);
  });

  // WindowActions contract, REQ-21: each maximize and unmaximize sends isMaximized() to the page
  it('each maximize and unmaximize of the window sends the maximized state to the page', () => {
    const { win, own } = connected(false);
    win.state.maximized = true;
    win.emit('maximize');
    win.state.maximized = false;
    win.emit('unmaximize');
    expect(own.send.mock.calls).toEqual([
      [MAXIMIZED, true],
      [MAXIMIZED, false],
    ]);
  });

  // WindowActions rule: after the window is destroyed, requests and state changes do nothing
  it('after the window is destroyed requests do nothing and state changes send nothing', () => {
    const { ipc, win, own } = connected(false);
    win.state.destroyed = true;
    ipc.send(CLOSE, own);
    ipc.send(MINIMIZE, own);
    ipc.send(TOGGLE, own);
    win.emit('maximize');
    win.emit('unmaximize');
    expect(win.window.close).not.toHaveBeenCalled();
    expect(win.window.minimize).not.toHaveBeenCalled();
    expect(win.window.maximize).not.toHaveBeenCalled();
    expect(win.window.unmaximize).not.toHaveBeenCalled();
    expect(own.send).not.toHaveBeenCalled();
  });
});
