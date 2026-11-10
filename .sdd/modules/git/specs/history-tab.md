---
module: git
component: HistoryTab
type: UI component
---

# HistoryTab

**Purpose** → the commit list of the current branch, and the detail of the chosen commit.

## Contract

Description:
- a scrolling list of commits, one row per commit, with "Load more" at its end. A click on a commit replaces the list with the CommitDetail; "Back" brings the list back, at the same scroll position.

Props:
- `root` → the repository root.
- `commits`, `hasMore`, `loadingMore`, `moreError` → from the `loaded` state of useHistory.
- `onLoadMore` → called by "Load more".

Shows:
- no commits → "No commits yet", and no error.
- each commit (list named "Commits") as a button on two lines:
  - the short hash in mono, then the first line of the message (tooltip: that line);
  - "<author> · <date>", the author date in local time as `DD/MM/YYYY HH:MM`.
- `hasMore` → the button "Load more"; while `loadingMore` it reads "Loading…" and is disabled.
- `moreError` → its message in an ErrorMessage, above "Load more".
- a chosen commit → the CommitDetail of that commit, instead of the list.

Actions:
- click on a commit → opens its CommitDetail.
- "Load more" → `onLoadMore()`; the next commits appear after the current ones.
- "Back" in the CommitDetail → the list again.

After a refresh (a new `commits` list):
- the open commit is among the new commits (same hash) → it stays open, as it was;
- else → it closes and the list shows again. After a refresh only the first page is loaded, so a commit of a later page closes too.

## Dependencies

- CommitDetail
- ErrorMessage (module app)

## Requirements served

- `plan-git_explorer/REQ-16`, `plan-git_explorer/REQ-17`, `plan-git_explorer/REQ-20`, `plan-git_explorer/REQ-21`, `plan-git_explorer/REQ-26`
