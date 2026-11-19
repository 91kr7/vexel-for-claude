import { useCallback, useSyncExternalStore } from 'react';

export const SOUND_SWITCH_KEY = 'ai-client.needs-input-sound';

type SoundSwitchStorage = Pick<Storage, 'getItem' | 'setItem'>;

function readSwitch(storage: SoundSwitchStorage | undefined): boolean {
  try {
    return storage?.getItem(SOUND_SWITCH_KEY) !== 'off';
  } catch {
    return true;
  }
}

export class SoundSwitchStore {
  readonly #storage: SoundSwitchStorage | undefined;
  readonly #listeners = new Set<() => void>();
  #on: boolean;

  constructor(storage?: SoundSwitchStorage) {
    this.#storage = storage;
    this.#on = readSwitch(storage);
  }

  set(on: boolean): void {
    if (on === this.#on) return;
    this.#on = on;
    try {
      this.#storage?.setItem(SOUND_SWITCH_KEY, on ? 'on' : 'off');
    } catch {
      // The choice still applies to this page when the browser refuses to store it.
    }
    for (const listener of this.#listeners) listener();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): boolean => this.#on;
}

let pageStore: SoundSwitchStore | undefined;

function pageStorage(): SoundSwitchStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function pageSoundSwitchStore(): SoundSwitchStore {
  pageStore ??= new SoundSwitchStore(pageStorage());
  return pageStore;
}

export function useSoundSwitch(store: SoundSwitchStore = pageSoundSwitchStore()): { on: boolean; setOn: (on: boolean) => void } {
  const on = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const setOn = useCallback((next: boolean) => store.set(next), [store]);
  return { on, setOn };
}
