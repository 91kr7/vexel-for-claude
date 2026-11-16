---
module: git
component: mergeHistories
type: frontend function
---

# mergeHistories

**Purpose** → merges the loaded history pages of several repositories into one list, newest first, and tells where that list stops.

## Contract

- `mergeHistories(histories) → { commits, border, hasMore }`
  - `histories` → one entry per repository: `{ root, commits, hasMore }`, the commits in git order (as useHistory reads them).
  - `commits` → `{ root, commit }[]`, each commit with the root of its repository.
  - `border` → the roots with `hasMore` whose loaded commits all appear in `commits`, in the order of `histories`.
  - `hasMore` → `border` is not empty.

Order:
- the commits of each repository keep their order, whatever their dates.
- among the next commits of the repositories, the newest by `committerDate` comes first; with no `committerDate`, the author `date` counts. A date that does not parse counts as the oldest.
- equal dates → the repository earlier in `histories` first.

Where the list stops:
```
repeat:
  if a repository with hasMore has no loaded commit left → stop
  if no repository has a loaded commit left → stop
  take the next commit as in "Order"
```
- so the list ends with the oldest loaded commit of a repository that has more pages; the loaded commits after it are not in `commits`.
- no repository with `hasMore` → every loaded commit is in `commits`, and `hasMore` is `false`.
- one repository → its commits in their order; `hasMore` is its own.
- no repositories → an empty list, `hasMore` false.

## Rules and invariants

- A commit never appears below one of its parents of the same repository, as long as each repository's order holds that.
- Pure: the same input gives the same output.

## Requirements served

- `plan-multi_repo_workspace/REQ-21`, `plan-multi_repo_workspace/REQ-24`
