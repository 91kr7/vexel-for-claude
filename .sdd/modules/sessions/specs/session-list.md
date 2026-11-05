---
module: sessions
component: SessionList
type: UI component
---

# SessionList

**Purpose** → the panel with every hosted session and every external session.

## Contract

Description:
- a vertical panel with one button per session. It scrolls when the entries do not fit. It is not a landmark: the list panel of AppLayout carries the label "Elenco sessioni".

Props:
- `sessions` → the list from LiveSessionStore.
- `openSessionId` → the session shown in the open-session area, or `null`.
- `onOpen(id)` → called on a click.
- `status` → the load status from LiveSessionStore: `loading`, `ready` or `error`. Default `ready`.

Shows:
- `loading` → a ProgressIndicator "Caricamento…" in place of the entries and of "Nessuna sessione.".
- `error` → an ErrorMessage "Connessione al server persa. Ricarica la pagina." above the entries. The entries already received stay.
- `ready`, no session → "Nessuna sessione." With `error` and no session, only the ErrorMessage shows.
- one entry per session, in `orderSessions` order.
- each entry has two lines, the same for every entry:
  - first line → the label on the left, the StateBadge on the right.
  - second line → the folder (full path) on the left, the last activity on the right.
- a label or folder longer than the entry is cut on one line with an ellipsis. Its tooltip (`title`) is the full value.
- last activity → local time `HH:MM:SS` (Italian format). On another day the date comes before the time.
- entries in `needs_input` have the class `needs-input`: needs-input background, a frame and a left bar in the needs-input colour. It is the strongest emphasis of the list.
- the open session's entry has `aria-current="true"`: selected background and a left bar in the primary colour. No other entry has it.
- an open entry in `needs_input` keeps the needs-input background and frame, with the primary left bar of the open entry.
- an external entry (`external: true`) has the class `external` and, on the second line before the time, the mark "Esterna" with a terminal icon (`TerminalIcon`). The mark tooltip (`title`) is "Sessione in un altro terminale: lo stato «Richiede input» non è disponibile". Hosted entries have no mark.

Actions:
- click on an entry → `onOpen(id)`. Ended sessions too.

## Rules and invariants

- No entry text wraps: the entry height is the same for every entry.
- The emphasis order is needs input, then open entry, then the other entries.

## Dependencies

- orderSessions
- StateBadge
- IconSet, ProgressIndicator, ErrorMessage (module app)

## Requirements served

- `plan-claude_sessions_client/REQ-11`, `plan-claude_sessions_client/REQ-12`, `plan-claude_sessions_client/REQ-16`, `plan-claude_sessions_client/REQ-22`, `plan-claude_sessions_client/REQ-29`, `plan-claude_sessions_client/REQ-30`
- `plan-claude_sessions_client-ui_redesign/REQ-11`, `plan-claude_sessions_client-ui_redesign/REQ-12`, `plan-claude_sessions_client-ui_redesign/REQ-13`, `plan-claude_sessions_client-ui_redesign/REQ-15`, `plan-claude_sessions_client-ui_redesign/REQ-16`, `plan-claude_sessions_client-ui_redesign/REQ-29`, `plan-claude_sessions_client-ui_redesign/REQ-30`
