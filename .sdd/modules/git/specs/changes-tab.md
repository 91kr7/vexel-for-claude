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
- a list box "Changed files", drawn by the open-source list component, with the group "Staged", then the group "Unstaged" (each a group named after its title, with the title as header); a group with no entries is not shown.
- each entry as an option: the path in mono, then the kind label "Added", "Modified", "Deleted", "Renamed" or "Untracked". A rename shows "<old path> → <new path>". The full path text is the tooltip.
- a file with staged and unstaged changes appears in both groups.
- after a click:
  - while loading → a progress indicator "Loading…";
  - loaded → the DiffView of that file in that group;
  - error → its message in an ErrorMessage.
- every colour comes from the theme tokens, so the list follows the light and the dark theme.

Actions:
- click on an entry, or Enter or Space on the focused entry → it becomes the only selected one (`aria-selected`, surface 3 background) and its diff loads. The arrow keys move the focus between entries.
- click on the selected entry → it stays selected.

After a refresh (a new `changes` list):
- the list holds an entry with the same group and path as the selected one → that entry stays selected and its diff loads again ("Loading…", then the new diff);
- else → the selection and the diff close, and stay closed.

## Dependencies

- useFileDiff, DiffView
- ErrorMessage, ProgressIndicator (module app)
- react-aria-components (npm): ListBox, with one section per group

## Requirements served

- `plan-git_graph/REQ-1`, `plan-git_graph/REQ-2`, `plan-git_graph/REQ-3`, `plan-git_graph/REQ-4`
- `plan-git_explorer/REQ-9`, `plan-git_explorer/REQ-10`, `plan-git_explorer/REQ-11`, `plan-git_explorer/REQ-12`, `plan-git_explorer/REQ-26`
