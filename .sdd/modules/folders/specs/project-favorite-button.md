---
module: folders
component: ProjectFavoriteButton
type: UI component
---

# ProjectFavoriteButton

**Purpose** → the icon button of a project row that marks the project as favorite or removes the mark.

## Contract

Description:
- a bare star: a 20 px button with no background and no border, star icon 13 px. ProjectList places it right after the folder name of the row. An error shows under the row.
- its look comes from the shared star classes (`star-button`, with `marked` and `pop`), that the session star reuses. The row that holds it carries `star-host`.

Props:
- `folder` → the folder of the project.
- `favorite` → `true` when the project is marked. The star is filled when marked, an outline when not.

Shows:
- accessible name and tooltip "Mark as Favorite", or "Remove Favorite" when `favorite`.
- marked → a filled star in the theme amber (`--amber-400`), always shown.
- not marked → an outline star in `--text-muted` at 70 % opacity, shown only while the pointer is over the row, while the keyboard focus is visible on the row or on a control of the row, while the button has keyboard focus (full opacity), or while its request runs. Else it is hidden (opacity 0).
- marked and not marked differ by shape (filled or outline), not only by colour.
- hover → full opacity, amber colour, slightly larger. The focused button shows the focus ring.
- "pop" → a short scale-up with an amber glow (about 0.3 s). It plays once when `favorite` turns `true` after a press of this button that asked to mark. It never plays on mount, on unmark, after a failed request, or when the mark comes from elsewhere (e.g. another page). It does not play when the system asks for reduced motion.
- while a request runs → `aria-disabled="true"` and `aria-busy="true"`, and a press sends nothing more.
- an ErrorMessage "Could not change the favorite mark." after a failed request. A new press clears it.

Actions:
- press → `PUT /api/projects/favorite` with `{ folder, favorite: !favorite }`.
  - `204` → nothing more: the change reaches the row through ProjectMarkLiveStore.
  - any other answer, or a network error → the error above.
- Enter or Space on the focused button presses it.

## Rules and invariants

- The button does not change `favorite` by itself: the state comes from the props.
- It does not choose the project.
- All text is in English.

## Dependencies

- ErrorMessage, IconSet (`StarIcon`) (module app)
- ProjectFavoriteRoute

## Requirements served

- `plan-project_list_actions/REQ-23`, `plan-project_list_actions/REQ-31`, `plan-project_list_actions/REQ-32`
- `plan-ui_restyle/REQ-14`, `plan-ui_restyle/REQ-15`, `plan-ui_restyle/REQ-16`, `plan-ui_restyle/REQ-17`, `plan-ui_restyle/REQ-18`, `plan-ui_restyle/REQ-24`, `plan-ui_restyle/REQ-25`, `plan-ui_restyle/REQ-26`, `plan-ui_restyle/REQ-27`, `plan-ui_restyle/REQ-28`
