---
module: folders
component: FolderChooser
type: UI component
---

# FolderChooser

**Purpose** → a modal dialog to choose the project folder of a new session and start it. It is the new-session dialog of board "Dialoghi".

## Contract

Description:
- a Dialog with `FolderPlusIcon`, the title "Nuova sessione" and the description "Scegli il progetto in cui avviare Claude Code.". Its form is named "Scegli la cartella del progetto".
- from top to bottom: the field "Cartella del progetto", then one scrolling area with "Recenti" and "Cartelle", then the buttons "Annulla" and "Avvia sessione" (primary action).
- the path field has the focus on open.

Props:
- `onStarted(sessionId)` → called after the session started.
- `onCancel()` → called when the user closes the dialog.

Shows (sizes in px, as the board):
- the field → an outlined box 56 high, 8 below the description: 2 `--primary` border, 4 radius, padding 0 12 0 16, 12 gap. Inside: `FolderIcon` 20 in `--on-surface-variant`, then the text input in `.body-m` and the UI font, `--on-surface`, with no border, background or focus ring of its own.
  - the label "Cartella del progetto" (`.label-m`, `--primary`) sits on the top border, 12 from the left, on a `--dialog` patch. It is the accessible name of the input.
  - the input holds the current folder as a full absolute path.
- the scrolling area → between the field and the buttons, 16 gap. When the content is taller than the dialog allows, only this area scrolls.
- "Recenti" → the heading (`.label-l`, `--on-surface-variant`, 4 above), then a `radiogroup` named "Progetti recenti" with a 4 gap. One row per folder of PastSessionListRoute, in the order of the route, each folder once, no maximum.
  - a row → 10 16 padding, 16 radius, 16 gap: Avatar (`dialog` size), then the folder name (`.body-l`) above its full path (Roboto Mono, 12/16, `--on-surface-variant`), then a 20 radio in `--primary`.
  - the radio is named by the folder name and described by the path.
  - checked row → `--secondary-container` background, `--on-secondary-container` text, the path in that colour at 80 % opacity. A row is checked when its folder is the text of the field (trimmed).
  - the route answers with no folder, fails or is not loaded yet → no "Recenti" heading and no group. The dialog works without it.
- "Cartelle" → the same heading, then the list of the current folder: ".." first unless the current folder is `/`, then the subfolders. Each entry is a button drawn as a "Recenti" row, with a 36 box holding `FolderIcon` 20 (`--on-surface-variant`) in place of the Avatar, and no radio. It shows the name (`..` for the parent) and the full path it opens. The button is named by the name and described by the path.
- an unchecked row or entry under the pointer → an 8 % `--on-surface` layer.
- long names and paths wrap. They are never cut.
- while a folder lists → a ProgressIndicator "Caricamento…" under the "Cartelle" list.
- while the start runs → "Avvia sessione" is busy (Dialog `primaryBusy`): Spinner, disabled, same name.

Actions:
- choosing a "Recenti" row (click, Space, arrow keys) → the field holds its folder at once and that row is checked. The folder becomes current as a subfolder click does: its listing loads.
- click on a subfolder or on ".." → that folder becomes current; the field and the list update.
- Enter in the path field, the field holds a folder other than the listed one → lists the typed folder.
- Enter in the path field, the field holds the listed folder → same as "Avvia sessione".
- Enter on a "Recenti" radio → same as "Avvia sessione".
- "Avvia sessione" → starts a session in the path of the field (StartSessionRoute). Success → `onStarted(id)`.
- "Annulla" or Esc → `onCancel()`.

Focus:
- a new listing removes the folder button that had the focus → the focus moves to the first entry of the new list.

Errors (an ErrorMessage between the scrolling area and the buttons, the dialog stays open):
- the folder does not exist → "La cartella non esiste."
- the path is not absolute → "Inserisci un percorso assoluto."
- the folder cannot be read → "La cartella non è leggibile."
- any other failure of a listing → "Lettura della cartella non riuscita."
- any other failure of the start → "Avvio della sessione non riuscito."

## Rules and invariants

- A failed start starts no session and does not call `onStarted`.
- "Avvia sessione" is disabled while the start request runs.
- A path the user typed or chose under "Recenti" is never replaced by a listing that started before.
- A recent folder that no longer exists stays in the field. Its listing shows "La cartella non esiste.".
- The dialog sends `GET /api/past-sessions` once, on open. Its failure shows no error.

## Dependencies

- Dialog, ProgressIndicator, ErrorMessage, IconSet (`FolderPlusIcon`, `FolderIcon`), ThemeTokens, WebEntry (module app)
- Avatar, `folderNameOf` (module sessions)
- FolderRoute
- PastSessionListRoute (module history)
- StartSessionRoute (module sessions)

## Requirements served

- `plan-claude_sessions_client/REQ-1`
- `plan-claude_sessions_client-ui_redesign/REQ-25`, `plan-claude_sessions_client-ui_redesign/REQ-26`, `plan-claude_sessions_client-ui_redesign/REQ-27`, `plan-claude_sessions_client-ui_redesign/REQ-29`, `plan-claude_sessions_client-ui_redesign/REQ-30`, `plan-claude_sessions_client-ui_redesign/REQ-31`, `plan-claude_sessions_client-ui_redesign/REQ-32`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-44`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-45`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-46`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-52`
