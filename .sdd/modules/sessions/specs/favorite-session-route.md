---
module: sessions
component: FavoriteSessionRoute
type: REST endpoint
---

# FavoriteSessionRoute

**Purpose** → sets or clears the favorite mark of a hosted or an external session.

## Contract

- `registerFavoriteSessionRoute(app, { tracker, scanner, favorites })` → SessionStateTracker, ExternalSessionScanner, SessionFavoriteStore.
- `PUT /api/sessions/:id/favorite` → request `{ favorite }`.
  - `204` → the mark is set or cleared with SessionFavoriteStore `set(key, favorite)`. Empty body.
  - `404` → `:id` is neither a tracked hosted session nor a listed external session. Body: `{ error: "session_not_found" }`.
  - `400` → `favorite` is missing or not a boolean. Body: `{ error: "invalid_favorite" }`.

Key of the mark:

```
:id is a hosted session (tracker.get)    → key = tracker.claudeSessionId(:id), else :id
:id is an external session (scanner.get) → key = :id
```

## Rules and invariants

- A hosted session of any state can be marked, ended included.
- On `400` and `404` nothing changes.
- The same request twice changes nothing the second time.
- `204` comes after the new mark went out through SessionEventsRoute.

## Dependencies

- SessionFavoriteStore, SessionStateTracker
- ExternalSessionScanner (module external)

## Requirements served

- `plan-favorite_session/REQ-1`, `plan-favorite_session/REQ-2`, `plan-favorite_session/REQ-5`
