---
module: sessions
component: SessionView
type: UI component
---

# SessionView

**Purpose** → the open hosted session in the main area, as `#screen-session` of `.sdd/mockups/studio-dark/mock.html`: the subbar, the terminal panel and the footer.

## Contract

Description:
- one column that fills the main area, on `--bg-canvas` at 75 % over the dot grid: the SessionHeader with, from left to right in its right group, "Search" (as `leadingActions`), the state pill, "Interrupt" and "Terminate" (StopSessionButton), the terminal panel with the xterm.js terminal inside, and the SessionFooter.
- the panel takes all the height the header and the footer leave.

Props:
- `sessionId` → the session to show.
  - a new `sessionId` → closes the connection of the previous session. The terminal is empty, then shows the snapshot of the new session, then its live output. It fits the panel and sends `resize`.
  - the terminal never shows output of the previous session after a switch.
  - a new `sessionId` closes the search box, with its text and its count.
- `onLeaveTerminal()` → called when the user presses Ctrl+Shift+L in the terminal.
- `session` → `{ folder, label, state, usage? }` of the session, optional. It goes to the SessionHeader and the SessionFooter, and its `state` and folder name to StopSessionButton. A change of `session` does not reconnect the terminal.

Shows:
- the terminal panel → `role="region"` named "Terminal: <folder name>" ("Terminal" without `session`). 16 px from the left, right and top, 8 px radius, 1 px `--border-subtle` border, `--term-bg` background, padding 12 px. The terminal fills the box inside the padding.
- the terminal → Roboto Mono at the size of TerminalFontSizeStore (12 px by default), line height 1.2. Background `--term-bg`, default text `--term-fg`, cursor `--term-cursor`, selection `--term-selection`. These tokens have the same dark values in both themes, so the panel stays dark in the light theme. The font is loaded before the terminal opens and fits; if it fails to load, the terminal opens with the next font of `--font-mono`. The ANSI colours that Claude Code writes stay as written.
- while the terminal or the search box has the keyboard focus, the panel shows the focus ring (`--color-focus-ring`) around its rounded edge.
- the SessionFooter with `session` (path and figures). Its end holds the TerminalZoomControls, at the right end.
- no on-screen hint for Ctrl+Shift+L (human decision, 2026-11-07).
- a ProgressIndicator "Loading…" centred over the panel, on surface 2 with an 8 px radius, from the start until the first frame (the snapshot) arrives or the connection closes. A click goes through it to the terminal.
- the session snapshot, then its live output, from AttachSessionRoute.
- `[Session disconnected]` in the terminal when the connection closes.
- links in the terminal → the web addresses of WebAddressLinks and the terminal hyperlinks (OSC 8) with an `http` or `https` address. An OSC 8 hyperlink with another scheme is not a link.
  - pointer over a link → the link is underlined in its own text colour and the pointer is a hand.
  - pointer over a hyperlink whose visible text on that row differs from its address → a tooltip (`role="tooltip"`) 12 px right of and below the pointer shows the full address, kept 12 px inside the window's left and right edges. Mono 11 px, `--text-primary` on `--bg-surface-3` with a `--border-strong` border, at most 480 px wide, long addresses break. It does not take the pointer. It hides when the pointer leaves the link and when the session changes.
- the connection closes, between the header and the panel → an ErrorMessage on surface 1:
  - code `1000` (the session process ended) → no message. The header shows "Ended".
  - code `4404` → "The session no longer exists."
  - any other code (e.g. the server stopped) → "Connection to the session lost."
- "Search" → an icon button (search icon, 26 px, `--text-secondary`) with the accessible name "Search" and the tooltip "Search (Ctrl+Shift+F)". It shows in every state, `ended` included, before the state pill. Tab goes from "Search" to "Interrupt", then to "Terminate".
- the TerminalSearchBox at the top right of the panel, while the search is open. Its count follows the search, also while new output arrives.
- the search matches → every match on a `--term-match-bg` background. The current match has a 1 px `--term-match-current-border` outline over the selection colour, so it looks different from the others.
- the TerminalZoomControls → at the right end of the footer, in every state, `ended` included. They show the size of TerminalFontSizeStore.
- while files are dragged over the panel, in the desktop app (useDesktopBridge gives a path lookup) and the session is not `ended` (`undefined` included) → the panel shows that it accepts the drop: the `drop-target` class, a 2 px dashed `--accent-primary` outline and an `--accent-primary` border. It goes when the drag leaves the panel or the files are dropped. In the browser client and on an ended session the panel never shows it.
- after a drop on the panel in the browser client (no path lookup) → the message "Paths can be dropped only in the desktop app." (`role="status"`) at the bottom centre of the panel, for 4 seconds; a new drop starts the 4 seconds again. It does not take the pointer.
- "Interrupt" → `.button-interrupt` (orange) with the decorative CirclePauseIcon before the text. Its accessible name is "Interrupt" and it has no tooltip. It shows in every state except `ended`, `undefined` included. "Terminate" keeps its rose look.

