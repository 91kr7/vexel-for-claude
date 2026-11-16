import { useSyncExternalStore } from 'react';
import type { ShortcutId, ShortcutModifier } from './shortcut-map';

export const SHORTCUTS_KEY = 'ai-client.shortcuts';

export interface UserShortcutKey {
  code: string;
  modifiers: readonly ShortcutModifier[];
  character?: string;
}

export type UserShortcutKeys = Readonly<Partial<Record<ShortcutId, UserShortcutKey>>>;

type ShortcutsStorage = Pick<Storage, 'getItem' | 'setItem'>;

const MODIFIERS: readonly ShortcutModifier[] = ['Ctrl', 'Alt', 'Shift'];

function isUserKey(value: unknown): value is UserShortcutKey {
  if (typeof value !== 'object' || value === null) return false;
  const { code, modifiers, character } = value as Record<string, unknown>;
  return (
    typeof code === 'string' &&
    code !== '' &&
    Array.isArray(modifiers) &&
    modifiers.every((modifier) => MODIFIERS.includes(modifier)) &&
    new Set(modifiers).size === modifiers.length &&
    (character === undefined || typeof character === 'string')
  );
}

function readKeys(storage: ShortcutsStorage | undefined): UserShortcutKeys {
  let parsed: unknown;
  try {
    parsed = JSON.parse(storage?.getItem(SHORTCUTS_KEY) ?? '{}');
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
  return Object.fromEntries(Object.entries(parsed).filter(([, key]) => isUserKey(key)));
}

export class UserShortcutKeysStore {
  readonly #storage: ShortcutsStorage | undefined;
  readonly #listeners = new Set<() => void>();
  #keys: UserShortcutKeys;

  constructor(storage?: ShortcutsStorage) {
    this.#storage = storage;
    this.#keys = readKeys(storage);
  }

  keyOf(id: ShortcutId): UserShortcutKey | undefined {
    return this.#keys[id];
  }

  set(id: ShortcutId, key: UserShortcutKey): void {
    this.#change({ ...this.#keys, [id]: { code: key.code, modifiers: [...key.modifiers], character: key.character } });
  }

  restore(id: ShortcutId): void {
    if (!(id in this.#keys)) return;
    const { [id]: _restored, ...rest } = this.#keys;
    this.#change(rest);
  }

  restoreAll(): void {
    this.#change({});
  }

  #change(keys: UserShortcutKeys): void {
    this.#keys = keys;
    try {
      this.#storage?.setItem(SHORTCUTS_KEY, JSON.stringify(keys));
    } catch {
      // The keys still apply to this page when the browser refuses to store them.
    }
    for (const listener of this.#listeners) listener();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): UserShortcutKeys => this.#keys;
}

let pageStore: UserShortcutKeysStore | undefined;

function pageStorage(): ShortcutsStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function pageUserShortcutKeys(): UserShortcutKeysStore {
  pageStore ??= new UserShortcutKeysStore(pageStorage());
  return pageStore;
}

export function useUserShortcutKeys(store: UserShortcutKeysStore = pageUserShortcutKeys()): UserShortcutKeys {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
