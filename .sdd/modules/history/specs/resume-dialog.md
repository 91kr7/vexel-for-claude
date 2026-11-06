---
module: history
component: ResumeDialog
type: UI component
---

# ResumeDialog

**Purpose** → a modal dialog to choose a past session and resume it in the client. It uses the rows and headings of FolderChooser.

## Contract

Description:
- a Dialog with the title "Resume Session" and no description. In the body, a search bar, then one scrolling area with the past sessions grouped by folder. Then the footer with "Cancel" and "Resume" (primary action).

Props:
- `onResumed(sessionId)` → called with the id of the new hosted session.
- `onCancel()` → called when the user closes the dialog.

Shows:
- the search bar, always, also while the list loads and when there are no past sessions:
  - a text field with the look of the WebEntry `.field-input`, the placeholder "Search by label or folder" in `--text-muted`, and the accessible name "Search Past Sessions".
  - `SearchIcon` inside on the left, in `--text-muted`.
  - on open → empty, with the keyboard focus.
  - while it has text → the icon button "Clear Search" (accessible name and tooltip) with `XIcon`, inside on the right.
- on open → loads PastSessionListRoute. While it loads → a compact AreaState `loading` "Loading…".
- the past sessions → one `radiogroup` named "Past Sessions". When the content is taller than the dialog allows, only this area scrolls.
- one section per visible group, in the order of the route, named by the folder path. Its heading is the full folder path in `.section-label .section-label-path`: mono 10 px, `--text-muted`, not uppercase, wrapping.
- one radio row per visible session, in the order of the route, drawn as a "Recent" row of FolderChooser: the Avatar of the folder, the label (12 px) above its date and time ("DD/MM/YYYY HH:MM:SS", 24-hour clock, mono 11 px, `--text-muted`), and the radio.
  - the radio is named by the label and described by the date and time.
  - a session with `runningElsewhere` → the amber pill "Running in a terminal" (the StateBadge `chip` look in amber, with `TerminalIcon` at 12 px), 4 px under the date. The radio is also described by the pill.
  - the selected session → its radio is checked and its row has the checked look of a "Recent" row. On open no session is selected.
- "Resume" → disabled while no session is selected. While a resume runs it is busy (Dialog `primaryBusy`): Spinner, disabled, same name.
- no group → a compact AreaState `empty` "No sessions to resume." with the history icon, and no radiogroup.
- groups exist but no session is visible → a compact AreaState `empty` `No sessions match "<search text>".` with the history icon, and no radiogroup.

Actions:
- typing in the search bar → the list updates at each keystroke, with no request. The filter:
  ```
  text = search text, lower case
  text empty                                    → every group and session is visible
  session label, lower case, contains text      → the session is visible
  group folder path, lower case, contains text  → every session of the group is visible
  otherwise                                     → the session is hidden
  a group with no visible session               → hidden
  ```
  - the filter hides the selected session → no session is selected and "Resume" is disabled.
- "Clear Search" → the search bar is empty, has the focus, and the full list shows.
- Enter in the search bar → nothing. It does not resume a session.
- choosing a row (click, Space, arrow keys) → selects its session. No request.
- "Resume", or Enter outside a button and outside the search bar → acts on the selected session:
  - without `runningElsewhere` → resumes it (ResumeSessionRoute). Success → `onResumed(id)`.
  - with `runningElsewhere` → opens RunningElsewhereWarning over the dialog. No request yet.
    - "Resume Anyway" → the warning closes and the session is resumed.
    - "Cancel", "[Esc]" or Esc → the warning closes. No request. The dialog stays open.
- "Cancel", "[Esc]" or Esc → `onCancel()`. Esc does it also when the search bar has the focus or contains text.

Errors (an ErrorMessage under the scrolling area, the dialog stays open):
- the session no longer exists → "The session no longer exists."
- the project folder does not exist → "The project folder does not exist."
- any other failure of the loading → "Could not load the past sessions."
- any other failure of a resume → "Could not resume the session."

## Rules and invariants

- The search only hides entries. It never changes the label, date or pill of a row. Only the label and the folder path are searched.
- A session hidden by the search is never resumed. Resuming a visible session follows the same path as with the full list, RunningElsewhereWarning included.
- Each opening starts with an empty search bar. The search text is not kept between openings.

- While a resume request runs, the radios and "Resume" are disabled. One action starts at most one session.
- A failed resume starts no session and does not call `onResumed`.

## Dependencies

- Dialog, AreaState, ErrorMessage, IconSet (`HistoryIcon`, `TerminalIcon`, `SearchIcon`, `XIcon`), ThemeTokens, WebEntry (module app)
- Avatar (module sessions)
- FolderChooser (module folders), for the row and heading look
- RunningElsewhereWarning, PastSessionListRoute, ResumeSessionRoute

## Requirements served

- `plan-claude_sessions_client/REQ-25`, `plan-claude_sessions_client/REQ-26`, `plan-claude_sessions_client/REQ-27`
- `plan-claude_sessions_client-ui_redesign/REQ-25`, `plan-claude_sessions_client-ui_redesign/REQ-26`, `plan-claude_sessions_client-ui_redesign/REQ-27`, `plan-claude_sessions_client-ui_redesign/REQ-29`, `plan-claude_sessions_client-ui_redesign/REQ-30`, `plan-claude_sessions_client-ui_redesign/REQ-31`, `plan-claude_sessions_client-ui_redesign/REQ-32`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-8`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-12`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-50`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-4`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-5`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-7`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-8`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-9`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-2`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-4`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-5`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-6`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-7`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-8`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-9`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-10`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-11`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-12`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-13`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-14`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-15`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-16`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-17`
