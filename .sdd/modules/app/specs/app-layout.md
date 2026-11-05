---
module: app
component: AppLayout
type: UI page
---

# AppLayout

**Purpose** → the page: a header with the actions, the session list and the area of the open session.

## Contract

Description:
- a header with the title "Sessioni Claude", the NeedsInputCounter and the buttons "Riprendi sessione" and "Nuova sessione".
- below it, the SessionList on the left and the open-session area on the right. Together they fill the rest of the window.

Shows:
- the counter and the list, always, also while a session is open. Both follow LiveSessionStore (`useLiveSessions`).
- no open session → the text "Nessuna sessione aperta."
- an open hosted session → its SessionView, with the state of that session from LiveSessionStore (none while the store does not list it yet).
- an open external session → its ConversationView, in place of the SessionView. It stays open when the entry leaves the list.

Actions:
- "Nuova sessione" → opens FolderChooser.
- FolderChooser starts a session → the chooser closes and the new session becomes the open one.
- FolderChooser cancelled → the chooser closes; the open session does not change.
- "Riprendi sessione" → opens ResumeDialog.
- ResumeDialog resumes a session → the dialog closes and the resumed session becomes the open one.
- ResumeDialog cancelled → the dialog closes; the open session does not change.
- click on a SessionList entry → that session becomes the open one. The other sessions keep running.
- ConversationView resumes the session ("Riprendi qui") → the new hosted session becomes the open one.

## Dependencies

- FolderChooser (module folders)
- ResumeDialog (module history)
- SessionView, SessionList, NeedsInputCounter, LiveSessionStore (module sessions)
- ConversationView (module external)

## Requirements served

- `plan-claude_sessions_client/REQ-1`, `plan-claude_sessions_client/REQ-17`, `plan-claude_sessions_client/REQ-18`, `plan-claude_sessions_client/REQ-19`, `plan-claude_sessions_client/REQ-23`, `plan-claude_sessions_client/REQ-25`, `plan-claude_sessions_client/REQ-33`, `plan-claude_sessions_client/REQ-35`
