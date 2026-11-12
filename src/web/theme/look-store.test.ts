import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOOK_KEY, LookStore, START_LOOK, isLook } from './look-store';

function fakeRoot(initialMark?: string) {
  const attributes = new Map<string, string>();
  if (initialMark !== undefined) attributes.set('data-look', initialMark);
  return {
    attributes,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    getAttribute: (name: string) => attributes.get(name) ?? null,
  };
}

function fakeStorage() {
  const items = new Map<string, string>();
  return { items, setItem: vi.fn((key: string, value: string) => void items.set(key, value)) };
}

describe('LookStore', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts with the Vexel look and marks it on the root', () => {
    const root = fakeRoot();
    const store = new LookStore(root);
    expect(START_LOOK).toBe('vexel');
    expect(store.getSnapshot()).toBe('vexel');
    expect(root.attributes.get('data-look')).toBe('vexel');
  });

  it('toggles between the Vexel and the Windows 11 look, marking and saving each one', () => {
    const root = fakeRoot();
    const storage = fakeStorage();
    const store = new LookStore(root, 'vexel', storage);
    const listener = vi.fn();
    store.subscribe(listener);

    store.toggle();
    expect(store.getSnapshot()).toBe('windows11');
    expect(root.attributes.get('data-look')).toBe('windows11');
    expect(storage.items.get(LOOK_KEY)).toBe('windows11');

    store.toggle();
    expect(store.getSnapshot()).toBe('vexel');
    expect(storage.items.get(LOOK_KEY)).toBe('vexel');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('still applies the look when the storage refuses to save it', () => {
    const root = fakeRoot();
    const store = new LookStore(root, 'vexel', {
      setItem: () => {
        throw new Error('quota');
      },
    });
    store.toggle();
    expect(root.attributes.get('data-look')).toBe('windows11');
  });

  it('reads the look marked on the page, falling back to Vexel for unknown marks', async () => {
    for (const [mark, expected] of [
      ['windows11', 'windows11'],
      ['other', 'vexel'],
    ] as const) {
      vi.resetModules();
      vi.stubGlobal('document', { documentElement: fakeRoot(mark) });
      vi.stubGlobal('window', { localStorage: fakeStorage() });
      const { pageLookStore } = await import('./look-store');
      expect(pageLookStore().getSnapshot()).toBe(expected);
    }
  });

  it('recognises only the two looks', () => {
    expect(isLook('vexel')).toBe(true);
    expect(isLook('windows11')).toBe(true);
    expect(isLook('dark')).toBe(false);
    expect(isLook(undefined)).toBe(false);
  });
});
