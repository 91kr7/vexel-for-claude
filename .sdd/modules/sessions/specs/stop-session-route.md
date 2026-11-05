---
module: sessions
component: StopSessionRoute
type: REST endpoint
---

# StopSessionRoute

**Purpose** → stops the CLI process of a hosted session.

## Contract

- `POST /api/sessions/:id/stop` → asks the session to stop. No request body.
  - `202` → stop requested (`Session.stop()`), empty body. The answer does not wait for the process to end.
  - `202` → also for a session whose process already ended. Nothing happens.
  - `404` → no session with that id. Body: `{ error: "session_not_found" }`.

## Rules and invariants

- When the process ends, SessionStateTracker marks the session "ended" and pushes the change to the pages.

## Dependencies

- SessionRegistry

## Requirements served

- `plan-claude_sessions_client/REQ-23`
