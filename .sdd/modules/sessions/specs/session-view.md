---
module: sessions
component: SessionView
type: UI component
---

# SessionView

**Purpose** → the open hosted session in the main area, as `#screen-session` of `.sdd/mockups/studio-dark/mock.html`: the subbar, the terminal panel and the hint row.

## Contract

Description:
- one column that fills the main area, on `--bg-canvas` at 75 % over the dot grid: the SessionHeader with "Interrupt" and "Terminate" (StopSessionButton), the terminal panel with the xterm.js terminal inside, and the hint row.
- the panel takes all the height the header and the hint row leave.

Props:
- `sessionId` → the session to show.
  - a new `sessionId` → closes the connection of the previous session. The terminal is empty, then shows the snapshot of the new session, then its live output. It fits the panel and sends `resize`.
  - the terminal never shows output of the previous session after a switch.
- `onLeaveTerminal()` → called when the user presses Ctrl+Shift+L in the terminal.
- `session` → `{ folder, label, state }` of the session, optional. It goes to the SessionHeader, and its `state` and folder name to StopSessionButton. A change of `session` does not reconnect the terminal.

Shows:
- the terminal panel → `role="region"` named "Terminal: <folder name>" ("Terminal" without `session`). 16 px from the left, right and top, 8 px radius, 1 px `--border-subtle` border, `--term-bg` background, padding 12 px. The terminal fills the box inside the padding.
- the terminal → Roboto Mono 12 px, line height 1.2. Background `--term-bg`, default text `--term-fg`, cursor `--term-cursor`, selection `--term-selection`. These tokens have the same dark values in both themes, so the panel stays dark in the light theme. The font is loaded before the terminal opens and fits; if it fails to load, the terminal opens with the next font of `--font-mono`. The ANSI colours that Claude Code writes stay as written.
- while the terminal has the keyboard focus, the panel shows the focus ring (`--color-focus-ring`) around its rounded edge.
- the hint row → 40 px high, padding 0 × 16 px, centred: the keys "Ctrl", "Shift", "L" as `.kbd-badge`, joined by "+", then "back to the list", 11 px in `--text-muted`, 6 px gaps. Always visible, never cut.
- a ProgressIndicator "Loading…" centred over the panel, on surface 2 with an 8 px radius, from the start until the first frame (the snapshot) arrives or the connection closes. A click goes through it to the terminal.
- the session snapshot, then its live output, from AttachSessionRoute.
- `[Session disconnected]` in the terminal when the connection closes.
- the connection closes, between the header and the panel → an ErrorMessage on surface 1:
  - code `1000` (the session process ended) → no message. The header shows "Ended".
  - code `4404` → "The session no longer exists."
  - any other code (e.g. the server stopped) → "Connection to the session lost."
- "Interrupt" → `.button-danger` (rose, look of `#subbar-stop-btn`) with the decorative glyph "■" before the text. Its accessible name is "Interrupt". It shows in every state except `ended`, `undefined` included.

Actions:
- every key typed in the terminal → sent to the pty as `input`, Esc included. Ctrl+Shift+L is the only exception.
- Ctrl+Shift+L in the terminal (no Alt, no Meta, either case of L) → `onLeaveTerminal()`. The terminal does not process it, nothing goes to the pty, and the browser default is prevented.
- "Interrupt" → sends Esc (`\x1b`) as `input`, then gives focus back to the terminal.
- the panel changes size → the terminal fits it and sends the new `resize`. It also sends a `resize` as soon as it connects.

## Rules and invariants

- Human decision (`plan-claude_sessions_client-ui_redesign/REQ-4`): one key combination moves the focus from the terminal to the sidebar, with an on-screen hint. Claude Code needs Tab, Shift+Tab and Esc, so the terminal keeps them.
- Why Ctrl+Shift+L: Claude Code does not use it (Ctrl+L, which it uses to redraw, stays free without Shift). Chromium and Firefox on Linux give it no default action. Ctrl+Shift+E would open the Firefox network monitor. "L" stands for the session list.
- The hint row has a fixed height. The snackbar is fixed to the window (AppLayout), so it never changes the panel size and never resizes the terminal.
- The view does not read the system theme.
- Removing the view closes its connection. The session keeps running.

## Dependencies

- AttachSessionRoute
- SessionHeader, StopSessionButton, Avatar (`folderNameOf`)
- ProgressIndicator, ErrorMessage, ThemeTokens, WebEntry, BundledFont (module app)

## Requirements served

- `plan-claude_sessions_client/REQ-2`, `plan-claude_sessions_client/REQ-3`, `plan-claude_sessions_client/REQ-4`, `plan-claude_sessions_client/REQ-5`, `plan-claude_sessions_client/REQ-8`, `plan-claude_sessions_client/REQ-18`, `plan-claude_sessions_client/REQ-19`, `plan-claude_sessions_client/REQ-21`, `plan-claude_sessions_client/REQ-22`, `plan-claude_sessions_client/REQ-23`
- `plan-claude_sessions_client-ui_redesign/REQ-4`, `plan-claude_sessions_client-ui_redesign/REQ-17`, `plan-claude_sessions_client-ui_redesign/REQ-18`, `plan-claude_sessions_client-ui_redesign/REQ-24`, `plan-claude_sessions_client-ui_redesign/REQ-29`, `plan-claude_sessions_client-ui_redesign/REQ-30`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-7`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-11`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-22`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-32`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-34`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-35`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-42`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-5`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-9`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-14`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-15`
- `plan-light_theme/REQ-12`
