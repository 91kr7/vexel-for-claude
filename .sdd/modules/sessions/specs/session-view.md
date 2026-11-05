---
module: sessions
component: SessionView
type: UI component
---

# SessionView

**Purpose** → the terminal of the open session in the page.

## Contract

Description:
- a toolbar with the "Interrompi" button above an xterm.js terminal. The terminal fills the rest of the container.

Props:
- `sessionId` → the session to show.

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

## Requirements served

- `plan-claude_sessions_client/REQ-2`, `plan-claude_sessions_client/REQ-3`, `plan-claude_sessions_client/REQ-4`, `plan-claude_sessions_client/REQ-5`, `plan-claude_sessions_client/REQ-8`
