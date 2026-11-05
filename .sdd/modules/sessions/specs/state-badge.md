---
module: sessions
component: StateBadge
type: UI component
---

# StateBadge

**Purpose** → the state of one session as icon, colour and Italian name together. Used in the session list and, later, in the session header.

## Contract

Props:
- `state` → `working`, `needs_input`, `idle` or `ended`.

Shows:
- one inline element with the class `state-badge` and the class `state-<state>` (e.g. `state-needs_input`).
- inside it, a state icon and then the state name:

| `state` | Name | Icon | Colour token |
|---------|------|------|--------------|
| `working` | "In lavorazione" | `LoaderCircleIcon` | `--color-state-working` |
| `needs_input` | "Richiede input" | `CircleAlertIcon` | `--color-state-needs-input`, semibold |
| `idle` | "In attesa" | `CirclePauseIcon` | `--color-state-idle` |
| `ended` | "Terminata" | `CircleOffIcon` | `--color-state-ended` |

- `StateIcon` → the icon of the table alone, for a given `state`. NeedsInputCounter uses it.

## Rules and invariants

- Icon and name always appear together, in the same colour. The name is never cut and never wraps.
- Each state has its own icon, so two states never look alike without colour.
- The icon is decorative: the accessible text is the state name.

## Dependencies

- IconSet (module app)
- ThemeTokens (module app)

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-12`
- `plan-claude_sessions_client-ui_redesign/REQ-1`
- `plan-claude_sessions_client-ui_redesign/REQ-3`
