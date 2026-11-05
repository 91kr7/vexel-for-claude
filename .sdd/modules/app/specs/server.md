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
- at start, writes the HookSettings file for `http://127.0.0.1:<port>`.
- one shared SessionRegistry that starts the CLI with that settings file.
- one shared SessionStateTracker. It tracks every session the registry starts.
- registers StartSessionRoute, StopSessionRoute, AttachSessionRoute (with the tracker), SessionListRoute, SessionEventsRoute, HookEventRoute and FolderRoute.
- serves the files of `dist/web` when the folder exists.

## Rules and invariants

- Never reachable from another machine: no other bind address.

## Dependencies

- LocalAccessGuard
- SessionRegistry, SessionStateTracker, HookSettings, StartSessionRoute, StopSessionRoute, AttachSessionRoute, SessionListRoute, SessionEventsRoute, HookEventRoute (module sessions)
- FolderRoute (module folders)

## Requirements served

- `plan-claude_sessions_client/REQ-9`, `plan-claude_sessions_client/REQ-14`, `plan-claude_sessions_client/REQ-15`, `plan-claude_sessions_client/REQ-23`
