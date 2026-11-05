---
module: sessions
component: SessionEventsRoute
type: REST endpoint (WebSocket)
---

# SessionEventsRoute

**Purpose** → pushes every change of the session list to the connected pages.

## Contract

- `registerSessionEventsRoute(app, tracker, external?)` → `external` is the ExternalSessionScanner. Without it, only hosted changes are sent.
- `GET /api/sessions/events` → WebSocket.
  - server → client: one JSON text frame per SessionStateTracker change: `{ "type": "session", "session": <SessionSummary> }`. A new session is a change too.
  - server → client: one JSON text frame per ExternalSessionScanner change: `{ "type": "session", "session": <ExternalSessionSummary> }` for an addition or a change, `{ "type": "session-removed", "id" }` for a removal.
  - client → server: frames are ignored.
  - nothing is sent on connect. The page loads the current list from SessionListRoute.

## Rules and invariants

- Every connected page gets every change, in the order the tracker and the scanner emit them.
- Closing the socket stops its frames and nothing else.

## Dependencies

- SessionStateTracker
- ExternalSessionScanner (module external)

## Requirements served

- `plan-claude_sessions_client/REQ-15`, `plan-claude_sessions_client/REQ-32`
