import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

export const START_THEME: Theme = 'dark';

type ThemeRoot = Pick<Element, 'setAttribute'>;

export class ThemeStore {
  readonly #root: ThemeRoot;
  readonly #listeners = new Set<() => void>();
  #theme: Theme;

  constructor(root: ThemeRoot, initial: Theme = START_THEME) {
    this.#root = root;
    this.#theme = initial;
    this.#mark();
  }

  toggle(): void {
    this.#theme = this.#theme === 'dark' ? 'light' : 'dark';
    this.#mark();
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

export function pageThemeStore(): ThemeStore {
  pageStore ??= new ThemeStore(document.documentElement);
  return pageStore;
}

export function useTheme(store: ThemeStore = pageThemeStore()): { theme: Theme; toggleTheme: () => void } {
  const theme = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const toggleTheme = useCallback(() => store.toggle(), [store]);
  return { theme, toggleTheme };
}
