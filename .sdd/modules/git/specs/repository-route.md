---
module: git
component: RepositoryRoute
type: REST endpoint
---

# RepositoryRoute

**Purpose** → gives the page the covered repositories of a folder.

## Contract

- `GET /api/git/repository?path=<absolute path>` → the detection of the folder `path`, normalized (no trailing slash, no `.` or `..`).
  - `200` → body `{ status: "repositories", repositories: [{ root, name, path, branch | error }] }` or `{ status: "none" }`, as detectRepositories gives them. `none` also when git is not installed.
  - `400` → `path` is missing or not absolute. Body: `{ error: "invalid_path" }`.
  - `500` → a git error. Body: `{ error: "git_error", message }`, with the message of the error.

## Rules and invariants

- Read only: the route changes nothing in the folder or in the repositories.
- Each request runs detection again. No cache.
- LocalAccessGuard covers it, as every route.

## Dependencies

- detectRepositories, GitRunner

## Requirements served

- `plan-git_explorer/REQ-4`, `plan-git_explorer/REQ-6`
- `plan-multi_repo_workspace/REQ-5`, `plan-multi_repo_workspace/REQ-6`, `plan-multi_repo_workspace/REQ-9`, `plan-multi_repo_workspace/REQ-10`
