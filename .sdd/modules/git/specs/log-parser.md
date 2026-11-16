---
module: git
component: parseLog
type: backend function
---

# parseLog

**Purpose** → reads the commits out of a `git log -z` output.

## Contract

- `LOG_FORMAT` → the `--format` argument that parseLog reads: per commit, full hash, short hash, parent hashes, full message, author name, author date, committer date (both strict ISO 8601), split by NUL.
- `parseLog(output) → Commit[]`, in the order of the output.
  - `Commit` → `{ hash, shortHash, parents, message, author, date, committerDate }`.
  - `parents` → the full hashes of the parents, in git order (first parent first); a root commit → an empty list, a merge → two or more.
  - `message` → the full message, multi-line included, without its trailing newlines.
  - `date` → the author date as git wrote it, e.g. `2026-11-10T15:25:02+01:00`. It stays the date shown on the row.
  - `committerDate` → the committer date as git wrote it, same format.
  - an empty output → an empty list.
  - an incomplete last record (fewer than 7 fields) → dropped.

## Requirements served

- `plan-git_explorer/REQ-16`, `plan-git_explorer/REQ-17`, `plan-git_graph/REQ-9`, `plan-git_graph/REQ-10`
- `plan-multi_repo_workspace/REQ-21`
