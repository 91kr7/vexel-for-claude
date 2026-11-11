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
- `stop()` → closes the socket and cancels a pending reconnection. Later frames and the pending load change nothing.
- `subscribe(listener) → unsubscribe` → `listener()` after each change of the list.
- `getSnapshot()` → the current list. The same array until the next change.
- `getStatus()` → the load status of the list:
  - `loading` → from `start()` until the first list arrives.
  - `ready` → the list of the current connection arrived and its events socket is open.
  - `error` → the list request fails (network error or a non-2xx answer), or the events socket closes or fails while the store runs.
  - a status change also calls the `subscribe` listeners.
- Reconnection → after each `error`, the store opens a new events socket 2 s later, and again every 2 s while the attempts fail. The status stays `error` during the attempts.
  - a new connection loads `GET /api/sessions` again and replaces the whole list with it. The events received while loading apply after it. Then the status is `ready`.
  - a later failure gives `error` and new attempts again, at every disconnection.
  - `stop()` ends the attempts: no new socket after it.
- `useLiveSessions()` → React hook: one store on `window.location.origin`, started on mount, stopped on unmount. Returns `{ sessions, status }`: the current list and the load status.

## Rules and invariants

- The list starts empty and holds only data received from the server. A failed load leaves it as it was.
- `stop()` does not change the status: a socket closed by `stop()` is not an error.
- Frames that are not `{ type: "session" }` or `{ type: "session-removed" }` are ignored.
- Entries keep the `external: true` marker the server gives to external sessions, the `resumable: true` marker of hosted sessions, and the `favorite: true` marker the server gives to a marked session. A later event without `favorite` clears it.

## Dependencies

- SessionListRoute, SessionEventsRoute

## Requirements served

- `plan-claude_sessions_client/REQ-11`, `plan-claude_sessions_client/REQ-15`, `plan-claude_sessions_client/REQ-20`, `plan-claude_sessions_client/REQ-29`, `plan-claude_sessions_client/REQ-32`
- `plan-claude_sessions_client-ui_redesign/REQ-29`, `plan-claude_sessions_client-ui_redesign/REQ-30`
- `plan-claude_sessions_client/REQ-46`, `plan-claude_sessions_client/REQ-47`, `plan-claude_sessions_client/REQ-48`, `plan-claude_sessions_client/REQ-52`, `plan-claude_sessions_client/REQ-53`
