---
module: history
component: ResumeDialog
type: UI component
---

# ResumeDialog

**Purpose** → a modal dialog to choose a past session and resume it in the client. It uses the rows and headings of FolderChooser.

## Contract

Description:
- a Dialog with the title "Resume Session" and no description. In the body, a search bar with the toggle "Only Favorites" on its right, then one scrolling area with the past sessions grouped by folder. Then the footer with "Cancel" and "Resume" (primary action).

Size (shared with FolderChooser, module folders, which has the same size and place):
- width → 672 px, about 1.5 times the 448 px of the other dialogs. Never wider than the backdrop: in a narrower window the frame takes the backdrop width, inside its 16 px padding.
- height → follows the content, capped at 70 % of the window height, but never below 280 px and never taller than the backdrop. With many sessions the frame stops at that cap, with clear space above and below it.
- at the cap → the header, the search bar, the toggle and the footer stay in view. Only the past sessions area scrolls, and it keeps at least 56 px, room for one row.

Props:
- `onResumed(sessionId)` → called with the id of the new hosted session.
- `onCancel()` → called when the user closes the dialog.

Shows:
- the search bar, always, also while the list loads and when there are no past sessions:
  - a text field with the look of the WebEntry `.field-input`, the placeholder "Search by label or folder" in `--text-muted`, and the accessible name "Search Past Sessions".
  - `SearchIcon` inside on the left, in `--text-muted`.
  - on open → empty, with the keyboard focus.
  - while it has text → the icon button "Clear Search" (accessible name and tooltip) with `XIcon`, inside on the right.
- the toggle "Only Favorites", right of the search bar, always shown:
  - an icon button with `StarIcon`, as tall as the search bar, with the field border. "Only Favorites" is its accessible name and its tooltip.
  - off → outline star in `--text-muted`, `aria-pressed="false"`.
  - on → filled star in amber, `aria-pressed="true"`, pressed look (accent border, active card background). The state never shows by colour alone.
  - on open → off. It does not take the focus.
- on open → loads PastSessionListRoute. While it loads → a compact AreaState `loading` "Loading…".
- the past sessions → one `radiogroup` named "Past Sessions". When the content is taller than the dialog allows, only this area scrolls. A shown scrollbar is as far from the right edge of the rows as the dialog edge is from their left edge (ListStyles `.list-scroll`, module app).
- one section per visible group, in the order of the route, named by the full folder path. Its heading is the folder path in `.section-label .section-label-path`: mono 10 px, `--text-muted`, not uppercase.
  - while the rows of its group scroll, the heading sticks to the top of the past sessions area. It has no background colour, only the `--popup-glass-blur` backdrop blur, in every theme: the rows pass under it, blurred. Gatekeeper decision, 2026-11-20, on the human's request.
  - always one line. A path that does not fit starts with an ellipsis: its last folders stay visible. The tooltip of the heading is the full path.
- one radio row per visible session, in the order of the route, drawn as a "Recent" row of FolderChooser: the Avatar of the folder, the label (12 px) above its date and time ("DD/MM/YYYY HH:MM:SS", 24-hour clock, mono 11 px with tabular figures, `--text-muted`), and the radio.
  - the radio is named by the label and described by the date and time.
  - a FavoriteButton (with `pastSession`) right after the label, on the same line, outside the radio's label. Marked → the filled star, always shown. Not marked → the outline star, shown while the pointer is over the row or the keyboard focus is visible in the row. Its error "Could not change the favorite mark." shows under the row.
  - a session with `favorite` → the radio is also described by "Favorite". The mark is read when the dialog opens.
  - a session with `runningElsewhere` → the amber pill "Running in a terminal" (the StateBadge `chip` look in amber, with `TerminalIcon` at 12 px), 4 px under the date. The radio is also described by the pill.
  - each row, search results included, is a card of ListStyles (`.list-card`), 6 px apart, with its hover.
  - the selected session → its radio is checked and its row is the active card of ListStyles (`.list-active`), weight 600. On open no session is selected.
- "Resume" → disabled while no session is selected. While a resume runs it is busy (Dialog `primaryBusy`): Spinner, disabled, same name.
- no group → a compact AreaState `empty` "No sessions to resume." with the history icon, and no radiogroup.
- groups exist but no session is visible → a compact AreaState `empty` with the history icon, and no radiogroup:
  - filter off → `No sessions match "<search text>".`
  - filter on, empty search → "No favorite sessions."
  - filter on, search text → `No favorite sessions match "<search text>".`

