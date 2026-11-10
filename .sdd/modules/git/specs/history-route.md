---
module: git
component: HistoryRoute
type: REST endpoint
---

# HistoryRoute

**Purpose** → gives the page the history of a repository, the files of a commit and the diff of one file in a commit.

## Contract

- `GET /api/git/history?path=<absolute path>&offset=<n>` → one page of lookupHistory for the folder `path` (normalized). `offset` is optional, default 0.
  - `200` → body `{ commits: Commit[], hasMore }`.
  - `400` →
    - `path` missing or not absolute → `{ error: "invalid_path" }`;
    - `offset` not a non-negative whole number → `{ error: "invalid_offset" }`.
  - `500` → a git error (not a repository included). Body `{ error: "git_error", message }`.
- `GET /api/git/commit-files?path=<absolute path>&hash=<full hash>` → the files of the commit, as lookupCommitFiles gives them.
  - `200` → body `{ files: CommitFile[] }`.
  - `400` →
    - `path` missing or not absolute → `{ error: "invalid_path" }`;
    - `hash` missing or not a full lowercase hash (40 or 64 hex digits) → `{ error: "invalid_hash" }`.
  - `500` → a git error (unknown commit included). Body `{ error: "git_error", message }`.
- `GET /api/git/commit-diff?path=<absolute path>&hash=<full hash>&file=<path>&oldPath=<path>` → the diff of `file` in the commit, as lookupCommitFileDiff gives it. `oldPath` is optional.
  - `200` → body `{ binary, cut, lines }`.
  - `400` →
    - `path` → `{ error: "invalid_path" }`, `hash` → `{ error: "invalid_hash" }`, as above;
    - `file` missing, empty, absolute or out of the repository (`..`), or `oldPath` given and so → `{ error: "invalid_file" }`.
  - `500` → a git error. Body `{ error: "git_error", message }`.

## Rules and invariants

- Read only: the routes change nothing in the folder or in the repository.
- LocalAccessGuard covers them, as every route.
- The server registers them at start, next to ChangesRoute.

## Dependencies

- lookupHistory, lookupCommitFiles, lookupCommitFileDiff, GitRunner

## Requirements served

- `plan-git_explorer/REQ-6`, `plan-git_explorer/REQ-16`, `plan-git_explorer/REQ-18`, `plan-git_explorer/REQ-19`
