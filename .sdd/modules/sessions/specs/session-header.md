---
module: sessions
component: SessionHeader
type: UI component
---

# SessionHeader

**Purpose** → the bar above the open session: its label, state and folder, with the actions for it.

## Contract

Description:
- one bar across the top of the open-session area. The session data is on the left, the actions are on the right.

Props:
- `session` → `{ folder, label, state }` of the open session. Optional.
- `actions` → the buttons of the session.
- `notice` → an extra mark shown after the state. Optional.

Shows:
- with `session` → the label as a heading (`h2`), then the StateBadge of `state`, then `notice`. Below them, the folder.
- without `session` → no label, state or folder. `notice` and `actions` still show.
- `actions` on the right, always.

## Rules and invariants

- A label or a folder too long for the bar is cut with an ellipsis. The full text is its tooltip (`title`).
- The actions are never cut or pushed out of the bar by a long label or folder.
- The header keeps its height. It never scrolls with the content below it.

## Dependencies

- StateBadge
- ThemeTokens (module app)

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-17`
- `plan-claude_sessions_client-ui_redesign/REQ-1`
