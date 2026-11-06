---
module: sessions
component: AttentionRoute
type: REST endpoint (WebSocket)
---

# AttentionRoute

**Purpose** → sends the events and the needs-input list of the AttentionMonitor to the desktop app.

## Contract

- `registerAttentionRoute(app, monitor)` → `monitor` is the AttentionMonitor.
- `GET /api/attention` → WebSocket.
  - on connect → one JSON text frame `{ "type": "needs-input", "sessions": [<AttentionSession>] }` with the current list.
  - after each change of the list → the same frame with the new list.
  - after each event → `{ "type": "event", "event": <AttentionEvent> }`.
  - client → server: frames are ignored.

## Rules and invariants

- No history. A client gets the list of the moment it connects, then the later changes and events. It never gets an older event.
- Each connected client gets each list change and each event once, in the order the monitor gives them.
- Closing the socket stops its frames and nothing else.

## Dependencies

- AttentionMonitor

## Requirements served

- `plan-session_notifications/REQ-1`, `plan-session_notifications/REQ-5`, `plan-session_notifications/REQ-6`, `plan-session_notifications/REQ-11`
