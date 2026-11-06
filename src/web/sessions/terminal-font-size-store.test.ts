import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TERMINAL_FONT_SIZE,
  MAX_TERMINAL_FONT_SIZE,
  MIN_TERMINAL_FONT_SIZE,
  TERMINAL_FONT_SIZE_KEY,
  TerminalFontSizeStore,
  useTerminalFontSize,
} from './terminal-font-size-store';

class MemoryStorage {
  readonly values = new Map<string, string>();
  readonly writes: [string, string][] = [];
  constructor(saved?: string) {
    if (saved !== undefined) this.values.set(TERMINAL_FONT_SIZE_KEY, saved);
  }
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.writes.push([key, value]);
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
  clear(): void {
    this.values.clear();
  }
  key(): string | null {
    return null;
  }
  get length(): number {
    return this.values.size;
  }
}

const storeAt = (saved: string) => {
  const storage = new MemoryStorage(saved);
  return { storage, store: new TerminalFontSizeStore(storage) };
};

const throwing = (method: 'getItem' | 'setItem') => {
  const storage = new MemoryStorage('16');
  storage[method] = () => {
    throw new Error('blocked');
  };
  return storage;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('TerminalFontSizeStore', () => {
  // TerminalFontSizeStore contract: the limits, the default and the storage key
  it('has the limits 8 and 32 px, the default 12 px and the key "ai-client.terminal-font-size"', () => {
    expect([MIN_TERMINAL_FONT_SIZE, MAX_TERMINAL_FONT_SIZE, DEFAULT_TERMINAL_FONT_SIZE]).toEqual([8, 32, 12]);
    expect(TERMINAL_FONT_SIZE_KEY).toBe('ai-client.terminal-font-size');
  });

  // plan-terminal_addons/REQ-44: a saved whole number from 8 to 32 is the starting size
  it.each(['8', '16', '32'])('starts at the saved size "%s"', (saved) => {
    expect(storeAt(saved).store.getSnapshot()).toBe(Number(saved));
  });

  // plan-terminal_addons/REQ-40: anything else starts at 12
  it.each(['', 'abc', '7', '33', '12.5', '-12', 'NaN'])('starts at 12 when the saved value is "%s"', (saved) => {
    expect(storeAt(saved).store.getSnapshot()).toBe(12);
  });

  it('starts at 12 with no saved value, with no storage, and when getItem throws', () => {
    expect(new TerminalFontSizeStore(new MemoryStorage()).getSnapshot()).toBe(12);
    expect(new TerminalFontSizeStore().getSnapshot()).toBe(12);
    expect(new TerminalFontSizeStore(throwing('getItem')).getSnapshot()).toBe(12);
  });

  it('does not write at creation', () => {
    expect(storeAt('16').storage.writes).toEqual([]);
    expect(new MemoryStorage().writes).toEqual([]);
  });

  // plan-terminal_addons/REQ-32, REQ-33, REQ-34: steps of 1 px and reset to 12
  it('larger() adds 1, smaller() removes 1, reset() goes back to 12', () => {
    const { store } = storeAt('14');
    store.larger();
    expect(store.getSnapshot()).toBe(15);
    store.smaller();
    store.smaller();
    expect(store.getSnapshot()).toBe(13);
    store.reset();
    expect(store.getSnapshot()).toBe(12);
  });

  // plan-terminal_addons/REQ-40: the size stays between 8 and 32
  it('stops at 32 with larger() and at 8 with smaller()', () => {
    const big = storeAt('31').store;
    big.larger();
    big.larger();
    expect(big.getSnapshot()).toBe(32);
    const small = storeAt('9').store;
    small.smaller();
    small.smaller();
    expect(small.getSnapshot()).toBe(8);
  });

  // plan-terminal_addons/REQ-44: a change is saved as text, then the listeners run
  it('saves each change under the key as text, before calling the listeners', () => {
    const { storage, store } = storeAt('12');
    const seen: (string | null)[] = [];
    store.subscribe(() => seen.push(storage.getItem(TERMINAL_FONT_SIZE_KEY)));
    store.larger();
    store.smaller();
    expect(storage.writes).toEqual([
      [TERMINAL_FONT_SIZE_KEY, '13'],
      [TERMINAL_FONT_SIZE_KEY, '12'],
    ]);
    expect(seen).toEqual(['13', '12']);
  });

  // TerminalFontSizeStore contract: no change → nothing saved, no listener called
  it.each<[string, (store: TerminalFontSizeStore) => void]>([
    ['32', (store) => store.larger()],
    ['8', (store) => store.smaller()],
    ['12', (store) => store.reset()],
  ])('at %s px the call changes nothing, saves nothing and calls no listener', (saved, act) => {
    const { storage, store } = storeAt(saved);
    const listener = vi.fn();
    store.subscribe(listener);
    act(store);
    expect(store.getSnapshot()).toBe(Number(saved));
    expect(storage.writes).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('still changes the size and calls the listeners without storage or when setItem throws', () => {
    for (const store of [new TerminalFontSizeStore(), new TerminalFontSizeStore(throwing('setItem'))]) {
      const listener = vi.fn();
      store.subscribe(listener);
      const before = store.getSnapshot();
      store.larger();
      expect(store.getSnapshot()).toBe(before + 1);
      expect(listener).toHaveBeenCalledTimes(1);
    }
  });

  it('calls each listener once per change, and no more after unsubscribe', () => {
    const { store } = storeAt('12');
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribe = store.subscribe(first);
    store.subscribe(second);
    store.larger();
    unsubscribe();
    store.larger();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  // plan-terminal_addons/REQ-43: one store for the page
  it('pageTerminalFontSizeStore() returns the same store at each call', async () => {
    const { pageTerminalFontSizeStore } = await import('./terminal-font-size-store');
    const store = pageTerminalFontSizeStore();
    store.larger();
    expect(pageTerminalFontSizeStore()).toBe(store);
    expect(pageTerminalFontSizeStore().getSnapshot()).toBe(13);
  });

  // plan-terminal_addons/REQ-44: the page store reads and writes localStorage
  it('pageTerminalFontSizeStore() starts from localStorage and saves there', async () => {
    const storage = new MemoryStorage('20');
    vi.stubGlobal('window', { localStorage: storage });
    const { pageTerminalFontSizeStore } = await import('./terminal-font-size-store');
    const store = pageTerminalFontSizeStore();
    expect(store.getSnapshot()).toBe(20);
    store.smaller();
    expect(storage.getItem(TERMINAL_FONT_SIZE_KEY)).toBe('19');
  });

  it('pageTerminalFontSizeStore() works without saving when localStorage is not reachable', async () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('SecurityError');
      },
    });
    const { pageTerminalFontSizeStore } = await import('./terminal-font-size-store');
    const store = pageTerminalFontSizeStore();
    expect(store.getSnapshot()).toBe(12);
    store.larger();
    expect(store.getSnapshot()).toBe(13);
  });

  it('useTerminalFontSize(store) gives the current size of the store in a server render', () => {
    const { store } = storeAt('16');
    store.larger();
    const Probe = () => createElement('span', null, useTerminalFontSize(store));
    expect(renderToStaticMarkup(createElement(Probe))).toBe('<span>17</span>');
  });
});
