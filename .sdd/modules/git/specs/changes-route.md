---
module: git
component: ChangesRoute
type: REST endpoint
---

# ChangesRoute

**Purpose** → gives the page the uncommitted changes of a repository and the diff of one changed file.

## Contract

- `GET /api/git/changes?path=<absolute path>` → the changes of the repository that holds the folder `path` (normalized).
  - `200` → body `{ changes: ChangeEntry[] }`, as lookupChanges gives them.
  - `400` → `path` missing or not absolute. Body `{ error: "invalid_path" }`.
  - `500` → a git error (not a repository included). Body `{ error: "git_error", message }`.
- `GET /api/git/diff?path=<absolute path>&group=<staged|unstaged>&file=<path>&oldPath=<path>` → the diff of `file` in `group`, as lookupFileDiff gives it. `oldPath` is optional.
  - `200` → body `{ binary, cut, lines }`.
  - `400` →
    - `path` missing or not absolute → `{ error: "invalid_path" }`;
    - `group` missing or another value → `{ error: "invalid_group" }`;
    - `file` missing, empty, absolute or out of the repository (`..`), or `oldPath` given and so → `{ error: "invalid_file" }`.
  - `500` → a git error. Body `{ error: "git_error", message }`.

## Rules and invariants

- Read only: the routes change nothing in the folder or in the repository.
- LocalAccessGuard covers them, as every route.

## Dependencies

- lookupChanges, lookupFileDiff, GitRunner

## Requirements served

- `plan-git_explorer/REQ-6`, `plan-git_explorer/REQ-9`, `plan-git_explorer/REQ-12`
