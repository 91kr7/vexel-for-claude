---
module: git
component: GitExplorerPanel
type: UI component
---

# GitExplorerPanel

**Purpose** → the git explorer of a session: a panel at the right of the session content, with its covered repositories, the uncommitted changes and the history.

## Contract

Description:
- a region named "Git Explorer" (`section` with `aria-label`), on `--role-list`, with a 1 px `--role-border-subtle` left border. Repository entries and branch labels have `--radius-pill` corners; a hovered entry is on `--role-card`, a chosen one on `--role-card-active`. A focused repository entry or commit row shows the focus ring inside its own edge. It takes 50 % of the width of the session content, at least 360 px. It fills the height between the session header and the footer.

Props:
- `lookup` → the state of useRepositoryLookup.
- `folder` → optional, the project folder of the session; the repository filter is kept per folder (useRepositoryFilter).
- `onRefresh()` → optional. Called at each refresh, so the owner reads the repository again.
- `sessions` → optional, the session list of LiveSessionStore (module sessions), for the turn-end refresh. Without it, no turn-end refresh.

Shows:
- with one repository → a 40 px header:
  - the repository name, with the full `root` path as tooltip (`title`);
  - the branch chip (mono chip with the `git-branch` icon) → the branch name, or "detached <short hash>" on a detached HEAD;
  - at its right end, the icon button "Refresh" (`refresh-cw` icon, name and tooltip "Refresh").
- with one repository that has `error` → the header with the name and "Refresh", no chip; then the message in an ErrorMessage, and no tabs.
- with several repositories → a header at least 40 px high, with the RepositoryList (with the filter) and, at its right end, "Refresh". With one repository there is no list and no filter.
- with `repositories` and no error message, below the header → a tab list with the tabs "Changes" (selected at first) and "History". The selected tab has `aria-selected` and an accent underline; its tab panel fills the rest of the height. The other tab panel stays mounted but hidden, so it keeps its state.
- the shown repositories → the chosen ones of the filter, in list order; with no filter, every covered repository. Each keeps the colour of its position in the full list (repositoryColor). With several covered repositories the tabs keep the look of several (repository groups, row marks, "<name>: " before a history error), also when one only is chosen.
- tab "Changes" → the changes of the shown repositories, read when the panel mounts and at each refresh (useChanges on the shown roots and `revision`):
  - until each root has its first answer → a progress indicator "Loading…";
  - then → the ChangesTab with the shown repositories, their colours and their states (groups, empty note and errors are its own).
- tab "History" → the combined history of the shown repositories (useHistory on the shown roots and `revision`), whose first pages are read the first time the tab opens, not before, and again at each later refresh:
  - until each root has its first answer → a progress indicator "Loading…";
  - each repository whose history failed → its git message in an ErrorMessage, above the commits, in the order of the list. With several covered repositories the message starts with the repository name ("<name>: <message>"); with one, the message alone;
  - at least one repository read → the HistoryTab with the commits of the repositories read, and with every shown repository: its name, its colour (as in the header and the Changes tab) and the branch of the lookup ("No commits yet" when none has commits);
  - every shown repository failed → only the messages.
- with `error` → a header with only the "Refresh" button, then the message in an ErrorMessage (announced as an alert).
- with `loading` or `none` → an empty region.

Actions:
- click on a tab → shows its panel. Going back to a tab already opened reads nothing again.
- "Refresh" → a refresh: the changes of every shown root and, once the tab was opened, the first history page of every shown root are read again, and `onRefresh()` is called.
- a toggle of the filter in the RepositoryList, or "All repositories" → both tabs show the new shown repositories; a repository shown again is read again.
- a session of `sessions` ends a turn in a folder at or under a covered root, or above one (useTurnEndSignal on every covered root) → the same refresh, with no click.

During a refresh:
- each tab keeps what it shows until its new answer arrives, then shows the new content in one step. "Load more" reads "Loading…" and is disabled until the first history page answers.
- the open diff of "Changes" and the open commit of "History" follow the rules of ChangesTab and HistoryTab.

## Rules and invariants

- A git error shows only inside the panel; the rest of the page keeps working.
- Each mount reads the changes again: nothing is kept from a previous opening of the panel.
- No periodic read: the panel reads only on mount, "Refresh" and a turn end.

## Dependencies

- useRepositoryLookup, useRepositoryFilter, RepositoryList, repositoryColor, useChanges, ChangesTab, useHistory, HistoryTab, useTurnEndSignal
- ErrorMessage, ProgressIndicator, IconSet (module app)

## Requirements served

- `plan-git_explorer/REQ-4`, `plan-git_explorer/REQ-6`, `plan-git_explorer/REQ-7`, `plan-git_explorer/REQ-9`, `plan-git_explorer/REQ-13`, `plan-git_explorer/REQ-16`, `plan-git_explorer/REQ-23`, `plan-git_explorer/REQ-24`, `plan-git_explorer/REQ-26`, `plan-git_graph/REQ-12`
- `plan-multi_repo_workspace/REQ-7`, `plan-multi_repo_workspace/REQ-8`, `plan-multi_repo_workspace/REQ-11`, `plan-multi_repo_workspace/REQ-13`, `plan-multi_repo_workspace/REQ-14`, `plan-multi_repo_workspace/REQ-19`, `plan-multi_repo_workspace/REQ-20`, `plan-multi_repo_workspace/REQ-21`, `plan-multi_repo_workspace/REQ-22`, `plan-multi_repo_workspace/REQ-23`, `plan-multi_repo_workspace/REQ-26`, `plan-multi_repo_workspace/REQ-28`, `plan-multi_repo_workspace/REQ-29`, `plan-multi_repo_workspace/REQ-30`, `plan-multi_repo_workspace/REQ-31`
- `plan-dark_blue_theme/REQ-3`
