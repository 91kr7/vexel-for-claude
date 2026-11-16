---
module: app
component: UserShortcutKeys
type: frontend service
---

# UserShortcutKeys

**Purpose** → holds the keys the user chose for the shortcut rows, saved in the page storage. The ShortcutMap applies them over the defaults.

## Contract

- `SHORTCUTS_KEY` → `'ai-client.shortcuts'`, the storage key.
- a user key → `{ code, modifiers, character? }`: the physical key, the list of `Ctrl`, `Alt`, `Shift`, and the character it typed when the user chose it.
- `new UserShortcutKeysStore(storage?)` → reads the saved keys once, at creation.
  - the saved value is a JSON object from row id to user key.
  - value missing, not JSON, not an object, or `getItem` throws → no user keys.
  - an entry that is not a valid user key (no `code`, empty `code`, `modifiers` not a list of distinct `Ctrl`, `Alt`, `Shift`, `character` not text) → ignored: that row keeps its defaults.
- `keyOf(id)` → the user key of the row, or `undefined`.
- `set(id, key)` → the row gets this one key, replacing any previous one.
- `restore(id)` → the row loses its user key. A row with no user key → nothing happens, no listener call.
- `restoreAll()` → every row loses its user key.
- after `set`, `restore` and `restoreAll` → the whole map is saved under `SHORTCUTS_KEY`, then the `subscribe` listeners are called.
  - `storage` missing, or `setItem` throws → the change still applies on the page and the listeners are called.
- `subscribe(listener) → unsubscribe` → `listener()` after each change.
- `getSnapshot()` → the current map; a new object after each change.
- `pageUserShortcutKeys()` → the one store of the page, created at the first call, with `localStorage`. `localStorage` not reachable → the store works without saving.
- `useUserShortcutKeys(store = pageUserShortcutKeys())` → React hook: the current map; the component re-renders after each change.

## Rules and invariants

- The store does not check the keys: the ShortcutKeyCheck runs before `set`.
- Each browser profile, and the desktop window, keeps its own keys. The backend stores nothing.

## Dependencies

- ShortcutMap (`ShortcutId`, `ShortcutModifier` types)

## Requirements served

- `plan-settings_dialog/REQ-26`, `plan-settings_dialog/REQ-34`, `plan-settings_dialog/REQ-35`, `plan-settings_dialog/REQ-37`, `plan-settings_dialog/REQ-40`
