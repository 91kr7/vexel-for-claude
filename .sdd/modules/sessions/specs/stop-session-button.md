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
- "Termina", `state` is `working` → opens a WarningDialog "Terminare la sessione?" with the text "La sessione è in lavorazione. Il lavoro in corso si interrompe.", the buttons "Annulla" (focused) and "Termina" (primary action). No request yet.
  - "Annulla" or Esc → the dialog closes. No request.
  - "Termina" → the dialog closes and the stop request leaves.
- "Termina", any other `state` → the stop request leaves at once.
- stop request → `POST /api/sessions/:id/stop`, no body. A failed request has no visible effect.

## Dependencies

- StopSessionRoute
- WarningDialog (module app)

## Requirements served

- `plan-claude_sessions_client/REQ-23`, `plan-claude_sessions_client/REQ-24`
- `plan-claude_sessions_client-ui_redesign/REQ-25`, `plan-claude_sessions_client-ui_redesign/REQ-26`, `plan-claude_sessions_client-ui_redesign/REQ-27`, `plan-claude_sessions_client-ui_redesign/REQ-28`
