---
module: history
component: ResumeDialog
type: UI component
---

# ResumeDialog

**Purpose** → a modal dialog to choose a past session and resume it in the client.

## Contract

Description:
- a Dialog titled "Riprendi sessione" with the past sessions grouped by folder.
- primary action "Riprendi", cancel "Annulla".

Props:
- `onResumed(sessionId)` → called with the id of the new hosted session.
- `onCancel()` → called when the user closes the dialog.

Shows:
- on open → loads PastSessionListRoute. While it loads → a ProgressIndicator "Caricamento…".
- one section per group, in the order of the route. The heading is the folder path.
- one entry per session: its label and its date and time (Italian format).
- an entry with `runningElsewhere` → also the mark "In esecuzione in un terminale".
- the selected entry → marked as selected (`aria-pressed="true"`). On open no entry is selected.
- "Riprendi" → disabled while no entry is selected. While a resume runs it is busy (Dialog `primaryBusy`): Spinner, disabled, same name.
- no group → "Nessuna sessione da riprendere."

Actions:
- click on an entry, or Enter or Space on it → selects it. No request.
- "Riprendi", or Enter outside a button → acts on the selected entry:
  - without `runningElsewhere` → resumes it (ResumeSessionRoute). Success → `onResumed(id)`.
  - with `runningElsewhere` → opens RunningElsewhereWarning over the dialog. No request yet.
    - "Riprendi comunque" → the warning closes and the session is resumed.
    - "Annulla" or Esc → the warning closes. No request. The dialog stays open.
- "Annulla" or Esc → `onCancel()`.

Errors (an ErrorMessage in the dialog, the dialog stays open):
- the session no longer exists → "La sessione non esiste più."
- the project folder does not exist → "La cartella del progetto non esiste."
- any other failure of the loading → "Caricamento delle sessioni passate non riuscito."
- any other failure of a resume → "Ripresa della sessione non riuscita."

## Rules and invariants

- While a resume request runs, the entries and "Riprendi" are disabled. One action starts at most one session.
- A failed resume starts no session and does not call `onResumed`.

## Dependencies

- Dialog, ProgressIndicator, ErrorMessage (module app), RunningElsewhereWarning, PastSessionListRoute, ResumeSessionRoute

## Requirements served

- `plan-claude_sessions_client/REQ-25`, `plan-claude_sessions_client/REQ-26`, `plan-claude_sessions_client/REQ-27`
- `plan-claude_sessions_client-ui_redesign/REQ-25`, `plan-claude_sessions_client-ui_redesign/REQ-26`, `plan-claude_sessions_client-ui_redesign/REQ-27`, `plan-claude_sessions_client-ui_redesign/REQ-4`, `plan-claude_sessions_client-ui_redesign/REQ-29`, `plan-claude_sessions_client-ui_redesign/REQ-30`, `plan-claude_sessions_client-ui_redesign/REQ-31`, `plan-claude_sessions_client-ui_redesign/REQ-32`
