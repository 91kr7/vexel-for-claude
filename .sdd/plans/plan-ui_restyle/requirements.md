---
slug: ui_restyle
date: 2026-11-14
spec: .sdd/analysis/ui_restyle.md
status: validated
---

# Requirements — ui_restyle

Words used below, as in the spec:

- "Project star" → the favorite action of a row in the Projects list (`plan-project_list_actions`).
- "Session star" → the favorite action of an entry in the session list (`plan-favorite_session`).
- "Remove" → the action that takes a project out of the Projects list (`plan-project_list_actions`).
- "Cards of sessions waiting for input" → the cards that show sessions which wait for the user.
- "Hovered or focused" → the pointer is over the row, or the row or a control inside it has keyboard focus.

## Feature: Top bar

| ID | Requirement |
|----|-------------|
| REQ-1 | The top bar is 44px high. |
| REQ-2 | The top bar shows no "New Session" button. |
| REQ-3 | The user still starts a new session from the "+" button of the navigation rail and from the keyboard shortcut. |

## Feature: Window buttons (desktop app, macOS look)

| ID | Requirement |
|----|-------------|
| REQ-4 | Each window button is a flat circle of 12px with a solid colour, and the buttons are 8px apart. |
| REQ-5 | The colours are close `#e0443c`, minimize `#e8b616` and maximize `#25b033`. |
| REQ-6 | Each window button has a thin 0.5px light border, made from its own colour mixed with white. |
| REQ-7 | At rest the window buttons show no gloss and no shadow. |
| REQ-8 | While the pointer is over the group, all three buttons show their symbol, as today. |
| REQ-9 | The button under the pointer gets a little brighter and shows a soft glow in its own colour, with a 0.2s transition. |
| REQ-10 | A pressed window button gets darker. |
| REQ-11 | The Windows 11 look of the window buttons does not change. |

## Feature: Project row

| ID | Requirement |
|----|-------------|
| REQ-12 | The project row shows no "New session" pill. |
| REQ-13 | A click on the project row still starts a session in that folder. |
| REQ-14 | The project star is a button next to the project name, on the first line of the row, in place of the current favorite indicator. |
| REQ-15 | On a favorite project the star always shows, filled in amber. |
| REQ-16 | On any other project the star shows as an outline, and only while the row is hovered or focused. |
| REQ-17 | A click on an outline star marks the project, and the star fills with a short "pop" animation. |
| REQ-18 | The "pop" animation does not play when the system asks for reduced motion. |
| REQ-19 | Remove is the only other action on the row, shown as a 22px circle with a thin grey X of 10px. |
| REQ-20 | Remove sits at the right end of the row, centred in height, in a column kept free for it, so it never covers the folder path. |
| REQ-21 | Remove shows only while the row is hovered or focused. |
| REQ-22 | On hover, Remove gets a soft red background and a soft red X. |
| REQ-23 | The folder path shows no native browser tooltip. |
| REQ-24 | A click on the star or on Remove acts only on that control and does not start a session. |
| REQ-25 | Favorite and Remove keep their current effect and their current error messages. |
| REQ-26 | The star and Remove are reachable with the keyboard, and each shows when it has focus, also on a row that is not hovered. |
| REQ-27 | The star has an accessible name that says whether a click marks or unmarks the project. |
| REQ-28 | A marked and an unmarked star differ by shape (filled or outline), not only by colour. |

## Feature: Session star

| ID | Requirement |
|----|-------------|
| REQ-29 | In the session list the session star sits next to the session name, on the first line of the entry, and no longer in the top-right corner. |
| REQ-30 | The session star looks and behaves like the project star of REQ-15 to REQ-18 and REQ-26 to REQ-28. |
| REQ-31 | The top-right corner of a session entry keeps only the Rename action. |
| REQ-32 | The cards of sessions waiting for input follow REQ-29 to REQ-31. |
| REQ-33 | The session favorite mark keeps its current logic. |

## Feature: Terminal

| ID | Requirement |
|----|-------------|
| REQ-34 | The terminal panel has a 16px margin on all four sides. |
| REQ-35 | The focus ring of the terminal does not overlap the session footer. |

## Feature: Startup screen (desktop app)

Added on 2026-11-15 by a human decision, outside the spec. The startup screen is what the desktop window shows while the backend starts, or when it cannot start.

| ID | Requirement |
|----|-------------|
| REQ-36 | The bar of the startup screen is 44px high, like the top bar of REQ-1. |
| REQ-37 | The window buttons of the startup screen have the size, gap, colours, light border and plain rest look of REQ-4 to REQ-7. |
| REQ-38 | On the startup screen the button under the pointer gets brighter with a soft glow, and a pressed button gets darker, as in REQ-9 and REQ-10. |
| REQ-39 | The window button symbols of the startup screen are black at 60%, so they keep the 3:1 contrast of `plan-mac_title_bar/REQ-26`. |
| REQ-40 | When the app finishes loading, the bar and the window buttons keep their height, place and look. |

## Assumptions

All come from the spec, where the gatekeeper decided them.

- **Mock.** The mock approved by the user decides any visual detail that the request does not state. Its copy is `.sdd/mockups/ui_restyle/mock.html`.
- **Colours (REQ-15, REQ-22).** Amber and rose come from the current theme, so the light and dark themes both keep them.
- **Unmark (REQ-17).** A click on a filled star still unmarks, as today. Only the marking gets the animation.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Only the five changes of the spec, plus the startup screen (human decision). No other visual change.
- The favorite and remove logic, their stored data, their sync and their error messages do not change. Every requirement of `plan-project_list_actions`, `plan-favorite_session` and `plan-mac_title_bar` stays true, except the look and the place the REQs above change.
- Out of scope: the favorite indicator in the resume history, the "+" button of the navigation rail and the new-session keyboard shortcut.
- Every change works in the browser page and in the desktop app.
