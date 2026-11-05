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
- `PlusIcon` → "Nuova sessione", in the top bar, the rail and the EmptyState
- `HistoryIcon` → "Riprendi sessione" in the EmptyState, "Riprendi" in the rail, the empty state of the ResumeDialog
- `SquareTerminalIcon` → the tile of an empty AreaState
- `LogInIcon` → "Riprendi qui"
- `LoaderCircleIcon`, rotating → the ProgressIndicator and its Spinner
- `CircleXIcon` → the ErrorMessage and the tile of an error AreaState
- `TerminalIcon` → "Sessioni" in the rail, the pill "In esecuzione in un terminale" of the ResumeDialog
- `LockIcon` → the "Sola lettura" chip of the external view
- `ArrowDownIcon` → the "N nuovi messaggi" button
- `TriangleAlertIcon` → the amber banner of a WarningDialog (RunningElsewhereWarning)
- `FolderIcon` → the "Cartelle" rows of the FolderChooser
- no user since the dark Studio restyle → `FolderPlusIcon`, `CircleStopIcon`, `PowerIcon`, `CircleAlertIcon`, `CirclePauseIcon`, `CircleOffIcon`, `CircleMinusIcon`, `WrenchIcon`, `PencilIcon`, `ChevronRightIcon`, `ChevronDownIcon`, `CheckIcon`, and `SparkIcon` (the ember four-point star, mock artwork and not a Lucide icon: a filled shape with the class `spark`, painted with `currentColor`)

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
