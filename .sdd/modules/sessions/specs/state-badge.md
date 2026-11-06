---
module: sessions
component: StateBadge
type: UI component
---

# StateBadge

**Purpose** → the state of one session as a coloured dot, a mono name or the tinted pill of `#subbar-status-badge` in `.sdd/mockups/studio-dark/mock.html`. Colours as `statusMeta()` of the mock.

## Contract

Props:
- `state` → `working`, `needs_input`, `idle` or `ended`.
- `variant` → `dot`, `inline` (default) or `chip`.

| `state` | Name | Colour | Dot pulses |
|---------|------|--------|-----------|
| `working` | "Lavora" | emerald | yes |
| `needs_input` | "Richiede input" | amber | yes |
| `idle` | "In attesa" | zinc | no |
| `ended` | "Terminata" | zinc | no |

"Colour" is the 400 tone for the dot and the text, the 500 tone at 15 % for a fill and at 30 % for a border.

Shows:
- `dot` → a decorative round 8 px dot (`aria-hidden`) in the colour. It pulses as Tailwind `animate-pulse` (opacity to 0.5 and back in 2 s) when the table says so.
- `inline` → the name alone, mono 10/15 px, in the colour. No dot: the caller shows the dot apart.
- `chip` → an inline pill: padding 2 × 8 px, 4 px radius, mono 11 px, 6 px gap, 15 % fill, 30 % border, the name in the colour, after a 6 px dot.
- `StateDot({ state })` → the dot alone, exported.

## Rules and invariants

- The name is never cut and never wraps.
- Every variant but `dot` shows the name, so the state is readable without colour. The `dot` variant is used only next to a text that names the state.
- With `prefers-reduced-motion: reduce` the dot does not pulse.

## Dependencies

- ThemeTokens, WebEntry (module app)

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-12`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-8`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-9`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-11`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-31`
