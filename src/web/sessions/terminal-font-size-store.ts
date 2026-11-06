import { useSyncExternalStore } from 'react';

export const MIN_TERMINAL_FONT_SIZE = 8;
export const MAX_TERMINAL_FONT_SIZE = 32;
export const DEFAULT_TERMINAL_FONT_SIZE = 12;
export const TERMINAL_FONT_SIZE_KEY = 'ai-client.terminal-font-size';

type FontSizeStorage = Pick<Storage, 'getItem' | 'setItem'>;

function isFontSize(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_TERMINAL_FONT_SIZE && value <= MAX_TERMINAL_FONT_SIZE;
}

function readFontSize(storage: FontSizeStorage | undefined): number {
  try {
    const saved = storage?.getItem(TERMINAL_FONT_SIZE_KEY);
    const size = saved ? Number(saved) : Number.NaN;
    return isFontSize(size) ? size : DEFAULT_TERMINAL_FONT_SIZE;
  } catch {
    return DEFAULT_TERMINAL_FONT_SIZE;
  }
}

export class TerminalFontSizeStore {
  readonly #storage: FontSizeStorage | undefined;
  readonly #listeners = new Set<() => void>();
  #size: number;

  constructor(storage?: FontSizeStorage) {
    this.#storage = storage;
    this.#size = readFontSize(storage);
  }

  larger(): void {
    this.#apply(this.#size + 1);
  }

  smaller(): void {
    this.#apply(this.#size - 1);
  }

  reset(): void {
    this.#apply(DEFAULT_TERMINAL_FONT_SIZE);
  }

  #apply(size: number): void {
    if (!isFontSize(size) || size === this.#size) return;
    this.#size = size;
    try {
      this.#storage?.setItem(TERMINAL_FONT_SIZE_KEY, String(size));
    } catch {
      // The size still applies to this page when the browser refuses to store it.
    }
    for (const listener of this.#listeners) listener();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): number => this.#size;
}

let pageStore: TerminalFontSizeStore | undefined;

function pageStorage(): FontSizeStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function pageTerminalFontSizeStore(): TerminalFontSizeStore {
  pageStore ??= new TerminalFontSizeStore(pageStorage());
  return pageStore;
}

export function useTerminalFontSize(store: TerminalFontSizeStore = pageTerminalFontSizeStore()): number {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
