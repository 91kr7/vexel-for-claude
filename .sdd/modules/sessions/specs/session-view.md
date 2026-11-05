---
module: sessions
component: SessionView
type: UI component
---

# SessionView

**Purpose** → the open hosted session in the main area, as board "Sessione ospitata": header, terminal panel and hint row.

## Contract

Description:
- one column with a 12 px gap that fills the main area: the SessionHeader with "Interrompi" and "Termina" (StopSessionButton), the rounded terminal panel with the xterm.js terminal inside, and the hint row.
- the panel and the hint row fill the whole area below the header. The panel takes all the height the hint row leaves.

Props:
- `sessionId` → the session to show.
  - a new `sessionId` → closes the connection of the previous session. The terminal is empty, then shows the snapshot of the new session, then its live output. It fits the panel and sends `resize`.
  - the terminal never shows output of the previous session after a switch.
- `onLeaveTerminal()` → called when the user presses Ctrl+Shift+L in the terminal.
- `session` → `{ folder, label, state }` of the session, optional. It goes to the SessionHeader, and its `state` and folder name to StopSessionButton. A change of `session` does not reconnect the terminal.
- `snackbar` → an element shown at the right of the hint row, optional (the NeedsInputSnackbar).

Shows:
- the terminal panel → `role="region"` named "Terminale di <folder name>" ("Terminale" without `session`). 28 px radius, `--term-bg` background, `--term-fg` text, padding 24 px 28 px. The terminal fills the box inside the padding.
- the terminal text in Roboto Mono, 14 px, rows about 22 px high. The font is loaded before the terminal opens and fits; if it fails to load, the terminal opens with the next font of `--font-mono`.
- the terminal background in `--term-bg` and its default text in `--term-fg`, of the active theme. A change of the system theme recolours the open terminal at once, with no reconnect. The colours that Claude Code writes stay as written.
- while the terminal has the keyboard focus, the panel shows the focus ring (`--color-focus-ring`) around its rounded edge.
- the hint row → 48 px high, padding 0 8 px, centred, 12 px gap, items at the two ends:
  - on the left, the hint (`.body-s`, `--on-surface-variant`, 8 px gap): the keys "Ctrl", "Maiusc", "L" as `kbd` (`.label-m`, padding 2 px 8 px, 6 px radius, `--sc-high` background, `--on-surface` text, the UI font), joined by "+", then "torna all'elenco". Always visible, never cut.
  - on the right, `snackbar` when given. It stays on one row; its text is cut with an ellipsis when the row is too narrow.
- a ProgressIndicator "Caricamento…" centred over the panel, from the start until the first frame (the snapshot) arrives or the connection closes. A click goes through it to the terminal.
- the session snapshot, then its live output, from AttachSessionRoute.
- `[Sessione disconnessa]` in the terminal when the connection closes.
- the connection closes, between the header and the panel → an ErrorMessage:
  - code `1000` (the session process ended) → no message. The header shows "Terminata".
  - code `4404` → "La sessione non esiste più."
  - any other code (e.g. the server stopped) → "Connessione alla sessione persa."
- "Interrompi" → the outlined board button (`.btn`, `.label-l`): transparent, 1 px `--outline` border, `--on-surface-variant` text, `CircleStopIcon` 20 px. It shows in every state except `ended`, `undefined` included.

Actions:
- every key typed in the terminal → sent to the pty as `input`, Esc included. Ctrl+Shift+L is the only exception.
- Ctrl+Shift+L in the terminal (no Alt, no Meta, either case of L) → `onLeaveTerminal()`. The terminal does not process it, nothing goes to the pty, and the browser default is prevented.
- "Interrompi" → sends Esc (`\x1b`) as `input`, then gives focus back to the terminal.
- the panel changes size → the terminal fits it and sends the new `resize`. It also sends a `resize` as soon as it connects.

## Rules and invariants

- Human decision (`plan-claude_sessions_client-ui_redesign/REQ-4`): one key combination moves the focus from the terminal to the sidebar, with an on-screen hint. Claude Code needs Tab, Shift+Tab and Esc, so the terminal keeps them.
- Why Ctrl+Shift+L: Claude Code does not use it (Ctrl+L, which it uses to redraw, stays free without Shift). Chromium and Firefox on Linux give it no default action. Ctrl+Shift+E would open the Firefox network monitor. "L" stands for the session list ("elenco").
- Gatekeeper decision G1: the hint row has a fixed height, so a snackbar that shows or hides never changes the panel size and never resizes the terminal.
- Removing the view closes its connection. The session keeps running.

## Dependencies

- AttachSessionRoute
- SessionHeader, StopSessionButton, Avatar (`folderNameOf`)
- ProgressIndicator, ErrorMessage, IconSet, ThemeTokens, WebEntry, BundledFont (module app)

## Requirements served

- `plan-claude_sessions_client/REQ-2`, `plan-claude_sessions_client/REQ-3`, `plan-claude_sessions_client/REQ-4`, `plan-claude_sessions_client/REQ-5`, `plan-claude_sessions_client/REQ-8`, `plan-claude_sessions_client/REQ-18`, `plan-claude_sessions_client/REQ-19`, `plan-claude_sessions_client/REQ-21`, `plan-claude_sessions_client/REQ-22`, `plan-claude_sessions_client/REQ-23`
- `plan-claude_sessions_client-ui_redesign/REQ-17`, `plan-claude_sessions_client-ui_redesign/REQ-18`, `plan-claude_sessions_client-ui_redesign/REQ-24`, `plan-claude_sessions_client-ui_redesign/REQ-29`, `plan-claude_sessions_client-ui_redesign/REQ-30`, `plan-claude_sessions_client-ui_redesign/REQ-4`, `plan-claude_sessions_client-ui_redesign/REQ-5`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-2`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-5`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-29`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-30`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-31`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-32`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-33`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-34`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-47`
