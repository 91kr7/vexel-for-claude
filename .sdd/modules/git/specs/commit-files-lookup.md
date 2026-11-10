---
module: git
component: lookupCommitFiles
type: backend function
---

# lookupCommitFiles

**Purpose** → the files that one commit changed.

## Contract

- `lookupCommitFiles(runner, folder, hash) → CommitFile[]`
  - `CommitFile` → `{ kind, path, oldPath?, binary }`; paths from the repository root of `folder`.
  - the comparison base → the first parent of `hash`; for a commit with no parent, the empty tree (every file `added`).
  - `kind` → `added`, `modified` (content or type change), `deleted` or `renamed` (rename detection on). A rename has `path` (new) and `oldPath` (old).
  - `binary` → `true` for a file git sees as binary.
  - a merge commit → the files changed against its first parent only.
  - an unknown hash or any git failure → rejects with the `GitError` of the GitRunner.
- `commitDiffTrees(runner, root, hash) → string[]` → the `diff-tree` arguments that compare `hash` with that same base; lookupCommitFileDiff uses it.

## Rules and invariants

- Read only: it runs `rev-parse` and `diff-tree` through the GitRunner.

## Dependencies

- GitRunner, lookupChanges (repository root)

## Requirements served

- `plan-git_explorer/REQ-8`, `plan-git_explorer/REQ-18`, `plan-git_explorer/REQ-22`
