---
module: git
component: ChangesTab
type: UI component
---

# ChangesTab

**Purpose** → the changed files of the covered repositories, one group per repository, and the diff of the chosen file.

## Contract

Description:
- the file list on top (at most 40 % of the height, own scroll), the diff below it filling the rest.

Props:
- `repositories` → the covered repositories (CoveredRepository of useRepositoryLookup), in list order.
- `changes` → the states of useChanges, one per repository, in the same order.

Shows, with one repository (no repository group, as before `plan-multi_repo_workspace`):
- loading → a progress indicator "Loading…";
- a git error → its message in an ErrorMessage;
- no changes → "No uncommitted changes";
- changes → the file list "Changed files" and the diff area below.

Shows, with several repositories:
- one group per repository, in list order: a region named after the repository, headed by the colour mark of repositoryColor (its position in the list) and the repository name, with the root as tooltip;
- inside a group, by its state:
  - loading → a progress indicator "Loading…";
  - a git error → its message in an ErrorMessage, in that group only;
  - no changes → "No uncommitted changes";
  - changes → a file list "Changed files of <name>".
- one diff area below all the groups.

A file list:
- drawn by the open-source list component, with the group "Staged", then the group "Unstaged" (each a group named after its title, with the title as header); a group with no entries is not shown.
- each entry as an option: the path in mono, then the kind label "Added", "Modified", "Deleted", "Renamed" or "Untracked". A rename shows "<old path> → <new path>". The full path text is the tooltip.
- a file with staged and unstaged changes appears in both groups.

The diff area, after a click:
- while loading → a progress indicator "Loading…";
- loaded → the DiffView of that file in that group, read from the root of its repository;
- error → its message in an ErrorMessage.

Every colour comes from the theme tokens, so the tab follows the light and the dark theme.

Actions:
- click on an entry, or Enter or Space on the focused entry → it becomes the only selected one of the whole tab (`aria-selected`, surface 3 background) and its diff loads. The arrow keys move the focus between the entries of one list.
- click on the selected entry → it stays selected.

After a refresh (new states):
- the repository of the selection is still in the list and its changes hold an entry with the same group and path → that entry stays selected; when its repository has a new list, its diff loads again ("Loading…", then the new diff);
- else → the selection and the diff close, and stay closed.

## Rules and invariants

- The selection is keyed by repository root, group and path: the same path in two repositories are two entries.

## Dependencies

- useFileDiff, DiffView, repositoryColor
- ErrorMessage, ProgressIndicator (module app)
- react-aria-components (npm): ListBox, with one section per group

## Requirements served

- `plan-git_graph/REQ-1`, `plan-git_graph/REQ-2`, `plan-git_graph/REQ-3`, `plan-git_graph/REQ-4`
- `plan-git_explorer/REQ-9`, `plan-git_explorer/REQ-10`, `plan-git_explorer/REQ-11`, `plan-git_explorer/REQ-12`, `plan-git_explorer/REQ-26`
- `plan-multi_repo_workspace/REQ-14`, `plan-multi_repo_workspace/REQ-15`, `plan-multi_repo_workspace/REQ-16`, `plan-multi_repo_workspace/REQ-17`, `plan-multi_repo_workspace/REQ-18`, `plan-multi_repo_workspace/REQ-19`, `plan-multi_repo_workspace/REQ-20`
