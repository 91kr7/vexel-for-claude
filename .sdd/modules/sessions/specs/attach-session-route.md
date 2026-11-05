---
module: sessions
component: AttachSessionRoute
type: REST endpoint (WebSocket)
---

# AttachSessionRoute

**Purpose** → connects a page to the terminal of a session.

## Contract

- `registerAttachSessionRoute(app, registry, tracker?)` → registers the route below.
- `GET /api/sessions/:id/attach` → WebSocket.
  - unknown id → the server closes the socket with code `4404`.
  - server → client: text frames of terminal output. The first frame is the snapshot of the session (screen and scrollback). Then the live output follows.
  - client → server: JSON text frames.
    - `{ "type": "input", "data": "<text>" }` → `data` goes to the pty as typed input, unchanged (Esc and control characters included). With a `tracker`, `data` also goes to `tracker.applyUserInput(id, data)`, so a lone Esc or Ctrl+C sets the session idle.
    - `{ "type": "resize", "cols": <int>, "rows": <int> }` → resizes the pty. Ignored unless both values are integers from 1 to 1000.
    - any other frame → ignored.
  - the session process ends → the server closes the socket with code `1000`.

## Rules and invariants

- The pty receives only what the client sends as `input`. The route adds nothing, so it never answers a permission request.
- Closing the socket never stops the session.

## Dependencies

- SessionRegistry
- SessionStateTracker

## Requirements served

- `plan-claude_sessions_client/REQ-2`, `plan-claude_sessions_client/REQ-3`, `plan-claude_sessions_client/REQ-4`, `plan-claude_sessions_client/REQ-5`, `plan-claude_sessions_client/REQ-6`, `plan-claude_sessions_client/REQ-8`, `plan-claude_sessions_client/REQ-14`
