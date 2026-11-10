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
  - else a list named "Changed files": each file as a button with its path in mono and its kind label "Added", "Modified", "Deleted" or "Renamed". A rename shows "<old path> → <new path>". A binary file also shows "Binary". The full path text is the tooltip.
- after a click on a file:
  - while loading → a progress indicator "Loading…";
  - loaded → the DiffView of that file in that commit (a binary file → "Binary file, no diff shown");
  - error → its message in an ErrorMessage.

Actions:
- click on a file → it becomes the selected one (`aria-pressed`, surface 3 background) and its diff loads.
- "Back" → `onBack()`.

## Dependencies

- useCommitFiles, useCommitFileDiff (useFileDiff), DiffView
- ErrorMessage, ProgressIndicator (module app)

## Requirements served

- `plan-git_explorer/REQ-18`, `plan-git_explorer/REQ-19`, `plan-git_explorer/REQ-22`
