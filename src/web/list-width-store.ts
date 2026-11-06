import { useSyncExternalStore } from 'react';

export const MIN_LIST_WIDTH = 180;
export const MAX_LIST_WIDTH = 480;
export const DEFAULT_LIST_WIDTH = 224;
export const MIN_MAIN_AREA_WIDTH = 700;
export const LIST_WIDTH_KEY = 'ai-client.list-width';

const RAIL_WIDTH = 52;

type ListWidthStorage = Pick<Storage, 'getItem' | 'setItem'>;

function keptInLimits(width: number): number {
  return Math.min(Math.max(Math.round(width), MIN_LIST_WIDTH), MAX_LIST_WIDTH);
}

function readListWidth(storage: ListWidthStorage | undefined): number {
  try {
    const saved = storage?.getItem(LIST_WIDTH_KEY);
    const width = saved ? Number(saved) : Number.NaN;
    return Number.isInteger(width) && width >= MIN_LIST_WIDTH && width <= MAX_LIST_WIDTH ? width : DEFAULT_LIST_WIDTH;
  } catch {
    return DEFAULT_LIST_WIDTH;
  }
}

export function listWidthLimit(windowWidth: number): number {
  return keptInLimits(windowWidth - RAIL_WIDTH - MIN_MAIN_AREA_WIDTH);
}

export function shownListWidth(width: number, windowWidth: number): number {
  return Math.min(width, listWidthLimit(windowWidth));
}

export class ListWidthStore {
  readonly #storage: ListWidthStorage | undefined;
  readonly #listeners = new Set<() => void>();
  #width: number;

  constructor(storage?: ListWidthStorage) {
    this.#storage = storage;
    this.#width = readListWidth(storage);
  }

  preview(width: number): void {
    const next = keptInLimits(width);
    if (next === this.#width) return;
    this.#width = next;
    for (const listener of this.#listeners) listener();
  }

  commit(width: number): void {
    this.preview(width);
    try {
      this.#storage?.setItem(LIST_WIDTH_KEY, String(this.#width));
    } catch {
      // The width still applies to this page when the browser refuses to store it.
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): number => this.#width;
}

let pageStore: ListWidthStore | undefined;

function pageStorage(): ListWidthStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function pageListWidthStore(): ListWidthStore {
  pageStore ??= new ListWidthStore(pageStorage());
  return pageStore;
}

export function useListWidth(store: ListWidthStore = pageListWidthStore()): number {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
