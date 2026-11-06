---
module: sessions
component: nextSessionOrder
type: frontend function
---

# nextSessionOrder

**Purpose** → the order rule: the new order of each group of the session list, from the previous order and the current sessions.

## Contract

- `nextSessionOrder(previous, sessions) → SessionOrder` → a new order. The inputs are not changed.
  - every session goes in the list of its group, as `groupSessions` decides the group.
  - a session already in the previous list of its group keeps its place. The other sessions keep their relative order.
  - a new session, or one that is now in another group, goes at the end of its group. Several of them → the most recent `lastActivity` first.
  - a session missing from `sessions` drops out of the order.
  - a session that left a group is no longer in that group's list. If it comes back, it is new there and goes at the end.
  - a group with no session has no list.
  - empty `previous` → each group in latest-activity order.

## Rules and invariants

- `groupSessions(sessions, nextSessionOrder(previous, sessions))` lists the sessions in the same order as `groupSessions(sessions, previous)`.
- Every session id of `sessions` is in exactly one list. No list has an id that is not in `sessions`.

## Dependencies

- groupSessions (`SessionOrder`)

## Requirements served

- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-1` to `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-4`
