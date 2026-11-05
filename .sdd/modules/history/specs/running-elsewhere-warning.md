---
module: history
component: RunningElsewhereWarning
type: UI component
---

# RunningElsewhereWarning

**Purpose** → warns that a session still runs in another terminal before the user resumes it. Any page can use it.

## Contract

Description:
- a modal alert dialog that opens on top of the page and of other modals.

Props:
- `onConfirm()` → called on "Riprendi comunque".
- `onCancel()` → called on "Annulla".

Shows:
- the title "Sessione in esecuzione in un terminale".
- the text "Questa sessione è ancora in esecuzione in un altro terminale. Se la riprendi anche qui, le due istanze possono danneggiare la conversazione."
- the buttons "Annulla" (focused) and "Riprendi comunque".

## Rules and invariants

- It sends no request. The caller does the resume after `onConfirm()`.

## Requirements served

- `plan-claude_sessions_client/REQ-27`
