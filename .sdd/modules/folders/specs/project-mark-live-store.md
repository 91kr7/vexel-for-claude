---
module: folders
component: ProjectMarkLiveStore
type: frontend service
---

# ProjectMarkLiveStore

**Purpose** → the project marks in the page, kept current by ProjectMarkEventsRoute.

## Contract

- `ProjectMarks` → `{ favorites }`: the set of the folders with the project favorite mark.
- `new ProjectMarkLiveStore(origin)` → `origin` is the server origin, e.g. `http://127.0.0.1:3000`. The marks start empty.
- `start()` → opens ProjectMarkEventsRoute (`ws` or `wss` on the same origin).
  - each `project-marks` frame replaces the marks with its `favorites`.
  - calling `start()` again first stops the previous connection.
- Reconnection → when the socket closes or fails while the store runs, the store opens a new socket 2 s later, and again every 2 s while the attempts fail. The marks stay as they were until a frame arrives.
- `stop()` → closes the socket and cancels a pending reconnection. Later frames change nothing.
- `subscribe(listener) → unsubscribe` → `listener()` after each change of the marks.
- `getSnapshot() → ProjectMarks` → the current marks. The same object until the next change.
- `pageProjectMarkLiveStore()` → the one store of the page on `window.location.origin`, created and started on the first call. It stays connected while the page lives.

## Rules and invariants

- The marks hold only data received from the server.
- Frames that are not `{ type: "project-marks" }` with an array of strings in `favorites` are ignored.

## Dependencies

- ProjectMarkEventsRoute

## Requirements served

- `plan-project_list_actions/REQ-28`, `plan-project_list_actions/REQ-29`
