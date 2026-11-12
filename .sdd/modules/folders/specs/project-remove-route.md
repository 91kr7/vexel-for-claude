---
module: folders
component: ProjectRemoveRoute
type: REST endpoint
---

# ProjectRemoveRoute

**Purpose** → records the removal of a project from the Projects list. It deletes nothing.

## Contract

- `registerProjectRemoveRoute(app, marks)` → `marks` is the ProjectMarkStore.
- `POST /api/projects/remove` → request: `{ folder }`.
  - `204` → `folder` is removed at the current server time, its favorite mark is cleared, and the file is saved. No body.
  - `400` `{ error: "invalid_path" }` → `folder` is not a string or not an absolute path.

## Rules and invariants

- The folder may be missing on disk: the route never reads the disk.
- It writes only the ProjectMarkStore file: no folder, no Claude Code file, no session and no history entry changes.
- The removal is stored for `folder` as sent.

## Dependencies

- ProjectMarkStore

## Requirements served

- `plan-project_list_actions/REQ-13`, `plan-project_list_actions/REQ-14`, `plan-project_list_actions/REQ-18`
