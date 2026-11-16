---
module: git
component: lookupHistory
type: backend function
---

# lookupHistory

**Purpose** → one page of the commits of the current branch.

## Contract

- `HISTORY_PAGE_SIZE` → 100.
- `lookupHistory(runner, folder, offset = 0) → { commits, hasMore }`
  - `commits` → the commits reachable from HEAD, merged branches included, in `git log --date-order` order, from position `offset`, at most 100, each with its parents (see parseLog).
  - order → a commit never comes after one of its parents; otherwise the newer commit comes first.
  - `hasMore` → `true` when at least one commit follows the page.
  - a repository with no commits → `{ commits: [], hasMore: false }`, not an error.
  - an offset past the last commit → `{ commits: [], hasMore: false }`.
  - a detached HEAD → the commits reachable from it.
  - any git failure (not a repository included) → rejects with the `GitError` of the GitRunner.

## Rules and invariants

- Read only: it runs `rev-parse` and `log` through the GitRunner.
- Commit signatures of the git config are not checked or shown; the output has no colours.

## Dependencies

- GitRunner, parseLog

## Requirements served

- `plan-git_explorer/REQ-8`, `plan-git_explorer/REQ-16`, `plan-git_explorer/REQ-20`, `plan-git_explorer/REQ-21`, `plan-git_graph/REQ-8`, `plan-git_graph/REQ-9`, `plan-git_graph/REQ-17`
