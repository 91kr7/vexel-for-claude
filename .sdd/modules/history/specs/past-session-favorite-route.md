---
module: history
component: PastSessionFavoriteRoute
type: REST endpoint
---

# PastSessionFavoriteRoute

**Purpose** → sets or clears the favorite mark of a past session, by its Claude Code session id.

## Contract

- `registerPastSessionFavoriteRoute(app, { history, favorites })` → SessionHistory, SessionFavoriteStore.
- `PUT /api/past-sessions/:id/favorite` → request `{ favorite }`.
  - `204` → the mark is set or cleared with SessionFavoriteStore `set(:id, favorite)`. Empty body.
  - `404` → SessionHistory `get(:id)` finds no past session. Body: `{ error: "session_not_found" }`.
  - `400` → `favorite` is missing or not a boolean. Body: `{ error: "invalid_favorite" }`.

## Rules and invariants

- The key of the mark is `:id` itself, the key that FavoriteSessionRoute uses for the same Claude Code session. Both routes change the same mark.
- On `400` and `404` nothing changes.
- The same request twice changes nothing the second time.
- `204` comes after the new mark went out through SessionEventsRoute: the session list updates without a reload.

## Dependencies

- SessionHistory
- SessionFavoriteStore (module sessions)

## Requirements served

- `plan-resume_favorites/REQ-5`, `plan-resume_favorites/REQ-8`
