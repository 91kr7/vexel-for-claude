---
module: folders
component: FolderChooser
type: UI component
---

# FolderChooser

**Purpose** → a modal dialog to choose the project folder of a new session and start it.

## Contract

Description:
- a Dialog titled "Nuova sessione". Its form is named "Scegli la cartella del progetto". It holds a path field and the list of subfolders of the current folder.
- primary action "Avvia sessione", cancel "Annulla". The path field has the focus on open.

Props:
- `onStarted(sessionId)` → called after the session started.
- `onCancel()` → called when the user closes the dialog.

Shows:
- on open → the home folder and its subfolders (FolderRoute with no path).
- the path field holds the current folder.
- a ".." entry on top of the list, unless the current folder is `/`.
- while a folder lists → a ProgressIndicator "Caricamento…" under the list.
- while the start runs → "Avvia sessione" is busy (Dialog `primaryBusy`): Spinner, disabled, same name.

Actions:
- click on a subfolder or on ".." → that folder becomes current; the field and the list update.
- Enter in the path field, the field holds a folder other than the listed one → lists the typed folder.
- Enter in the path field, the field holds the listed folder → same as "Avvia sessione".
- "Avvia sessione" → starts a session in the path of the field (StartSessionRoute). Success → `onStarted(id)`.
- "Annulla" or Esc → `onCancel()`.

Focus:
- a new listing removes the folder button that had the focus → the focus moves to the first entry of the new list.

Errors (an ErrorMessage in the dialog, the dialog stays open):
- the folder does not exist → "La cartella non esiste."
- the path is not absolute → "Inserisci un percorso assoluto."
- the folder cannot be read → "La cartella non è leggibile."
- any other failure of a listing → "Lettura della cartella non riuscita."
- any other failure of the start → "Avvio della sessione non riuscito."

## Rules and invariants

- A failed start starts no session and does not call `onStarted`.
- "Avvia sessione" is disabled while the start request runs.
- A path the user typed is never replaced by a listing that started before the user typed it.

## Dependencies

- Dialog, ProgressIndicator, ErrorMessage (module app)
- FolderRoute
- StartSessionRoute (module sessions)

## Requirements served

- `plan-claude_sessions_client/REQ-1`
- `plan-claude_sessions_client-ui_redesign/REQ-25`, `plan-claude_sessions_client-ui_redesign/REQ-26`, `plan-claude_sessions_client-ui_redesign/REQ-27`, `plan-claude_sessions_client-ui_redesign/REQ-29`, `plan-claude_sessions_client-ui_redesign/REQ-30`, `plan-claude_sessions_client-ui_redesign/REQ-31`, `plan-claude_sessions_client-ui_redesign/REQ-32`
