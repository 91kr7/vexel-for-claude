---
module: history
component: ResumeDialog
type: UI component
---

# ResumeDialog

**Purpose** → a modal dialog to choose a past session and resume it in the client. It uses the rows and headings of FolderChooser.

## Contract

Description:
- a Dialog with the title "Riprendi sessione" and no description. In the body, one scrolling area with the past sessions grouped by folder. Then the footer with "Annulla" and "Riprendi" (primary action).

Props:
- `onResumed(sessionId)` → called with the id of the new hosted session.
- `onCancel()` → called when the user closes the dialog.

Shows:
- on open → loads PastSessionListRoute. While it loads → a compact AreaState `loading` "Caricamento…".
- the past sessions → one `radiogroup` named "Sessioni passate". When the content is taller than the dialog allows, only this area scrolls.
- one section per group, in the order of the route, named by the folder path. Its heading is the full folder path in `.section-label .section-label-path`: mono 10 px, `--text-muted`, not uppercase, wrapping.
- one radio row per session, drawn as a "Recenti" row of FolderChooser: the Avatar of the folder, the label (12 px) above its date and time (Italian format, mono 11 px, `--text-muted`), and the radio.
  - the radio is named by the label and described by the date and time.
  - a session with `runningElsewhere` → the amber pill "In esecuzione in un terminale" (the StateBadge `chip` look in amber, with `TerminalIcon` at 12 px), 4 px under the date. The radio is also described by the pill.
  - the selected session → its radio is checked and its row has the checked look of a "Recenti" row. On open no session is selected.
- "Riprendi" → disabled while no session is selected. While a resume runs it is busy (Dialog `primaryBusy`): Spinner, disabled, same name.
- no group → a compact AreaState `empty` "Nessuna sessione da riprendere." with the history icon, and no radiogroup.

Actions:
- choosing a row (click, Space, arrow keys) → selects its session. No request.
- "Riprendi", or Enter outside a button → acts on the selected session:
  - without `runningElsewhere` → resumes it (ResumeSessionRoute). Success → `onResumed(id)`.
  - with `runningElsewhere` → opens RunningElsewhereWarning over the dialog. No request yet.
    - "Riprendi comunque" → the warning closes and the session is resumed.
    - "Annulla", "[Esc]" or Esc → the warning closes. No request. The dialog stays open.
- "Annulla", "[Esc]" or Esc → `onCancel()`.

Errors (an ErrorMessage under the scrolling area, the dialog stays open):
- the session no longer exists → "La sessione non esiste più."
- the project folder does not exist → "La cartella del progetto non esiste."
- any other failure of the loading → "Caricamento delle sessioni passate non riuscito."
- any other failure of a resume → "Ripresa della sessione non riuscita."

## Rules and invariants

- While a resume request runs, the radios and "Riprendi" are disabled. One action starts at most one session.
- A failed resume starts no session and does not call `onResumed`.

## Dependencies

- Dialog, AreaState, ErrorMessage, IconSet (`HistoryIcon`, `TerminalIcon`), ThemeTokens, WebEntry (module app)
- Avatar (module sessions)
- FolderChooser (module folders), for the row and heading look
- RunningElsewhereWarning, PastSessionListRoute, ResumeSessionRoute

## Requirements served

- `plan-claude_sessions_client/REQ-25`, `plan-claude_sessions_client/REQ-26`, `plan-claude_sessions_client/REQ-27`
- `plan-claude_sessions_client-ui_redesign/REQ-25`, `plan-claude_sessions_client-ui_redesign/REQ-26`, `plan-claude_sessions_client-ui_redesign/REQ-27`, `plan-claude_sessions_client-ui_redesign/REQ-29`, `plan-claude_sessions_client-ui_redesign/REQ-30`, `plan-claude_sessions_client-ui_redesign/REQ-31`, `plan-claude_sessions_client-ui_redesign/REQ-32`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-8`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-12`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-50`
