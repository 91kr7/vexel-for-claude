---
module: processes
component: terminateProcess
type: frontend function
---

# terminateProcess

**Purpose** → the page call of TerminateProcessRoute, with its answer checked.

## Contract

- `terminateProcess(pid, startedAt) → Promise<TerminateOutcome>`, never rejects. One `POST /api/processes/terminate` with the JSON body `{ pid, startedAt }`.
- `TerminateOutcome` → `ended`, `gone`, `running`, `not_allowed` or `failed`.
- answer `200` with `outcome` one of `ended`, `gone`, `running`, `not_allowed` → that outcome.
- network error, status other than `200`, a body that is not JSON, or any other `outcome` → `failed`.

## Dependencies

- TerminateProcessRoute

## Requirements served

- `plan-app_processes/REQ-31`, `plan-app_processes/REQ-32`, `plan-app_processes/REQ-34`
