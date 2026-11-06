---
module: app
component: AreaState
type: UI component
---

# AreaState

**Purpose** → the one block for an empty, loading or error state that fills an area. It copies `#orchestrator-empty-state` of `.sdd/mockups/studio-dark/mock.html`, without the serif font.

## Contract

Props:
- `kind` → `empty`, `loading` or `error`.
- `title` → the text of the state.
- `text` → optional second text.
- `icon` → optional icon of the tile. Default: SquareTerminalIcon (`empty`), the rotating Spinner (`loading`), CircleXIcon (`error`).
- `size` → `full` (default) or `compact`.
- `actions` → optional buttons under the texts.
- `className` → extra class.

Shows:
- a `.vx-surface-1` block, items centred in one column, text centred.
- role: `loading` → `status`, `error` → `alert`, `empty` → none. Its text is `title`, then `text` when given. The tile adds no text.
- the tile → decorative, `.vx-surface-2`, icon in `--accent-primary`; in `--rose-400` for `error`.
- `title`, then `text` (12/16 px, `--text-secondary`, at most 448 px wide, 4 px below the title), then `actions` (centred, 8 px apart, 16 px below, buttons padded 8 × 16 px).

| | `full` | `compact` |
|-|--------|-----------|
| block | 40 px padding, 12 px radius, at most 528 px wide, centred in its area by auto margins | 16 px padding, 8 px radius |
| tile | 48 px, 12 px radius, 24 px icon, 12 px below | 32 px, 8 px radius, 16 px icon, 8 px below |
| title | Roboto Flex 24/32 px, weight 400 | 12/16 px, weight 600 |

## Rules and invariants

- It sends nothing and holds no state.
- Inline errors (under a field, next to a button, in a tool card) do not use it: they stay ErrorMessage.

## Dependencies

- ProgressIndicator (`Spinner`), IconSet, ThemeTokens, WebEntry

## Requirements served

- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-50`
