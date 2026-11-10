---
module: git
component: GitExplorerButton
type: UI component
---

# GitExplorerButton

**Purpose** → the session header icon button that opens and closes the git explorer panel.

## Contract

Props:
- `lookup` → the state of useRepositoryLookup.
- `open` → whether the panel is open.
- `onToggle()` → called on each click.

Shows:
- nothing while `lookup` is `loading` or `none`.
- with `repository` or `error` → a 26 px icon button with the `git-branch` icon, as "Search" of the header: accessible name "Git Explorer", tooltip "Git Explorer", the global focus ring on keyboard focus.
- `aria-expanded` follows `open`. While open, the button has the surface 3 background and the accent colour.

Actions:
- click → `onToggle()`.

## Rules and invariants

- With `error` the button stays, so the panel can show the git message (`plan-git_explorer/REQ-6`).

## Dependencies

- useRepositoryLookup
- IconSet (module app)

## Requirements served

- `plan-git_explorer/REQ-1`, `plan-git_explorer/REQ-2`, `plan-git_explorer/REQ-3`
