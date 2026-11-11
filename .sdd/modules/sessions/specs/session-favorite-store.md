---
module: sessions
component: SessionFavoriteStore
type: backend service
---

# SessionFavoriteStore

**Purpose** → keeps the favorite mark of sessions, by session key, in a JSON file of the client's data folder.

## Contract

- `SessionFavoriteStore.load(dataDir) → Promise<SessionFavoriteStore>` → a store on `<dataDir>/session-favorites.json`, with the keys saved there. `dataDir` comes from `dataDirOf` (SessionNameStore).
  - missing file, invalid JSON, or a JSON value that is not an object → no favorites. It never fails.
  - entries whose value is not `true` are ignored.
  - it writes nothing.
- `new SessionFavoriteStore(file?, keys?)` → a store with the given keys. With no `file` it saves nothing.
- `has(key) → boolean` → the key has the favorite mark.
- `set(key, favorite) → Promise<void>` → sets or clears the mark of the key.
  - same value as now → nothing changes, no listener is called, nothing is written.
  - otherwise the listeners get `(key, favorite)` before the call returns. The promise resolves once the file is saved.
- `move(from, to) → Promise<void>` → the mark of `from` goes to `to`, and `from` has no mark any more.
  - `from` has no mark, or `from = to` → nothing changes.
  - `to` already marked → it stays marked.
  - listeners get `(from, false)`, then `(to, true)` unless `to` was already marked. The promise resolves once the file is saved.
- `onChange(listener) → unsubscribe` → `listener(key, favorite)` after each change.

## Rules and invariants

- The file is a JSON object `{ "<key>": true }` with every marked key.
- A save writes a temporary file, then renames it over the old one. Saves run one after the other. The folder is created when missing.
- It reads and writes nothing under the Claude Code folder.
- The key is a Claude Code session id, or a hosted session id while the Claude Code session id is not known (SessionStateTracker). The store never removes a key by itself (gatekeeper decision: a hosted id that never got a Claude Code session id stays in the file).

## Dependencies

- `dataDirOf` (SessionNameStore)

## Requirements served

- `plan-favorite_session/REQ-5`, `plan-favorite_session/REQ-6`, `plan-favorite_session/REQ-10`
