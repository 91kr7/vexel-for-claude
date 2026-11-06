---
module: sessions
component: SessionNameStore
type: backend service
---

# SessionNameStore

**Purpose** → keeps the names the user gives to sessions, by session key, in a JSON file of the client's data folder.

## Contract

- `dataDirOf(env?) → string` → the data folder of the client.
  - `AI_CLIENT_DATA_DIR` when set and not empty.
  - else `<XDG_DATA_HOME>/ai-client`, with `XDG_DATA_HOME` defaulting to `~/.local/share`.
- `SessionNameStore.load(dataDir) → Promise<SessionNameStore>` → a store on `<dataDir>/session-names.json`, with the names saved there.
  - missing file, invalid JSON, or a JSON value that is not an object → no names. It never fails.
  - entries whose value is not a non-empty string are ignored.
  - it writes nothing.
- `new SessionNameStore(file?, names?)` → a store with the given names. With no `file` it saves nothing.
- `get(key) → string | undefined` → the name of the key.
- `set(key, name) → Promise<void>` → sets the name of the key.
  - the name is trimmed at both ends.
  - trimmed name longer than 200 characters → rejects with `NameTooLongError`. Nothing changes.
  - trimmed name empty → the key has no name any more.
  - same name as now → nothing changes, no listener is called, nothing is written.
  - otherwise the listeners get `(key, name)` (`name` is `undefined` when removed) before the call returns. The promise resolves once the file is saved.
- `move(from, to) → Promise<void>` → the name of `from` becomes the name of `to`, and `from` has no name any more.
  - `from` has no name, or `from = to` → nothing changes.
  - an old name of `to` is replaced.
  - listeners get `(from, undefined)`, then `(to, name)`. The promise resolves once the file is saved.
- `onChange(listener) → unsubscribe` → `listener(key, name)` after each change.
- `NAME_MAX_LENGTH` → 200. `nameLength(name)` → the number of characters (Unicode code points).

## Rules and invariants

- The file is a JSON object `{ "<key>": "<name>" }` with every current name.
- A save writes a temporary file, then renames it over the old one. Saves run one after the other. The folder is created when missing.
- It reads and writes nothing under the Claude Code folder.
- The key is a Claude Code session id, or a hosted session id while the Claude Code session id is not known (SessionStateTracker).

## Requirements served

- `plan-session_list_improvements/REQ-31`, `plan-session_list_improvements/REQ-32`, `plan-session_list_improvements/REQ-33`, `plan-session_list_improvements/REQ-35`
