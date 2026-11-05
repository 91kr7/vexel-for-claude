---
module: sessions
component: NeedsInputCounter
type: UI component
---

# NeedsInputCounter

**Purpose** → how many sessions need input, always in view.

## Contract

Props:
- `sessions` → the list from LiveSessionStore.

Shows:
- the text "Richiede input: N" (`role="status"`). N is the number of sessions in `needs_input`. It shows 0 too.
- N > 0 → class `active`: the needs-input icon of StateBadge before the text, needs-input colour and background, semibold.
- N = 0 → no icon, muted text on a neutral background.

## Dependencies

- StateBadge (`StateIcon`)

## Requirements served

- `plan-claude_sessions_client/REQ-17`
- `plan-claude_sessions_client-ui_redesign/REQ-14`
