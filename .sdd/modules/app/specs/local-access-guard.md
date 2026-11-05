---
module: app
component: LocalAccessGuard
type: backend service (request hook)
---

# LocalAccessGuard

**Purpose** → blocks every request that does not come from a page of the local machine.

## Contract

- `isLocalRequest(host, origin) → boolean` → `true` when a request with these `Host` and `Origin` headers passes (rules below).
- `registerLocalAccessGuard(app)` → adds the check to every HTTP and WebSocket request of the Fastify app.
- A request passes when:
  - its `Host` header names `localhost` or `127.0.0.1`, with any port or none (case-insensitive), and
  - its `Origin` header is missing, or it is an `http` or `https` origin on `localhost` or `127.0.0.1`, with any port or none.
- Any other request → `403`, body `{ error: "forbidden" }`. A WebSocket upgrade is refused with the same `403` before the socket opens.
- After the `403` to a refused WebSocket upgrade, the server closes the connection.

## Rules and invariants

- The check runs before every route, the static files and the not-found handler.

## Requirements served

- `plan-claude_sessions_client/REQ-9`
