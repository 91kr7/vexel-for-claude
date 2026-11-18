---
module: processes
component: ProcessesSection
type: UI component
---

# ProcessesSection

**Purpose** → the "Processes" menu of the settings popup: the list of the app's processes, with "Terminate" on each row.

## Contract

Props:
- `load` → optional, default loadProcesses.
- `terminate` → optional, default terminateProcess.
- `quitApp` → optional, default the quit request of useDesktopBridge.
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
  - a "Terminate" button (rose, compact) on every row, the current instance included. While its terminate runs it is busy: disabled, with a spinner.
  - under the row, the error of its last terminate, when there is one (see "Terminate").

Actions:
- mount → one load.
- "Refresh" → a new load; the loading state shows until it ends. A load still running is aborted.

Terminate:
- "Terminate" on a row → opens TerminateProcessDialog for that row.
- "Cancel" or Esc → the dialog closes; nothing else changes.
- "Terminate" in the dialog → the dialog closes, the row's button is busy, `terminate(pid, startedAt)` runs. When it answers:
  - the current instance's row and `ended` → `quitApp()` (the desktop app quits; nothing in a browser).
  - `running` → the row error "The process did not end."
  - `not_allowed` → "You are not allowed to end this process."
  - `failed` → "Could not terminate the process."
  - `ended`, `gone` → no error; an older error of that row is removed.
  - then a new load, as "Refresh".
- focus after that load, when the focus was lost (on the page body):
  - the row is still listed → its "Terminate" button gets the focus.
  - the row left the list, or the load failed → "Refresh" gets the focus. So Esc still closes the popup.
  - a focus that the user moved elsewhere in the meantime stays where it is.
- a row error is kept by PID and start time: it shows again under the row after each load, as long as the row is listed. A row with the same PID and another start time does not get it.

Keyboard:
- Tab reaches "Refresh", then the "Process List" region, which scrolls with the arrow keys, then each row's "Terminate". All show the focus ring. Enter or Space on "Terminate" opens the dialog.

## Rules and invariants

- no load runs on a timer: only mount and "Refresh" load (REQ-10, REQ-11).
- a load that ends after unmount, or after a newer load started, changes nothing.

## Dependencies

- SettingsPane, AreaState, ErrorMessage, ProgressIndicator, useDesktopBridge (module app)
- loadProcesses, terminateProcess, TerminateProcessDialog, runningTimeText

## Requirements served

- `plan-app_processes/REQ-10`, `plan-app_processes/REQ-11`, `plan-app_processes/REQ-12`, `plan-app_processes/REQ-13`, `plan-app_processes/REQ-14`, `plan-app_processes/REQ-15`, `plan-app_processes/REQ-16`, `plan-app_processes/REQ-17`, `plan-app_processes/REQ-18`, `plan-app_processes/REQ-19`, `plan-app_processes/REQ-21`, `plan-app_processes/REQ-22`, `plan-app_processes/REQ-23`, `plan-app_processes/REQ-26`, `plan-app_processes/REQ-31`, `plan-app_processes/REQ-32`, `plan-app_processes/REQ-33`, `plan-app_processes/REQ-34`
