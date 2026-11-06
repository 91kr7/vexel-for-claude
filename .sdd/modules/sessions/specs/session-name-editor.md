---
module: sessions
component: SessionNameEditor
type: UI component
---

# SessionNameEditor

**Purpose** → the text field that edits the name of a session in place of the label of its list entry.

## Contract

Description:
- one line text field, as wide as the label it replaces, 11/16 px, `--bg-canvas`, 1 px `--accent-border` border, 4 px radius. An error shows under the field.

Props:
- `sessionId` → the hosted or external session id.
- `label` → the current label of the entry.
- `onEnd(end)` → the edit is over. `end` is `saved`, `cancelled` or `blurred`.

Shows:
- the field "Session Name" (accessible name), holding `label`, with the focus and all the text selected.
- it accepts at most 200 characters. Typing or pasting more stops at 200, with no message.
- after a failed request → ErrorMessage "Could not rename the session." under the field. The field stays open with the typed text.

Actions:
- Enter, text equal to `label` → no request, `onEnd("saved")`.
- Enter, other text → `PUT /api/sessions/:id/name` with `{ name: <text> }`, as typed.
  - `2xx` → `onEnd("saved")`.
  - any other answer, or a network error → the error above.
  - while the request runs, another Enter sends nothing.
- Esc → no request, `onEnd("cancelled")`.
- the field loses the focus (mouse, Tab) → no request, `onEnd("blurred")`.
- keys pressed during an input-method composition do nothing.

## Rules and invariants

- Only Enter saves. Esc and blur discard the typed text.
- The new label reaches the list through the `session` events, not through this component.

## Dependencies

- RenameSessionRoute
- ErrorMessage (module app)

## Requirements served

- `plan-session_list_improvements/REQ-31`, `plan-session_list_improvements/REQ-32`, `plan-session_list_improvements/REQ-33`, `plan-session_list_improvements/REQ-34`, `plan-session_list_improvements/REQ-39`
