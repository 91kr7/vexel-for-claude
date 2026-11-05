---
module: sessions
component: groupSessions, orderSessions
type: frontend function
---

# groupSessions, orderSessions

**Purpose** → the groups of the session list and the order inside each group.

## Contract

- `groupSessions(sessions) → SessionGroup[]` → `SessionGroup` is `{ id, title, sessions }`. The input is not changed.
  - groups, in this order:

    | `id` | `title` | Sessions |
    |------|---------|----------|
    | `needs-input` | "Richiedono input" | state `needs_input`, hosted or external |
    | `running` | "In corso" | hosted, state `working` or `idle` |
    | `external` | "In altri terminali" | external, state `working` or `idle` |
    | `ended` | "Terminate" | state `ended` |

  - a group with no session is left out.
  - inside each group, the most recent `lastActivity` comes first. Equal times keep their input order.

- `orderSessions(sessions) → SessionSummary[]` → a new sorted array. The input is not changed.
  - sessions in `needs_input` come first.
  - inside each part, the most recent `lastActivity` comes first.
  - equal keys keep their input order.

## Rules and invariants

- Every session is in exactly one group.

## Requirements served

- `plan-claude_sessions_client/REQ-16`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-16`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-17`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-18`
