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
- `LockIcon` → the "Sola lettura" notice of the external view
- `WrenchIcon` → a tool call in the external view
- `ChevronRightIcon`, `ChevronDownIcon` → "Espandi" and "Comprimi" of a tool item in the external view
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
