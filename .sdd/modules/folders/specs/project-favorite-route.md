---
module: folders
component: ProjectFavoriteRoute
type: REST endpoint
---

# ProjectFavoriteRoute

**Purpose** → sets or clears the project favorite mark of a folder.

## Contract

- `registerProjectFavoriteRoute(app, marks)` → `marks` is the ProjectMarkStore.
- `PUT /api/projects/favorite` → request: `{ folder, favorite }`.
  - `204` → the mark of `folder` is now `favorite`, and the file is saved. No body.
  - `400` `{ error: "invalid_path" }` → `folder` is not a string or not an absolute path.
  - `400` `{ error: "invalid_favorite" }` → `favorite` is not a boolean.

## Rules and invariants

- The folder may be missing on disk: the route never reads the disk.
- The mark is stored for `folder` as sent.

## Dependencies

- ProjectMarkStore

## Requirements served

- `plan-project_list_actions/REQ-23`, `plan-project_list_actions/REQ-27`
