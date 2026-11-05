---
module: sessions
component: SessionView
type: UI component
---

# SessionView

**Purpose** → the terminal of the open session in the page.

## Contract

Description:
- a SessionHeader with the actions "Interrompi" and "Termina" (StopSessionButton), above an xterm.js terminal. The terminal fills the whole area below the header.

Props:
- `sessionId` → the session to show.
  - a new `sessionId` → closes the connection of the previous session. The terminal is empty, then shows the snapshot of the new session, then its live output. It fits the container and sends `resize`.
  - the terminal never shows output of the previous session after a switch.
- `session` → `{ folder, label, state }` of the session, optional. It goes to the SessionHeader, and its `state` to StopSessionButton. A change of `session` does not reconnect the terminal.

Shows:
- the session snapshot, then its live output, from AttachSessionRoute.
- `[Sessione disconnessa]` in the terminal when the connection closes.

Actions:
- every key typed in the terminal → sent to the pty as `input`, Esc included.
- "Interrompi" → sends Esc (`\x1b`) as `input`, then gives focus back to the terminal.
- the container changes size → the terminal fits it and sends the new `resize`. It also sends a `resize` as soon as it connects.

## Rules and invariants

- Removing the view closes its connection. The session keeps running.

## Dependencies

- AttachSessionRoute
- SessionHeader, StopSessionButton

## Requirements served

- `plan-claude_sessions_client/REQ-2`, `plan-claude_sessions_client/REQ-3`, `plan-claude_sessions_client/REQ-4`, `plan-claude_sessions_client/REQ-5`, `plan-claude_sessions_client/REQ-8`, `plan-claude_sessions_client/REQ-18`, `plan-claude_sessions_client/REQ-19`, `plan-claude_sessions_client/REQ-21`, `plan-claude_sessions_client/REQ-22`, `plan-claude_sessions_client/REQ-23`
- `plan-claude_sessions_client-ui_redesign/REQ-17`, `plan-claude_sessions_client-ui_redesign/REQ-18`, `plan-claude_sessions_client-ui_redesign/REQ-24`
