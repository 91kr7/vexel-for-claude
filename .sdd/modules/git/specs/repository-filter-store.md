---
module: git
component: useRepositoryFilter
type: frontend hook
---

# useRepositoryFilter

**Purpose** → the repositories the user chose in the git explorer of a project folder, kept in memory while the page stays open.

## Contract

- `useRepositoryFilter(folder, roots) → { chosen, toggle(root), clear() }`
  - `folder` → the project folder of the session, or `undefined`. `roots` → the covered roots, in list order; empty while the lookup has no answer.
  - `chosen` → the chosen roots. Empty means no filter: every covered repository shows.
  - `toggle(root)` → adds `root` to the choice, or removes it when already chosen.
  - `clear()` → empties the choice.

## Rules and invariants

- The choice is kept per `folder`, in memory only: a later mount on the same folder (the panel closed and opened again, or another session on that folder) gets the same choice. A reload of the page starts with no filter.
- Without `folder` the choice lives only in the calling component.
- `chosen` holds only roots of `roots`. A root that `roots` no longer holds leaves the choice, also for later mounts. An empty `roots` keeps the choice as it is.
- A choice left with no root counts as no filter.
- With fewer than 2 `roots` → `chosen` is always empty: a single repository has no filter.

## Requirements served

- `plan-multi_repo_workspace/REQ-28`, `plan-multi_repo_workspace/REQ-30`, `plan-multi_repo_workspace/REQ-31`
