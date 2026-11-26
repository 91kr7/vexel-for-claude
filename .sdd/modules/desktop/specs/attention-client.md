---
module: desktop
component: AttentionClient
type: backend service
---

# AttentionClient

**Purpose** → connects the desktop app to AttentionRoute and passes on its events and lists. It connects again after a drop.

## Contract

- `connectAttention(origin, handlers, options?) → { stop() }`
  - `origin` → the backend origin, e.g. `http://127.0.0.1:4001`.
  - it opens a WebSocket to `/api/attention` of that origin at once.
  - `handlers.onNeedsInput(sessions)` → for each `needs-input` frame. Each list replaces the previous one.
  - `handlers.onEvent(event)` → for each `event` frame.
  - `options.retryMs` → wait before a new try. Default: 2000.
  - the socket closes or cannot connect → a new try after `retryMs`, and so on after each failed try.
  - `stop()` → closes the socket. No more tries and no more handler calls.

Frames (the shapes of AttentionRoute, module sessions):

- `{ type: "needs-input", sessions: AttentionSession[] }`, with `AttentionSession` = `{ sessionId, folder, label, waitingSince? }`, all strings. `waitingSince` is optional, so a backend that does not send it still works.
- `{ type: "event", event: AttentionEvent }`, with `AttentionEvent` = `{ id, sessionId, kind, folder, label, waitingTool?, waitingDetail?, excerpt?, error? }`. `kind` is `"needs_input"`, `"turn_end"` or `"session_end"`. `error` is a boolean, required when `kind` is `"session_end"`. `waitingDetail` is an object (below). The other fields are strings.
- `WaitingDetail` → `{ kind: "argument", text: string }` or `{ kind: "questions", questions: [{ question: string, options: string[] }] }` with at least one question.

## Rules and invariants

- A frame that is not JSON, or that does not have one of the shapes above, is ignored.
- A `waitingDetail` of a wrong shape, or on an event that is not `needs_input`, is dropped: the event is passed on without it.
- At most one socket is open at a time.
- It uses no Electron API.

## Dependencies

- AttentionRoute (module sessions), over the network

## Requirements served

- `plan-session_notifications/REQ-1`, `plan-session_notifications/REQ-2`, `plan-session_notifications/REQ-4`, `plan-session_notifications/REQ-14`
- `plan-session_notifications/REQ-21`
- `plan-session_notifications/REQ-33`, `plan-session_notifications/REQ-35`
- `plan-remote_notifications/REQ-31`, `plan-remote_notifications/REQ-32`
