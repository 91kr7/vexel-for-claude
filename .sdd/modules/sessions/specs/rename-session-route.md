---
module: sessions
component: RenameSessionRoute
type: REST endpoint
---

# RenameSessionRoute

**Purpose** → sets or clears the name of a hosted or an external session.

## Contract

- `registerRenameSessionRoute(app, { tracker, scanner, names })` → SessionStateTracker, ExternalSessionScanner, SessionNameStore.
- `PUT /api/sessions/:id/name` → request `{ name }`.
  - `204` → the name is set with SessionNameStore `set(key, name)`. Empty body.
  - `404` → `:id` is neither a tracked hosted session nor a listed external session. Body: `{ error: "session_not_found" }`.
  - `400` → `name` is missing or not a string. Body: `{ error: "invalid_name" }`.
  - `400` → `name`, trimmed, is longer than 200 characters. Body: `{ error: "name_too_long" }`.

Key of the name:

```
:id is a hosted session (tracker.get)   → key = tracker.claudeSessionId(:id), else :id
:id is an external session (scanner.get) → key = :id
```

## Rules and invariants

- A hosted session of any state can be renamed, ended included.
- On `400` and `404` nothing changes.
- A name of spaces only, or an empty name, removes the name: the default label comes back.
- `204` comes after the new label went out through SessionEventsRoute.

## Dependencies

- SessionNameStore, SessionStateTracker
- ExternalSessionScanner (module external)

## Requirements served

- `plan-session_list_improvements/REQ-25`, `plan-session_list_improvements/REQ-31`, `plan-session_list_improvements/REQ-32`, `plan-session_list_improvements/REQ-33`
