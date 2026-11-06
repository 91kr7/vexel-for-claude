---
module: sessions
component: SessionHeader
type: UI component
---

# SessionHeader

**Purpose** → the 40 px subbar of the open session, as "Session Info Subbar" of `.sdd/mockups/studio-dark/mock.html`: folder name, a line chip, the state pill and the actions.

## Contract

Props:
- `session` → `{ folder, label, state }` of the open session. Optional.
- `actions` → the buttons of the session.
- `notice` → extra chips shown after the state pill. Optional.
- `line` → the text of the line chip. Optional; default the label.

Shows:
- a `header`, 40 px high (its bottom line included) in every variant, padding 0 × 16 px, `--bg-surface-1`, 1 px `--border-subtle` line below. Two groups at the two ends, 8 px apart, on one row.
- the left group, 10 px gaps, with `session`:
  - the `h2` with the folder name (the last segment of `folder`), 12/16 px weight 600. Its tooltip (`title`) is the folder name.
  - the line chip with the line, in a `.mono-chip` on surface 2, in `--text-muted` (look of `#subbar-model`). Not shown when the text is empty.
- the right group, 8 px gaps → with `session`, the StateBadge `chip`; then `notice`; then `actions`.
- the line chip:
  - it is focusable with the keyboard (Tab).
  - hover or keyboard focus → a tooltip under the chip, over the content below, with the full text of the line. The tooltip is the chip's description (`role="tooltip"`, `aria-describedby`).
  - pointer away and focus elsewhere → no tooltip.
- without `session` → the left group is empty and there is no state pill. `notice` and `actions` still show.
- no path, no "/", no usage figures (they are in SessionFooter), no project avatar.

## Rules and invariants

- Name and line chip stay on one row each. Text too long ends with "…".
- The actions are never cut and never wrap. When the header is too narrow, the line chip shrinks first, then the folder name.
- From 700 px of main area, the header stays 40 px high on one row, and its items never overlap.
- The header never shrinks, and it never scrolls with the content below it.
- The tooltip of the line chip never changes the height of the header.

## Dependencies

- StateBadge, Avatar (`folderNameOf`)
- ThemeTokens, WebEntry (module app)

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-17`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-11`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-30`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-31`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-53`
- `plan-session_list_width/REQ-15`, `plan-session_list_width/REQ-16`, `plan-session_list_width/REQ-17`, `plan-session_list_width/REQ-18`
