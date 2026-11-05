---
module: sessions
component: NeedsInputCounter
type: UI component
---

# NeedsInputCounter

**Purpose** → how many sessions need input, as the amber chip of the list panel. It copies the chip of board "Sessione ospitata".

## Contract

`countNeedsInput(sessions) → number` → the number of sessions in `needs_input`. The rail badge uses it too.

`NeedsInputCounter` props:
- `sessions` → the list from LiveSessionStore.

Shows:
- a `role="status"` element, always present. It holds the chip when N > 0 and nothing when N = 0.
- the chip → `.chip` `.label-l`, `--attn-container` background, `--on-attn-container` text: the circle-alert icon, then "N richiede input".

## Dependencies

- IconSet (`CircleAlertIcon`, module app)

## Requirements served

- `plan-claude_sessions_client/REQ-17`
- `plan-claude_sessions_client-ui_redesign/REQ-14`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-9`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-11`
