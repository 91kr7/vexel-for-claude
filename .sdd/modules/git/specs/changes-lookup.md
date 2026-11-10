---
module: git
component: lookupChanges
type: backend function
---

# lookupChanges

**Purpose** → the uncommitted changes of the whole repository that holds a folder.

## Contract

- `lookupChanges(runner, folder) → ChangeEntry[]` (see parseStatus)
  - finds the repository root of `folder`, then reads the status from the root.
  - every changed file of the repository is listed, also outside `folder`, and every untracked file one by one (no folder summary).
  - renames are detected.
  - `folder` not in a repository, or any other git failure → rejects with the `GitError` of the GitRunner.
- `repositoryRootOf(runner, folder) → root` → the absolute path of the root of the working tree.

## Rules and invariants

- Read only: it runs `rev-parse` and `status` through the GitRunner; the status takes no index lock.

## Dependencies

- GitRunner, parseStatus

## Requirements served

- `plan-git_explorer/REQ-5`, `plan-git_explorer/REQ-8`, `plan-git_explorer/REQ-9`
