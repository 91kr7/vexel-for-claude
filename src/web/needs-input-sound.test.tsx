// @vitest-environment jsdom
// Tests of plan-input_sound, batch needs-input-sound: useNeedsInputSound spec.
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playNeedsInputSound, useNeedsInputSound } from './needs-input-sound';

/** Stands in for the browser audio element: records each element and each play. */
let audios: { src: string; plays: number }[];
let playResult: () => unknown;

class FakeAudio {
  readonly record: { src: string; plays: number };
  constructor(src: string) {
    this.record = { src, plays: 0 };
    audios.push(this.record);
  }
  play() {
    this.record.plays += 1;
    return playResult();
  }
}

/** Plays the DesktopBridge preload: the test sends the sound requests. */
function installBridge() {
  const listeners = new Set<() => void>();
  const unsubscribed = vi.fn();
  Object.assign(window, {
    desktopBridge: {
      reportOpenSession: () => {},
      onOpenSession: () => () => {},
      getPathForFile: () => '',
      onPlaySound: (listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
          unsubscribed();
        };
      },
    },
  });
  return { requestSound: () => listeners.forEach((listener) => listener()), unsubscribed };
}

function Player() {
  useNeedsInputSound();
  return null;
}

const roots: Root[] = [];

// The shell may export NODE_ENV=production, where React has no `act`: flushSync commits the render and its effects at once.
function mount(): Root {
  const root = createRoot(document.createElement('div'));
  roots.push(root);
  flushSync(() => root.render(<Player />));
  return root;
}

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  audios = [];
  playResult = () => new Promise(() => {});
  vi.stubGlobal('Audio', FakeAudio);
});

afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  delete (window as { desktopBridge?: unknown }).desktopBridge;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('playNeedsInputSound', () => {
  // plan-input_sound/REQ-1, NeedsInputChime: one new audio element of the chime, played once
  it('starts one play of the chime in a new audio element', () => {
    playNeedsInputSound();
    playNeedsInputSound();
    expect(audios).toHaveLength(2);
    for (const audio of audios) {
      expect(audio.src).toMatch(/needs-input-chime.*\.wav/);
      expect(audio.plays).toBe(1);
    }
  });

  // plan-input_sound/REQ-9: it does not wait for the end of the sound
  it('returns at once while the sound still plays', () => {
    // The default play promise never settles: the sound never ends.
    expect(playNeedsInputSound()).toBeUndefined();
    expect(audios[0]?.plays).toBe(1);
  });

  // plan-input_sound/REQ-9: a rejected play reaches neither the caller nor the console
  it('ignores a play that rejects', async () => {
    const consoleError = vi.spyOn(console, 'error');
    const consoleWarn = vi.spyOn(console, 'warn');
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    playResult = () => Promise.reject(new DOMException('play() failed', 'NotAllowedError'));
    try {
      expect(() => playNeedsInputSound()).not.toThrow();
      await nextTask();
      await nextTask();
      expect(unhandled).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      expect(consoleWarn).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  // plan-input_sound/REQ-9: a play that throws reaches neither the caller nor the console
  it('ignores a play that throws', () => {
    const consoleError = vi.spyOn(console, 'error');
    playResult = () => {
      throw new Error('no audio output');
    };
    expect(() => playNeedsInputSound()).not.toThrow();
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe('useNeedsInputSound', () => {
  // plan-input_sound/REQ-1: each sound request plays the chime once while mounted
  it('plays the chime once for each sound request of the bridge', () => {
    const bridge = installBridge();
    mount();
    expect(audios).toHaveLength(0);

    bridge.requestSound();
    expect(audios).toHaveLength(1);
    bridge.requestSound();
    expect(audios).toHaveLength(2);
    expect(audios.every((audio) => audio.plays === 1)).toBe(true);
  });

  // useNeedsInputSound contract: on unmount it stops listening
  it('stops listening on unmount', () => {
    const bridge = installBridge();
    const root = mount();
    roots.splice(roots.indexOf(root), 1);
    root.unmount();

    expect(bridge.unsubscribed).toHaveBeenCalledTimes(1);
    bridge.requestSound();
    expect(audios).toHaveLength(0);
  });

  // plan-input_sound constraint "only the desktop app plays the sound": a browser has no bridge
  it('plays nothing and does not fail in a browser, with no bridge', () => {
    expect(() => mount()).not.toThrow();
    expect(audios).toHaveLength(0);
  });
});
