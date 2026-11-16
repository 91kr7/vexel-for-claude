---
module: sessions
component: FavoriteButton
type: UI component
---

# FavoriteButton

**Purpose** → the star button of a list entry that marks the session as favorite or removes the mark.

## Contract

Description:
- a bare star: a 20 px button with no background and no border, star icon 13 px. It has the look of ProjectFavoriteButton (module folders), from the shared star classes (`star-button`, with `marked` and `pop`). SessionList places it right after the folder name of the entry, beside the entry button, not inside it. An error shows under the entry.

Props:
- `sessionId` → the id of the hosted or external session.
- `favorite` → `true` when the session is marked. The star is filled when marked, an outline when not.
- `hidden` → `true` hides the button and its error. Optional, default `false`.

Shows:
- accessible name and tooltip "Mark as Favorite", or "Remove Favorite" when `favorite`.
- marked → a filled star in the theme amber (`--amber-400`), always shown.
- not marked → an outline star in `--text-muted` at 70 % opacity, shown only while the pointer is over the entry, while the keyboard focus is visible on the entry or on a control of the entry, while the button has keyboard focus (full opacity), or while its request runs. Else it is hidden (opacity 0).
- marked and not marked differ by shape (filled or outline), not only by colour.
- hover → full opacity, amber colour, slightly larger. The focused button shows the focus ring.
- "pop" → a short scale-up with an amber glow (about 0.3 s). It plays once when `favorite` turns `true` after a press of this button that asked to mark. It never plays on mount, on unmark, after a failed request, or when the mark comes from elsewhere (e.g. another page). It does not play when the system asks for reduced motion.
- while a request runs → `aria-disabled="true"` and `aria-busy="true"`, and a click sends nothing more.
- an ErrorMessage "Could not change the favorite mark." under the entry after a failed request. A new press clears it.

Actions:
- press → `PUT /api/sessions/:id/favorite` with `{ favorite: !favorite }`.
  - any `2xx` answer → nothing more: the change reaches the entry through the `session` event.
  - any other answer, or a network error → the error above.
- Enter or Space on the focused button presses it.

## Rules and invariants

- The button does not change `favorite` by itself: the state comes from the props.
- It does not open the session and does not start a drag.

## Dependencies

- ErrorMessage, IconSet (`StarIcon`), WebEntry (shared star classes) (module app)
- FavoriteSessionRoute

## Requirements served

- `plan-favorite_session/REQ-1`, `plan-favorite_session/REQ-5`, `plan-favorite_session/REQ-12`, `plan-favorite_session/REQ-13`
- `plan-ui_restyle/REQ-30`, `plan-ui_restyle/REQ-33`
