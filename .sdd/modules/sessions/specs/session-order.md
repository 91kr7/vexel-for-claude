---
module: sessions
component: orderSessions
type: frontend function
---

# orderSessions

**Purpose** → the display order of the session list.

## Contract

- `orderSessions(sessions) → SessionSummary[]` → a new sorted array. The input is not changed.
  - sessions in `needs_input` come first.
  - inside each group, the most recent `lastActivity` comes first.
  - equal keys keep their input order.

## Requirements served

- `plan-claude_sessions_client/REQ-16`
