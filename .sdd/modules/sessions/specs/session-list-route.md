---
module: sessions
component: SessionListRoute
type: REST endpoint
---

# SessionListRoute

**Purpose** → gives the page the sessions the client hosts and the external sessions.

## Contract

- `registerSessionListRoute(app, tracker, external?)` → `external` is the ExternalSessionScanner. Without it, the array has only hosted sessions.
- `GET /api/sessions` → `200`. Body: array of:
  - the hosted sessions: `{ id, folder, label, state, lastActivity, waitingTool? }` (SessionSummary of SessionStateTracker), in start order;
  - then the current external sessions: `{ id, folder, label, state, lastActivity, external: true }` (ExternalSessionScanner `list()`).

## Rules and invariants

- Ended sessions stay in the array until the server stops.
- The array is the same after a page reload: it lives in the server, not in the page.

## Dependencies

- SessionStateTracker
- ExternalSessionScanner (module external)

## Requirements served

- `plan-claude_sessions_client/REQ-11`, `plan-claude_sessions_client/REQ-12`, `plan-claude_sessions_client/REQ-20`, `plan-claude_sessions_client/REQ-29`, `plan-claude_sessions_client/REQ-30`
