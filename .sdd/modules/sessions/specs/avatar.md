---
module: sessions
component: Avatar
type: UI component
---

# Avatar

**Purpose** → the project badge of the dialog rows: the folder initials in the neutral square of the mock's user message (`selectSession()` in `.sdd/mockups/studio-dark/mock.html`). Also the folder-name helpers.

## Contract

Props:
- `folder` → the project folder, full path.

Shows:
- one decorative element (`aria-hidden="true"`) with the class `avatar`: a 24 px square, 6 px radius, `--bg-surface-3`, 1 px `--border-strong` border, the initials (`initialsOf`) in mono 11 px weight 500, `--text-primary`. The same look for every folder.

Functions:
- `folderNameOf(folder) → string` → the last non-empty segment of the path (`/home/u/web-dashboard/` → `web-dashboard`). A path with no segment gives the path itself.
- `initialsOf(folder) → string` → from the folder name: words split on `-`, `_` and spaces, empty words dropped.
  - two or more words → the first letter of the first two words.
  - one word → its first two letters.
  - no word → empty text.
  - always upper case. Letters are whole characters, also outside ASCII.
  - examples: `web-dashboard` → `WD`, `infra_terraform` → `IT`, `docs site` → `DS`, `billing` → `BI`, `x` → `X`.

## Rules and invariants

- No colour or shape per project or state.
- The avatar adds nothing to the accessible name of its container.

## Dependencies

- ThemeTokens (module app)

## Requirements served

- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-4`
