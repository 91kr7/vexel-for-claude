import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { START_THEME, THEME_KEY, type Theme, ThemeStore, isTheme, useTheme } from './theme-store';

/** A page root that records its attributes. */
function fakeRoot(initialMark?: string) {
  const attributes = new Map<string, string>();
  if (initialMark !== undefined) attributes.set('data-theme', initialMark);
  return {
    attributes,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    getAttribute: (name: string) => attributes.get(name) ?? null,
  };
}

/** A storage that records what is saved. */
function fakeStorage() {
  const items = new Map<string, string>();
  return { items, setItem: vi.fn((key: string, value: string) => void items.set(key, value)) };
}

/** Stubs the page globals: the root and a window whose localStorage is `storage`. */
function stubPage(root: ReturnType<typeof fakeRoot>, storage: unknown = fakeStorage()) {
  vi.stubGlobal('document', { documentElement: root });
  vi.stubGlobal('window', { localStorage: storage });
  vi.stubGlobal('localStorage', storage);
}

/** A fresh copy of the module, so that pageThemeStore() creates its store again. */
async function freshModule() {
  vi.resetModules();
  return import('./theme-store');
}

describe('ThemeStore', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // plan-light_theme/REQ-19: with no remembered choice the client starts light
  it('starts from the light theme by default', () => {
    expect(START_THEME).toBe('light');
    const root = fakeRoot();
    const store = new ThemeStore(root);
    expect(store.getSnapshot()).toBe('light');
    expect(root.attributes.get('data-theme')).toBe('light');
  });

  it('uses the key ai-client.theme', () => {
    expect(THEME_KEY).toBe('ai-client.theme');
  });

  it.each<[unknown, boolean]>([
    ['dark', true],
    ['light', true],
    ['Dark', false],
    ['', false],
    [null, false],
    [undefined, false],
    ['system', false],
  ])('isTheme(%j) is %s', (value, expected) => {
    expect(isTheme(value)).toBe(expected);
  });

  it('marks the given initial theme on the root at once, without saving it', () => {
    const root = fakeRoot();
    const storage = fakeStorage();
    const store = new ThemeStore(root, 'dark', storage);
    expect(store.getSnapshot()).toBe('dark');
    expect(root.attributes.get('data-theme')).toBe('dark');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  // plan-light_theme/REQ-3: toggle() switches light to dark and back, moving the mark
  it('toggles light to dark and back, moving the data-theme mark', () => {
    const root = fakeRoot();
    const store = new ThemeStore(root);
    store.toggle();
    expect(store.getSnapshot()).toBe('dark');
    expect(root.attributes.get('data-theme')).toBe('dark');
    store.toggle();
    expect(store.getSnapshot()).toBe('light');
    expect(root.attributes.get('data-theme')).toBe('light');
  });

  // plan-light_theme/REQ-17: each toggle saves the new theme
  it('saves the new theme under THEME_KEY on each toggle', () => {
    const storage = fakeStorage();
    const store = new ThemeStore(fakeRoot(), 'light', storage);
    store.toggle();
    expect(storage.setItem).toHaveBeenLastCalledWith(THEME_KEY, 'dark');
    store.toggle();
    expect(storage.setItem).toHaveBeenLastCalledWith(THEME_KEY, 'light');
    expect(storage.setItem).toHaveBeenCalledTimes(2);
  });

  // ThemeStore contract: mark, then save, then listeners
  it('moves the mark and saves before calling the listeners', () => {
    const root = fakeRoot();
    const storage = fakeStorage();
    const store = new ThemeStore(root, 'light', storage);
    const seen: (string | undefined)[] = [];
    store.subscribe(() => seen.push(root.attributes.get('data-theme'), storage.items.get(THEME_KEY)));
    store.subscribe(() => seen.push(store.getSnapshot()));
    store.toggle();
    expect(seen).toEqual(['dark', 'dark', 'dark']);
  });

  it('changes the theme and calls the listeners when setItem throws', () => {
    const root = fakeRoot();
    const storage = {
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const store = new ThemeStore(root, 'light', storage);
    const listener = vi.fn();
    store.subscribe(listener);
    expect(() => store.toggle()).not.toThrow();
    expect(store.getSnapshot()).toBe('dark');
    expect(root.attributes.get('data-theme')).toBe('dark');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('changes the theme and calls the listeners with no storage', () => {
    const root = fakeRoot();
    const store = new ThemeStore(root, 'dark');
    const listener = vi.fn();
    store.subscribe(listener);
    store.toggle();
    expect(store.getSnapshot()).toBe('light');
    expect(root.attributes.get('data-theme')).toBe('light');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops calling a listener after unsubscribe', () => {
    const store = new ThemeStore(fakeRoot());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.toggle();
    unsubscribe();
    store.toggle();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('pageThemeStore', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns one store that marks document.documentElement', async () => {
    const root = fakeRoot();
    stubPage(root);
    const { pageThemeStore } = await freshModule();
    const store = pageThemeStore();
    expect(pageThemeStore()).toBe(store);
    expect(root.attributes.get('data-theme')).toBe(store.getSnapshot());
    store.toggle();
    expect(root.attributes.get('data-theme')).toBe(store.getSnapshot());
  });

  // plan-light_theme/REQ-18: the store takes over the mark set before the first paint
  it.each<Theme>(['dark', 'light'])('starts from the "%s" mark already on the root', async (theme) => {
    stubPage(fakeRoot(theme));
    const { pageThemeStore } = await freshModule();
    expect(pageThemeStore().getSnapshot()).toBe(theme);
  });

  // plan-light_theme/REQ-19
  it.each([undefined, 'blue', ''])('starts light when the root mark is %j', async (mark) => {
    stubPage(fakeRoot(mark));
    const { pageThemeStore } = await freshModule();
    expect(pageThemeStore().getSnapshot()).toBe('light');
  });

  // plan-light_theme/REQ-17
  it('saves each toggle in localStorage', async () => {
    const storage = fakeStorage();
    stubPage(fakeRoot('light'), storage);
    const { pageThemeStore } = await freshModule();
    pageThemeStore().toggle();
    expect(storage.items.get('ai-client.theme')).toBe('dark');
  });

  it('works without saving when localStorage is not reachable', async () => {
    const root = fakeRoot('dark');
    const denied = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    vi.stubGlobal('document', { documentElement: root });
    vi.stubGlobal('window', Object.defineProperty({}, 'localStorage', { get: denied }));
    const { pageThemeStore } = await freshModule();
    const store = pageThemeStore();
    expect(() => store.toggle()).not.toThrow();
    expect(store.getSnapshot()).toBe('light');
    expect(root.attributes.get('data-theme')).toBe('light');
  });
});

describe('useTheme', () => {
  let toggleTheme: (() => void) | undefined;
  function Probe({ store }: { store: ThemeStore }) {
    const result = useTheme(store);
    toggleTheme = result.toggleTheme;
    return createElement('span', null, result.theme);
  }

  it.each<Theme>(['dark', 'light'])('gives the active theme "%s" in a server render', (theme) => {
    expect(renderToStaticMarkup(createElement(Probe, { store: new ThemeStore(fakeRoot(), theme) }))).toBe(`<span>${theme}</span>`);
  });

  it('toggleTheme() toggles the store', () => {
    const store = new ThemeStore(fakeRoot());
    renderToStaticMarkup(createElement(Probe, { store }));
    toggleTheme!();
    expect(store.getSnapshot()).toBe('dark');
  });
});
