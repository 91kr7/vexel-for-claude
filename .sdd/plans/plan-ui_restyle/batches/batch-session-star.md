---
batch: session-star
feature: Session star
closed_req: [REQ-29, REQ-30, REQ-31, REQ-32, REQ-33]
depends: [project-row]
---

# Batch session-star

Requirements: `.sdd/plans/plan-ui_restyle/requirements.md`. Request mock: `.sdd/mockups/ui_restyle/mock.html`. The mock sets the look only, never the scope.

The "session name" of the request is the name on line 1 of the entry (the folder name today). The star goes where the FavoriteIndicator is today. "Cards of sessions waiting for input" are the hosted needs-input cards of SessionList.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/sessions/SessionList.tsx` | In rows and in needs-input cards, put the FavoriteButton right after the folder name on line 1, in place of the FavoriteIndicator. Do not nest it inside the entry button. | REQ-29, REQ-32 | — |
| INT-2 | modify | `src/web/sessions/SessionList.tsx` | The top-right corner keeps only "Rename". EndedEntryActions of ended rows stay as today. The Tab order follows the new visual order. | REQ-31, REQ-32 | INT-1 |
| INT-3 | modify | `src/web/sessions/FavoriteButton.tsx` | Use the star look of the project star (shared star classes of batch project-row), with the pop only after a press that marks. Keep the request, the accessible name, the `hidden` prop and the error. | REQ-30, REQ-33 | — |
| INT-4 | modify | `src/web/styles.css` (`.entry-favorite`) | Place the star on line 1 after the folder name. It never shrinks, so the folder name is cut first. The "External" chip stays after it. | REQ-29, REQ-30, REQ-32 | INT-1, INT-3 |
| INT-5 | modify | `src/web/sessions/SessionList.test.tsx`, `src/web/sessions/SessionList-favorite.test.tsx`, `src/web/sessions/SessionList-rename.test.tsx`, `src/web/sessions/FavoriteButton.test.tsx`, `e2e/favorite-session.spec.ts` | Check the star place in rows and cards, its states, keyboard reach and accessible name. Check that the top-right corner holds only "Rename". The mark still sets and clears as before. | REQ-29, REQ-30, REQ-31, REQ-32, REQ-33 | INT-1 to INT-4 |

Notes:
- The FavoriteIndicator stays in the resume history.

## Human acceptance

### Scenario: The user marks a session from the star next to its name

- REQ → REQ-29, REQ-30, REQ-31, REQ-33
- Given → the session list shows a session that is not a favorite
- When → the user moves the pointer over the entry and clicks the outline star next to its name
- Then → the star fills in amber with a short pop and stays visible after the pointer leaves, the session does not open, and the top-right corner shows only the pencil "Rename"

### Scenario: The card of a session waiting for input has the same star

- REQ → REQ-32
- Given → a session waits for input and the list shows its card
- When → the user moves the pointer over the card
- Then → the star shows next to the session name, and the top-right corner shows only "Rename"

### Scenario: A failed favorite change shows the current error

- REQ → REQ-33
- Given → the server cannot save the mark
- When → the user clicks the session star
- Then → "Could not change the favorite mark." shows under the entry
