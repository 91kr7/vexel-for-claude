---
batch: project-row
feature: Project row
closed_req: [REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28]
depends: []
---

# Batch project-row

Requirements: `.sdd/plans/plan-ui_restyle/requirements.md`. Request mock: `.sdd/mockups/ui_restyle/mock.html`. The mock decides the visual details that the REQs do not state. It sets the look only, never the scope.

"Hovered or focused" means the pointer is over the row, or the row or a control inside it has keyboard focus.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/folders/ProjectList.tsx` | Remove the "▶ New session" label and the `title` of the path. Click, Enter and Space on the row still choose the project. | REQ-12, REQ-13, REQ-23 | — |
| INT-2 | modify | `src/web/folders/ProjectList.tsx` | Put the ProjectFavoriteButton right after the folder name on line 1, in place of the FavoriteIndicator. Do not nest it inside the row button. Keep the ProjectRemoveButton as the only other action. | REQ-14, REQ-19, REQ-24, REQ-26 | INT-1 |
| INT-3 | modify | `src/web/folders/ProjectFavoriteButton.tsx` | Drop the square button look: a bare star, filled when marked, outline when not. Play the "pop" only after a press that marks the project, never on load or on a change from another page. | REQ-15, REQ-16, REQ-17, REQ-28 | — |
| INT-4 | modify | `src/web/folders/ProjectFavoriteButton.tsx` | Keep the accessible name and tooltip ("Mark as Favorite" / "Remove Favorite"), the request, the busy state and the error message as they are. | REQ-25, REQ-27 | INT-3 |
| INT-5 | modify | `src/web/folders/ProjectRemoveButton.tsx` | A 22px circle with a thin grey X of 10px. Keep the accessible name, the request, the busy state and the error message. | REQ-19, REQ-22, REQ-25 | — |
| INT-6 | modify | `src/web/styles.css` (`.project-row*`) | Give the row `padding-right: 36px`. Put Remove in that column, right end, centred in height. Show it only while the row is hovered or focused, and on its own focus. Hover → rose background and rose X from the theme. | REQ-19, REQ-20, REQ-21, REQ-22, REQ-26 | INT-2, INT-5 |
| INT-7 | modify | `src/web/styles.css` (new shared star classes) | Star classes that the session star reuses: filled amber from the theme when marked and always shown; outline only while the row is hovered or focused, or on its own focus. Short "pop" keyframes, off under `prefers-reduced-motion: reduce`. | REQ-15, REQ-16, REQ-17, REQ-18, REQ-26, REQ-28 | INT-3 |
| INT-8 | modify | `src/web/folders/ProjectList.test.tsx`, `src/web/folders/ProjectFavoriteButton.test.tsx`, `src/web/folders/ProjectRemoveButton.test.tsx`, `e2e/project-list.spec.ts`, `e2e/favorite-project.spec.ts`, `e2e/remove-project.spec.ts`, `e2e/project-search.spec.ts`, `e2e/project-session-start.spec.ts` | Remove the checks on the "New session" label and the path tooltip. Check the star place and states, the pop and reduced motion, Remove look and place, keyboard reach. A click on the star or on Remove starts no session. | REQ-12 to REQ-28 | INT-1 to INT-7 |

Notes:
- The FavoriteIndicator component stays: the resume history still uses it.
- The ProjectFavoriteButton error and the ProjectRemoveButton error still show under the row.

## Human acceptance

### Scenario: The user marks a project from the star next to its name

- REQ → REQ-12, REQ-14, REQ-15, REQ-16, REQ-17, REQ-24
- Given → the Projects list shows a project that is not a favorite
- When → the user moves the pointer over the row and clicks the outline star next to the project name
- Then → the star fills in amber with a short pop, stays visible when the pointer leaves the row, no session starts, and the row shows no "New session" label

### Scenario: The user removes a project with the X at the right end of the row

- REQ → REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-25
- Given → the Projects list shows a project with a long folder path
- When → the user moves the pointer over the row and clicks the round X at its right end
- Then → the X turned soft red under the pointer and never covered the path, the path showed no browser tooltip, and the project leaves the list

### Scenario: A click on the row still starts a session

- REQ → REQ-13
- Given → the Projects list shows an available project
- When → the user clicks the row outside the star and the X
- Then → the session start begins in that folder, as before

### Scenario: The star and the X work from the keyboard

- REQ → REQ-26, REQ-27, REQ-28
- Given → the Projects list is open and the pointer is not over any row
- When → the user moves through the row with Tab
- Then → the star and then the X appear when each has focus, and a screen reader reads "Mark as Favorite" or "Remove Favorite"; a marked star is filled and an unmarked one is an outline

### Scenario: No pop with reduced motion

- REQ → REQ-18
- Given → the system asks for reduced motion
- When → the user marks a project with the star
- Then → the star fills with no animation

### Scenario: A failed favorite change shows the current error

- REQ → REQ-25
- Given → the server cannot save the mark
- When → the user clicks the star
- Then → "Could not change the favorite mark." shows under the row
