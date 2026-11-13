---
module: folders
component: ProjectMarkStore
type: backend service
---

# ProjectMarkStore

**Purpose** → keeps the project favorite mark and the removal of each folder in a JSON file of the client data folder. It is separate from SessionFavoriteStore.

## Contract

- `ProjectMarkStore.load(dataDir) → Promise<ProjectMarkStore>` → a store on `<dataDir>/project-marks.json`, with the favorites and removals saved there. `dataDir` comes from `dataDirOf` (SessionNameStore).
  - missing file, invalid JSON or a value that is not an object → no favorites and no removals. It never fails.
  - a `favorites` that is not an array → no favorites. Entries that are not strings are ignored.
  - a `removed` that is not a plain object → no removals. Entries whose value is not a string are ignored.
  - it writes nothing.
- `new ProjectMarkStore(file?, favorites?, removed?)` → a store with the given favorite folders and the given `[folder, removedAt]` pairs. With no `file` it saves nothing.
- `isFavorite(folder) → boolean` → the folder has the project favorite mark.
- `favorites() → string[]` → every marked folder, once each.
- `removals() → { [folder]: removedAt }` → every removed folder with its removal time, an ISO-8601 UTC text.
- `setFavorite(folder, favorite) → Promise<void>` → sets or clears the mark of the folder.
  - same value as now → nothing changes, no listener is called, nothing is written.
  - otherwise the listeners are called before the call returns. The promise resolves once the file is saved.
- `remove(folder) → Promise<void>` → records the removal of the folder at the current server time, and clears its favorite mark.
  - a folder already removed gets the new time.
  - the listeners are called once, before the call returns. The promise resolves once the file is saved.
- `clearRemoval(folder) → Promise<void>` → forgets the removal of the folder. The favorite mark stays cleared.
  - a folder not removed → nothing changes, no listener is called, nothing is written.
  - otherwise the listeners are called before the call returns. The promise resolves once the file is saved.
- `onChange(listener) → unsubscribe` → `listener()` after each change.

## Rules and invariants

- The file is a JSON object `{ "favorites": [<folder>, ...], "removed": { <folder>: <removedAt>, ... } }` with every marked folder and every removal.
- A removal deletes nothing: no folder, no Claude Code file, no session.
- The folder is the text the caller gives, compared as is. The store does not check the disk.
- A save writes a temporary file, then renames it over the old one. Saves run one after the other. The folder is created when missing.
- It reads and writes nothing under the Claude Code folder.

## Dependencies

- `dataDirOf` (SessionNameStore, module sessions)

## Requirements served

- `plan-project_list_actions/REQ-14`, `plan-project_list_actions/REQ-15`, `plan-project_list_actions/REQ-18`, `plan-project_list_actions/REQ-19`
- `plan-project_list_actions/REQ-27`, `plan-project_list_actions/REQ-28`
