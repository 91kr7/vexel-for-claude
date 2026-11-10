---
module: external
component: ConversationView
type: UI component
---

# ConversationView

**Purpose** → shows the conversation of an external session read-only, as `#screen-session` and `#session-stream` of `.sdd/mockups/studio-dark/mock.html`, and keeps it current.

## Contract

Description:
- the SessionHeader above the content and the SessionFooter below it. Together they fill the open-session area, on `--bg-canvas` at 75 % over the dot grid. There is no rounded panel.
- the content scrolls between the header and the footer. The entries sit in a centred column of at most 896 px, with 24 px padding, 16 px apart.

Props:
- `sessionId` → the id of the external session.
- `session` → `{ folder, label, state, usage? }` for the header and the footer. Optional.
- `sessions` → optional, the session list of LiveSessionStore (module sessions), passed to the GitExplorerPanel.
- `onResumed(id)` → called with the id of the hosted session after "Resume Here" succeeds.
- `focusRef` → optional. Gets `{ focus() }`: puts the keyboard focus in the message area (the scrolling content), which then shows the focus ring inside its edge. The message area is not in the Tab order.

Shows:
- the SessionHeader with `session`: folder name, the label or name as its line, the state pill, then the chip "Read-only" (`.mono-chip` on surface 2, lock icon at 12 px). The actions are GitExplorerButton, then ResumeHereButton.
- the GitExplorerPanel, while open, at the right of the content, in the same row. The content takes the width it leaves.
- GitExplorerButton → shown when useRepositoryLookup gives `repository` or `error` for the session folder (one lookup when the folder is known, and one more at each opening of the panel and each refresh). A click opens the panel; a second click closes it. The panel is closed when the view opens.
- the GitExplorerPanel gets the session list of the `sessions` prop. Each opening of the panel, and each refresh the panel asks for (`onRefresh`), reads the repository again. While a lookup of a refresh is in flight, the button and the panel stay as they are.
- the SessionFooter with `session` and the lead text "Open in Another Terminal · ": the lead, the path, then the figures. No end items.
- before the first frame of ConversationStreamRoute → an AreaState `loading` "Loading…".
- first frame with no items → an AreaState `empty` "No messages.".
- the socket closes before the first frame → an AreaState `error` "Conversation not available." (rose tile).
- one `article` per entry, in the order received:
  - `user` item (`aria-label` "You") and `assistant` item (`aria-label` "Claude") → both on the left. A 24 px avatar 2 px lower, 12 px gap, then:
    - the name line, 8 px gap → "You" or "Claude" (12/16 px, weight 600); for a user item with a valid `timestamp`, the time (mono 10 px, `--text-muted`).
    - the text, 14 px, line height 1.625, `--text-primary`. A user text sits in a `.vx-surface-2` box with 8 px radius and 12 px padding, 4 px under the name line. A Claude text is 10 px under the name line, with no box.
  - user avatar → the neutral square of Avatar with "U". Claude avatar → a 24 px square, 6 px radius, `--accent-primary` fill, "✦" in mono 11 px and `--on-accent`. Both decorative.
  - in Claude text, text between single backticks on one line shows without the backticks as a mono chip: 12 px, padding 2 × 6 px, 4 px radius, `--bg-surface-2`, 1 px `--border-subtle`.
  - tool card → see "Tool cards".
- user and Claude text keeps its line breaks.

Message time (`formatMessageTime(iso, now)`, exported):

```
iso not a valid date          → ""
same calendar day as now      → "HH:MM"
any other day                 → "DD/MM/YYYY HH:MM"
```

Tool cards (look of the tool card built by `selectSession()`):
- a `tool_call` and the first later `tool_result` whose `toolUseId` equals its `id` form one card, at the place of the call. A `tool_result` with no such call is a card of its own, named "Result".
- the card (`aria-label` "Tool: <name>"): 36 px from the left, so it lines up with the message text. `.vx-surface-1`, 8 px radius. Two cards in a row are 8 px apart.
- its row is one button (`aria-expanded`), padding 6 × 12 px, 8 px gaps, mono 11 px; surface 2 on hover:
  - the name chip → padding 0 × 6 px, 4 px radius, `--bg-surface-3`, `--accent-primary`, weight 500.
  - the summary → `--text-primary`, one line cut with an ellipsis, full text as tooltip.
  - the outcome, 8 px after, mono 10 px: no result yet → "▾" alone in `--text-muted`; result with `isError` → "Error ▾" in rose-400; any other result → "Completed ▾" in emerald-400. "▾" is decorative.
