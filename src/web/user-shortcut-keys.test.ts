// Tests of plan-settings_dialog, batch editable-shortcuts: UserShortcutKeys spec.
import { describe, expect, it, vi } from 'vitest';
import { SHORTCUTS_KEY, UserShortcutKeysStore } from './user-shortcut-keys';

class MemoryStorage {
  readonly values = new Map<string, string>();
  constructor(initial?: string) {
    if (initial !== undefined) this.values.set(SHORTCUTS_KEY, initial);
  }
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  saved(): unknown {
    const value = this.values.get(SHORTCUTS_KEY);
    return value === undefined ? undefined : JSON.parse(value);
  }
}

const altK = { code: 'KeyK', modifiers: ['Alt'] as const, character: 'k' };
const altJ = { code: 'KeyJ', modifiers: ['Alt'] as const };

describe('UserShortcutKeysStore', () => {
  // UserShortcutKeys contract: the storage key
  it('saves under "ai-client.shortcuts"', () => {
    expect(SHORTCUTS_KEY).toBe('ai-client.shortcuts');
  });

  // plan-settings_dialog/REQ-40: the saved keys are read back at creation
  it('reads the saved keys of each row', () => {
    const storage = new MemoryStorage(JSON.stringify({ 'focus-list': altK, 'resume-history': altJ }));
    const store = new UserShortcutKeysStore(storage);
    expect(store.keyOf('focus-list')).toEqual(altK);
    expect(store.keyOf('resume-history')).toEqual(altJ);
    expect(store.keyOf('new-session')).toBeUndefined();
  });

  // UserShortcutKeys contract: a missing, non-JSON or non-object value gives no user keys
  it.each([
    ['missing', undefined],
    ['not JSON', '{not json'],
    ['a list', JSON.stringify([altK])],
    ['a string', JSON.stringify('Alt+K')],
    ['null', 'null'],
  ])('has no user keys when the saved value is %s', (_, value) => {
    const store = new UserShortcutKeysStore(new MemoryStorage(value));
    expect(store.getSnapshot()).toEqual({});
  });

  // UserShortcutKeys contract: getItem that throws gives no user keys
  it('has no user keys when getItem throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {},
    };
    expect(new UserShortcutKeysStore(storage).getSnapshot()).toEqual({});
  });

  // UserShortcutKeys contract: an invalid entry is ignored, so that row keeps its defaults; valid entries stay
  it.each([
    ['no code', { modifiers: ['Alt'] }],
    ['an empty code', { code: '', modifiers: ['Alt'] }],
    ['a code that is not text', { code: 7, modifiers: ['Alt'] }],
    ['no modifiers', { code: 'KeyK' }],
    ['modifiers not a list', { code: 'KeyK', modifiers: 'Alt' }],
    ['an unknown modifier', { code: 'KeyK', modifiers: ['Meta'] }],
    ['a repeated modifier', { code: 'KeyK', modifiers: ['Alt', 'Alt'] }],
    ['a character that is not text', { code: 'KeyK', modifiers: ['Alt'], character: 1 }],
    ['not an object', 'Alt+K'],
  ])('ignores an entry with %s and keeps the valid ones', (_, entry) => {
    const store = new UserShortcutKeysStore(new MemoryStorage(JSON.stringify({ 'focus-list': entry, 'resume-history': altJ })));
    expect(store.keyOf('focus-list')).toBeUndefined();
    expect(store.keyOf('resume-history')).toEqual(altJ);
  });

  // plan-settings_dialog/REQ-26, REQ-40: set gives the row one key and saves the whole map
  it('saves the whole map after set, replacing the previous key of the row', () => {
    const storage = new MemoryStorage(JSON.stringify({ 'resume-history': altJ }));
    const store = new UserShortcutKeysStore(storage);
    store.set('focus-list', { code: 'KeyX', modifiers: ['Alt', 'Shift'] });
    store.set('focus-list', altK);
    expect(store.keyOf('focus-list')).toEqual(altK);
    expect(storage.saved()).toEqual({ 'focus-list': altK, 'resume-history': altJ });
  });

  // plan-settings_dialog/REQ-40: a new store on the same storage reads what an earlier one saved
  it('gives a later store the keys an earlier one saved', () => {
    const storage = new MemoryStorage();
    new UserShortcutKeysStore(storage).set('terminal-search', altK);
    expect(new UserShortcutKeysStore(storage).keyOf('terminal-search')).toEqual(altK);
  });

  // plan-settings_dialog/REQ-34: restore removes the user key of one row and saves
  it('removes the key of one row on restore and saves', () => {
    const storage = new MemoryStorage(JSON.stringify({ 'focus-list': altK, 'resume-history': altJ }));
    const store = new UserShortcutKeysStore(storage);
    store.restore('focus-list');
    expect(store.keyOf('focus-list')).toBeUndefined();
    expect(store.keyOf('resume-history')).toEqual(altJ);
    expect(storage.saved()).toEqual({ 'resume-history': altJ });
  });

  // UserShortcutKeys contract: restore of a row with no user key does nothing and calls no listener
  it('calls no listener on restore of a row with no user key', () => {
    const store = new UserShortcutKeysStore(new MemoryStorage(JSON.stringify({ 'resume-history': altJ })));
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.getSnapshot();
    store.restore('focus-list');
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(before);
  });

  // plan-settings_dialog/REQ-35: restoreAll removes every user key and saves
  it('removes every key on restoreAll and saves', () => {
    const storage = new MemoryStorage(JSON.stringify({ 'focus-list': altK, 'resume-history': altJ }));
    const store = new UserShortcutKeysStore(storage);
    store.restoreAll();
    expect(store.getSnapshot()).toEqual({});
    expect(storage.saved()).toEqual({});
  });

  // plan-settings_dialog/REQ-37, UserShortcutKeys contract: listeners run after each change, after the save, with a new snapshot
  it('calls the listeners after set, restore and restoreAll, after the save, with a new snapshot each time', () => {
    const storage = new MemoryStorage();
    const store = new UserShortcutKeysStore(storage);
    const savedAtCall: unknown[] = [];
    const snapshots = [store.getSnapshot()];
    store.subscribe(() => {
      savedAtCall.push(storage.saved());
      snapshots.push(store.getSnapshot());
    });
    store.set('focus-list', altK);
    store.restore('focus-list');
    store.set('resume-history', altJ);
    store.restoreAll();
    expect(savedAtCall).toEqual([{ 'focus-list': altK }, {}, { 'resume-history': altJ }, {}]);
    expect(new Set(snapshots).size).toBe(5);
  });

  // UserShortcutKeys contract: unsubscribe stops the calls
  it('stops calling a listener after unsubscribe', () => {
    const store = new UserShortcutKeysStore(new MemoryStorage());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set('focus-list', altK);
    unsubscribe();
    store.set('focus-list', altJ);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // UserShortcutKeys contract: no storage, or setItem that throws, still applies the change and calls the listeners
  it.each([
    ['no storage', undefined],
    [
      'a setItem that throws',
      {
        getItem: () => null,
        setItem: () => {
          throw new Error('quota');
        },
      },
    ],
  ])('applies the change and calls the listeners with %s', (_, storage) => {
    const store = new UserShortcutKeysStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);
    store.set('focus-list', altK);
    expect(store.keyOf('focus-list')).toEqual(altK);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
