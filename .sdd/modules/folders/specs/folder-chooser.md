---
module: folders
component: FolderChooser
type: UI component
---

# FolderChooser

**Purpose** → a modal dialog to choose the project folder of a new session and start it. It is `#modal-new-session` of `.sdd/mockups/studio-dark/mock.html`, with only the folder field.

## Contract

Description:
- a Dialog with the title "New Claude Code Session" and the description "Choose the project where Claude Code starts.". Its form is named "Choose the Project Folder".
- in the body, from top to bottom: the description, the field "Working Directory Path", then one scrolling area with "Recent" and "Folders". Then the footer with "Cancel" and "Start Session" (primary action).
- the path field has the focus on open.

Props:
- `onStarted(sessionId)` → called after the session started.
- `onCancel()` → called when the user closes the dialog.

Shows:
- the field → `.field`: the label "Working Directory Path" above (mono 11 px, `--text-secondary`), then the mono input on the canvas with the subtle border, and the accent border on focus. No icon. The label is the accessible name of the input. The input holds the current folder as a full absolute path.
- the scrolling area → under the field, 10 px between its parts. When the content is taller than the dialog allows, only this area scrolls.
- "Recent" → the heading in `.section-label`, then a `radiogroup` named "Recent Projects", rows 2 px apart. One row per folder of PastSessionListRoute, in the order of the route, each folder once, no maximum.
  - a row (look of `.vx-session-row`) → padding 4 × 8 px, 6 px radius, 8 px gaps, `--text-secondary`: the Avatar (24 px neutral square), then the folder name (12/18 px) above its full path (mono 11 px, `--text-muted`), then a 14 px radio in `--accent-primary`.
  - the radio is named by the folder name and described by the path.
  - checked row (look of `.vx-session-row.active`) → `--accent-glow` background, `--text-primary`, weight 600, 2 px `--accent-primary` bar on the left; the path in `--text-secondary`, mono 500. A row is checked when its folder is the text of the field (trimmed).
  - the route answers with no folder, fails or is not loaded yet → no "Recent" heading and no group. The dialog works without it.
- "Folders" → the same heading, then the list of the current folder: ".." first unless the current folder is `/`, then the subfolders. Each entry is a button drawn as a "Recent" row, with `FolderIcon` (14 px, `--text-secondary`) in a 24 px `.vx-surface-3` square with 6 px radius in place of the Avatar, and no radio. It shows the name (`..` for the parent) and the full path it opens. The button is named by the name and described by the path.
- an unchecked row or entry under the pointer → `--bg-surface-3` and `--text-primary`.
- long names and paths wrap. They are never cut.
- while a folder lists → a ProgressIndicator "Loading…" under the "Folders" list.
- while the start runs → "Start Session" is busy (Dialog `primaryBusy`): Spinner, disabled, same name.

Actions:
- choosing a "Recent" row (click, Space, arrow keys) → the field holds its folder at once and that row is checked. The folder becomes current as a subfolder click does: its listing loads.
- click on a subfolder or on ".." → that folder becomes current; the field and the list update.
- Enter in the path field, the field holds a folder other than the listed one → lists the typed folder.
- Enter in the path field, the field holds the listed folder → same as "Start Session".
- Enter on a "Recent" radio → same as "Start Session".
- "Start Session" → starts a session in the path of the field (StartSessionRoute). Success → `onStarted(id)`.
- "Cancel", "[Esc]" or Esc → `onCancel()`.

Focus:
- a new listing removes the folder button that had the focus → the focus moves to the first entry of the new list.

Errors (an ErrorMessage under the scrolling area, the dialog stays open):
- the folder does not exist → "The folder does not exist."
- the path is not absolute → "Enter an absolute path."
- the folder cannot be read → "The folder is not readable."
- any other failure of a listing → "Could not read the folder."
- any other failure of the start → "Could not start the session."

## Rules and invariants

- A failed start starts no session and does not call `onStarted`.
- "Start Session" is disabled while the start request runs.
- A path the user typed or chose under "Recent" is never replaced by a listing that started before.
- A recent folder that no longer exists stays in the field. Its listing shows "The folder does not exist.".
- The dialog sends `GET /api/past-sessions` once, on open. Its failure shows no error.

## Assumptions

- Row hover uses surface 3, not the mock's surface 2: the dialog itself is surface 2, so a surface-2 hover would not show.

## Dependencies

- Dialog, ProgressIndicator, ErrorMessage, IconSet (`FolderIcon`), ThemeTokens, WebEntry (module app)
- Avatar, `folderNameOf` (module sessions)
- FolderRoute
- PastSessionListRoute (module history)
- StartSessionRoute (module sessions)

## Requirements served

- `plan-claude_sessions_client/REQ-1`
- `plan-claude_sessions_client-ui_redesign/REQ-25`, `plan-claude_sessions_client-ui_redesign/REQ-26`, `plan-claude_sessions_client-ui_redesign/REQ-27`, `plan-claude_sessions_client-ui_redesign/REQ-29`, `plan-claude_sessions_client-ui_redesign/REQ-30`, `plan-claude_sessions_client-ui_redesign/REQ-31`, `plan-claude_sessions_client-ui_redesign/REQ-32`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-12`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-46`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-4`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-5`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-9`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-13`
