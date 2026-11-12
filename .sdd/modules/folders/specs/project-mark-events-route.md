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
  - server → client, on connect: one JSON text frame `{ "type": "project-marks", "favorites": [<folder>, ...] }` with the current marks.
  - server → client: the same frame, with the marks after the change, after each change of the store.
  - client → server: frames are ignored.

## Rules and invariants

- Every connected page gets every change.
- Closing the socket stops its frames and nothing else.

## Dependencies

- ProjectMarkStore

## Requirements served

- `plan-project_list_actions/REQ-29`