Actions:
- typing in the search bar → the list updates at each keystroke, with no request. The filter:
  ```
  text = search text, lower case
  passes search:
    text empty                                    → yes
    session label, lower case, contains text      → yes
    group folder path, lower case, contains text  → yes
    otherwise                                     → no
  visible session:
    toggle off → passes search
    toggle on  → has `favorite` and passes search
  a group with no visible session                 → hidden
  ```
  - the filter hides the selected session → no session is selected and "Resume" is disabled.
- pressing "Only Favorites" (click, Enter, Space) → the toggle switches and the list updates, with no request. Enter does not resume. Same selection rule as the search.
- unmarking a row while the toggle is on → the row leaves the list at once. If it was selected, no session is selected and "Resume" is disabled.
- "Clear Search" → the search bar is empty, has the focus, and the full list shows.
- Enter in the search bar → nothing. It does not resume a session.
- choosing a row (click, Space, arrow keys) → selects its session. No request.
- pressing the star of a row (click, Enter, Space) → PastSessionFavoriteRoute with the opposite mark.
  - `2xx` → the row's mark flips at once (star and "Favorite" description). The dialog stays open.
  - failure → the row keeps its star and shows the error.
  - the press never selects the row, never resumes and never closes the dialog. The selected row stays the same.
- Tab → order: search bar, "Clear Search" when shown, "Only Favorites", then the list. The toggle and each star are their own Tab stops, with the focus ring.
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
- Each opening starts with an empty search bar and the toggle off. Neither the search text nor the toggle state is kept between openings or saved.

- While a resume request runs, the radios and "Resume" are disabled. One action starts at most one session.
- A failed resume starts no session and does not call `onResumed`.
- The dialog does not listen to session events. A mark changed elsewhere shows at the next opening.

## Dependencies

- Dialog, AreaState, ErrorMessage, IconSet (`HistoryIcon`, `TerminalIcon`, `SearchIcon`, `StarIcon`, `XIcon`), ThemeTokens, ListStyles, WebEntry (module app)
- Avatar, FavoriteButton (module sessions)
- FolderChooser (module folders), for the row and heading look
- RunningElsewhereWarning, PastSessionListRoute, ResumeSessionRoute, PastSessionFavoriteRoute

## Requirements served

- `plan-claude_sessions_client/REQ-25`, `plan-claude_sessions_client/REQ-26`, `plan-claude_sessions_client/REQ-27`
- `plan-new_session_popup/REQ-7`
- `plan-claude_sessions_client-ui_redesign/REQ-25`, `plan-claude_sessions_client-ui_redesign/REQ-26`, `plan-claude_sessions_client-ui_redesign/REQ-27`, `plan-claude_sessions_client-ui_redesign/REQ-29`, `plan-claude_sessions_client-ui_redesign/REQ-30`, `plan-claude_sessions_client-ui_redesign/REQ-31`, `plan-claude_sessions_client-ui_redesign/REQ-32`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-8`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-12`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-50`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-4`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-5`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-7`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-8`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-9`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-2`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-4`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-5`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-6`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-7`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-8`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-9`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-10`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-11`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-12`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-13`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-14`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-15`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-16`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-17`
- `plan-dark_blue_theme/REQ-3`, `plan-dark_blue_theme/REQ-44`, `plan-dark_blue_theme/REQ-45`, `plan-dark_blue_theme/REQ-46`, `plan-dark_blue_theme/REQ-48`, `plan-dark_blue_theme/REQ-49`
- `plan-resume_favorites/REQ-1`, `plan-resume_favorites/REQ-2`, `plan-resume_favorites/REQ-3`, `plan-resume_favorites/REQ-4`, `plan-resume_favorites/REQ-5`, `plan-resume_favorites/REQ-6`, `plan-resume_favorites/REQ-7`, `plan-resume_favorites/REQ-9`, `plan-resume_favorites/REQ-10`, `plan-resume_favorites/REQ-11`, `plan-resume_favorites/REQ-12`, `plan-resume_favorites/REQ-13`, `plan-resume_favorites/REQ-14`, `plan-resume_favorites/REQ-15`, `plan-resume_favorites/REQ-16`, `plan-resume_favorites/REQ-17`, `plan-resume_favorites/REQ-18`, `plan-resume_favorites/REQ-19`, `plan-resume_favorites/REQ-20`, `plan-resume_favorites/REQ-21`
- `plan-cool_slate_light/REQ-1`, `plan-cool_slate_light/REQ-11`
