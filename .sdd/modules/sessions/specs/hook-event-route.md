---
module: sessions
component: HookEventRoute
type: REST endpoint
---

# HookEventRoute

**Purpose** → receives the Claude Code hook events of a session and updates its state.

## Contract

- `POST /api/sessions/:id/hook-events` → `:id` is the client session id (`AI_CLIENT_SESSION_ID` of the CLI process).
  - request: `content-type: application/json`. Body: the hook input JSON, as Claude Code gives it. Only `hook_event_name`, `tool_name`, `notification_type` and `prompt` are read.
  - `204` → event passed to SessionStateTracker (also when it changes nothing).
  - `400` → body not a JSON object, or `hook_event_name` not a string. Body: `{ error: "invalid_event" }`.
  - `404` → no session with that id. Body: `{ error: "session_not_found" }`.
  - accepts bodies up to 64 MiB.

## Rules and invariants

- LocalAccessGuard applies: only local callers reach it.

## Dependencies

- SessionStateTracker

## Requirements served

- `plan-claude_sessions_client/REQ-14`
