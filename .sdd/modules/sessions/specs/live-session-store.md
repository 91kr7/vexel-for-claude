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
  - a `session` event for a known id replaces that entry. For an unknown id it adds the entry at the end.
  - a `session-removed` event removes the entry with that `id`. An unknown id changes nothing.
  - calling `start()` again first stops the previous connection.
- `stop()` → closes the socket. Later frames and the pending load change nothing.
- `subscribe(listener) → unsubscribe` → `listener()` after each change of the list.
- `getSnapshot()` → the current list. The same array until the next change.
- `getStatus()` → the load status of the list:
  - `loading` → from `start()` until the first list arrives.
  - `ready` → the first list arrived and the events connection is open.
  - `error` → the list request fails (network error or a non-2xx answer), or the events socket closes or fails while the store runs. It stays `error`: the store does not reconnect.
  - a status change also calls the `subscribe` listeners.
- `useLiveSessions()` → React hook: one store on `window.location.origin`, started on mount, stopped on unmount. Returns `{ sessions, status }`: the current list and the load status.

## Rules and invariants

- The list starts empty and holds only data received from the server. A failed load leaves it as it was.
- `stop()` does not change the status: a socket closed by `stop()` is not an error.
- Frames that are not `{ type: "session" }` or `{ type: "session-removed" }` are ignored.
- Entries keep the `external: true` marker the server gives to external sessions, and the `resumable: true` marker of hosted sessions.

## Dependencies

- SessionListRoute, SessionEventsRoute

## Requirements served

- `plan-claude_sessions_client/REQ-11`, `plan-claude_sessions_client/REQ-15`, `plan-claude_sessions_client/REQ-20`, `plan-claude_sessions_client/REQ-29`, `plan-claude_sessions_client/REQ-32`
- `plan-claude_sessions_client-ui_redesign/REQ-29`, `plan-claude_sessions_client-ui_redesign/REQ-30`
