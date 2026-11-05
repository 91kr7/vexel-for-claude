---
module: sessions
component: Avatar
type: UI component
---

# Avatar

**Purpose** → the badge of a project: its initials on a coloured shape, or a terminal icon for an external session. Used in the session list; the header and the dialogs can reuse it.

## Contract

Props:
- `folder` → the project folder, full path.
- `state` → the session state. Optional.
- `external` → `true` for a session of another terminal. Optional.
- `size` → `list` (default), `header` or `dialog`.

Shows:
- one decorative element (`aria-hidden="true"`) with the class `avatar`, the class `avatar-<size>` and the class `avatar-<variant>`.
- the initials of the folder name (`initialsOf`), or the TerminalIcon for the `external` variant.

Variant (first matching rule wins):

| Condition | Variant | Look (board colour roles) |
|-----------|---------|---------------------------|
| `external` | `external` | transparent, 1 px `--outline` border, `--on-surface-variant` icon, full circle |
| `state` = `needs_input` | `attn` | `--attn` background, `--sc-lowest` text, square |
| `state` = `ended` | `ended` | `--sc-highest` background, `--on-surface-variant` text, round |
| any other | `primary` or `teal`, stable per `folder` | `primary` → `--primary-container` / `--on-primary-container`, round; `teal` → `--teal-container` / `--on-teal-container`, square |

Sizes, as the boards draw them:

| `size` | Side | Text | Round radius | Square radius | Terminal icon |
|--------|------|------|--------------|---------------|---------------|
| `list` | 40 px | `.label-l` | 20 px | 12 px | 20 px |
| `dialog` | 36 px | `.label-l` | 18 px | 12 px | 20 px |
| `header` | 48 px | `.title-m` | 16 px | 12 px | 24 px |

The `external` variant is always a full circle (half the side). Its 1 px border is added outside the side, as on the boards: it measures the side plus 2 px outside (42 px `list`, 38 px `dialog`, 50 px `header`).

Functions:
- `folderNameOf(folder) → string` → the last non-empty segment of the path (`/home/u/web-dashboard/` → `web-dashboard`). A path with no segment gives the path itself.
- `initialsOf(folder) → string` → from the folder name: words split on `-`, `_` and spaces, empty words dropped.
  - two or more words → the first letter of the first two words.
  - one word → its first two letters.
  - no word → empty text.
  - always upper case. Letters are whole characters, also outside ASCII.
  - examples: `web-dashboard` → `WD`, `infra_terraform` → `IT`, `docs site` → `DS`, `billing` → `BI`, `x` → `X`.
- `avatarVariantOf({ folder, state?, external? }) → 'external' | 'attn' | 'ended' | 'primary' | 'teal'` → the variant of the table.

## Rules and invariants

- The same folder always gets the same stable variant (`primary` or `teal`), across renders and page loads. Both variants occur.
- The avatar adds nothing to the accessible name of its container: the title next to it carries the name.

## Dependencies

- IconSet, ThemeTokens (module app)

## Requirements served

- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-19`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-24`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-28`
