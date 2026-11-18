---
module: processes
component: TerminateProcessDialog
type: UI component
---

# TerminateProcessDialog

**Purpose** → the confirmation that names the process before "Terminate" ends it.

## Contract

Props:
- `row` → the ProcessRow to terminate.
- `onConfirm`, `onCancel`.

Description:
- a WarningDialog with the `error` accent (rose primary action), with "Cancel" focused on open.

Shows:
- title "Terminate the Process?".
- the name in bold: "<kind> · PID <pid>", kind as in the list ("App server", "Test server", "Fake Claude", "Claude session").
- after the name: " · port <port>" when the row has a port, else " · <label>" when it has a session label, else nothing.
- on the next line:
  - the current instance → "This is the instance you are using. Terminating it closes the app and ends every session it hosts."
  - another app server or a test server → "The sessions it hosts end too."
  - a fake Claude or a Claude session → no text.
- actions "Cancel" and the primary "Terminate".

Actions:
- "Terminate" → `onConfirm()`.
- "Cancel", Esc or "[Esc]" → `onCancel()`.

## Dependencies

- WarningDialog (module app)

## Requirements served

- `plan-app_processes/REQ-24`, `plan-app_processes/REQ-25`, `plan-app_processes/REQ-26`, `plan-app_processes/REQ-27`, `plan-app_processes/REQ-33`
