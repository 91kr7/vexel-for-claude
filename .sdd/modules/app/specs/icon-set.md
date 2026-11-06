---
module: app
component: IconSet
type: UI component
---

# IconSet

**Purpose** → the Lucide icons of the client, as local React SVG components.

## Contract

Shows:
- one inline SVG with the class `icon`, 16 px unless its container sets another size, drawn in the current text colour.

Components and where the client uses them today:
- `PlusIcon` → "New Session" in the top bar and the EmptyState, "New Claude Code Session" in the rail, "Larger text" in the TerminalZoomControls
- `MinusIcon` → "Smaller text" in the TerminalZoomControls, the yellow WindowButtons button
- `HistoryIcon` → "Resume Session" in the EmptyState, "Resume" in the rail, the empty state of the ResumeDialog
- `SquareTerminalIcon` → the tile of an empty AreaState
- `LogInIcon` → "Resume Here"
- `LoaderCircleIcon`, rotating → the ProgressIndicator and its Spinner
- `CircleXIcon` → the ErrorMessage and the tile of an error AreaState
- `TerminalIcon` → "Sessions" in the rail, the pill "Running in a terminal" of the ResumeDialog
- `LockIcon` → the "Read-only" chip of the external view
- `ArrowDownIcon` → the "N new messages" button
- `TriangleAlertIcon` → the amber banner of a WarningDialog (RunningElsewhereWarning)
- `FolderIcon` → the "Folders" rows of the FolderChooser
- `SearchIcon` → the search bar of the ResumeDialog, "Search" in the SessionView subbar, the TerminalSearchBox
- `XIcon` → "Clear Search" in the search bar of the ResumeDialog, "Close search" in the TerminalSearchBox, the red WindowButtons button
- `ChevronUpIcon`, `ChevronDownIcon` → "Previous match" and "Next match" in the TerminalSearchBox
- `Maximize2Icon`, `Minimize2Icon` → the green WindowButtons button, to maximize and to restore
- `MoonIcon`, `SunIcon` → the ThemeSwitch in the dark and in the light theme
- `PencilIcon` → "Rename" of a list entry
- no user since the dark Studio restyle → `FolderPlusIcon`, `CircleStopIcon`, `PowerIcon`, `CircleAlertIcon`, `CirclePauseIcon`, `CircleOffIcon`, `CircleMinusIcon`, `WrenchIcon`, `ChevronRightIcon`, `CheckIcon`, and `SparkIcon` (the ember four-point star, mock artwork and not a Lucide icon: a filled shape with the class `spark`, painted with `currentColor`)

## Rules and invariants

- Each icon is decorative: `aria-hidden="true"` and not focusable. It never changes the accessible name of the button that holds it.
- The SVG is inline, so an icon makes no network request.
- Only the icons the client uses are added to the set. A new icon is copied from the same Lucide version, cited in `THIRD-PARTY-NOTICES.md`. When a board of `.sdd/mockups/vexel-material3/` draws the icon, its path data comes from the board.
- The Lucide licence file sits next to the components.

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-1`
- `plan-claude_sessions_client-ui_redesign/REQ-6`
- `plan-claude_sessions_client-ui_redesign/REQ-7`
- `plan-claude_sessions_client-ui_redesign/REQ-9`
- `plan-claude_sessions_client-ui_redesign/REQ-30`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-20`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-37`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-39`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-40`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-41`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-44`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-9`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search/REQ-17`
- `plan-light_theme/REQ-2`
- `plan-mac_title_bar/REQ-19`, `plan-mac_title_bar/REQ-21`
- `plan-terminal_addons/REQ-25`, `plan-terminal_addons/REQ-35`
