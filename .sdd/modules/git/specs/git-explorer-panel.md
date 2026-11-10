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

Shows:
- with `repository` → a 40 px header:
  - the name of the repository root folder (last segment of `root`), with the full `root` path as tooltip (`title`);
  - the branch chip (mono chip with the `git-branch` icon) → the branch name, or "detached <short hash>" on a detached HEAD.
- with `repository`, below the header → a tab list with the tabs "Changes" (selected at first) and "History". The selected tab has `aria-selected` and an accent underline; its tab panel fills the rest of the height. The other tab panel stays mounted but hidden, so it keeps its state.
- tab "Changes" → the changes of the whole repository, read once when the panel mounts (useChanges on `root`):
  - while loading → a progress indicator "Loading…";
  - no changes → "No uncommitted changes";
  - changes → the ChangesTab;
  - a git error → its message in an ErrorMessage.
- tab "History" → the history of the repository (useHistory on `root`), whose first page is read the first time the tab opens, not before:
  - while loading → a progress indicator "Loading…";
  - loaded → the HistoryTab ("No commits yet" for a repository with no commits);
  - a git error → its message in an ErrorMessage.
- with `error` → the message in an ErrorMessage (announced as an alert).
- with `loading` or `none` → an empty region.

Actions:
- click on a tab → shows its panel. Going back to a tab already opened reads nothing again.

## Rules and invariants

- A git error shows only inside the panel; the rest of the page keeps working.

## Dependencies

- useRepositoryLookup, useChanges, ChangesTab, useHistory, HistoryTab
- ErrorMessage, ProgressIndicator, IconSet (module app)

## Requirements served

- `plan-git_explorer/REQ-4`, `plan-git_explorer/REQ-6`, `plan-git_explorer/REQ-7`, `plan-git_explorer/REQ-9`, `plan-git_explorer/REQ-13`, `plan-git_explorer/REQ-16`
