---
module: app
component: IconSet
type: UI component
---

# IconSet

**Purpose** → the Lucide icons of the client, as local React SVG components.

## Contract

Shows:
- one inline SVG with the class `icon`, sized by `--icon-size` (20 px; 16 px inside a `.chip`), drawn in the current text colour.

Components and where the client uses them today:
- `PlusIcon` → "Nuova sessione", in the EmptyState and in the rail
- `HistoryIcon` → "Riprendi sessione" in the EmptyState, "Riprendi" in the rail
- `SquareTerminalIcon` → the EmptyState
- `CircleStopIcon` → "Interrompi"
- `PowerIcon` → "Termina", in the session header
- `LogInIcon` → "Riprendi qui"
- `LoaderCircleIcon`, `CircleAlertIcon`, `CirclePauseIcon`, `CircleMinusIcon` → the StateBadge states `working`, `needs_input`, `idle`, `ended`
- `LoaderCircleIcon`, rotating → the ProgressIndicator
- `CircleXIcon` → the ErrorMessage
- `CircleOffIcon` → no user since `CircleMinusIcon` replaced it in the StateBadge
- `CircleAlertIcon` → the needs-input chip of the list panel
- `TerminalIcon` → the external Avatar and the "Esterna" tag of the session list, "Sessioni" in the rail
- `LockIcon` → the "Sola lettura" chip of the external view
- `TerminalIcon`, `PencilIcon`, `WrenchIcon` → the tool icon of a tool card in the external view
- `ChevronRightIcon`, `ChevronDownIcon` → a closed and an open tool card
- `CheckIcon`, `CircleXIcon` → the outcome chips "Fatto" and "Fallito" of a tool card
- `ArrowDownIcon` → the "N nuovi messaggi" button
- `SparkIcon` → a Claude message in the external view. It is the ember four-point star of board "Sessione esterna", mock artwork and not a Lucide icon: a filled shape with the class `spark`, painted with `currentColor`. Its size and colour come from the stylesheet.
- `TriangleAlertIcon` → the title of a WarningDialog

## Rules and invariants

- Each icon is decorative: `aria-hidden="true"` and not focusable. It never changes the accessible name of the button that holds it.
- The SVG is inline, so an icon makes no network request.
- Only the icons the client uses are in the set. A new icon is copied from the same Lucide version, cited in `THIRD-PARTY-NOTICES.md`. When a board of `.sdd/mockups/vexel-material3/` draws the icon, its path data comes from the board.
- The Lucide licence file sits next to the components.

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-1`
- `plan-claude_sessions_client-ui_redesign/REQ-6`
- `plan-claude_sessions_client-ui_redesign/REQ-7`
- `plan-claude_sessions_client-ui_redesign/REQ-9`
- `plan-claude_sessions_client-ui_redesign/REQ-30`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-20`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-37`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-39`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-40`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-41`
