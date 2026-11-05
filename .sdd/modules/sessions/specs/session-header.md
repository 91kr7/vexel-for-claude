---
module: sessions
component: SessionHeader
type: UI component
---

# SessionHeader

**Purpose** → the header of the open session, as the `header` of board "Sessione ospitata": avatar, folder name, state chip, a line of text, and the actions.

## Contract

Description:
- one row that wraps when it does not fit: 16 px gap, centred, padding 8 px 8 px 8 px 4 px, no background and no border. From left: the avatar, the text block, the actions.
- the text block takes the free width (flex basis 280 px). On top, the name row (10 px gap, it wraps); below it, the line.

Props:
- `session` → `{ folder, label, state }` of the open session. Optional.
- `actions` → the buttons of the session.
- `notice` → extra chips shown after the state chip. Optional.
- `external` → `true` gives the Avatar its outlined terminal form. Optional.
- `line` → the text of the line. Optional; default "<label> · <folder>".

Shows:
- with `session`:
  - the Avatar in its `header` size (48 px) for `folder`, `state` and `external`.
  - the `h2` with the folder name (the last segment of `folder`), in `.title-l`, no margin.
  - the StateBadge of `state` in its `chip` variant, then `notice`.
  - the line, in `.body-m` and `--on-surface-variant`.
- without `session` → no avatar, `h2`, chip or line. `notice` and `actions` still show.
- `actions` → in a row with an 8 px gap, after the text block. The row wraps when it does not fit.

## Rules and invariants

- The `h2` and the line stay on one row each. Text too long is cut with an ellipsis, and its full text is its tooltip (`title`).
- The actions are never cut: when the header is too narrow they move to the next row, inside the header.
- The header never shrinks, and it never scrolls with the content below it.

## Dependencies

- Avatar, StateBadge
- ThemeTokens, WebEntry (module app)

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-17`
- `plan-claude_sessions_client-ui_redesign/REQ-1`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-29`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-34`
