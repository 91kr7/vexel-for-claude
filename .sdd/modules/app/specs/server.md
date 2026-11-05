---
module: app
component: Server
type: configuration
---

# Server

**Purpose** → the Fastify process: it wires the routes and serves the built page.

## Contract

- listens on `127.0.0.1` only, port from `PORT` (default `3000`).
- applies LocalAccessGuard to every request.
- `GET /api/health` → `200`, body `{ status: "ok" }`.
- registers StartSessionRoute, AttachSessionRoute and FolderRoute, with one shared SessionRegistry.
- serves the files of `dist/web` when the folder exists.

## Rules and invariants

- Never reachable from another machine: no other bind address.

## Dependencies

- LocalAccessGuard
- SessionRegistry, StartSessionRoute, AttachSessionRoute (module sessions)
- FolderRoute (module folders)

## Requirements served

- `plan-claude_sessions_client/REQ-9`
