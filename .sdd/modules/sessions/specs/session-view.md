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
- `onLeaveTerminal()` → called when the user presses Ctrl+Shift+L in the terminal.
- `session` → `{ folder, label, state }` of the session, optional. It goes to the SessionHeader, and its `state` to StopSessionButton. A change of `session` does not reconnect the terminal.

Shows:
- in the header, next to the state, the hint "Ctrl+Maiusc+L torna all'elenco", always visible, in `--color-text-muted` with the keys in `--color-text`.
- a ProgressIndicator "Caricamento…" over the terminal, from the start until the first frame (the snapshot) arrives or the connection closes. A click goes through it to the terminal.
- the session snapshot, then its live output, from AttachSessionRoute.
- while the terminal has the keyboard focus, its area shows the focus ring (`--color-focus-ring`).
- `[Sessione disconnessa]` in the terminal when the connection closes.
- the connection closes, between the header and the terminal → an ErrorMessage:
  - code `1000` (the session process ended) → no message. The header shows "Terminata".
  - code `4404` → "La sessione non esiste più."
  - any other code (e.g. the server stopped) → "Connessione alla sessione persa."

Actions:
- every key typed in the terminal → sent to the pty as `input`, Esc included. Ctrl+Shift+L is the only exception.
- Ctrl+Shift+L in the terminal (no Alt, no Meta, either case of L) → `onLeaveTerminal()`. The terminal does not process it, nothing goes to the pty, and the browser default is prevented.
- "Interrompi" → sends Esc (`\x1b`) as `input`, then gives focus back to the terminal.
- the container changes size → the terminal fits it and sends the new `resize`. It also sends a `resize` as soon as it connects.

## Rules and invariants

- Human decision (`plan-claude_sessions_client-ui_redesign/REQ-4`): one key combination moves the focus from the terminal to the sidebar, with an on-screen hint. Claude Code needs Tab, Shift+Tab and Esc, so the terminal keeps them.
- Why Ctrl+Shift+L: Claude Code does not use it (Ctrl+L, which it uses to redraw, stays free without Shift). Chromium and Firefox on Linux give it no default action. Ctrl+Shift+E would open the Firefox network monitor. "L" stands for the session list ("elenco").
- Removing the view closes its connection. The session keeps running.

## Dependencies

- AttachSessionRoute
- SessionHeader, StopSessionButton
- ProgressIndicator, ErrorMessage (module app)

## Requirements served

- `plan-claude_sessions_client/REQ-2`, `plan-claude_sessions_client/REQ-3`, `plan-claude_sessions_client/REQ-4`, `plan-claude_sessions_client/REQ-5`, `plan-claude_sessions_client/REQ-8`, `plan-claude_sessions_client/REQ-18`, `plan-claude_sessions_client/REQ-19`, `plan-claude_sessions_client/REQ-21`, `plan-claude_sessions_client/REQ-22`, `plan-claude_sessions_client/REQ-23`
- `plan-claude_sessions_client-ui_redesign/REQ-17`, `plan-claude_sessions_client-ui_redesign/REQ-18`, `plan-claude_sessions_client-ui_redesign/REQ-24`, `plan-claude_sessions_client-ui_redesign/REQ-29`, `plan-claude_sessions_client-ui_redesign/REQ-30`, `plan-claude_sessions_client-ui_redesign/REQ-4`, `plan-claude_sessions_client-ui_redesign/REQ-5`
