---
module: processes
component: TerminateProcessRoute
type: REST endpoint
---

# TerminateProcessRoute

**Purpose** → the server route that the page calls to terminate the process of a row.

## Contract

- `POST /api/processes/terminate` → terminates one process through ProcessTerminator.
  - request: JSON `{ pid, startedAt }`, the values of the row.
  - `200` → `{ outcome }`: `ended`, `gone`, `running` or `not_allowed`.
  - `400` → `{ error: "invalid_body" }` when `pid` is not an integer ≥ 1 or `startedAt` is not a finite number. Nothing is terminated.
- the current instance → the answer `{ outcome: "ended" }` is sent first. Only after it, the server sends `SIGTERM` to itself and stops as the Server does on any `SIGTERM`.

## Rules and invariants

- The route sends no signal of its own: every signal comes from ProcessTerminator.
- LocalAccessGuard covers it, as every route.

## Dependencies

- ProcessTerminator

## Requirements served

- `plan-app_processes/REQ-23`, `plan-app_processes/REQ-30`, `plan-app_processes/REQ-31`, `plan-app_processes/REQ-32`, `plan-app_processes/REQ-34`
