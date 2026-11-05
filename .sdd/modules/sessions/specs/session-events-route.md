---
module: sessions
component: SessionEventsRoute
type: REST endpoint (WebSocket)
---

# SessionEventsRoute

**Purpose** → pushes every change of the session list to the connected pages.

## Contract

- `GET /api/sessions/events` → WebSocket.
  - server → client: one JSON text frame per SessionStateTracker change: `{ "type": "session", "session": <SessionSummary> }`. A new session is a change too.
  - client → server: frames are ignored.
  - nothing is sent on connect. The page loads the current list from SessionListRoute.

## Rules and invariants

- Every connected page gets every change, in the order the tracker emits them.
- Closing the socket stops its frames and nothing else.

## Dependencies

- SessionStateTracker

## Requirements served

- `plan-claude_sessions_client/REQ-15`
