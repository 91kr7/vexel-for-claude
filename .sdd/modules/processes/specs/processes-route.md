---
module: processes
component: ProcessesRoute
type: REST endpoint
---

# ProcessesRoute

**Purpose** → gives the page the rows of the app's processes.

## Contract

- `GET /api/processes` → reads the list at each call.
  - `200` → body `{ processes: ProcessRow[] }`, in the order of ProcessList.
  - `500` → the read failed.

## Dependencies

- ProcessList

## Requirements served

- `plan-app_processes/REQ-10`, `plan-app_processes/REQ-11`, `plan-app_processes/REQ-22`
