import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { START_THEME, type Theme, ThemeStore, pageThemeStore, useTheme } from './theme-store';

/** A page root that records its attributes. */
function fakeRoot() {
  const attributes = new Map<string, string>();
  return {
    attributes,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
  };
}

describe('ThemeStore', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ThemeStore contract and plan-light_theme/REQ-13: the client starts dark until remembered-theme
  it('starts from the dark theme', () => {
    expect(START_THEME).toBe('dark');
    const root = fakeRoot();
    const store = new ThemeStore(root);
    expect(store.getSnapshot()).toBe('dark');
    expect(root.attributes.get('data-theme')).toBe('dark');
  });

  // ThemeStore contract: the store marks the initial theme at once
  it('marks the given initial theme on the root at once', () => {
    const root = fakeRoot();
    const store = new ThemeStore(root, 'light');
    expect(store.getSnapshot()).toBe('light');
    expect(root.attributes.get('data-theme')).toBe('light');
  });

  // plan-light_theme/REQ-3: toggle() switches dark to light and light to dark, moving the mark
  it('toggles dark to light and back, moving the data-theme mark', () => {
    const root = fakeRoot();
    const store = new ThemeStore(root);
    store.toggle();
    expect(store.getSnapshot()).toBe('light');
    expect(root.attributes.get('data-theme')).toBe('light');
    store.toggle();
    expect(store.getSnapshot()).toBe('dark');
    expect(root.attributes.get('data-theme')).toBe('dark');
  });

  // ThemeStore contract: the mark changes first, then the listeners are called
  it('calls each listener once per change, after the mark has moved', () => {
    const root = fakeRoot();
    const store = new ThemeStore(root);
    const seen: (string | undefined)[] = [];
    store.subscribe(() => seen.push(root.attributes.get('data-theme')));
    store.subscribe(() => seen.push(store.getSnapshot()));
    store.toggle();
    expect(seen).toEqual(['light', 'light']);
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

  // ThemeStore rule: the store does not save the theme
  it('does not write the theme to web storage', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem, getItem: () => null, removeItem: vi.fn() });
    vi.stubGlobal('sessionStorage', { setItem, getItem: () => null, removeItem: vi.fn() });
    const store = new ThemeStore(fakeRoot());
    store.toggle();
    expect(setItem).not.toHaveBeenCalled();
    expect(new ThemeStore(fakeRoot()).getSnapshot()).toBe(START_THEME);
  });

  // ThemeStore contract: pageThemeStore() is the one store of the page, on document.documentElement
  it('pageThemeStore() returns one store that marks document.documentElement', () => {
    const root = fakeRoot();
    vi.stubGlobal('document', { documentElement: root });
    const store = pageThemeStore();
    expect(pageThemeStore()).toBe(store);
    expect(root.attributes.get('data-theme')).toBe(store.getSnapshot());
    store.toggle();
    expect(root.attributes.get('data-theme')).toBe(store.getSnapshot());
  });
});

describe('useTheme', () => {
  let toggleTheme: (() => void) | undefined;
  function Probe({ store }: { store: ThemeStore }) {
    const result = useTheme(store);
    toggleTheme = result.toggleTheme;
    return createElement('span', null, result.theme);
  }

  // ThemeStore contract: useTheme gives the active theme of the store, also in a server render
  it.each<Theme>(['dark', 'light'])('gives the active theme "%s" in a server render', (theme) => {
    expect(renderToStaticMarkup(createElement(Probe, { store: new ThemeStore(fakeRoot(), theme) }))).toBe(`<span>${theme}</span>`);
  });

  // ThemeStore contract: toggleTheme() calls store.toggle()
  it('toggleTheme() toggles the store', () => {
    const store = new ThemeStore(fakeRoot());
    renderToStaticMarkup(createElement(Probe, { store }));
    toggleTheme!();
    expect(store.getSnapshot()).toBe('light');
  });
});
