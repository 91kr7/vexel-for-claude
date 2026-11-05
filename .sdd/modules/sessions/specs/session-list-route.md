---
module: sessions
component: SessionListRoute
type: REST endpoint
---

# SessionListRoute

**Purpose** → gives the page the sessions the client hosts.

## Contract

- `GET /api/sessions` → `200`. Body: array of `{ id, folder, label, state, lastActivity }` (SessionSummary of SessionStateTracker), in start order.

## Rules and invariants

- Ended sessions stay in the array until the server stops.
- The array is the same after a page reload: it lives in the server, not in the page.

## Dependencies

- SessionStateTracker

## Requirements served

- `plan-claude_sessions_client/REQ-11`, `plan-claude_sessions_client/REQ-12`, `plan-claude_sessions_client/REQ-20`
