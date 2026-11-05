---
module: sessions
component: StopSessionButton
type: UI component
---

# StopSessionButton

**Purpose** → the "Termina" button of the open session, with its confirmation.

## Contract

Props:
- `sessionId` → the session to stop.
- `state` → its current state, or `undefined` when the page does not know it yet.

Shows:
- `state` is `ended` → nothing. The button disappears also while the confirmation is open.
- any other `state`, `undefined` included → the button "Termina".

Actions:
- "Termina", `state` is `working` → opens a confirmation dialog "Terminare la sessione?" with the buttons "Annulla" (focused) and "Termina". No request yet.
  - "Annulla" → the dialog closes. No request.
  - "Termina" → the dialog closes and the stop request leaves.
- "Termina", any other `state` → the stop request leaves at once.
- stop request → `POST /api/sessions/:id/stop`, no body. A failed request has no visible effect.

## Dependencies

- StopSessionRoute

## Requirements served

- `plan-claude_sessions_client/REQ-23`, `plan-claude_sessions_client/REQ-24`
