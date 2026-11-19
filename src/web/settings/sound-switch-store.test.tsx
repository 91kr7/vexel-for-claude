// @vitest-environment jsdom
// Tests of plan-input_sound, batch sound-switch: SoundSwitchStore spec.
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SOUND_SWITCH_KEY, SoundSwitchStore, useSoundSwitch } from './sound-switch-store';

/** In-memory storage that records each save. */
function memoryStorage(initial?: string) {
  const values = new Map<string, string>(initial === undefined ? [] : [[SOUND_SWITCH_KEY, initial]]);
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => void values.set(key, value)),
  };
}

const roots: Root[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) flushSync(() => root.unmount());
  vi.restoreAllMocks();
  localStorage.clear();
  vi.resetModules();
});

describe('SoundSwitchStore', () => {
  // spec SoundSwitchStore: SOUND_SWITCH_KEY
  it('uses the storage key "ai-client.needs-input-sound"', () => {
    expect(SOUND_SWITCH_KEY).toBe('ai-client.needs-input-sound');
  });

  // plan-input_sound/REQ-10: on by default
  it('is on when nothing is saved', () => {
    expect(new SoundSwitchStore(memoryStorage()).getSnapshot()).toBe(true);
  });

  // plan-input_sound/REQ-10; spec SoundSwitchStore: no storage means on
  it('is on with no storage', () => {
    expect(new SoundSwitchStore().getSnapshot()).toBe(true);
  });

  // plan-input_sound/REQ-12: a saved "off" is read back at creation
  it('is off when "off" is saved', () => {
    expect(new SoundSwitchStore(memoryStorage('off')).getSnapshot()).toBe(false);
  });

  // spec SoundSwitchStore: only a saved "off" means off
  it.each(['on', 'false', '0', ''])('is on when "%s" is saved', (saved) => {
    expect(new SoundSwitchStore(memoryStorage(saved)).getSnapshot()).toBe(true);
  });

  // spec SoundSwitchStore: a storage that throws on read means on
  it('is on when reading the storage throws', () => {
    const storage = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      setItem: vi.fn(),
    };
    expect(new SoundSwitchStore(storage).getSnapshot()).toBe(true);
  });

  // plan-input_sound/REQ-11, REQ-12: a change applies at once and is saved
  it('set(false) saves "off", reads off at once and calls the listeners', () => {
    const storage = memoryStorage();
    const store = new SoundSwitchStore(storage);
    const listener = vi.fn(() => expect(store.getSnapshot()).toBe(false));
    store.subscribe(listener);

    store.set(false);

    expect(store.getSnapshot()).toBe(false);
    expect(storage.setItem).toHaveBeenCalledWith(SOUND_SWITCH_KEY, 'off');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // plan-input_sound/REQ-11, REQ-12
  it('set(true) from off saves "on" and calls the listeners', () => {
    const storage = memoryStorage('off');
    const store = new SoundSwitchStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);

    store.set(true);

    expect(store.getSnapshot()).toBe(true);
    expect(storage.values.get(SOUND_SWITCH_KEY)).toBe('on');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // spec SoundSwitchStore: setting the current value does nothing
  it.each([true, false])('set(%s) with the current value saves nothing and calls no listener', (value) => {
    const storage = memoryStorage(value ? undefined : 'off');
    const store = new SoundSwitchStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);

    store.set(value);

    expect(storage.setItem).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(value);
  });

  // spec SoundSwitchStore: a refused save still applies on the page
  it('applies a change and calls the listeners when saving throws', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    };
    const store = new SoundSwitchStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);

    expect(() => store.set(false)).not.toThrow();
    expect(store.getSnapshot()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // spec SoundSwitchStore: no storage still applies on the page
  it('applies a change and calls the listeners with no storage', () => {
    const store = new SoundSwitchStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set(false);
    expect(store.getSnapshot()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // spec SoundSwitchStore: subscribe returns unsubscribe
  it('calls no listener after unsubscribe', () => {
    const store = new SoundSwitchStore(memoryStorage());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set(false);
    expect(listener).not.toHaveBeenCalled();
  });

  // plan-input_sound/REQ-12: a new store on the same storage, as after a restart, reads the last choice
  it('a new store on the same storage reads the choice saved by the previous one', () => {
    const storage = memoryStorage();
    new SoundSwitchStore(storage).set(false);
    expect(new SoundSwitchStore(storage).getSnapshot()).toBe(false);
  });
});

describe('pageSoundSwitchStore', () => {
  // spec SoundSwitchStore: one store per page
  it('returns the same store on each call', async () => {
    const { pageSoundSwitchStore } = await import('./sound-switch-store');
    expect(pageSoundSwitchStore()).toBe(pageSoundSwitchStore());
  });

  // plan-input_sound/REQ-12: the page store reads and saves localStorage
  it('reads and saves the choice in localStorage', async () => {
    localStorage.setItem(SOUND_SWITCH_KEY, 'off');
    const { pageSoundSwitchStore } = await import('./sound-switch-store');
    const store = pageSoundSwitchStore();
    expect(store.getSnapshot()).toBe(false);
    store.set(true);
    expect(localStorage.getItem(SOUND_SWITCH_KEY)).toBe('on');
  });

  // spec SoundSwitchStore: localStorage not reachable, the store works without saving
  it('works without saving when localStorage is not reachable', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const { pageSoundSwitchStore } = await import('./sound-switch-store');
    const store = pageSoundSwitchStore();
    expect(store.getSnapshot()).toBe(true);
    store.set(false);
    expect(store.getSnapshot()).toBe(false);
  });
});

describe('useSoundSwitch', () => {
  function mountProbe(store: SoundSwitchStore) {
    const seen: { on: boolean; setOn: (on: boolean) => void }[] = [];
    function Probe() {
      const value = useSoundSwitch(store);
      seen.push(value);
      return <span>{value.on ? 'on' : 'off'}</span>;
    }
    const host = document.createElement('div');
    const root = createRoot(host);
    roots.push(root);
    flushSync(() => root.render(<Probe />));
    return { host, seen };
  }

  // plan-input_sound/REQ-11: the component shows a change at once
  it('re-renders with the new value after each change of the store', () => {
    const store = new SoundSwitchStore(memoryStorage());
    const { host } = mountProbe(store);
    expect(host.textContent).toBe('on');
    flushSync(() => store.set(false));
    expect(host.textContent).toBe('off');
    flushSync(() => store.set(true));
    expect(host.textContent).toBe('on');
  });

  // spec SoundSwitchStore: useSoundSwitch setOn
  it('setOn sets the store', () => {
    const store = new SoundSwitchStore(memoryStorage());
    const { host, seen } = mountProbe(store);
    flushSync(() => seen.at(-1)?.setOn(false));
    expect(store.getSnapshot()).toBe(false);
    expect(host.textContent).toBe('off');
  });
});
