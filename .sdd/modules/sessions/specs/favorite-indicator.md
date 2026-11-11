---
module: sessions
component: FavoriteIndicator
type: UI component
---

# FavoriteIndicator

**Purpose** → the sign that a session has the favorite mark, the same in the session list and in the resume history.

## Contract

Description:
- a small filled star (`StarIcon`, filled), 12 px, in `--amber-400` (readable in the dark and in the light theme).

Shows:
- the star with the accessible name "Favorite" (`role="img"`) and the tooltip "Favorite".
- it is told apart without colour: the star shape and the name.
- it never shrinks in a flex line.

## Rules and invariants

- No props. The caller decides when to show it.
- It is not focusable and takes no action.

## Dependencies

- IconSet (`StarIcon`) (module app)

## Requirements served

- `plan-favorite_session/REQ-3`, `plan-favorite_session/REQ-4`, `plan-favorite_session/REQ-11`, `plan-favorite_session/REQ-12`
