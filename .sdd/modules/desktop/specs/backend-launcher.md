---
module: desktop
component: BackendLauncher
type: backend service
---

# BackendLauncher

**Purpose** → gives the desktop app a ready backend: it reuses one that already runs, or it starts one and waits for it.

## Contract

- `backendPort(env) → number` → the number in `env.PORT`; `4001` when `PORT` is missing or empty.
- `backendOrigin(port) → string` → `http://127.0.0.1:<port>`.
- `isBackendRunning(origin) → Promise<boolean>`
  - `true` only when `GET <origin>/api/health` answers `200` with the body `{ status: "ok" }` within 1 second.
  - any other status, another body, a network error or no answer → `false`.
- `launchBackend(options) → Promise<LaunchResult>`
  - options:
    - `rootDir` → the repository folder. The server runs in it.
    - `logFile` → the file that receives the server output.
    - `port` → optional, default `backendPort(process.env)`.
    - `nodePath` → optional. Default: `AI_CLIENT_NODE` from the environment, else `node`.
    - `command` → optional. The executable and its arguments. Default: `<nodePath> --import tsx src/server/main.ts`.
    - `readyTimeoutMs` → optional, default `15000`.
  - a backend already runs on the port → `{ status: "ready", origin, startedByApp: false }`. Nothing starts and the log file is not touched.
  - otherwise it starts the command with `NODE_ENV=production` and `PORT=<port>`, and it waits:
    - the backend runs before the command exits and within the timeout → `{ status: "ready", origin, startedByApp: true }`.
    - the command exits first → `{ status: "failed", outputLines }`.
    - the command cannot start → `{ status: "failed", outputLines }`.
    - the timeout passes → it stops the command, then `{ status: "failed", outputLines }`.
  - `outputLines` → the last 20 non-empty lines of the log file, then one line with the reason:
    - `Backend exited with code <n>.` or `Backend exited with signal <name>.`
    - `Backend not ready within <s> seconds.`
    - the system error message when the command cannot start.

## Rules and invariants

- The started server is detached from the desktop app. Its output goes to `logFile`, which each start empties. So the server keeps running after the desktop app quits.
- The launcher never passes another bind address: the server stays on `127.0.0.1` (see Server, module app).
- A program on the port that does not answer the health check counts as no backend. The started server then cannot bind, exits, and the launch fails.

## Assumptions

- **Default port 4001** (gatekeeper decision, 2026-11-06). It is the port of `npm start`, so a backend started with `npm start` is reused (REQ-5). `PORT` still overrides it.

## Dependencies

- Server (module app): the command it starts, and its `GET /api/health`.

## Requirements served

- `plan-desktop_app/REQ-4`, `plan-desktop_app/REQ-5`, `plan-desktop_app/REQ-7`, `plan-desktop_app/REQ-8`, `plan-desktop_app/REQ-9`, `plan-desktop_app/REQ-10`
