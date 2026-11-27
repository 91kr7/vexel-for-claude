---
module: activity
component: TurnRoute
type: REST endpoint
---

# TurnRoute

**Purpose** → streams the tree of the current turn of a hosted or an external session to the page.

## Contract

- `registerTurnRoute(app, { monitor, tracker, scanner })` → `monitor` is the ActivityMonitor (`turnOf`, `onTurnChange`), `tracker` the SessionStateTracker (`get`), `scanner` the ExternalSessionScanner (`get`).
- WebSocket `GET /api/sessions/:id/turn`
  - `:id` → a hosted session id (`tracker.get`) or an external session id (`scanner.get`).
  - unknown id → the socket closes with code `4404` (reason `session_not_found`), with no frame.
  - first frame → `{ type: "turn", turn }`: the whole tree of `monitor.turnOf(id)` (`noTurn()` when the monitor has none).
  - then → one frame per `onTurnChange` of that session, as given: `{ type: "turn", turn }` for a new turn, or `{ type: "update", … }` with only the changed groups, `earlier` groups, status and subagents (turnTreeOf `turnChangeOf`). No frame carries a step of the main conversation.
  - frames are JSON text. The route never reads the socket.

## Rules and invariants

- The socket gets no frame of another session.
- Closing the socket ends its subscription to the monitor.
- The route reads only the monitor: no file read on the path of a frame.
- LocalAccessGuard covers it, as every route.

## Dependencies

- ActivityMonitor, turnTreeOf (`noTurn`, `TurnChange`)
- SessionStateTracker (module sessions), ExternalSessionScanner (module external)

## Requirements served

- `plan-session_activity/REQ-27`, `plan-session_activity/REQ-43`, `plan-session_activity/REQ-45`
- `plan-subagent_panel/REQ-1`
