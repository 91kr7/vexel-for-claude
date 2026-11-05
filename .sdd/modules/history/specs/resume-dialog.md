---
module: history
component: ResumeDialog
type: UI component
---

# ResumeDialog

**Purpose** → a modal dialog to choose a past session and resume it in the client.

## Contract

Description:
- a modal with the title "Riprendi sessione", the past sessions grouped by folder and the button "Annulla".

Props:
- `onResumed(sessionId)` → called with the id of the new hosted session.
- `onCancel()` → called when the user closes the dialog.

Shows:
- on open → loads PastSessionListRoute. While it loads → "Caricamento…".
- one section per group, in the order of the route. The heading is the folder path.
- one entry per session: its label and its date and time (Italian format).
- an entry with `runningElsewhere` → also the mark "In esecuzione in un terminale".
- no group → "Nessuna sessione da riprendere."

Actions:
- click on an entry without `runningElsewhere` → resumes it (ResumeSessionRoute). Success → `onResumed(id)`.
- click on an entry with `runningElsewhere` → opens RunningElsewhereWarning. No request yet.
  - "Riprendi comunque" → the warning closes and the session is resumed.
  - "Annulla" → the warning closes. No request. The dialog stays open.
- "Annulla" → `onCancel()`.

Errors (shown in the dialog, the dialog stays open):
- the session no longer exists → "La sessione non esiste più."
- the project folder does not exist → "La cartella del progetto non esiste."
- any other failure, also of the loading → "Operazione non riuscita."

## Rules and invariants

- While a resume request runs, the entries are disabled. One click starts at most one session.
- A failed resume starts no session and does not call `onResumed`.

## Dependencies

- RunningElsewhereWarning, PastSessionListRoute, ResumeSessionRoute

## Requirements served

- `plan-claude_sessions_client/REQ-25`, `plan-claude_sessions_client/REQ-26`, `plan-claude_sessions_client/REQ-27`
