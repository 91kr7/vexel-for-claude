---
module: sessions
component: NeedsInputCounter
type: UI component
---

# NeedsInputCounter

**Purpose** → how many sessions need input, as the amber `#subbar-status-badge` pill of `.sdd/mockups/studio-dark/mock.html`, in the list panel header.

## Contract

`countNeedsInput(sessions) → number` → the number of sessions in `needs_input`. The rail badge uses it too.

`NeedsInputCounter` props:
- `sessions` → the list from LiveSessionStore.

Shows:
- a `role="status"` element, always present. It holds the pill when N > 0 and nothing when N = 0.
- the pill → the StateBadge `chip` look in amber: the pulsing amber dot, then "N richiede input".

## Dependencies

- StateBadge (`StateDot`), ThemeTokens, WebEntry (module app)

## Requirements served

- `plan-claude_sessions_client/REQ-17`
- `plan-claude_sessions_client-ui_redesign/REQ-14`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-21`
