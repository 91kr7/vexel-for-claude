---
module: sessions
component: FavoriteButton
type: UI component
---

# FavoriteButton

**Purpose** → the icon button of a list entry that marks the session as favorite or removes the mark.

## Contract

Description:
- a 20 px square icon button, 4 px radius, star icon 14 px, in `--text-muted` on `--bg-surface-2`. It looks as "Rename" of SessionList and sits beside the entry button, not inside it. An error shows under the entry.

Props:
- `sessionId` → the id of the hosted or external session.
- `favorite` → `true` when the session is marked. The star is filled when marked, an outline when not.
- `hidden` → `true` hides the button and its error. Optional, default `false`.

Shows:
- accessible name and tooltip "Mark as Favorite", or "Remove Favorite" when `favorite`.
- hidden (opacity 0) until the pointer is over the entry or the focus inside the entry is visible from the keyboard. It stays shown while a request runs. Hover → `--bg-surface-3` and `--text-primary`. The focused button shows the focus ring.
- while a request runs → `aria-disabled="true"` and `aria-busy="true"`, and a click sends nothing more.
- an ErrorMessage "Could not change the favorite mark." under the entry after a failed request. A new press clears it.

Actions:
- press → `PUT /api/sessions/:id/favorite` with `{ favorite: !favorite }`.
  - `204` → nothing more: the change reaches the entry through the `session` event.
  - any other answer, or a network error → the error above.
- Enter or Space on the focused button presses it.

## Rules and invariants

- The button does not change `favorite` by itself: the state comes from the props.
- It does not open the session and does not start a drag.

## Dependencies

- ErrorMessage, IconSet (`StarIcon`) (module app)
- FavoriteSessionRoute

## Requirements served

- `plan-favorite_session/REQ-1`, `plan-favorite_session/REQ-5`, `plan-favorite_session/REQ-12`, `plan-favorite_session/REQ-13`
