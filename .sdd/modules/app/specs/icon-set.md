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
- `MacWindowIcon`, `WindowsLogoIcon` → the LookSwitch in the current and in the Windows 11 look. Drawn for the client, not Lucide icons: a window with three dots, and four rounded squares. Same `icon` class and stroke as the Lucide icons
- `CaptionMinimizeGlyph`, `CaptionMaximizeGlyph`, `CaptionRestoreGlyph`, `CaptionCloseGlyph` → the WindowButtons in the Windows 11 look. Drawn for the client on a 10 × 10 grid with a 1 px line, class `caption-glyph` instead of `icon`
- `KeyboardIcon` → the ShortcutsButton
- `GaugeIcon` → the PlanUsageButton
- `GitBranchIcon` → the GitExplorerButton and the branch chip of the GitExplorerPanel (module git)
- `RefreshCwIcon` → "Refresh" in the GitExplorerPanel (module git)
- `PencilIcon` → "Rename" of a list entry
- `StarIcon` → "Mark as Favorite" and "Remove Favorite" of a list entry (FavoriteButton), and the FavoriteIndicator. It has a filled variant (`filled`): the SVG has the class `icon-filled` and its computed `fill` is `currentColor`; the other icons keep `fill: none`
- `CirclePauseIcon` → "Interrupt" in the SessionView subbar
- no user since the dark Studio restyle → `FolderPlusIcon`, `CircleStopIcon`, `PowerIcon`, `CircleAlertIcon`, `CircleOffIcon`, `CircleMinusIcon`, `WrenchIcon`, `ChevronRightIcon`, `CheckIcon`, and `SparkIcon` (the ember four-point star, mock artwork and not a Lucide icon: a filled shape with the class `spark`, painted with `currentColor`)

## Rules and invariants

- Each icon is decorative: `aria-hidden="true"` and not focusable. It never changes the accessible name of the button that holds it.
- The SVG is inline, so an icon makes no network request.
- Only the icons the client uses are added to the set. A new icon is copied from the same Lucide version (except the look and caption glyphs above, drawn for the client), cited in `THIRD-PARTY-NOTICES.md`. When a board of `.sdd/mockups/vexel-material3/` draws the icon, its path data comes from the board.
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
- `plan-keyboard_shortcuts/REQ-22`
- `plan-usage_limits/REQ-1`
- `plan-git_explorer/REQ-1`, `plan-git_explorer/REQ-24`
- `plan-favorite_session/REQ-3`, `plan-favorite_session/REQ-4`, `plan-favorite_session/REQ-11`
- `plan-wsl_support/REQ-19`, `plan-wsl_support/REQ-28`
