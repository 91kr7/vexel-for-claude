---
module: git
component: RepositoryRoute
type: REST endpoint
---

# RepositoryRoute

**Purpose** → gives the page the repository lookup of a folder.

## Contract

- `GET /api/git/repository?path=<absolute path>` → the lookup of the folder `path`, normalized (no trailing slash, no `.` or `..`).
  - `200` → body `{ status: "repository", root, branch }` or `{ status: "none" }`, as lookupRepository gives them.
  - `400` → `path` is missing or not absolute. Body: `{ error: "invalid_path" }`.
  - `500` → a git error. Body: `{ error: "git_error", message }`, with the message of the error.

## Rules and invariants

- Read only: the route changes nothing in the folder or in the repository.
- LocalAccessGuard covers it, as every route.

## Dependencies

- lookupRepository, GitRunner

## Requirements served

- `plan-git_explorer/REQ-1`, `plan-git_explorer/REQ-2`, `plan-git_explorer/REQ-4`, `plan-git_explorer/REQ-6`
