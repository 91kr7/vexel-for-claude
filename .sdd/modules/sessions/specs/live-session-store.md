---
module: sessions
component: LiveSessionStore
type: frontend service
---

# LiveSessionStore

**Purpose** → the session list in the page, kept current without a reload.

## Contract

- `new LiveSessionStore(origin)` → `origin` is the server origin, e.g. `http://127.0.0.1:3000`.
- `start()` → opens SessionEventsRoute (`ws` or `wss` on the same origin). When the socket opens, it loads `GET /api/sessions` and replaces the list with the result. Then it applies the events received while loading, then every new event.
  - an event for a known id replaces that entry. An event for an unknown id adds it at the end.
  - calling `start()` again first stops the previous connection.
- `stop()` → closes the socket. Later frames and the pending load change nothing.
- `subscribe(listener) → unsubscribe` → `listener()` after each change of the list.
- `getSnapshot()` → the current list. The same array until the next change.
- `useLiveSessions()` → React hook: one store on `window.location.origin`, started on mount, stopped on unmount. Returns the current list.

## Rules and invariants

- The list starts empty and holds only data received from the server.
- Frames that are not `{ type: "session" }` are ignored.

## Dependencies

- SessionListRoute, SessionEventsRoute

## Requirements served

- `plan-claude_sessions_client/REQ-11`, `plan-claude_sessions_client/REQ-15`, `plan-claude_sessions_client/REQ-20`
