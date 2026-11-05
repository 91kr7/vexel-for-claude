---
module: app
component: IconSet
type: UI component
---

# IconSet

**Purpose** → the Lucide icons of the client, as local React SVG components.

## Contract

Shows:
- one inline SVG with the class `icon`, sized by `--icon-size`, drawn in the current text colour.

Components and where the client uses them today:
- `PlusIcon` → "Nuova sessione"
- `HistoryIcon` → "Riprendi sessione"
- `CircleStopIcon` → "Interrompi"
- `PowerIcon` → "Termina", in the session toolbar
- `LogInIcon` → "Riprendi qui"

## Rules and invariants

- Each icon is decorative: `aria-hidden="true"` and not focusable. It never changes the accessible name of the button that holds it.
- The SVG is inline, so an icon makes no network request.
- Only the icons the client uses are in the set. A new icon is copied from the same Lucide version, cited in `THIRD-PARTY-NOTICES.md`.
- The Lucide licence file sits next to the components.

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-1`
- `plan-claude_sessions_client-ui_redesign/REQ-6`
- `plan-claude_sessions_client-ui_redesign/REQ-7`
