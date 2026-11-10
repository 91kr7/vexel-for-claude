---
module: git
component: ChangesTab
type: UI component
---

# ChangesTab

**Purpose** → the list of the changed files of the repository, and the diff of the chosen one.

## Contract

Description:
- the file list on top (at most 40 % of the height, own scroll), the diff below it filling the rest.

Props:
- `root` → the repository root.
- `changes` → the entries of useChanges, not empty.

Shows:
- the group "Staged", then the group "Unstaged" (each a region named after its title); a group with no entries is not shown.
- each entry as a button: the path in mono, then the kind label "Added", "Modified", "Deleted", "Renamed" or "Untracked". A rename shows "<old path> → <new path>". The full path text is the tooltip.
- a file with staged and unstaged changes appears in both groups.
- after a click:
  - while loading → a progress indicator "Loading…";
  - loaded → the DiffView of that file in that group;
  - error → its message in an ErrorMessage.

Actions:
- click on an entry → it becomes the selected one (`aria-pressed`, surface 3 background) and its diff loads.

## Dependencies

- useFileDiff, DiffView
- ErrorMessage, ProgressIndicator (module app)

## Requirements served

- `plan-git_explorer/REQ-9`, `plan-git_explorer/REQ-10`, `plan-git_explorer/REQ-11`, `plan-git_explorer/REQ-12`
