---
slug: resume_favorites
date: 2026-11-17
spec: .sdd/analysis/resume_favorites.md
status: validated
---

# Requirements — Favorites in the resume session popup

Words used below, as in the spec and in `plan-favorite_session`:

- "Resume popup" → the dialog "Resume Session" with the past sessions. `plan-favorite_session` calls it "resume history".
- "Favorite mark" and "favorite indicator" → the same mark and indicator defined by `plan-favorite_session`.
- "Session list" → the main list of sessions, with its list entries.
- "Favorites filter" → the new control of the resume popup that shows only favorite sessions.

## Feature: Popup size

| ID | Requirement |
|----|-------------|
| REQ-1 | The resume popup is about 1.5 times as wide as today. |
| REQ-2 | The resume popup is shorter than today and no longer fills almost the whole window. |
| REQ-3 | The list of past sessions scrolls inside the popup when it does not fit. |
| REQ-4 | In a small window the popup stays fully visible and usable. |

## Feature: Mark from the resume popup

| ID | Requirement |
|----|-------------|
| REQ-5 | Each row of the resume popup offers an action to mark the session as favorite, or to remove the mark. |
| REQ-6 | The mark action does not resume the session and does not close the popup. |
| REQ-7 | The favorite indicator of the row updates at once after the mark action. |
| REQ-8 | A mark changed in the popup is the same mark that the session list shows, and the session list updates without a reload. |
| REQ-9 | The mark action is usable with the keyboard, with visible focus. |

## Feature: Favorites filter

| ID | Requirement |
|----|-------------|
| REQ-10 | The resume popup offers a favorites filter that shows only the favorite sessions. |
| REQ-11 | With the filter on, a row shows only if it is a favorite and it matches the search text. |
| REQ-12 | With the filter off, the list behaves as it does today. |
| REQ-13 | The filter is off each time the popup opens. |
| REQ-14 | If the user unmarks a session while the filter is on, its row leaves the list. |
| REQ-15 | With the filter on and no row to show, the popup shows an empty state that says no favorite session matches. |
| REQ-16 | The filter control shows whether it is on or off, not by colour alone. |
| REQ-17 | The filter control is usable with the keyboard, with visible focus. |
| REQ-18 | The search bar has the keyboard focus when the popup opens, as today. |
| REQ-19 | Every new text of the UI is in English. |

## Feature: Project path while scrolling

Fix of 2026-11-17. The batches of the three features above are certified. This feature is planned on top of them.

| ID | Requirement |
|----|-------------|
| REQ-20 | While the user scrolls the list of the resume popup, the project path of the sessions in view stays visible, and it changes when they belong to another project. |
| REQ-21 | A long project path stays readable, and the user can see its full value. |

## Assumptions

All come from the spec, where the gatekeeper decided them. None is a human decision.

- **Exact size (REQ-1, REQ-2).** The exact width and height are a design choice of the implementer. REQ-1 and REQ-2 set only the direction and the rough ratio.
- **Filter state (REQ-13).** The filter state is not saved. Nothing new is persisted.
- **Mark in the session list.** The mark action on the session list entry stays as it is.
- **REQ-19.** It covers the texts of both the mark action and the filter. It closes with the filter, the last feature.
- **Which path (REQ-20).** The visible path is the project path of the first session in view, fixed at the top of the list. It works the same with the search or the favorites filter on. Its exact look is a design choice of the implementer.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- The popup does not sort favorites first.
- Out of scope: a favorites filter, group or sort in the session list; saving the filter state; marking several sessions at once; any change to other dialogs.
- Every requirement of `plan-favorite_session` stays true, except that the resume popup now offers a mark action.
