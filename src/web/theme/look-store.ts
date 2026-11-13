import { useCallback, useSyncExternalStore } from 'react';

export type Look = 'vexel' | 'windows11';

export const START_LOOK: Look = 'vexel';

export const LOOK_KEY = 'ai-client.look';

type LookRoot = Pick<Element, 'setAttribute'>;
type LookStorage = Pick<Storage, 'setItem'>;

export function isLook(value: unknown): value is Look {
  return value === 'vexel' || value === 'windows11';
}

export class LookStore {
  readonly #root: LookRoot;
  readonly #storage: LookStorage | undefined;
  readonly #listeners = new Set<() => void>();
  #look: Look;

  constructor(root: LookRoot, initial: Look = START_LOOK, storage?: LookStorage) {
    this.#root = root;
    this.#storage = storage;
    this.#look = initial;
    this.#mark();
  }

  toggle(): void {
    this.#look = this.#look === 'vexel' ? 'windows11' : 'vexel';
    this.#mark();
    try {
      this.#storage?.setItem(LOOK_KEY, this.#look);
    } catch {
      // The look still applies to this page when the browser refuses to store it.
    }
    for (const listener of this.#listeners) listener();
  }

  #mark(): void {
    this.#root.setAttribute('data-look', this.#look);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): Look => this.#look;
}

let pageStore: LookStore | undefined;

function pageStorage(): LookStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function pageLookStore(): LookStore {
  if (pageStore) return pageStore;
  const root = document.documentElement;
  const mark = root.getAttribute('data-look');
  pageStore = new LookStore(root, isLook(mark) ? mark : START_LOOK, pageStorage());
  return pageStore;
}

export function useLook(store: LookStore = pageLookStore()): { look: Look; toggleLook: () => void } {
  const look = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const toggleLook = useCallback(() => store.toggle(), [store]);
  return { look, toggleLook };
}
