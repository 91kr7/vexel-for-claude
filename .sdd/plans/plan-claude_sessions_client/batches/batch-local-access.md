---
batch: local-access
feature: Local access
closed_req: [REQ-37, REQ-38, REQ-39, REQ-40, REQ-41, REQ-42, REQ-43, REQ-44, REQ-45]
depends: []
---

# Batch — Local access

Fix of 2026-11-06. The Origin check accepts today any loopback port. After this batch it accepts only the client's own origin, plus the Vite dev server in development. The batch creates no new component.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/local-access-guard.ts` | Origin rule: a request passes only when its Origin is missing, `http://localhost:<port>` or `http://127.0.0.1:<port>`, with `<port>` the port the server listens on. Any other Origin, `null` and malformed included → `403`. The Host rule does not change. | REQ-37, REQ-39, REQ-40, REQ-41, REQ-42, REQ-43, REQ-44, REQ-45 | — |
| INT-2 | modify | `src/server/local-access-guard.ts` | Optional Vite dev port: when the server passes it, `http://localhost:<vite port>` and `http://127.0.0.1:<vite port>` are also allowed. Without it, no other origin is allowed. | REQ-38 | INT-1 |
| INT-3 | modify | `src/server/main.ts` | Pass the guard the port where the server really listens, not a fixed number. Pass the Vite dev port only when the development signal of INT-4 is set. | REQ-37, REQ-38, REQ-44, REQ-45 | INT-1, INT-2 |
| INT-4 | modify | `package.json` | The `dev` script gives the server an explicit development signal with the Vite dev port, the same port as `vite.config.ts` (5173). `start` and the desktop launch set nothing. | REQ-38 | — |

## Decisions for this batch

- **Scheme.** The client serves plain HTTP, so its own origin is always `http://`. A loopback `https` origin, accepted today, is rejected.
- **Development signal.** Only the `dev` script sets it. The server does not use `NODE_ENV`: the user's shell can set `NODE_ENV=production`, and `npm start` sets nothing. A missing signal means production. This answers the spec risk "development mode detected wrongly".
- **Where a request is refused.** The check stays in the request hook that runs before every route, the static files and the WebSocket upgrade. A refused WebSocket never opens, so it gets no session data and cannot write to a terminal (REQ-43).
- **Clients without an Origin.** The desktop window loads the page from the backend's own origin, so REQ-37 covers it. The desktop app's attention client and the hook forwarder send no Origin, so REQ-42 covers them.
- **Tests.** Vitest for the rule on every Origin value and for the HTTP and WebSocket routes. Browser e2e for the page on the client's port. To get a page on another local port, the e2e can serve a fake page on `http://localhost:8080` with Playwright request routing. No Electron e2e: the batch touches no desktop code, and the knowledge base entry `electron-e2e-separate` keeps Electron tests out of the default run.

## Human acceptance

The client runs with `npm start` on port 4001, unless a scenario says otherwise.

### Scenario: The page on the client's port works as before

- REQ → REQ-37, REQ-45
- Given → a hosted session is idle in the list
- When → the user opens `http://localhost:4001`, opens the session and sends a message
- Then → the list, the terminal and Claude's response work as before the fix
- And → the same holds on `http://127.0.0.1:4001` and in the desktop app window

### Scenario: In development the Vite page works

- REQ → REQ-38
- Given → the client runs with `npm run dev`
- When → the user opens `http://localhost:5173` and starts a session
- Then → the session opens and its terminal works

### Scenario: A page of another local server cannot drive a session

- REQ → REQ-39, REQ-43
- Given → a hosted session is open in the page on port 4001
- When → a page served on `http://localhost:8080` connects to that session's terminal and types "hello"
- Then → the connection is refused and the other page receives no session data
- And → "hello" does not appear in the session terminal

### Scenario: A request with a foreign Origin is refused

- REQ → REQ-38, REQ-40, REQ-41, REQ-44
- Given → the session list shows one hosted session
- When → the user sends with `curl` a request that starts a session, once for each Origin: `http://example.com:4001`, `null`, `not-an-origin`, `http://localhost:5173`
- Then → each response is `403` with `forbidden`
- And → no new session appears in the list

### Scenario: Clients without an Origin keep working

- REQ → REQ-42, REQ-45
- Given → a hosted session works in the page, and the desktop app runs with its window closed
- When → the session asks for a permission
- Then → the list shows the session as needing input, because the hook forwarder still reaches the client
- And → the desktop app shows its notification for that session
