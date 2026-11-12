---
module: sessions
component: StartSessionRoute
type: REST endpoint
---

# StartSessionRoute

**Purpose** → starts a new session in a project folder, with an optional name.

## Contract

- `registerStartSessionRoute(app, { registry, tracker, names })` → registers the route.
- `POST /api/sessions` → starts a session.
  - request: `{ path, name? }` → absolute path of the project folder, and the session name.
  - `201` → session started. Body: `{ id }`.
  - `400` → `path` missing, not a string or not absolute. Body: `{ error: "invalid_path" }`.
  - `400` → `name` present and not a string. Body: `{ error: "invalid_name" }`.
  - `400` → `name` longer than 200 characters after trim. Body: `{ error: "name_too_long" }`.
  - `404` → the path does not exist or is not a folder. Body: `{ error: "folder_not_found" }`.
- a `name` that is not empty after trim → before the `201`, SessionNameStore holds the trimmed name for the key of the new session. The key follows RenameSessionRoute: the Claude Code session id, else the session id.
- `name` missing, empty or spaces only → no name is set. The session keeps its default label.

## Rules and invariants

- On `400` and `404` no session starts and no name is set.
- The checks run in this order: `path`, `name`, then the folder.
- The length counts characters (Unicode code points), as SessionNameStore.

## Dependencies

- SessionRegistry, SessionStateTracker, SessionNameStore

## Requirements served

- `plan-claude_sessions_client/REQ-1`
- `plan-recent_projects/REQ-16`, `plan-recent_projects/REQ-18`, `plan-recent_projects/REQ-19`, `plan-recent_projects/REQ-22`