Actions:
- every key typed in the terminal → sent to the pty as `input`, Esc included. Ctrl+Shift+L, Ctrl+Shift+F and the zoom keys are the only exceptions.
- Ctrl+click on a link → LinkOpener `openLink` with the full address (a wrapped address included). The session stays on screen.
- a plain click on a link (no Ctrl) → opens nothing; focus and text selection work as on any other text.
- Ctrl+Shift+L in the terminal (no Alt, no Meta, either case of L) → `onLeaveTerminal()`. The terminal does not process it, nothing goes to the pty, and the browser default is prevented.
- Ctrl+Shift+F in the terminal (no Alt, no Meta, either case of F) → opens the search box and focuses its field. Nothing goes to the pty and the browser default is prevented. Outside the terminal the key does nothing here.
- the zoom keys in the terminal → Ctrl, without Alt or Meta, with a key that produces `=` or `+` → `larger()`, `-` → `smaller()`, `0` → `reset()` of TerminalFontSizeStore. Shift does not matter: the produced character decides (on an Italian keyboard Ctrl+Shift+0 produces `=`). Nothing goes to the pty and the browser default (page zoom) is prevented. Outside the terminal these keys do nothing here.
  - Ctrl+Shift+- produces `_` (undo) → not a zoom key: it goes to the pty as today.
- "Smaller text", the default size button and "Larger text" of the TerminalZoomControls → `smaller()`, `reset()` and `larger()` of TerminalFontSizeStore.
- a change of the TerminalFontSizeStore size → the terminal shows its text at the new size and fits the panel again. A new number of rows or columns goes to the pty as `resize`. This also holds for the terminal of an ended session.
- "Search" → opens the search box and focuses its field.
- opening the search while it is open → focuses the field and selects its text.
- a change of the search text → searches the whole terminal buffer, scrollback included. Plain text, case ignored.
  - empty text → no highlight, no selection, empty count.
  - otherwise → all matches highlighted. The current match is the first one from the current match (or the buffer start), going down and wrapping. The terminal scrolls to it when it is off screen. The count shows its position and the total, or "No results".
- Enter or "Next match" → the next match becomes current; after the last one comes the first. Shift+Enter or "Previous match" → the previous one; before the first comes the last. Each one scrolls to it and updates the count. With empty text they do nothing.
- Esc in the box or "Close search" → the box closes, the highlights and the selection go, the text is cleared, and the terminal gets the focus.
- the search also works on the terminal of an ended session.
- drop of files on the panel (a drag whose data types include `Files`) → the page default is prevented (the file never opens). Then:
  - desktop app, session not `ended` → the absolute path of each file and folder, in drop order, from the path lookup; files with an empty path are left out. With at least one path → the text of droppedPathsText goes to the terminal as a paste: wrapped in bracketed paste marks when Claude Code turned bracketed paste mode on, plain otherwise, then sent to the pty as `input`. No Enter is added. The terminal gets the focus.
  - desktop app, session `ended` → nothing is inserted and nothing goes to the pty.
  - browser client → nothing is inserted and nothing goes to the pty; the message above shows.
- a drag that carries no files (e.g. text) → the panel does not change it: no drop state, no message.
- "Interrupt" → sends Esc (`\x1b`) as `input`, then gives focus back to the terminal.
- the panel changes size → the terminal fits it and sends the new `resize`. It also sends a `resize` as soon as it connects.

## Rules and invariants