- no tool icon.
- closed (default) → "▾" turned to point right, nothing below the row.
- open → "▾" points down. Below the row, one block on `--bg-canvas` with a 1 px `--border-subtle` line on top, padding 8 × 12 px, mono 12 px (`--term-size`), line height 1.625, `--text-secondary`. It holds, in this order, separated by an empty line:
  - the full input, when the call has `moreInput`. It comes from ItemContentRoute.
  - the output: the full text from ItemContentRoute when the result is `truncated`; otherwise its text. Before the full text is loaded, the cut text and a last line "…".
- an open card with nothing to show in the block shows no block.

Actions:
- each new frame adds its items. A result joins its card even when it arrives in a later frame.
- opening a card loads, the first time, the full input (when `moreInput`) and the full output (when `truncated`). Only parts with a `ref` are loaded.
  - while a part loads → a ProgressIndicator "Loading…" under the block.
  - a load fails → an ErrorMessage "Could not load the full content." under the block. The next open tries that part again.
  - a part already loaded is never requested again.
- a card is open when its result arrives → the full output loads at once when it is `truncated`.

Reconnection:
- the socket closes after the first frame, not by unmount → the view opens a new socket 2 s later, and again every 2 s while the attempts fail.
- the first frame of a new socket replaces all the items. No entry shows twice. For "N new messages", only the entries beyond the previous count are new.
- an attempt closed with `4404` → no more attempts. The items stay.
- no error shows after the first frame, during the attempts or after them.
- a socket that closes before the first frame of the view → the error AreaState above, and no attempt.

Scrolling:
- the view is at the end when its bottom is within 8 px of the end of the content.
- the first frame always shows the last entry.
- new entries arrive while the view is at the end → the content scrolls to the last entry.
- new entries arrive while the user has scrolled up → the view does not move, and N grows by the number of new entries. A result that joins an existing card adds nothing.
- N > 0 → a `.vx-glass` button at the bottom centre of the content area, 20 px from its bottom, floating over the content: 8 px radius, padding 8 × 14 px, mono 12 px, arrow-down icon at 14 px. Text "N new messages", or "1 new message".
- click on the button → the content scrolls to the end, the button disappears and N goes back to 0.
- the user scrolls to the end → the button disappears and N goes back to 0.

## Rules and invariants

- It has no input field. It sends nothing on the socket.
- It has one socket open at a time per `sessionId`. Unmount closes it and ends the attempts.
- The header and the footer stay in place. Only the content scrolls; the button does not.
- It requests the full content of a part only when the user opens its card.

## Dependencies

- ConversationStreamRoute, ItemContentRoute, ResumeHereButton
- SessionHeader, SessionFooter (module sessions)
- useRepositoryLookup, GitExplorerButton, GitExplorerPanel (module git)
- AreaState, IconSet, ProgressIndicator, ErrorMessage, ThemeTokens, WebEntry (module app)

## Requirements served

- `plan-claude_sessions_client/REQ-33`, `plan-claude_sessions_client/REQ-34`, `plan-claude_sessions_client/REQ-36`, `plan-claude_sessions_client/REQ-46`, `plan-claude_sessions_client/REQ-50`, `plan-claude_sessions_client/REQ-51`, `plan-claude_sessions_client/REQ-53`
- `plan-claude_sessions_client-ui_redesign/REQ-17`, `plan-claude_sessions_client-ui_redesign/REQ-19`, `plan-claude_sessions_client-ui_redesign/REQ-20`, `plan-claude_sessions_client-ui_redesign/REQ-21`, `plan-claude_sessions_client-ui_redesign/REQ-22`, `plan-claude_sessions_client-ui_redesign/REQ-23`, `plan-claude_sessions_client-ui_redesign/REQ-24`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-8`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-11`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-22`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-33`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-36` to `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-41`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-50`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-5`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-6`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-9`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-12`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-13`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-16`
- `plan-session_list_width/REQ-16`, `plan-session_list_width/REQ-19`, `plan-session_list_width/REQ-20`, `plan-session_list_width/REQ-21`
- `plan-keyboard_shortcuts/REQ-3`
- `plan-git_explorer/REQ-1`, `plan-git_explorer/REQ-3`, `plan-git_explorer/REQ-23`, `plan-git_explorer/REQ-25`
