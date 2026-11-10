---
module: git
component: lookupRepository
type: backend function
---

# lookupRepository

**Purpose** → tells whether a folder is in a git repository, and gives the repository root and its current branch.

## Contract

- `lookupRepository(runner, folder) → RepositoryLookup`
  - `{ status: "repository", root, branch }` → `folder` is the root of a repository or one of its subfolders.
    - `root` → the absolute path of the root of the working tree, as git gives it.
    - `branch` → `{ kind: "branch", name }` with the short branch name, or `{ kind: "detached", hash }` with the short hash of HEAD when HEAD is detached.
  - `{ status: "none" }` →
    - `folder` does not exist or is not a folder;
    - `folder` is not inside a repository (git says "not a git repository");
    - git is not installed.
  - any other git failure → rejects with the `GitError` of the GitRunner, with git's message.

## Rules and invariants

- A repository with no commits gives `repository` with the name of its unborn branch.
- It runs only `rev-parse` and `symbolic-ref` in their read form, through the GitRunner.

## Dependencies

- GitRunner

## Requirements served

- `plan-git_explorer/REQ-1`, `plan-git_explorer/REQ-2`, `plan-git_explorer/REQ-4`
