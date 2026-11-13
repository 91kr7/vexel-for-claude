---
module: folders
component: ProjectMarkLiveStore
type: frontend service
---

# ProjectMarkLiveStore

**Purpose** → the project marks in the page, kept current by ProjectMarkEventsRoute.

## Contract

- `ProjectMarks` → `{ favorites, removed }`:
  - `favorites` → the set of the folders with the project favorite mark.
  - `removed` → a map from each removed folder to its removal time, as the server sent it.
- `new ProjectMarkLiveStore(origin)` → `origin` is the server origin, e.g. `http://127.0.0.1:3000`. The marks start empty.
- `start()` → opens ProjectMarkEventsRoute (`ws` or `wss` on the same origin).
  - each `project-marks` frame replaces the marks with its `favorites` and `removed`. A frame with no `removed` gives no removed folder.
  - calling `start()` again first stops the previous connection.
- Reconnection → when the socket closes or fails while the store runs, the store opens a new socket 2 s later, and again every 2 s while the attempts fail. The marks stay as they were until a frame arrives.
- `stop()` → closes the socket and cancels a pending reconnection. Later frames change nothing.
- `subscribe(listener) → unsubscribe` → `listener()` after each change of the marks.
- `getSnapshot() → ProjectMarks` → the current marks. The same object until the next change.
- `pageProjectMarkLiveStore()` → the one store of the page on `window.location.origin`, created and started on the first call. It stays connected while the page lives.

## Rules and invariants

- The marks hold only data received from the server.
- Frames are ignored when they are not `{ type: "project-marks" }` with an array of strings in `favorites`, or when they have a `removed` that is not an object of string values.

## Dependencies

- ProjectMarkEventsRoute

## Requirements served

- `plan-project_list_actions/REQ-15`, `plan-project_list_actions/REQ-20`
- `plan-project_list_actions/REQ-28`, `plan-project_list_actions/REQ-29`
