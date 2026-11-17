---
batch: popup-mark
feature: Mark from the resume popup
closed_req: [REQ-5, REQ-6, REQ-7, REQ-8, REQ-9]
depends: []
---

# Batch popup-mark — Mark from the resume popup

REQ ids refer to `plan-resume_favorites/requirements.md`. "Resume popup", "favorite mark" and "favorite indicator" are defined there. The resume popup is the ResumeDialog of module history.

## What this batch builds

- **Past-session favorite route** → sets or clears the favorite mark of a past session, by its Claude Code session id.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, history area | Route that sets or clears the mark of a past session by its Claude Code session id, body `{ favorite }`. `204` after SessionFavoriteStore `set(id, favorite)`. `400` when `favorite` is not a boolean. `404` for an id that is not a past session. | REQ-5, REQ-8 | — |
| INT-2 | modify | `src/server/main.ts` | Register the INT-1 route with SessionHistory and the shared SessionFavoriteStore. | REQ-5, REQ-8 | INT-1 |
| INT-3 | modify | `src/web/sessions/FavoriteButton.tsx` | Optional props: send the press to the INT-1 route instead of the session route, and a callback with the new mark after a `2xx`. Without them the button behaves as today. | REQ-5, REQ-7 | INT-1 |
| INT-4 | modify | `src/web/history/ResumeDialog.tsx` | FavoriteButton (INT-3) on each row, after the label, in place of FavoriteIndicator. On `2xx` the row's `favorite` flips in the dialog's list at once. The radio is still described by "Favorite" when marked. | REQ-5, REQ-7 | INT-3 |
| INT-5 | modify | `src/web/history/ResumeDialog.tsx` | A press of the button (click, Enter, Space) does not select the row, does not resume and does not close the dialog. The button is its own Tab stop, with the focus ring. | REQ-6, REQ-9 | INT-4 |

## Decisions

- **A new route, not FavoriteSessionRoute.** FavoriteSessionRoute takes a hosted or external id and answers `404` for any other session. A past session has only its Claude Code session id. That id is already the key of SessionFavoriteStore, so INT-1 calls `set(id, favorite)` directly.
- **REQ-8 needs no list code.** SessionStateTracker and ExternalSessionScanner already listen to SessionFavoriteStore. A change of the key pushes the `session` event, and every open session list updates without a reload. A test must cover it.
- **Button as indicator.** In the popup the star button replaces FavoriteIndicator, as in the session list. Marked → the filled star, always shown. Not marked → the outline star, shown on hover or with visible keyboard focus on the row, as on a list entry. The texts are those of FavoriteButton: "Mark as Favorite", "Remove Favorite" and "Could not change the favorite mark." The error shows under the row.
- **Mark is local after the press.** The popup does not listen to session events. It flips the row on the `2xx` answer (INT-4). A change made in another page shows at the next opening, as today.
- **Selection.** Marking a row does not change which row is selected.
- **Tests (knowledge base `electron-e2e-separate`).** Vitest for INT-1, INT-3 and the rows of INT-4 and INT-5. Playwright e2e in the browser: mark and unmark from the popup, the popup stays open, the list entry of an ended or external session updates without a reload, keyboard use. The e2e data folder is kept between runs: a test that marks a session removes the mark before it ends. No Electron e2e.

## Human acceptance

### Scenario: The user marks a session from the resume popup

- REQ → REQ-5, REQ-6, REQ-7
- Given → the resume popup is open, and a row is not a favorite
- When → the user presses "Mark as Favorite" on that row
- Then → the row shows the filled star at once, and the popup stays open with no session resumed
- And → a press of "Remove Favorite" on the same row brings back the empty star

### Scenario: The session list follows the mark of the popup

- REQ → REQ-8
- Given → an ended session is in the group "Ended" of the session list, without the mark
- When → the user marks its row in the resume popup
- Then → its list entry shows the favorite star without a reload

### Scenario: The mark works with the keyboard

- REQ → REQ-9
- Given → the resume popup is open
- When → the user reaches the star of a row with Tab and presses Space
- Then → the star shows a visible focus ring and the row becomes a favorite

### Scenario: The mark fails

- REQ → REQ-5
- Given → the server cannot change the mark
- When → the user presses "Mark as Favorite" on a row
- Then → the row shows "Could not change the favorite mark." and keeps its empty star
