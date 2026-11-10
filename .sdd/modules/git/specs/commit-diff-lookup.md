---
module: git
component: lookupCommitFileDiff
type: backend function
---

# lookupCommitFileDiff

**Purpose** → the diff of one file in one commit.

## Contract

- `lookupCommitFileDiff(runner, folder, { hash, file, oldPath? }) → FileDiff` (see parseDiff)
  - `file`, `oldPath` → paths from the repository root of `folder`.
  - the base → the same as lookupCommitFiles: first parent, or the empty tree for a commit with no parent (every line added).
  - with `oldPath` → the rename diff between `oldPath` and `file`; a pure rename gives no lines.
  - a file the commit did not change → no lines.
  - a binary file → `binary: true`; more than 5,000 lines → `cut: true`.
  - a diff output larger than 5 MB → no error: its first part is parsed, with `cut: true`.
  - an unknown hash or any git failure → rejects with the `GitError` of the GitRunner.

## Rules and invariants

- Read only: it runs `rev-parse` and `diff-tree` (with `runCapped`) through the GitRunner.
- Paths are taken literally: glob characters in a name match only that name.
- No external diff tool or text conversion of the git config runs; the output has no colours.

## Dependencies

- GitRunner, parseDiff, lookupCommitFiles (comparison base), lookupChanges (repository root)

## Requirements served

- `plan-git_explorer/REQ-8`, `plan-git_explorer/REQ-19`, `plan-git_explorer/REQ-22`
