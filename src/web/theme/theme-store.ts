import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

export const START_THEME: Theme = 'light';

export const THEME_KEY = 'ai-client.theme';

type ThemeRoot = Pick<Element, 'setAttribute'>;
type ThemeStorage = Pick<Storage, 'setItem'>;

export function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light';
}

export class ThemeStore {
  readonly #root: ThemeRoot;
  readonly #storage: ThemeStorage | undefined;
  readonly #listeners = new Set<() => void>();
  #theme: Theme;

  constructor(root: ThemeRoot, initial: Theme = START_THEME, storage?: ThemeStorage) {
    this.#root = root;
    this.#storage = storage;
    this.#theme = initial;
    this.#mark();
  }

  toggle(): void {
    this.#theme = this.#theme === 'dark' ? 'light' : 'dark';
    this.#mark();
    try {
      this.#storage?.setItem(THEME_KEY, this.#theme);
    } catch {
      // The theme still applies to this page when the browser refuses to store it.
    }
    for (const listener of this.#listeners) listener();
  }

  #mark(): void {
    this.#root.setAttribute('data-theme', this.#theme);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): Theme => this.#theme;
}

let pageStore: ThemeStore | undefined;

function pageStorage(): ThemeStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function pageThemeStore(): ThemeStore {
  if (pageStore) return pageStore;
  const root = document.documentElement;
  const mark = root.getAttribute('data-theme');
  pageStore = new ThemeStore(root, isTheme(mark) ? mark : START_THEME, pageStorage());
  return pageStore;
}

export function useTheme(store: ThemeStore = pageThemeStore()): { theme: Theme; toggleTheme: () => void } {
  const theme = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const toggleTheme = useCallback(() => store.toggle(), [store]);
  return { theme, toggleTheme };
}
