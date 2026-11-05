---
module: history
component: RunningElsewhereWarning
type: UI component
---

# RunningElsewhereWarning

**Purpose** → warns that a session still runs in another terminal before the user resumes it. Any page can use it.

## Contract

Description:
- a WarningDialog in the `attn` (amber) tone: the text in the amber banner with the triangle icon, and an amber primary action. It opens on top of the page and of other dialogs.

Props:
- `onConfirm()` → called on "Riprendi comunque".
- `onCancel()` → called on "Annulla", "[Esc]" and Esc.

Shows:
- the title "Sessione in esecuzione in un terminale".
- the text, in the banner, "Questa sessione è ancora in esecuzione in un altro terminale. Se la riprendi anche qui, le due istanze possono danneggiare la conversazione."
- the buttons "Annulla" (focused) and "Riprendi comunque" (primary action, `.button-attn`).

## Rules and invariants

- It sends no request. The caller does the resume after `onConfirm()`.
- Esc closes only the warning. A dialog below it stays open.

## Dependencies

- WarningDialog (module app)

## Requirements served

- `plan-claude_sessions_client/REQ-27`
- `plan-claude_sessions_client-ui_redesign/REQ-25`, `plan-claude_sessions_client-ui_redesign/REQ-26`, `plan-claude_sessions_client-ui_redesign/REQ-27`, `plan-claude_sessions_client-ui_redesign/REQ-28`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-50`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-49`
