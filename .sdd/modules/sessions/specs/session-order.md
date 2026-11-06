---
module: sessions
component: groupSessions, orderSessions
type: frontend function
---

# groupSessions, orderSessions

**Purpose** → the groups of the session list and the order inside each group.

## Contract

- `SessionOrder` → for each group `id`, a list of session ids. A group may be missing.
- `groupSessions(sessions, order = {}) → SessionGroup[]` → `SessionGroup` is `{ id, title, sessions }`. The inputs are not changed.
  - groups, in this order:

    | `id` | `title` | Sessions |
    |------|---------|----------|
    | `needs-input` | "Needs Input" | state `needs_input`, hosted or external |
    | `running` | "Running" | hosted, state `working` or `idle` |
    | `external` | "In Other Terminals" | external, state `working` or `idle` |
    | `ended` | "Ended" | state `ended` |

  - a group with no session is left out.
  - inside each group, the sessions listed in `order[id]` come first, in that order. An id listed twice counts at its first place.
  - then the sessions of the group missing from `order[id]`, the most recent `lastActivity` first. Equal times keep their input order.
  - an id in `order[id]` with no session in that group changes nothing.
  - with an empty order, the whole group is in latest-activity order.

- `orderSessions(sessions) → SessionSummary[]` → a new sorted array. The input is not changed.
  - sessions in `needs_input` come first.
  - inside each part, the most recent `lastActivity` comes first.
  - equal keys keep their input order.

## Rules and invariants

- Every session is in exactly one group.

## Requirements served

- `plan-claude_sessions_client/REQ-16`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-16`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-17`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-18`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-1`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-1` to `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-4`
