---
module: history
component: ResumeSessionRoute
type: REST endpoint
---

# ResumeSessionRoute

**Purpose** → resumes a past Claude Code session in the client.

## Contract

- `POST /api/past-sessions/:id/resume` → starts a hosted session that resumes the past session `:id`. No body.
  - `201` → session started. Body: `{ id }`, the id of the new hosted session (SessionRegistry).
  - `404` → SessionHistory has no session `:id`, or the session has no folder. Body: `{ error: "session_not_found" }`.
  - `404` → the folder of the session does not exist or is not a folder. Body: `{ error: "folder_not_found" }`.
- effect on `201` → `registry.start(folder, { sessionId: id, firstUserMessage })` with the data from SessionHistory.
- `resumePastSession(deps, id) → { id } | { error }` → the same resume step, for other routes. `deps` is `{ history, registry }`.
  - started → `{ id }`, the id of the new hosted session.
  - `{ error: "session_not_found" }` or `{ error: "folder_not_found" }` → in the same cases as the `404` answers. No session starts.

## Rules and invariants

- On `404` no session starts.
- The route answers with the result of `resumePastSession`: `{ id }` with `201`, `{ error }` with `404`.
- It does not check if the session runs elsewhere. The page warns the user before it calls the route.

## Dependencies

- SessionHistory
- SessionRegistry (module sessions)

## Requirements served

- `plan-claude_sessions_client/REQ-25`, `plan-claude_sessions_client/REQ-26`
- `plan-session_list_improvements/REQ-8`
