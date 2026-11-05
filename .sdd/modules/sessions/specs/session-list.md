---
module: sessions
component: SessionList
type: UI component
---

# SessionList

**Purpose** → the panel with every hosted session.

## Contract

Description:
- a vertical panel (`nav`, label "Elenco sessioni") with one button per session. It scrolls when the entries do not fit.

Props:
- `sessions` → the list from LiveSessionStore.
- `openSessionId` → the session shown in the open-session area, or `null`.
- `onOpen(id)` → called on a click.

Shows:
- no session → "Nessuna sessione."
- one entry per session, in `orderSessions` order. Each entry shows the label, the folder (full path), the state name and the last activity.
- state names → `working` "In lavorazione", `needs_input` "Richiede input", `idle` "In attesa", `ended` "Terminata".
- last activity → local time `HH:MM:SS` (Italian format). On another day the date comes before the time.
- entries in `needs_input` are highlighted (class `needs-input`).
- the open session's entry has `aria-current="true"`.

Actions:
- click on an entry → `onOpen(id)`. Ended sessions too.

## Dependencies

- orderSessions

## Requirements served

- `plan-claude_sessions_client/REQ-11`, `plan-claude_sessions_client/REQ-12`, `plan-claude_sessions_client/REQ-16`, `plan-claude_sessions_client/REQ-22`
