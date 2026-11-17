---
module: git
component: CommitDetail
type: UI component
---

# CommitDetail

**Purpose** → one commit: its full message, the files it changed, and the diff of the chosen file.

## Contract

Description:
- on top (at most 40 % of the height, own scroll): a "Back" button with the short hash chip, the message, the author line and the file list. The diff below it fills the rest.

Props:
- `root` → the repository root.
- `commit` → a `Commit` of useHistory.
- `onBack` → called by "Back".

Shows:
- the short hash in a mono chip (tooltip: the full hash).
- the full message, line breaks kept.
- "<author> · <date>", as in HistoryTab.
- the files of the commit (useCommitFiles):
  - while loading → a progress indicator "Loading…";
  - an error → its message in an ErrorMessage;
  - no files → "No files changed";
  - else a single-selection list box named "Changed files" (react-aria-components, as in ChangesTab): each file as an option, a dense row of ListStyles as in ChangesTab, with its path in mono and its kind label "Added", "Modified", "Deleted" or "Renamed". A rename shows "<old path> → <new path>". A binary file also shows "Binary". The full path text is the tooltip.
- after a click on a file:
  - while loading → a progress indicator "Loading…";
  - loaded → the DiffView of that file in that commit (a binary file → "Binary file, no diff shown");
  - error → its message in an ErrorMessage.

Actions:
- click on a file, or arrow keys and Enter/Space in the list → it becomes the selected option (`aria-selected`, the active look of ListStyles) and its diff loads. Once a file is selected, the selection cannot be emptied.
- "Back" → `onBack()`.

## Dependencies

- useCommitFiles, useCommitFileDiff (useFileDiff), DiffView
- `react-aria-components` (npm, Apache-2.0)
- ErrorMessage, ProgressIndicator, ListStyles (module app)

## Requirements served

- `plan-git_explorer/REQ-18`, `plan-git_explorer/REQ-19`, `plan-git_explorer/REQ-22`
- `plan-git_graph/REQ-14`, `plan-git_graph/REQ-15`, `plan-git_graph/REQ-16`
- `plan-dark_blue_theme/REQ-47`
