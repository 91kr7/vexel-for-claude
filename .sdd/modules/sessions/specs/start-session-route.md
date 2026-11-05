---
module: sessions
component: StartSessionRoute
type: REST endpoint
---

# StartSessionRoute

**Purpose** → starts a new session in a project folder.

## Contract

- `POST /api/sessions` → starts a session.
  - request: `{ path }` → absolute path of the project folder
  - `201` → session started. Body: `{ id }`.
  - `400` → `path` missing, not a string or not absolute. Body: `{ error: "invalid_path" }`.
  - `404` → the path does not exist or is not a folder. Body: `{ error: "folder_not_found" }`.

## Rules and invariants

- On `400` and `404` no session starts.

## Dependencies

- SessionRegistry

## Requirements served

- `plan-claude_sessions_client/REQ-1`
