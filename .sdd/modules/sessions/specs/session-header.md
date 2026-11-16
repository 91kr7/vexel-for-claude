---
module: sessions
component: SessionHeader
type: UI component
---

# SessionHeader

**Purpose** → the 44 px header of the open session, as the session header of `.sdd/mockups/dark_blue_theme/mock.html`: folder name, a line pill, the leading actions, the state pill and the actions.

## Contract

Props:
- `session` → `{ folder, label, state }` of the open session. Optional.
- `actions` → the buttons of the session.
- `leadingActions` → items shown before the state pill. Optional.
- `notice` → extra chips shown after the state pill. Optional.
- `line` → the text of the line pill. Optional; default the label.

Shows:
- a `header`, 44 px high (its bottom line included) in every variant and theme, padding 0 × 16 px, on `--role-chrome`, 1 px `--role-border-subtle` line below. Two groups at the two ends, 12 px apart, on one row.
- the left group, 10 px gaps, with `session`:
  - the `h2` with the folder name (the last segment of `folder`), 13.5/18 px weight 600, letter spacing -0.015 em. Its tooltip (`title`) is the folder name.
  - the line pill with the line → a `.mono-chip` with mono 11/16 px, padding 2 × 10 px, `--text-secondary`, at most 420 px wide. Not shown when the text is empty.
- the right group, 8 px gaps, from left to right → `leadingActions`; with `session`, the StateBadge `chip`; then `notice`; then `actions`. Without `leadingActions` the group starts with the state pill.
- the line pill:
  - it is focusable with the keyboard (Tab).
  - hover or keyboard focus → a tooltip under the pill, over the content below, with the full text of the line. The tooltip is the pill's description (`role="tooltip"`, `aria-describedby`).
  - pointer away and focus elsewhere → no tooltip.
- without `session` → the left group is empty and there is no state pill. `leadingActions`, `notice` and `actions` still show.
- no path, no "/", no usage figures (they are in SessionFooter), no project avatar.

## Rules and invariants

- Name and line pill stay on one row each. Text too long ends with "…".
- The actions are never cut and never wrap. When the header is too narrow, the line pill shrinks first, then the folder name.
- From 700 px of main area, the header stays 44 px high on one row, and its items never overlap.
- The header never shrinks, and it never scrolls with the content below it.
- The tooltip of the line pill never changes the height of the header.
- The order on screen is the order in the markup, so Tab follows it. The state pill takes no focus.

## Dependencies

- StateBadge, Avatar (`folderNameOf`)
- ThemeTokens, WebEntry (module app)

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-17`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-11`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-30`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-31`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-53`
- `plan-session_list_width/REQ-15`, `plan-session_list_width/REQ-16`, `plan-session_list_width/REQ-17`, `plan-session_list_width/REQ-18`, `plan-session_list_width/REQ-30`, `plan-session_list_width/REQ-31`
- `plan-dark_blue_theme/REQ-1`, `plan-dark_blue_theme/REQ-2`, `plan-dark_blue_theme/REQ-25`
