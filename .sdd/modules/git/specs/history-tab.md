---
module: git
component: HistoryTab
type: UI component
---

# HistoryTab

**Purpose** → the commit graph of the current branch of each covered repository, and the detail of the chosen commit.

## Contract

Description:
- a scrolling list of commits, one row per commit, with "Load more" at its end. The commit graph, drawn by `commit-graph`, runs down the left of the rows, one commit node per row. A click on a commit replaces the list with the CommitDetail; "Back" brings the list back, at the same scroll position.

Props:
- `repositories` → the shown repositories, in the order of the repository list: `{ root, name, color, branch? }`. `color` is its repositoryColor; `branch` comes from the repository lookup.
- `several` → optional, true to show the repository on each row; default: more than one repository. GitExplorerPanel sets it when the folder covers several repositories.
- `commits`, `hasMore`, `loadingMore`, `moreError` → from the `loaded` state of useHistory, in the order given (newest first). Each commit is `{ root, commit }`.
- `onLoadMore` → called by "Load more".

Shows:
- no commits → "No commits yet", and no error.
- each commit (list named "Commits") as a button on one line, in this order:
  - room on the left for the graph, as wide as the graph;
  - the short hash in mono;
  - with `several` → the name of the commit's repository, after a round mark in its `color` (tooltip: its root). Without → nothing, as before `plan-multi_repo_workspace`;
  - on the first commit of each repository in the list (its tip), a label: the branch name of that repository, or "detached" on a detached HEAD; no `branch` → no label;
  - the first line of the message (tooltip: that line);
  - the author (tooltip: the author);
  - the author date in local time as `DD/MM/YYYY HH:MM`.
- `hasMore` → the button "Load more"; while `loadingMore` it reads "Loading…" and is disabled.
- `moreError` → its message in an ErrorMessage, above "Load more".
- a chosen commit → the CommitDetail of that commit, instead of the list.

The graph:
- lanes come from the hashes and the `parents` of every loaded commit, all pages together; a commit with no `parents` field counts as a root.
- a hash counts only inside its repository: a parent joins only a commit of the same `root`. No line joins two repositories, also when two clones hold the same commit (each shows as its own row and node).
- each commit node sits in the middle of its own row, in the order of `commits`.
- a commit with one parent → one line down to its parent; a history with no merges → one straight line in one lane.
- a merge → one line to each loaded parent; its other parents run in lanes to the right.
- a parent not loaded yet (first or other) in that repository → its line leaves the commit and runs to the bottom edge of the last row. Rule: the graph gets, after the last commit, one placeholder per parent not loaded (no parents of its own); the drawing is clipped at the bottom of the last row, so placeholders show no node, no row and cannot be clicked.
- after "Load more" the graph is drawn again over all the commits, so the lines join their parents across the page border with no gap.
- lane colours, in lane order (the repository colour is on the row mark, never on the lanes): the theme tokens accent primary, emerald 400, amber 400, rose 400, accent secondary, orange 400, then again from the first. They are read from the theme and read again when the theme or the look changes. Lines are 2 px, with no shadow; a node has a ring in the panel colour.
- the graph is decoration (hidden from assistive technology, and clicks pass through it to the rows); the row text names the commit.

Actions:
- click on a commit → opens its CommitDetail, on the root of the commit's repository.
- "Load more" → `onLoadMore()`; the next commits appear after the current ones.
- "Back" in the CommitDetail → the list again.

After a refresh (a new `commits` list):
- the open commit is among the new commits (same repository and same hash) → it stays open, as it was;
- else → it closes and the list shows again. After a refresh only the first page is loaded, so a commit of a later page closes too.

## Rules and invariants

- A long history stays responsive: the graph is drawn again only when `commits` or the lane colours change.

## Dependencies

- CommitDetail
- `commit-graph` (npm, MIT): human decision, 2026-11-16 (a stable, well-known library); chosen over `@tomplum/react-git-log` 2.x, gatekeeper decision, 2026-11-16
- ErrorMessage (module app)

## Requirements served

- `plan-git_explorer/REQ-17`, `plan-git_explorer/REQ-20`, `plan-git_explorer/REQ-21`, `plan-git_explorer/REQ-26`
- `plan-git_graph/REQ-3`, `plan-git_graph/REQ-4`, `plan-git_graph/REQ-8`, `plan-git_graph/REQ-10`, `plan-git_graph/REQ-11`, `plan-git_graph/REQ-12`, `plan-git_graph/REQ-13`, `plan-git_graph/REQ-17`, `plan-git_graph/REQ-18`, `plan-git_graph/REQ-19`
- `plan-multi_repo_workspace/REQ-22`, `plan-multi_repo_workspace/REQ-23`, `plan-multi_repo_workspace/REQ-24`, `plan-multi_repo_workspace/REQ-25`, `plan-multi_repo_workspace/REQ-27`, `plan-multi_repo_workspace/REQ-29`
