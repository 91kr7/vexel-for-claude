---
module: folders
component: FolderRoute
type: REST endpoint
---

# FolderRoute

**Purpose** → lists the subfolders of a folder, for the folder chooser.

## Contract

- `GET /api/folders?path=<absolute path>` → lists the subfolders of `path`.
  - no `path` → the user's home folder.
  - `200` → body `{ path, parent, folders }`.
    - `path` → the listed folder, normalized (no trailing slash, no `.` or `..`).
    - `parent` → the parent folder, or `null` for `/`.
    - `folders` → the names of the direct subfolders, hidden ones included, sorted by name. Files and symbolic links are not listed.
  - `400` → `path` is not absolute. Body: `{ error: "invalid_path" }`.
  - `404` → the path does not exist or is not a folder. Body: `{ error: "folder_not_found" }`.
  - `403` → the folder cannot be read. Body: `{ error: "folder_not_readable" }`.

## Rules and invariants

- Read only: the route never changes the file system.

## Requirements served

- `plan-claude_sessions_client/REQ-1`
