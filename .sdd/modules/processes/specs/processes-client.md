---
module: processes
component: loadProcesses
type: frontend function
---

# loadProcesses

**Purpose** → the page call of ProcessesRoute, with its answer checked.

## Contract

- `loadProcesses(signal?) → Promise<ProcessesResult>`, never rejects. One `GET /api/processes`, aborted by `signal`.
- `ProcessesResult` → `{ status: "loaded", processes }` or `{ status: "failed" }`.
- answer `200` with `processes` as a list of valid rows → `loaded`, rows in the same order.
- a valid row → `kind` is one of the four kinds; `pid` and `startedAt` are numbers; `thisInstance`, `hosted`, `hanging` are booleans; `port` is a number and `folder`, `label` are text when present.
- network error, abort, status other than `200`, a body that is not JSON, or one invalid row → `failed`.

## Dependencies

- ProcessesRoute

## Requirements served

- `plan-app_processes/REQ-10`, `plan-app_processes/REQ-11`
