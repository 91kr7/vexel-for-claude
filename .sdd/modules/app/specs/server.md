---
module: app
component: Server
type: configuration
---

# Server

**Purpose** → the Fastify process: it wires the routes and serves the built page.

## Contract

- listens on `127.0.0.1` only, port from `PORT` (default `3000`).
- applies LocalAccessGuard to every request, for the port where it listens.
- development signal → `AI_CLIENT_VITE_DEV_PORT`, a port number. When it holds a valid port (1–65535), the guard also allows the origins of that port. Missing or invalid → no other origin. `NODE_ENV` plays no part.
- `GET /api/health` → `200`, body `{ status: "ok" }`.
- at start, writes the HookSettings file for `http://127.0.0.1:<port>`.
- one shared SessionRegistry that starts the CLI with that settings file.
- one SessionNameStore, loaded at start from the data folder (`dataDirOf()`: `AI_CLIENT_DATA_DIR`, else `$XDG_DATA_HOME/ai-client`).
- one shared SessionStateTracker with that name store. It tracks every session the registry starts.
- registers StartSessionRoute, StopSessionRoute, AttachSessionRoute (with the tracker), SessionListRoute, SessionEventsRoute, HookEventRoute, DismissSessionRoute (with the tracker), RenameSessionRoute (with the tracker, the scanner and the name store) and FolderRoute.
- one SessionHistory and one ExternalSessionCheck with their default Claude Code folder. Registers PastSessionListRoute (also with the name store), ResumeSessionRoute and ResumeEndedSessionRoute with them, the registry and the tracker.
- one ExternalSessionScanner on that ExternalSessionCheck and SessionHistory, with the hosted pids of the registry and the name store. It starts with the server.
- it starts listening only after one `scan()` of that scanner has settled. A scan that fails or throws does not stop the listen.
- passes the scanner to SessionListRoute and SessionEventsRoute.
- one AttentionMonitor on the tracker, the scanner and the registry, created before the scanner starts. Registers AttentionRoute with it.
- one TranscriptReader with the default Claude Code folder. Registers ConversationStreamRoute and ItemContentRoute with it and the scanner.
- one RunningToolMonitor on the tracker, the scanner and that TranscriptReader, created before the scanner starts. It starts with the server and stops on `SIGTERM` or `SIGINT`. Passed to SessionListRoute and SessionEventsRoute.
- one UsageMonitor on the tracker, the scanner and that TranscriptReader, created before the scanner starts. It starts with the server and stops on `SIGTERM` or `SIGINT`. Passed to SessionListRoute and SessionEventsRoute.
- serves the files of `dist/web` when the folder exists.
- on `SIGTERM` or `SIGINT` → it stops every running session of the SessionRegistry and waits for their exit, then closes the server and exits with code `0`. A second signal during this stop changes nothing.

## Rules and invariants

- Never reachable from another machine: no other bind address.
- LocalAccessGuard covers every route, ConversationStreamRoute and ItemContentRoute included.

## Dependencies

- LocalAccessGuard
- SessionRegistry, SessionStateTracker, SessionNameStore, RenameSessionRoute, HookSettings, StartSessionRoute, StopSessionRoute, AttachSessionRoute, SessionListRoute, SessionEventsRoute, HookEventRoute, DismissSessionRoute, ResumeEndedSessionRoute, AttentionMonitor, AttentionRoute, RunningToolMonitor, UsageMonitor (module sessions)
- FolderRoute (module folders)
- SessionHistory, ExternalSessionCheck, PastSessionListRoute, ResumeSessionRoute (module history)
- ExternalSessionScanner, TranscriptReader, ConversationStreamRoute, ItemContentRoute (module external)

## Requirements served

- `plan-claude_sessions_client/REQ-9`, `plan-claude_sessions_client/REQ-14`, `plan-claude_sessions_client/REQ-15`, `plan-claude_sessions_client/REQ-23`, `plan-claude_sessions_client/REQ-25`, `plan-claude_sessions_client/REQ-29`, `plan-claude_sessions_client/REQ-32`, `plan-claude_sessions_client/REQ-33`, `plan-claude_sessions_client/REQ-37`, `plan-claude_sessions_client/REQ-38`, `plan-claude_sessions_client/REQ-44`, `plan-claude_sessions_client/REQ-45`, `plan-claude_sessions_client/REQ-48`, `plan-claude_sessions_client/REQ-50`, `plan-claude_sessions_client/REQ-51`
- `plan-claude_sessions_client-ui_redesign/REQ-21`
- `plan-desktop_app/REQ-15`
- `plan-session_notifications/REQ-1`, `plan-session_notifications/REQ-21`
- `plan-session_list_improvements/REQ-4`, `plan-session_list_improvements/REQ-8`, `plan-session_list_improvements/REQ-14`, `plan-session_list_improvements/REQ-25`, `plan-session_list_improvements/REQ-35`
- `plan-session_usage/REQ-1`, `plan-session_usage/REQ-12`
