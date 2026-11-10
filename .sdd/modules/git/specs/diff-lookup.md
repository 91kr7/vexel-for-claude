---
module: git
component: lookupFileDiff
type: backend function
---

# lookupFileDiff

**Purpose** → the diff of one changed file, for one group.

## Contract

- `lookupFileDiff(runner, folder, { group, file, oldPath? }) → FileDiff` (see parseDiff)
  - `file`, `oldPath` → paths from the repository root of `folder`.
  - `staged` → the index against HEAD; in a repository with no commits, against the empty tree (every line added).
  - `unstaged`, file known to the index → the working file against the index.
  - `unstaged`, file not known to the index (untracked) → every line of the file added.
  - with `oldPath` → the rename diff between `oldPath` and `file`; a pure rename gives no lines.
  - a binary file → `binary: true`; more than 5,000 lines → `cut: true`.
  - a diff output larger than 5 MB → no error: its first part is parsed, with `cut: true`.
  - any git failure → rejects with the `GitError` of the GitRunner.

## Rules and invariants

- Read only: it runs `rev-parse`, `ls-files` and `diff` (with `runCapped`) through the GitRunner.
- Paths are taken literally: glob characters in a name match only that name.
- No external diff tool or text conversion of the git config runs; the output has no colours.

## Dependencies

- GitRunner, parseDiff, lookupChanges (repository root)

## Requirements served

- `plan-git_explorer/REQ-8`, `plan-git_explorer/REQ-12`, `plan-git_explorer/REQ-14`, `plan-git_explorer/REQ-15`
