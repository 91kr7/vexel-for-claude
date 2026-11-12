---
module: folders
component: SessionNameDialog
type: UI component
---

# SessionNameDialog

**Purpose** → the name dialog: asks for the name of a new session in a chosen project, then starts the session in its folder. It copies step "2 · Nome della sessione" of `.sdd/mockups/recent_projects/mock.html`.

## Contract

Props:
- `project` → the chosen Project (ProjectListStore).
- `onStarted(sessionId)` → called once the session has started.
- `onCancel()` → called by "Cancel", "[Esc]" and the Esc key.

Description:
- a Dialog with the title "New session" and the primary action "Start Session".

Shows:
- the project box → the Avatar of the folder, the folder name (`folderNameOf`) and the full path in mono. Background `--bg-surface-1`, 1 px `--border-subtle` border, 10 px radius.
- the field "Session name" → a text input, empty at open, with the focus. At most 200 characters.
- under the field, the hint "Leave it empty to use the default name. Enter starts, Esc cancels." in `--text-muted`.
- a failed start → the ErrorMessage "Could not start the session." under the field.

Actions:
- "Start Session", or Enter in the field → `POST /api/sessions` with `{ path: <project folder>, name: <field text trimmed, cut to 200 characters> }`.
  - while the request runs → "Start Session" is busy (Dialog `primaryBusy`). A second Enter sends nothing.
  - `201` → `onStarted(id)` with the `id` of the body.
  - any other answer, or a network failure → the ErrorMessage shows, and the dialog stays open. A new start hides the old message.
- Esc, "Cancel" or "[Esc]" → `onCancel()`. No request is sent.

Focus:
- on open → the field. On close → the Dialog rule: back to the element that had the focus before.

## Rules and invariants

- All text is in English.
- The dialog sends one request per start, and no request on cancel.
- The length counts characters (Unicode code points).

## Dependencies

- ProjectListStore (`Project`)
- Dialog, ErrorMessage (module app)
- Avatar, `folderNameOf` (module sessions)
- StartSessionRoute (module sessions), over HTTP

## Requirements served

- `plan-recent_projects/REQ-14`, `plan-recent_projects/REQ-16`, `plan-recent_projects/REQ-18`, `plan-recent_projects/REQ-19`, `plan-recent_projects/REQ-20`, `plan-recent_projects/REQ-21`, `plan-recent_projects/REQ-22`, `plan-recent_projects/REQ-23`, `plan-recent_projects/REQ-24`
