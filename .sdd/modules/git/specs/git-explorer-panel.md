---
module: git
component: GitExplorerPanel
type: UI component
---

# GitExplorerPanel

**Purpose** → the git explorer of a session: a panel at the right of the session content. Later batches fill it.

## Contract

Description:
- a region named "Git Explorer" (`section` with `aria-label`), on surface 1, with a 1 px `--border-subtle` left border. It takes 50 % of the width of the session content, at least 360 px. It fills the height between the session header and the footer.

Props:
- `lookup` → the state of useRepositoryLookup.

Shows:
- with `repository` → a 40 px header:
  - the name of the repository root folder (last segment of `root`), with the full `root` path as tooltip (`title`);
  - the branch chip (mono chip with the `git-branch` icon) → the branch name, or "detached <short hash>" on a detached HEAD.
- with `error` → the message in an ErrorMessage (announced as an alert).
- with `loading` or `none` → an empty region.

## Dependencies

- useRepositoryLookup
- ErrorMessage, IconSet (module app)

## Requirements served

- `plan-git_explorer/REQ-4`, `plan-git_explorer/REQ-6`, `plan-git_explorer/REQ-7`
