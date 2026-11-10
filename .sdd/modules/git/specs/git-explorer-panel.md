---
module: git
component: GitExplorerPanel
type: UI component
---

# GitExplorerPanel

**Purpose** → the git explorer of a session: a panel at the right of the session content, with the uncommitted changes of the repository.

## Contract

Description:
- a region named "Git Explorer" (`section` with `aria-label`), on surface 1, with a 1 px `--border-subtle` left border. It takes 50 % of the width of the session content, at least 360 px. It fills the height between the session header and the footer.

Props:
- `lookup` → the state of useRepositoryLookup.

Shows:
- with `repository` → a 40 px header:
  - the name of the repository root folder (last segment of `root`), with the full `root` path as tooltip (`title`);
  - the branch chip (mono chip with the `git-branch` icon) → the branch name, or "detached <short hash>" on a detached HEAD.
- with `repository`, below the header → the changes of the whole repository, read once when the panel mounts (useChanges on `root`):
  - while loading → a progress indicator "Loading…";
  - no changes → "No uncommitted changes";
  - changes → the ChangesTab;
  - a git error → its message in an ErrorMessage.
- with `error` → the message in an ErrorMessage (announced as an alert).
- with `loading` or `none` → an empty region.

## Dependencies

- useRepositoryLookup, useChanges, ChangesTab
- ErrorMessage, ProgressIndicator, IconSet (module app)

## Requirements served

- `plan-git_explorer/REQ-4`, `plan-git_explorer/REQ-6`, `plan-git_explorer/REQ-7`, `plan-git_explorer/REQ-9`, `plan-git_explorer/REQ-13`
