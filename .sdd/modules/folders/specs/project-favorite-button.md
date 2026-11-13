---
module: folders
component: ProjectFavoriteButton
type: UI component
---

# ProjectFavoriteButton

**Purpose** → the icon button of a project row that marks the project as favorite or removes the mark.

## Contract

Description:
- the same look as FavoriteButton (module sessions): a 20 px square icon button, 4 px radius, star icon 14 px, in `--text-muted` on `--bg-surface-2`. ProjectList places it beside the row button. An error shows under the row.

Props:
- `folder` → the folder of the project.
- `favorite` → `true` when the project is marked. The star is filled when marked, an outline when not.

Shows:
- accessible name and tooltip "Mark as Favorite", or "Remove Favorite" when `favorite`.
- hover → `--bg-surface-3` and `--text-primary`. The focused button shows the focus ring.
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
