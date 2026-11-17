import { useCallback, useSyncExternalStore } from 'react';
import { dissolveColors } from './color-dissolve';

export type Theme = 'light' | 'dark' | 'dark-blue';

export const START_THEME: Theme = 'dark-blue';

const THEME_CYCLE: readonly Theme[] = ['light', 'dark', 'dark-blue'];

export const THEME_KEY = 'ai-client.theme';

type ThemeRoot = Pick<Element, 'setAttribute'>;
type ThemeStorage = Pick<Storage, 'setItem'>;
/** Runs a change of the page colours; the default applies it at once. */
export type ColorChange = (apply: () => void) => void;

const applyAtOnce: ColorChange = (apply) => apply();

export function isTheme(value: unknown): value is Theme {
  return THEME_CYCLE.includes(value as Theme);
}

export class ThemeStore {
  readonly #root: ThemeRoot;
  readonly #storage: ThemeStorage | undefined;
  readonly #change: ColorChange;
  readonly #listeners = new Set<() => void>();
  #theme: Theme;

  constructor(root: ThemeRoot, initial: Theme = START_THEME, storage?: ThemeStorage, change: ColorChange = applyAtOnce) {
    this.#root = root;
    this.#storage = storage;
    this.#change = change;
    this.#theme = initial;
    this.#mark();
  }

  toggle(): void {
    this.setTheme(THEME_CYCLE[(THEME_CYCLE.indexOf(this.#theme) + 1) % THEME_CYCLE.length] ?? START_THEME);
  }

  setTheme(theme: Theme): void {
    this.#theme = theme;
    try {
      this.#storage?.setItem(THEME_KEY, this.#theme);
    } catch {
      // The theme still applies to this page when the browser refuses to store it.
    }
    // Marks the active theme, not `theme`: a later change may already have replaced it.
    this.#change(() => {
      this.#mark();
      for (const listener of this.#listeners) listener();
    });
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
  pageStore = new ThemeStore(root, isTheme(mark) ? mark : START_THEME, pageStorage(), dissolveColors);
  return pageStore;
}

export function useTheme(store: ThemeStore = pageThemeStore()): {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
} {
  const theme = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const toggleTheme = useCallback(() => store.toggle(), [store]);
  const setTheme = useCallback((next: Theme) => store.setTheme(next), [store]);
  return { theme, toggleTheme, setTheme };
}
