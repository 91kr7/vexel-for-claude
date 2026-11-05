---
module: app
component: AppLayout
type: UI page
---

# AppLayout

**Purpose** → the page: a header with the actions, the session list and the area of the open session.

## Contract

Description:
- a header with the title "Sessioni Claude", the NeedsInputCounter and the button "Nuova sessione".
- below it, the SessionList on the left and the open-session area on the right. Together they fill the rest of the window.

Shows:
- the counter and the list, always, also while a session is open. Both follow LiveSessionStore (`useLiveSessions`).
- no open session → the text "Nessuna sessione aperta."
- an open session → its SessionView, with the state of that session from LiveSessionStore (none while the store does not list it yet).

Actions:
- "Nuova sessione" → opens FolderChooser.
- FolderChooser starts a session → the chooser closes and the new session becomes the open one.
- FolderChooser cancelled → the chooser closes; the open session does not change.
- click on a SessionList entry → that session becomes the open one. The other sessions keep running.

## Dependencies

- FolderChooser (module folders)
- SessionView, SessionList, NeedsInputCounter, LiveSessionStore (module sessions)

## Requirements served

- `plan-claude_sessions_client/REQ-1`, `plan-claude_sessions_client/REQ-17`, `plan-claude_sessions_client/REQ-18`, `plan-claude_sessions_client/REQ-19`, `plan-claude_sessions_client/REQ-23`
