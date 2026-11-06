---
module: sessions
component: SessionEventsRoute
type: REST endpoint (WebSocket)
---

# SessionEventsRoute

**Purpose** → pushes every change of the session list to the connected pages.

## Contract

- `registerSessionEventsRoute(app, tracker, external?, runningTools?)` → `external` is the ExternalSessionScanner. Without it, only hosted changes are sent. `runningTools` is the RunningToolMonitor. Without it, no frame has `runningTool`.
- `GET /api/sessions/events` → WebSocket.
  - server → client: one JSON text frame per SessionStateTracker change: `{ "type": "session", "session": <SessionSummary> }`. A new session is a change too.
  - server → client: one JSON text frame per SessionStateTracker removal (`dismiss`): `{ "type": "session-removed", "id" }`.
  - server → client: one JSON text frame per ExternalSessionScanner change: `{ "type": "session", "session": <ExternalSessionSummary> }` for an addition or a change, `{ "type": "session-removed", "id" }` for a removal.
  - each `session` frame carries `runningTool` in its session when RunningToolMonitor `get(id)` gives one at send time.
  - server → client: one JSON text frame per RunningToolMonitor change: `{ "type": "session", "session" }` with the current summary of that session (tracker `get`, else scanner `get`) and its current `runningTool`. No frame when neither knows the id.
  - client → server: frames are ignored.
  - nothing is sent on connect. The page loads the current list from SessionListRoute.

## Rules and invariants

- Every connected page gets every change and removal, in the order the tracker, the scanner and the monitor emit them.
- Closing the socket stops its frames and nothing else.

## Dependencies

- SessionStateTracker
- ExternalSessionScanner (module external)
- RunningToolMonitor

## Requirements served

- `plan-claude_sessions_client/REQ-15`, `plan-claude_sessions_client/REQ-32`
- `plan-session_list_improvements/REQ-4`
- `plan-session_list_improvements/REQ-14`, `plan-session_list_improvements/REQ-24`
