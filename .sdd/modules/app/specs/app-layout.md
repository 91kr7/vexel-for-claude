---
module: app
component: AppLayout
type: UI page
---

# AppLayout

**Purpose** → the page: a header with the actions and the area of the open session.

## Contract

Description:
- a header with the title "Sessioni Claude" and the button "Nuova sessione". Below it, the open-session area fills the rest of the window.

Shows:
- no open session → the text "Nessuna sessione aperta."
- an open session → its SessionView.

Actions:
- "Nuova sessione" → opens FolderChooser.
- FolderChooser starts a session → the chooser closes and the new session becomes the open one.
- FolderChooser cancelled → the chooser closes; the open session does not change.

## Dependencies

- FolderChooser (module folders)
- SessionView (module sessions)

## Requirements served

- `plan-claude_sessions_client/REQ-1`
