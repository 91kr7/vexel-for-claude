---
module: git
component: RepositoryList
type: UI component
---

# RepositoryList

**Purpose** → names the covered repositories in the header of the git explorer panel, and lets the user filter them.

## Contract

Props:
- `repositories` → the covered repositories of useRepositoryLookup, in list order.
- `chosen` → the roots of the filter; empty means no filter.
- `onToggle(root)`, `onClear()` → called by the controls below.

Shows:
- a toggle button "All repositories", above the list, pressed (`aria-pressed`) when `chosen` is empty.
- a list named "Repositories", one entry per repository, in the order of `repositories`. Each entry is a toggle button, pressed when its root is in `chosen`, with the full `root` as tooltip, and shows:
  - a round colour mark → `repositoryColor(<position in the list>)`;
  - the name;
  - the relative path, in the mono font;
  - the branch chip (the `git-branch` icon and the branch name, or "detached <short hash>");
  - or, for an entry with `error`, the git message in the error colour in place of the chip.
- with many entries the list scrolls inside the header. A shown scrollbar is as far from the right edge of the entries as the header edge is from their left edge (ListStyles `.list-scroll`, module app).
- each entry → a 24 px card of ListStyles (`.list-card`), with its hover; a pressed entry is the active card (`.list-active`).
- "All repositories" pressed → a stronger background.

Actions:
- click on an entry → `onToggle(<its root>)`.
- click on "All repositories" → `onClear()`.

Also exports:
- `BranchChip({ branch, className })` → the branch chip alone, as GitExplorerPanel shows it for a single repository.

## Dependencies

- repositoryColor, useRepositoryLookup
- IconSet, ListStyles (module app)

## Requirements served

- `plan-multi_repo_workspace/REQ-7`, `plan-multi_repo_workspace/REQ-9`, `plan-multi_repo_workspace/REQ-28`, `plan-multi_repo_workspace/REQ-30`
- `plan-dark_blue_theme/REQ-44`, `plan-dark_blue_theme/REQ-45`, `plan-dark_blue_theme/REQ-46`, `plan-dark_blue_theme/REQ-49`
