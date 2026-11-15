---
module: folders
component: ProjectRemoveButton
type: UI component
---

# ProjectRemoveButton

**Purpose** → the icon button of a project row that removes the project from the Projects list.

## Contract

Description:
- a 22 px circle with a thin X icon of 10 px in `--text-muted`, no background. ProjectList places it at the right end of the row. An error shows under the row.

Props:
- `folder` → the folder of the project.

Shows:
- accessible name and tooltip "Remove from Projects".
- hover → soft red from the theme: `--rose-500-15` background and `--rose-400` X. The focused button shows the focus ring.
- while a request runs → `aria-disabled="true"` and `aria-busy="true"`, and a press sends nothing more.
- an ErrorMessage "Could not remove the project." after a failed request. A new press clears it.

Actions:
- press → `POST /api/projects/remove` with `{ folder }` at once, with no confirmation.
  - `204` → nothing more: the row leaves the list through ProjectMarkLiveStore.
  - any other answer, or a network error → the error above.
- Enter or Space on the focused button presses it.

## Rules and invariants

- The button does not hide the row by itself.
- It does not choose the project.
- All text is in English.

## Dependencies

- ErrorMessage, IconSet (`XIcon`) (module app)
- ProjectRemoveRoute

## Requirements served

- `plan-project_list_actions/REQ-12`, `plan-project_list_actions/REQ-13`, `plan-project_list_actions/REQ-21`, `plan-project_list_actions/REQ-22`
- `plan-ui_restyle/REQ-19`, `plan-ui_restyle/REQ-22`, `plan-ui_restyle/REQ-24`, `plan-ui_restyle/REQ-25`
