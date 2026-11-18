---
module: processes
component: ProcessesSection
type: UI component
---

# ProcessesSection

**Purpose** → the "Processes" menu of the settings popup: the read-only list of the app's processes.

## Contract

Props:
- `load` → optional, default loadProcesses.
- `now` → optional clock in epoch ms, default `Date.now`.

Description:
- a SettingsPane titled "Processes" with the action "Refresh" in the header. The body is the region "Process List".

Shows:
- while a load runs → AreaState `loading`, compact, "Loading processes…".
- a failed load → AreaState `error`, compact, "Could not load the processes."
- no rows → AreaState `empty`, compact, one line: "No app processes are running."
- else the list "Processes", one row per process in the order of the server:
  - the kind: "App server", "Test server", "Fake Claude" or "Claude session".
  - the marks, when true: "This instance", "Hosted here", "Hanging".
  - the details: the session label, "PID <pid>", "Port <port>", "Running <runningTimeText>", the folder. A missing value shows nothing.

Actions:
- mount → one load.
- "Refresh" → a new load; the loading state shows until it ends. A load still running is aborted.

Keyboard:
- Tab reaches "Refresh", then the "Process List" region, which scrolls with the arrow keys. Both show the focus ring.

## Rules and invariants

- no load runs on a timer: only mount and "Refresh" load (REQ-10, REQ-11).
- a load that ends after unmount, or after a newer load started, changes nothing.

## Dependencies

- SettingsPane, AreaState (module app), loadProcesses, runningTimeText

## Requirements served

- `plan-app_processes/REQ-10`, `plan-app_processes/REQ-11`, `plan-app_processes/REQ-12`, `plan-app_processes/REQ-13`, `plan-app_processes/REQ-14`, `plan-app_processes/REQ-15`, `plan-app_processes/REQ-16`, `plan-app_processes/REQ-17`, `plan-app_processes/REQ-18`, `plan-app_processes/REQ-19`, `plan-app_processes/REQ-21`, `plan-app_processes/REQ-22`
