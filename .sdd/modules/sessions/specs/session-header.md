---
module: sessions
component: SessionHeader
type: UI component
---

# SessionHeader

**Purpose** → the 40 px subbar of the open session, as "Session Info Subbar" of `.sdd/mockups/studio-dark/mock.html`: folder name, "/", path, a line chip, the state pill and the actions.

## Contract

Props:
- `session` → `{ folder, label, state }` of the open session. Optional.
- `actions` → the buttons of the session.
- `notice` → extra chips shown after the state pill. Optional.
- `line` → the text of the line chip. Optional; default the label.

Shows:
- a `header`, 40 px high (its bottom line included) in every variant, padding 0 × 16 px, `--bg-surface-1`, 1 px `--border-subtle` line below. Two groups at the two ends, 8 px apart, on one row.
- the left group, 10 px gaps, with `session`:
  - the `h2` with the folder name (the last segment of `folder`), 12/16 px weight 600.
  - "/" in `--text-muted`, hidden from assistive technology.
  - the full folder path, mono 11 px, `--text-secondary`.
  - the line in a `.mono-chip` on surface 2, in `--text-muted` (look of `#subbar-model`). Not shown when the text is empty.
- the right group, 8 px gaps → with `session`, the StateBadge `chip`; then `notice`; then `actions`.
- without `session` → the left group is empty and there is no state pill. `notice` and `actions` still show.
- no project avatar.

## Rules and invariants

- Name, path and line stay on one row each. Text too long is cut with an ellipsis, and its full text is its tooltip (`title`).
- The actions are never cut and never wrap: when the header is too narrow, the name, path and line of the left group shrink first.
- The header never shrinks, and it never scrolls with the content below it.

## Dependencies

- StateBadge, Avatar (`folderNameOf`)
- ThemeTokens, WebEntry (module app)

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-17`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-11`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-30`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-31`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-53`
