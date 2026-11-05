---
module: app
component: AppLayout
type: UI page
---

# AppLayout

**Purpose** → the page: a sidebar with the actions and the session list, next to the main area with the open session.

## Contract

Description:
- two columns that fill the window. There is no separate header bar.
- the sidebar (`aside`, left, fixed width) → at the top the title "Sessioni Claude" (`h1`), the NeedsInputCounter, the buttons "Nuova sessione" (primary) and "Riprendi sessione"; below them the SessionList.
- the main area (`main`, right) → takes the rest of the width.

Shows:
- the counter and the list, always, also while a session is open. Both follow LiveSessionStore (`useLiveSessions`). The list also gets its load status.
- no open session → the EmptyState in the main area.
- an open hosted session → its SessionView, with the summary (folder, label, state) of that session from LiveSessionStore. No summary while the store does not list it yet.
- an open external session → its ConversationView with its summary, in place of the SessionView. It stays open when the entry leaves the list, with the last summary the list gave.

Actions:
- "Nuova sessione", in the sidebar or in the EmptyState → opens FolderChooser.
- FolderChooser starts a session → the chooser closes and the new session becomes the open one.
- FolderChooser cancelled → the chooser closes; the open session does not change.
- "Riprendi sessione", in the sidebar or in the EmptyState → opens ResumeDialog.
- ResumeDialog resumes a session → the dialog closes and the resumed session becomes the open one.
- ResumeDialog cancelled → the dialog closes; the open session does not change.
- click on a SessionList entry → that session becomes the open one. The other sessions keep running.
- Ctrl+Shift+L in the terminal of the open SessionView → the focus moves to the open session's entry in the list. With no such entry, it moves to the first enabled button of the sidebar. The focused element shows the focus ring, also when the terminal got the focus by a mouse click.
- ConversationView resumes the session ("Riprendi qui") → the new hosted session becomes the open one.

## Rules and invariants

- the top of the sidebar stays in place. Only the SessionList scrolls, when its entries do not fit.
- from 1280 px to 3840 px of window width → no horizontal scroll and no overlapping elements. A sidebar title too long for its width is cut with an ellipsis.

## Dependencies

- EmptyState
- FolderChooser (module folders)
- ResumeDialog (module history)
- SessionView, SessionList, NeedsInputCounter, LiveSessionStore (module sessions)
- ConversationView (module external)

## Requirements served

- `plan-claude_sessions_client/REQ-1`, `plan-claude_sessions_client/REQ-17`, `plan-claude_sessions_client/REQ-18`, `plan-claude_sessions_client/REQ-19`, `plan-claude_sessions_client/REQ-23`, `plan-claude_sessions_client/REQ-25`, `plan-claude_sessions_client/REQ-33`, `plan-claude_sessions_client/REQ-35`
- `plan-claude_sessions_client-ui_redesign/REQ-8`, `plan-claude_sessions_client-ui_redesign/REQ-9`, `plan-claude_sessions_client-ui_redesign/REQ-10`, `plan-claude_sessions_client-ui_redesign/REQ-14`, `plan-claude_sessions_client-ui_redesign/REQ-17`, `plan-claude_sessions_client-ui_redesign/REQ-4`, `plan-claude_sessions_client-ui_redesign/REQ-29`, `plan-claude_sessions_client-ui_redesign/REQ-30`
