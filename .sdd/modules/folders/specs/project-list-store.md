---
module: folders
component: ProjectListStore
type: frontend service
---

# ProjectListStore

**Purpose** → loads the project folders of the machine for the project list, with their project favorite mark. It keeps the last loaded list, so a new opening shows it at once while the new load runs.

## Contract

- `Project` → `{ folder, lastActivity, available, favorite }`.
- `ProjectListState` → one of:
  - `{ kind: 'loading' }` → no list loaded yet, a load runs or none started.
  - `{ kind: 'ready', projects }` → the last loaded list.
  - `{ kind: 'error' }` → the last load failed and no list was ever loaded.
- `new ProjectListStore(fetchGroups?, marks?)` → `fetchGroups()` gives the body of `GET /api/past-sessions`. Default: a `fetch` of that route; a non-`2xx` answer is a failure. Initial state: `loading`.
  - `marks` → the source of the project marks, with `subscribe` and `getSnapshot` as ProjectMarkLiveStore. Without it, no project is favorite.
- `load()` → starts a load.
  - effect at the start: `error` becomes `loading`. `loading` and `ready` stay as they are.
  - success → `ready`, with one project per group:
    - `folder` → the group `folder`.
    - `lastActivity` → the `lastActivity` of the first session of the group.
    - `available` → the group `available`; `true` when the group has no boolean `available`.
    - `favorite` → `true` when the current marks hold `folder`.
    - a group with no session is left out.
    - order → the favorite projects first, then the others. Each part keeps the order of the groups (most recent first).
  - failure (rejected `fetchGroups`, or a body that is not an array) → `ready` stays as it is; else `error`.
  - several loads at the same time → only the result of the last started load applies.
- mark change → in state `ready`, a new `ready` state at once, with `favorite` and the order computed again on the last loaded groups. No new load. In the other states, nothing changes.
- `subscribe(listener) → unsubscribe` → `listener` runs on each change of state.
- `getSnapshot() → ProjectListState` → the current state. The same object while the state does not change.
- `pageProjectListStore()` → the one store of the page, created on the first call, with the marks of `pageProjectMarkLiveStore()`.
- `useProjectList(store?) → ProjectListState` → the state of `store` (default: the page store), and a new render on each change. It starts no load.

## Rules and invariants

- The store reads nothing on its own: a load starts only with `load()`.
- The list is never cached outside the page memory. A page reload starts from `loading`.

## Dependencies

- PastSessionListRoute (module history), over HTTP
- ProjectMarkLiveStore

## Requirements served

- `plan-recent_projects/REQ-3`, `plan-recent_projects/REQ-4`, `plan-recent_projects/REQ-5`, `plan-recent_projects/REQ-7`, `plan-recent_projects/REQ-8`, `plan-recent_projects/REQ-12`
- `plan-project_list_actions/REQ-25`, `plan-project_list_actions/REQ-26`, `plan-project_list_actions/REQ-29`
