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
- the content between the header and the footer is a ConversationBody on ConversationStreamRoute and ItemContentRoute of `sessionId`, with its default user name "You" and avatar "U".

Props:
- `sessionId` → the id of the external session.
- `session` → `{ folder, label, state, usage? }` for the header and the footer. Optional.
- `sessions` → optional, the session list of LiveSessionStore (module sessions), passed to the GitExplorerPanel.
- `onResumed(id)` → called with the id of the hosted session after "Resume Here" succeeds.
- `focusRef` → optional. Passed to the ConversationBody: `focus()` puts the keyboard focus in its message area.

Exports:
- `formatMessageTime` of ConversationBody, exported again.

Shows:
- the SessionHeader with `session`: folder name, the label or name as its line, the state pill, then the chip "Read-only" (`.mono-chip` on surface 2, lock icon at 12 px). The actions are GitExplorerButton, TurnPanelButton, then ResumeHereButton, with `ended` when `session.state` is `ended`.
- the GitExplorerPanel or the TurnPanel, while open, at the right of the content, in the same row. The content takes the width it leaves.
- GitExplorerButton → shown when useRepositoryLookup gives `repository` or `error` for the session folder (one lookup when the folder is known, and one more at each opening of the panel and each refresh). A click opens the panel; a second click closes it. The panel is closed when the view opens. The panel is mounted through ExitPresence: it slides in on open and out on close, and the content resizes with it.
- the GitExplorerPanel gets the session list of the `sessions` prop. Each opening of the panel, and each refresh the panel asks for (`onRefresh`), reads the repository again. While a lookup of a refresh is in flight, the button and the panel stay as they are.
- TurnPanelButton → shown for every session. A click opens the TurnPanel of `sessionId`; a second click closes it. The panel is closed when the view opens. It is mounted through ExitPresence and slides in and out as the GitExplorerPanel; the content resizes with it.
- one side panel at a time → opening the TurnPanel closes the GitExplorerPanel, and opening the GitExplorerPanel closes the TurnPanel.
- the SessionFooter with `session` and the lead text "Open in Another Terminal · ": the lead, the path, then the figures. No end items.

## Rules and invariants

- It has no input field.
- The header and the footer stay in place. Only the content scrolls.
- On an ended session, the shortcut command `resume` resumes once, with no warning. The command `dismiss` dismisses its list entry (EndedEntryActions of SessionList).

## Dependencies

- ConversationBody, ConversationStreamRoute, ItemContentRoute, ResumeHereButton
- SessionHeader, SessionFooter (module sessions)
- useRepositoryLookup, GitExplorerButton, GitExplorerPanel (module git)
- TurnPanelButton, TurnPanel (module activity)
- ExitPresence (module app)
- IconSet, ThemeTokens, WebEntry (module app)

## Requirements served

- `plan-claude_sessions_client/REQ-33`, `plan-claude_sessions_client/REQ-34`, `plan-claude_sessions_client/REQ-36`, `plan-claude_sessions_client/REQ-46`, `plan-claude_sessions_client/REQ-50`, `plan-claude_sessions_client/REQ-51`, `plan-claude_sessions_client/REQ-53`
- `plan-claude_sessions_client-ui_redesign/REQ-17`, `plan-claude_sessions_client-ui_redesign/REQ-19`, `plan-claude_sessions_client-ui_redesign/REQ-20`, `plan-claude_sessions_client-ui_redesign/REQ-21`, `plan-claude_sessions_client-ui_redesign/REQ-22`, `plan-claude_sessions_client-ui_redesign/REQ-23`, `plan-claude_sessions_client-ui_redesign/REQ-24`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-8`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-11`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-22`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-33`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-36` to `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-41`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-50`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-5`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-6`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-9`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-12`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-13`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-16`
- `plan-session_list_width/REQ-16`, `plan-session_list_width/REQ-19`, `plan-session_list_width/REQ-20`, `plan-session_list_width/REQ-21`
- `plan-keyboard_shortcuts/REQ-3`
- `plan-git_explorer/REQ-1`, `plan-git_explorer/REQ-3`, `plan-git_explorer/REQ-23`, `plan-git_explorer/REQ-25`
- `plan-wsl_support/REQ-11`, `plan-wsl_support/REQ-13`
- `plan-dark_blue_theme/REQ-3`
- `plan-ui_transitions/REQ-6`
- `plan-cool_slate_light/REQ-21`, `plan-cool_slate_light/REQ-22`
- `plan-session_activity/REQ-27`, `plan-session_activity/REQ-48`
