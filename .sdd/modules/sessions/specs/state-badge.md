---
module: sessions
component: StateBadge
type: UI component
---

# StateBadge

**Purpose** → the state of one session as icon and Italian name together. Used in the session list and, as a chip, in the SessionHeader.

## Contract

Props:
- `state` → `working`, `needs_input`, `idle` or `ended`.
- `variant` → `inline` (default) or `chip`.

Shows, `variant` `inline`:
- one inline element with the classes `state-badge`, `label-m` and `state-<state>` (e.g. `state-needs_input`).
- inside it, a 14 px state icon, a 4 px gap, then the state name. Icon paths and colours are those of board "Voci dell'elenco":

| `state` | Name | Icon | Colour |
|---------|------|------|--------|
| `working` | "Lavora" | `LoaderCircleIcon` | `--primary` |
| `needs_input` | "Richiede input" | `CircleAlertIcon` | the colour of its container, weight 700 |
| `idle` | "In attesa" | `CirclePauseIcon` | the colour of its container |
| `ended` | "Terminata" | `CircleMinusIcon` | the colour of its container |

Shows, `variant` `chip` (the header chip of board "Sessione ospitata"):
- one inline element with the classes `chip`, `label-l` and `state-chip`, and no `state-badge` class.
- the outlined chip: 28 px content height plus a 1 px `--outline-variant` border, padding 0 10 px 0 8 px, 8 px radius, 6 px gap, text in `--on-surface-variant` for every state.
- inside it, the 16 px icon of the table, then the state name of the table.

- `StateIcon` → the icon of the table alone, for a given `state`.

## Rules and invariants

- Icon and name always appear together, in the same colour. The name is never cut and never wraps.
- Each state has its own icon, so two states never look alike without colour.
- The icon is decorative: the accessible text is the state name.

## Dependencies

- IconSet (module app)
- ThemeTokens, WebEntry (module app): the `chip` and type classes

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-12`
- `plan-claude_sessions_client-ui_redesign/REQ-1`
- `plan-claude_sessions_client-ui_redesign/REQ-3`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-20`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-28`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-29`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-34`
