---
batch: favorites-filter
feature: Favorites filter
closed_req: [REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19]
depends: [popup-mark]
---

# Batch favorites-filter — Favorites filter

REQ ids refer to `plan-resume_favorites/requirements.md`. "Resume popup" and "favorites filter" are defined there. The resume popup is the ResumeDialog of module history.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/history/ResumeDialog.tsx` | Toggle button "Only Favorites" (`aria-pressed`) beside the search bar, with `StarIcon` filled when on and outline when off, and a pressed look. Off at each opening, never saved. It does not take the focus on open. | REQ-10, REQ-13, REQ-16, REQ-17, REQ-18, REQ-19 | — |
| INT-2 | modify | `src/web/history/ResumeDialog.tsx` | Filter on → a session is visible only if it has `favorite` and passes the search rule. A group with no visible session is hidden. Filter off → the search rule alone, as today. | REQ-11, REQ-12, REQ-14 | INT-1 |
| INT-3 | modify | `src/web/history/ResumeDialog.tsx` | Filter on, groups exist, no session visible → compact AreaState `empty` with the history icon: "No favorite sessions." with an empty search, `No favorite sessions match "<search text>".` otherwise. | REQ-15, REQ-19 | INT-2 |

## Decisions

- **Depends on `popup-mark`.** REQ-14 needs the mark action of the popup. A row unmarked with the filter on loses `favorite` at once (`batch-popup-mark/INT-4`), so INT-2 hides it with no extra code.
- **Selection.** The existing rule holds: when the filter hides the selected session, no session is selected and "Resume" is disabled.
- **Focus and keys.** The search bar keeps the focus on open. Tab order: search bar, "Clear Search" when shown, "Only Favorites", then the list. Enter and Space on the toggle switch it. Enter does not resume (Dialog rule for buttons). The toggle shows the focus ring.
- **On or off without colour.** The state shows by the star shape (filled or outline) and by `aria-pressed`. The colour of the pressed look only adds to it.
- **Empty list.** With no past session at all, "No sessions to resume." stays, also with the filter on.
- **Texts.** "Only Favorites" is the name and the tooltip of the toggle. With the empty states of INT-3, these are the new texts of the plan, in English. The texts of `popup-mark` are those of FavoriteButton, already in English. So REQ-19 closes here.
- **Tests (knowledge base `electron-e2e-separate`).** Vitest for the filter rule and the empty states of ResumeDialog. Playwright e2e in the browser: the filter with and without search text, off again at the next opening, unmark with the filter on, keyboard use, focus on the search bar at open. No Electron e2e.

## Human acceptance

### Scenario: The user shows only the favorite sessions

- REQ → REQ-10, REQ-11, REQ-16, REQ-19
- Given → the resume popup lists favorite and other sessions
- When → the user turns on "Only Favorites" and types part of a favorite label in the search bar
- Then → only the favorite rows that match the text show, and the toggle shows a filled star and its pressed look
- And → turning the toggle off shows every row that matches the text again

### Scenario: The filter starts off

- REQ → REQ-12, REQ-13, REQ-18
- Given → the user turned on "Only Favorites" and closed the popup
- When → the user opens "Resume Session" again
- Then → the toggle is off, every past session shows, and the search bar has the keyboard focus

### Scenario: An unmarked row leaves the filtered list

- REQ → REQ-14
- Given → "Only Favorites" is on and shows two favorite rows
- When → the user presses "Remove Favorite" on one of them
- Then → that row leaves the list, and the other one stays

### Scenario: No favorite matches

- REQ → REQ-15
- Given → "Only Favorites" is on
- When → the user types a text that no favorite label or folder contains
- Then → the popup shows `No favorite sessions match "<text>".`

### Scenario: The filter works with the keyboard

- REQ → REQ-17
- Given → the resume popup is open with the focus in the search bar
- When → the user reaches "Only Favorites" with Tab and presses Space
- Then → the toggle shows a visible focus ring and turns on
