---
module: git
component: parseLog
type: backend function
---

# parseLog

**Purpose** → reads the commits out of a `git log -z` output.

## Contract

- `LOG_FORMAT` → the `--format` argument that parseLog reads: per commit, full hash, short hash, full message, author name, author date (strict ISO 8601), split by NUL.
- `parseLog(output) → Commit[]`, in the order of the output.
  - `Commit` → `{ hash, shortHash, message, author, date }`.
  - `message` → the full message, multi-line included, without its trailing newlines.
  - `date` → the author date as git wrote it, e.g. `2026-11-10T15:25:02+01:00`.
  - an empty output → an empty list.
  - an incomplete last record (fewer than 5 fields) → dropped.

## Requirements served

- `plan-git_explorer/REQ-16`, `plan-git_explorer/REQ-17`