- Human decision (`plan-claude_sessions_client-ui_redesign/REQ-4`): one key combination moves the focus from the terminal to the sidebar. Its on-screen hint was removed by human decision (2026-11-07). Claude Code needs Tab, Shift+Tab and Esc, so the terminal keeps them.
- No key typed in the search box goes to the pty.
- Why Ctrl+Shift+L: Claude Code does not use it (Ctrl+L, which it uses to redraw, stays free without Shift). Chromium and Firefox on Linux give it no default action. Ctrl+Shift+E would open the Firefox network monitor. "L" stands for the session list.
- The footer has a fixed height of 40 px, the height of the former hint row, so the terminal keeps its number of rows. The snackbar is fixed to the window (AppLayout), so it never changes the panel size and never resizes the terminal.
- The view does not read the system theme.
- One size for all terminals: the terminal opens at the current size of TerminalFontSizeStore. The zoom changes only the terminal text: the subbar, the footer and the rest of the page keep their size.
- Removing the view closes its connection. The session keeps running.
- A browser never gives a page the absolute path of a dropped file, and Electron 45 gives it only through the preload (DesktopBridge `getPathForFile`). So the drop inserts paths only in the desktop app.

## Dependencies

- AttachSessionRoute
- WebAddressLinks, LinkOpener, TerminalSearchBox, TerminalFontSizeStore, TerminalZoomControls, droppedPathsText
- useDesktopBridge `desktopFilePathLookup` (module app)
- `@xterm/addon-search`
- SessionHeader, SessionFooter, StopSessionButton, Avatar (`folderNameOf`)
- ProgressIndicator, ErrorMessage, IconSet, ThemeTokens, WebEntry, BundledFont (module app)

## Requirements served

- `plan-claude_sessions_client/REQ-2`, `plan-claude_sessions_client/REQ-3`, `plan-claude_sessions_client/REQ-4`, `plan-claude_sessions_client/REQ-5`, `plan-claude_sessions_client/REQ-8`, `plan-claude_sessions_client/REQ-18`, `plan-claude_sessions_client/REQ-19`, `plan-claude_sessions_client/REQ-21`, `plan-claude_sessions_client/REQ-22`, `plan-claude_sessions_client/REQ-23`
- `plan-claude_sessions_client-ui_redesign/REQ-4`, `plan-claude_sessions_client-ui_redesign/REQ-17`, `plan-claude_sessions_client-ui_redesign/REQ-18`, `plan-claude_sessions_client-ui_redesign/REQ-24`, `plan-claude_sessions_client-ui_redesign/REQ-29`, `plan-claude_sessions_client-ui_redesign/REQ-30`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-7`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-11`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-22`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-32`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-34`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-35`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-42`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-5`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-9`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-14`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-15`
- `plan-light_theme/REQ-12`
- `plan-terminal_addons/REQ-1`, `plan-terminal_addons/REQ-2`, `plan-terminal_addons/REQ-3`, `plan-terminal_addons/REQ-4`, `plan-terminal_addons/REQ-5`, `plan-terminal_addons/REQ-6`, `plan-terminal_addons/REQ-12`, `plan-terminal_addons/REQ-13`, `plan-terminal_addons/REQ-14`, `plan-terminal_addons/REQ-15`, `plan-terminal_addons/REQ-16`, `plan-terminal_addons/REQ-17`, `plan-terminal_addons/REQ-18`, `plan-terminal_addons/REQ-19`, `plan-terminal_addons/REQ-20`, `plan-terminal_addons/REQ-21`, `plan-terminal_addons/REQ-22`, `plan-terminal_addons/REQ-23`, `plan-terminal_addons/REQ-24`, `plan-terminal_addons/REQ-25`, `plan-terminal_addons/REQ-26`, `plan-terminal_addons/REQ-27`, `plan-terminal_addons/REQ-28`, `plan-terminal_addons/REQ-29`, `plan-terminal_addons/REQ-32`, `plan-terminal_addons/REQ-33`, `plan-terminal_addons/REQ-34`, `plan-terminal_addons/REQ-35`, `plan-terminal_addons/REQ-36`, `plan-terminal_addons/REQ-37`, `plan-terminal_addons/REQ-38`, `plan-terminal_addons/REQ-39`, `plan-terminal_addons/REQ-42`, `plan-terminal_addons/REQ-43`, `plan-terminal_addons/REQ-46`, `plan-terminal_addons/REQ-47`, `plan-terminal_addons/REQ-48`, `plan-terminal_addons/REQ-50`, `plan-terminal_addons/REQ-51`, `plan-terminal_addons/REQ-52`, `plan-terminal_addons/REQ-54`
- `plan-session_list_width/REQ-15`, `plan-session_list_width/REQ-19`, `plan-session_list_width/REQ-20`, `plan-session_list_width/REQ-28`, `plan-session_list_width/REQ-29`, `plan-session_list_width/REQ-30`, `plan-session_list_width/REQ-31`, `plan-session_list_width/REQ-32`, `plan-session_list_width/REQ-33`, `plan-session_list_width/REQ-36`
