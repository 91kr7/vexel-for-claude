---
module: folders
component: ProjectListStore
type: frontend service
---

# ProjectListStore

**Purpose** → loads the project folders of the machine for the project list. It keeps the last loaded list, so a new opening shows it at once while the new load runs.

## Contract

- `Project` → `{ folder, lastActivity, available }`.
- `ProjectListState` → one of:
  - `{ kind: 'loading' }` → no list loaded yet, a load runs or none started.
  - `{ kind: 'ready', projects }` → the last loaded list.
  - `{ kind: 'error' }` → the last load failed and no list was ever loaded.
- `new ProjectListStore(fetchGroups?)` → `fetchGroups()` gives the body of `GET /api/past-sessions`. Default: a `fetch` of that route; a non-`2xx` answer is a failure. Initial state: `loading`.
- `load()` → starts a load.
  - effect at the start: `error` becomes `loading`. `loading` and `ready` stay as they are.
  - success → `ready`, with one project per group, in the order of the groups:
    - `folder` → the group `folder`.
    - `lastActivity` → the `lastActivity` of the first session of the group.
    - `available` → the group `available`; `true` when the group has no boolean `available`.
    - a group with no session is left out.
  - failure (rejected `fetchGroups`, or a body that is not an array) → `ready` stays as it is; else `error`.
  - several loads at the same time → only the result of the last started load applies.
- `subscribe(listener) → unsubscribe` → `listener` runs on each change of state.
- `getSnapshot() → ProjectListState` → the current state. The same object while the state does not change.
- `pageProjectListStore()` → the one store of the page, created on the first call.
- `useProjectList(store?) → ProjectListState` → the state of `store` (default: the page store), and a new render on each change. It starts no load.

## Rules and invariants

- The store reads nothing on its own: a load starts only with `load()`.
- The list is never cached outside the page memory. A page reload starts from `loading`.

## Dependencies

- PastSessionListRoute (module history), over HTTP

## Requirements served

- `plan-recent_projects/REQ-3`, `plan-recent_projects/REQ-4`, `plan-recent_projects/REQ-5`, `plan-recent_projects/REQ-7`, `plan-recent_projects/REQ-8`, `plan-recent_projects/REQ-12`
