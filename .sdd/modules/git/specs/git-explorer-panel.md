---
module: git
component: GitExplorerPanel
type: UI component
---

# GitExplorerPanel

**Purpose** → the git explorer of a session: a panel at the right of the session content, with the uncommitted changes and the history of the repository.

## Contract

Description:
- a region named "Git Explorer" (`section` with `aria-label`), on surface 1, with a 1 px `--border-subtle` left border. It takes 50 % of the width of the session content, at least 360 px. It fills the height between the session header and the footer.

Props:
- `lookup` → the state of useRepositoryLookup.
- `onRefresh()` → optional. Called at each refresh, so the owner reads the repository again.
- `sessions` → optional, the session list of LiveSessionStore (module sessions), for the turn-end refresh. Without it, no turn-end refresh.

Shows:
- with `repository` → a 40 px header:
  - the name of the repository root folder (last segment of `root`), with the full `root` path as tooltip (`title`);
  - the branch chip (mono chip with the `git-branch` icon) → the branch name, or "detached <short hash>" on a detached HEAD;
  - at its right end, the icon button "Refresh" (`refresh-cw` icon, name and tooltip "Refresh").
- with `repository`, below the header → a tab list with the tabs "Changes" (selected at first) and "History". The selected tab has `aria-selected` and an accent underline; its tab panel fills the rest of the height. The other tab panel stays mounted but hidden, so it keeps its state.
- tab "Changes" → the changes of the whole repository, read when the panel mounts and at each refresh (useChanges on `root` and `revision`):
  - while loading → a progress indicator "Loading…";
  - no changes → "No uncommitted changes";
  - changes → the ChangesTab;
  - a git error → its message in an ErrorMessage.
- tab "History" → the history of the repository (useHistory on `root` and `revision`), whose first page is read the first time the tab opens, not before, and again at each later refresh:
  - while loading → a progress indicator "Loading…";
  - loaded → the HistoryTab ("No commits yet" for a repository with no commits);
  - a git error → its message in an ErrorMessage.
- with `error` → a header with only the "Refresh" button, then the message in an ErrorMessage (announced as an alert).
- with `loading` or `none` → an empty region.

Actions:
- click on a tab → shows its panel. Going back to a tab already opened reads nothing again.
- "Refresh" → a refresh: the changes and, once the tab was opened, the first history page are read again, and `onRefresh()` is called.
- a session of `sessions` in the repository ends a turn (useTurnEndSignal on `root`) → the same refresh, with no click.

During a refresh:
- each tab keeps what it shows until its new answer arrives, then shows the new content in one step. "Load more" reads "Loading…" and is disabled until the first history page answers.
- the open diff of "Changes" and the open commit of "History" follow the rules of ChangesTab and HistoryTab.

## Rules and invariants

- A git error shows only inside the panel; the rest of the page keeps working.
- Each mount reads the changes again: nothing is kept from a previous opening of the panel.
- No periodic read: the panel reads only on mount, "Refresh" and a turn end.

## Dependencies

- useRepositoryLookup, useChanges, ChangesTab, useHistory, HistoryTab, useTurnEndSignal
- ErrorMessage, ProgressIndicator, IconSet (module app)

## Requirements served

- `plan-git_explorer/REQ-4`, `plan-git_explorer/REQ-6`, `plan-git_explorer/REQ-7`, `plan-git_explorer/REQ-9`, `plan-git_explorer/REQ-13`, `plan-git_explorer/REQ-16`, `plan-git_explorer/REQ-23`, `plan-git_explorer/REQ-24`, `plan-git_explorer/REQ-25`, `plan-git_explorer/REQ-26`
