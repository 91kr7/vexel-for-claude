---
module: folders
component: ProjectMarkEventsRoute
type: REST endpoint (WebSocket)
---

# ProjectMarkEventsRoute

**Purpose** → pushes the project marks to every open page.

## Contract

- `registerProjectMarkEventsRoute(app, marks)` → `marks` is the ProjectMarkStore.
- `GET /api/projects/marks` → WebSocket.
  - server → client, on connect: one JSON text frame `{ "type": "project-marks", "favorites": [<folder>, ...], "removed": { <folder>: <removedAt>, ... } }` with the current marks. `removed` is `removals()` of the store.
  - server → client: the same frame, with the marks after the change, after each change of the store.
  - client → server: frames are ignored.

## Rules and invariants

- Every connected page gets every change.
- Closing the socket stops its frames and nothing else.

## Dependencies

- ProjectMarkStore

## Requirements served

- `plan-project_list_actions/REQ-20`, `plan-project_list_actions/REQ-29`
