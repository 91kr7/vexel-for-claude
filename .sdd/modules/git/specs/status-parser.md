---
module: git
component: parseStatus
type: backend function
---

# parseStatus

**Purpose** → turns the output of `git status --porcelain=v2 -z` into the list of changed files.

## Contract

- `parseStatus(output) → ChangeEntry[]`, in the order of the output.
- `ChangeEntry` → `{ group, kind, path, oldPath? }`
  - `group` → `staged` or `unstaged`.
  - `kind` → `added`, `modified`, `deleted`, `renamed` or `untracked`.
  - `path` → the path from the repository root, as git writes it (no quoting).
  - `oldPath` → the path before the rename; only on `renamed`.

## Rules and invariants

- An ordinary or rename record gives one entry per side with a change: the staged side (`X`) in `staged`, the worktree side (`Y`) in `unstaged`. A file with both gives two entries.
- Change letter → kind:
  - `A`, `C` → `added` (a copy has no `oldPath`);
  - `M`, `T` → `modified`;
  - `D` → `deleted`;
  - `R` → `renamed`, with `oldPath`;
  - `.` → no entry for that side.
- An untracked record (`?`) → `unstaged`, `untracked`.
- An unmerged record (`u`) → one `unstaged`, `modified` entry.
- Ignored records (`!`), header records (`#`) and the empty end of the output → no entry.
- Paths with spaces are kept whole.

## Requirements served

- `plan-git_explorer/REQ-9`, `plan-git_explorer/REQ-10`, `plan-git_explorer/REQ-11`
