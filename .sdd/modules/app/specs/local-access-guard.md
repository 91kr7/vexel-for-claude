---
module: app
component: LocalAccessGuard
type: backend service (request hook)
---

# LocalAccessGuard

**Purpose** → blocks every request that does not come from the client's own page, or from a local program that sends no Origin.

## Contract

- `isLocalRequest(host, origin, allowedPorts?) → boolean` → `true` when a request with these `Host` and `Origin` headers passes, with `allowedPorts` the ports whose origins are allowed (rules below). Without `allowedPorts`, no origin is allowed: only a missing Origin passes.
- `registerLocalAccessGuard(app, options?)` → adds the check to every HTTP and WebSocket request of the Fastify app.
  - the allowed ports are the port where `app` listens, plus `options.viteDevPort` when given.
  - before `app` listens, only the Vite dev port is allowed, if given.
- A request passes when:
  - its `Host` header names `localhost` or `127.0.0.1`, with any port or none (case-insensitive), and
  - its `Origin` header is missing, or it is exactly `http://localhost:<p>` or `http://127.0.0.1:<p>`, with `<p>` one of the allowed ports (scheme and host case-insensitive).
- An Origin without a port means port `80`.
- Rejected Origins, among others: any other port, `https`, a host that is not `localhost` or `127.0.0.1`, `null`, an empty or malformed value, a trailing path or slash.
- Any other request → `403`, body `{ error: "forbidden" }`. A WebSocket upgrade is refused with the same `403` before the socket opens.
- After the `403` to a refused WebSocket upgrade, the server closes the connection.

## Rules and invariants

- The check runs before every route, the static files and the not-found handler.
- A refused WebSocket never opens: it receives no data and cannot send any.
- Without `viteDevPort`, the only allowed origins are the two of the listening port.

## Requirements served

- `plan-claude_sessions_client/REQ-9`, `plan-claude_sessions_client/REQ-37`, `plan-claude_sessions_client/REQ-38`, `plan-claude_sessions_client/REQ-39`, `plan-claude_sessions_client/REQ-40`, `plan-claude_sessions_client/REQ-41`, `plan-claude_sessions_client/REQ-42`, `plan-claude_sessions_client/REQ-43`, `plan-claude_sessions_client/REQ-44`
