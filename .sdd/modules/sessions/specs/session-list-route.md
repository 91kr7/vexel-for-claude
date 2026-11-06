---
module: sessions
component: SessionListRoute
type: REST endpoint
---

# SessionListRoute

**Purpose** → gives the page the sessions the client hosts and the external sessions.

## Contract

- `registerSessionListRoute(app, tracker, external?, runningTools?)` → `external` is the ExternalSessionScanner. Without it, the array has only hosted sessions. `runningTools` is the RunningToolMonitor. Without it, no entry has `runningTool`.
- `GET /api/sessions` → `200`. Body: array of:
  - the hosted sessions: `{ id, folder, label, state, lastActivity, waitingTool?, resumable? }` (SessionSummary of SessionStateTracker), in start order;
  - then the current external sessions: `{ id, folder, label, state, lastActivity, external: true }` (ExternalSessionScanner `list()`).
  - each entry, hosted or external, also has `runningTool` when RunningToolMonitor `get(id)` gives one.

## Rules and invariants

- Ended sessions stay in the array until DismissSessionRoute or ResumeEndedSessionRoute removes them, or the server stops.
- The array is the same after a page reload: it lives in the server, not in the page.

## Dependencies

- SessionStateTracker
- ExternalSessionScanner (module external)
- RunningToolMonitor

## Requirements served

- `plan-claude_sessions_client/REQ-11`, `plan-claude_sessions_client/REQ-12`, `plan-claude_sessions_client/REQ-20`, `plan-claude_sessions_client/REQ-29`, `plan-claude_sessions_client/REQ-30`
- `plan-session_list_improvements/REQ-2`, `plan-session_list_improvements/REQ-5`
- `plan-session_list_improvements/REQ-14`
