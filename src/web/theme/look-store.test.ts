// Unit tests of LookStore (module app), plan-wsl_support batch windows-look.
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
  return {
    items,
    setItem: vi.fn((key: string, value: string) => void items.set(key, value)),
    getItem: (key: string) => items.get(key) ?? null,
  };
}

describe('LookStore', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  // plan-wsl_support/REQ-24: first start shows the current look
  it('starts with the current look "vexel" and marks it on the root', () => {
    const root = fakeRoot();
    const store = new LookStore(root);
    expect(START_LOOK).toBe('vexel');
    expect(store.getSnapshot()).toBe('vexel');
    expect(root.attributes.get('data-look')).toBe('vexel');
  });

  it('takes the given initial look and marks it at once, without writing to the storage', () => {
    const root = fakeRoot();
    const storage = fakeStorage();
    const store = new LookStore(root, 'windows11', storage);
    expect(store.getSnapshot()).toBe('windows11');
    expect(root.attributes.get('data-look')).toBe('windows11');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  // plan-wsl_support/REQ-16, REQ-20, REQ-22: toggle moves the mark and saves the look under its key
  it('toggles vexel to windows11 and back, moving the mark and saving exactly the look name under "ai-client.look"', () => {
    const root = fakeRoot();
    const storage = fakeStorage();
    const store = new LookStore(root, 'vexel', storage);
    expect(LOOK_KEY).toBe('ai-client.look');

    store.toggle();
    expect(store.getSnapshot()).toBe('windows11');
    expect(root.attributes.get('data-look')).toBe('windows11');
    expect(storage.setItem).toHaveBeenLastCalledWith('ai-client.look', 'windows11');

    store.toggle();
    expect(store.getSnapshot()).toBe('vexel');
    expect(root.attributes.get('data-look')).toBe('vexel');
    expect(storage.setItem).toHaveBeenLastCalledWith('ai-client.look', 'vexel');
  });

  it('calls each listener after the change, with the new look already active, until it unsubscribes', () => {
    const root = fakeRoot();
    const store = new LookStore(root, 'vexel', fakeStorage());
    const seen: string[] = [];
    const unsubscribe = store.subscribe(() => seen.push(`${store.getSnapshot()}:${root.attributes.get('data-look')}`));

    store.toggle();
    expect(seen).toEqual(['windows11:windows11']);

    unsubscribe();
    store.toggle();
    expect(seen).toEqual(['windows11:windows11']);
  });

  it('still changes the look and calls the listeners when setItem throws', () => {
    const root = fakeRoot();
    const store = new LookStore(root, 'vexel', {
      setItem: () => {
        throw new Error('quota');
      },
    });
    const listener = vi.fn();
    store.subscribe(listener);
    expect(() => store.toggle()).not.toThrow();
    expect(store.getSnapshot()).toBe('windows11');
    expect(root.attributes.get('data-look')).toBe('windows11');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('still changes the look and calls the listeners with no storage', () => {
    const root = fakeRoot();
    const store = new LookStore(root, 'windows11');
    const listener = vi.fn();
    store.subscribe(listener);
    store.toggle();
    expect(store.getSnapshot()).toBe('vexel');
    expect(root.attributes.get('data-look')).toBe('vexel');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('recognises only "vexel" and "windows11" as looks', () => {
    expect(isLook('vexel')).toBe(true);
    expect(isLook('windows11')).toBe(true);
    for (const other of ['dark', 'light', 'Windows11', '', null, undefined, 1]) expect(isLook(other)).toBe(false);
  });

  // LookStore `pageLookStore()`: initial look from a valid page mark, else the start look
  it.each([
    ['windows11', 'windows11'],
    ['vexel', 'vexel'],
    ['other', 'vexel'],
    [undefined, 'vexel'],
  ] as const)('the page store starts from the page mark %s as %s, marks it on the root and saves nothing', async (mark, expected) => {
    const root = fakeRoot(mark);
    const storage = fakeStorage();
    vi.stubGlobal('document', { documentElement: root });
    vi.stubGlobal('window', { localStorage: storage });
    vi.stubGlobal('localStorage', storage);
    const { pageLookStore } = await import('./look-store');
    const store = pageLookStore();
    expect(store.getSnapshot()).toBe(expected);
    expect(root.attributes.get('data-look')).toBe(expected);
    expect(pageLookStore(), 'one store per page').toBe(store);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('the page store saves a toggle in the page localStorage', async () => {
    const root = fakeRoot('vexel');
    const storage = fakeStorage();
    vi.stubGlobal('document', { documentElement: root });
    vi.stubGlobal('window', { localStorage: storage });
    vi.stubGlobal('localStorage', storage);
    const { pageLookStore } = await import('./look-store');
    pageLookStore().toggle();
    expect(storage.items.get('ai-client.look')).toBe('windows11');
    expect(root.attributes.get('data-look')).toBe('windows11');
  });
});
