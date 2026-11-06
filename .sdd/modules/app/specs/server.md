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
- one SessionHistory and one ExternalSessionCheck with their default Claude Code folder. Registers PastSessionListRoute and ResumeSessionRoute with them, the registry and the tracker.
- one ExternalSessionScanner on that ExternalSessionCheck and SessionHistory, with the hosted pids of the registry. It starts with the server.
- passes the scanner to SessionListRoute and SessionEventsRoute.
- one AttentionMonitor on the tracker, the scanner and the registry, created before the scanner starts. Registers AttentionRoute with it.
- one TranscriptReader with the default Claude Code folder. Registers ConversationStreamRoute and ItemContentRoute with it and the scanner.
- serves the files of `dist/web` when the folder exists.
- on `SIGTERM` or `SIGINT` → it stops every running session of the SessionRegistry and waits for their exit, then closes the server and exits with code `0`. A second signal during this stop changes nothing.

## Rules and invariants

- Never reachable from another machine: no other bind address.
- LocalAccessGuard covers every route, ConversationStreamRoute and ItemContentRoute included.

## Dependencies

- LocalAccessGuard
- SessionRegistry, SessionStateTracker, HookSettings, StartSessionRoute, StopSessionRoute, AttachSessionRoute, SessionListRoute, SessionEventsRoute, HookEventRoute, AttentionMonitor, AttentionRoute (module sessions)
- FolderRoute (module folders)
- SessionHistory, ExternalSessionCheck, PastSessionListRoute, ResumeSessionRoute (module history)
- ExternalSessionScanner, TranscriptReader, ConversationStreamRoute, ItemContentRoute (module external)

## Requirements served

- `plan-claude_sessions_client/REQ-9`, `plan-claude_sessions_client/REQ-14`, `plan-claude_sessions_client/REQ-15`, `plan-claude_sessions_client/REQ-23`, `plan-claude_sessions_client/REQ-25`, `plan-claude_sessions_client/REQ-29`, `plan-claude_sessions_client/REQ-32`, `plan-claude_sessions_client/REQ-33`
- `plan-claude_sessions_client-ui_redesign/REQ-21`
- `plan-desktop_app/REQ-15`
- `plan-session_notifications/REQ-1`, `plan-session_notifications/REQ-21`
