---
module: folders
component: ProjectMarkStore
type: backend service
---

# ProjectMarkStore

**Purpose** → keeps the project favorite mark of each folder in a JSON file of the client data folder. It is separate from SessionFavoriteStore.

## Contract

- `ProjectMarkStore.load(dataDir) → Promise<ProjectMarkStore>` → a store on `<dataDir>/project-marks.json`, with the favorites saved there. `dataDir` comes from `dataDirOf` (SessionNameStore).
  - missing file, invalid JSON, a value that is not an object, or a `favorites` that is not an array → no favorites. It never fails.
  - entries of `favorites` that are not strings are ignored.
  - it writes nothing.
- `new ProjectMarkStore(file?, favorites?)` → a store with the given favorite folders. With no `file` it saves nothing.
- `isFavorite(folder) → boolean` → the folder has the project favorite mark.
- `favorites() → string[]` → every marked folder, once each.
- `setFavorite(folder, favorite) → Promise<void>` → sets or clears the mark of the folder.
  - same value as now → nothing changes, no listener is called, nothing is written.
  - otherwise the listeners are called before the call returns. The promise resolves once the file is saved.
- `onChange(listener) → unsubscribe` → `listener()` after each change.

## Rules and invariants

- The file is a JSON object `{ "favorites": [<folder>, ...] }` with every marked folder.
- The folder is the text the caller gives, compared as is. The store does not check the disk.
- A save writes a temporary file, then renames it over the old one. Saves run one after the other. The folder is created when missing.
- It reads and writes nothing under the Claude Code folder.

## Dependencies

- `dataDirOf` (SessionNameStore, module sessions)

## Requirements served

- `plan-project_list_actions/REQ-27`, `plan-project_list_actions/REQ-28`
