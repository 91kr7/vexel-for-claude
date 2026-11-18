---
module: processes
component: ProcessList
type: backend service
---

# ProcessList

**Purpose** → turns one read of ProcessReader into the rows of the app's processes.

## Contract

- `new ProcessList({ reader, registry, tracker, ownPid, appName })` → `registry` gives `hostedPids()`, `tracker` gives `get(sessionId)`.
- `list() → Promise<ProcessRow[]>` → one row per process of classifyProcesses.
- `ProcessRow`:
  - `kind` → the kind of classifyProcesses.
  - `pid`, `startedAt` (epoch ms) → from the facts.
  - `port` → app server and test server only: the lowest port it listens on; missing when it listens on none.
  - `folder` → fake Claude and Claude session only: the working directory, when known.
  - `label` → a session hosted by the current instance: the label of SessionStateTracker for its `AI_CLIENT_SESSION_ID`, when the tracker knows it.
  - `thisInstance` → `true` only for `ownPid`.
  - `hosted` → `true` when the pid is in `hostedPids()`.
  - `hanging` → isHanging.
- order → the current instance first, then app servers, test servers, fake Claude, Claude sessions. Inside a kind: oldest `startedAt` first, then lower pid.
- calls that overlap share one read and get the same rows. A call after the read ends starts a new read.

## Rules and invariants

- It reads only when called (REQ-20): no timer, no polling.
- Ports are read only for the server rows.

## Dependencies

- ProcessReader, classifyProcesses, isHanging
- SessionRegistry, SessionStateTracker (module sessions)

## Requirements served

- `plan-app_processes/REQ-6`, `plan-app_processes/REQ-13`, `plan-app_processes/REQ-14`, `plan-app_processes/REQ-15`, `plan-app_processes/REQ-16`, `plan-app_processes/REQ-17`, `plan-app_processes/REQ-18`, `plan-app_processes/REQ-20`
