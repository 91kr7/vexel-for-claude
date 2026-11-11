---
batch: favorite
feature: Favorite session
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13]
depends: []
---

# Batch favorite — Favorite session

REQ ids refer to `plan-favorite_session/requirements.md`. "Favorite mark" and "favorite indicator" are defined there.

## What this batch builds

- **Favorite store** → the keys of the favorite sessions, saved in a file of the client's data folder.
- **Favorite route** → sets or clears the favorite mark of a hosted or external session.
- **Favorite indicator** → the small filled star, with the accessible name "Favorite", shown on a list entry and on a row of the resume history.
- **Favorite button** → the icon button of a list entry that marks the session or removes the mark.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, sessions area | Favorite store: `has(key)`, `set(key, favorite)`, `move(from, to)`, change listeners. Saved to `session-favorites.json` in the data folder (`dataDirOf`), loaded at start, never fails on a bad file. A `set` to the same value changes nothing. | REQ-5, REQ-6, REQ-10 | — |
| INT-2 | modify | `src/server/sessions/session-state-tracker.ts` | Option `favorites`. A summary has `favorite: true` when the favorite store has its name key (Claude Code session id, else hosted id). A change of that key notifies each tracked session of the key, ended too, with a new cause `{ type: "favorite" }`. State and last activity stay as they are. | REQ-3, REQ-7, REQ-8, REQ-9 | INT-1 |
| INT-3 | modify | `src/server/sessions/session-state-tracker.ts` | When the Claude Code session id of a session is set or changes, a favorite mark under the old key moves to the new key (INT-1 `move`). | REQ-7 | INT-2 |
| INT-4 | modify | `src/server/external/external-session-scanner.ts` | Dependency `favorites`. An entry has `favorite: true` when its id is marked. A change of a listed id notifies `{ type: "session", session }` at once, outside the scan. | REQ-2, REQ-3, REQ-8, REQ-9 | INT-1 |
| INT-5 | modify | `src/server/history/past-session-list-route.ts` | Dependency `favorites`. A past session has `favorite: true` when its Claude Code session id is marked. A dismissed or ended session keeps it. | REQ-4, REQ-5, REQ-10 | INT-1 |
| INT-6 | create | backend, sessions area | Route `PUT /api/sessions/:id/favorite`, body `{ favorite }` (boolean), for a hosted or an external id, in any state. `204` after INT-1 `set`. `404` for an unknown id. `400` when `favorite` is not a boolean. | REQ-1, REQ-2, REQ-5 | INT-1 |
| INT-7 | modify | `src/server/main.ts` | Load the favorite store from the data folder. Pass it to the tracker, the scanner and PastSessionListRoute. Register the INT-6 route. | REQ-1, REQ-6 | INT-2, INT-4, INT-5, INT-6 |
| INT-8 | modify | `src/web/icons/Icons.tsx` | Add `StarIcon` (Lucide star), with a filled variant. | REQ-3, REQ-4, REQ-11 | — |
| INT-9 | create | frontend, sessions area | Favorite indicator: a filled star (INT-8), 12 px, accessible name and tooltip "Favorite". Same look in the list and in the history. | REQ-3, REQ-4, REQ-11, REQ-12 | INT-8 |
| INT-10 | create | frontend, sessions area | Favorite button: 20 px icon button with the look of "Rename". Name and tooltip "Mark as Favorite", or "Remove Favorite" when marked. Press → INT-6. Failure → ErrorMessage "Could not change the favorite mark." | REQ-1, REQ-5, REQ-12, REQ-13 | INT-6, INT-8 |
| INT-11 | modify | `src/web/sessions/live-session-store.ts` | Add `favorite?: true` to the `SessionSummary` type. The events already carry it. | REQ-8 | — |
| INT-12 | modify | `src/web/sessions/SessionList.tsx` | INT-10 on every entry, rows and needs-input card, beside "Rename". INT-9 after the folder name of a marked entry, in every group. The entry keeps its place and group. | REQ-1, REQ-2, REQ-3, REQ-8, REQ-9, REQ-13 | INT-9, INT-10, INT-11 |
| INT-13 | modify | `src/web/history/ResumeDialog.tsx` | A past session with `favorite` shows INT-9 after its label. The radio is also described by "Favorite". No mark action in the dialog. | REQ-4, REQ-11 | INT-5, INT-9 |

## Decisions

- **Same key as the name.** The mark is kept by the Claude Code session id, the same key as the name in `plan-session_list_improvements/batch-rename`. All resume paths start the new hosted session with `resumedFrom.sessionId`, so the mark follows the conversation (REQ-7). A hosted session with no known id uses its hosted id, and INT-3 moves the mark when the id becomes known.
- **A new store, not the name store.** The name store holds text and a length rule. A mark holds no text. A separate store with its own file `session-favorites.json` keeps the name store unchanged. The folder is the data folder, outside `~/.claude`. The client writes nothing to Claude Code files.
- **REQ-10 needs no code of its own.** Dismiss removes the session from the tracker only. The store key stays, so INT-5 still marks the session in the history. REQ-10 closes with INT-1 and INT-5. A test must cover it.
- **No desktop change.** The desktop window loads the same page and receives the same `session` events (REQ-8). Notifications and tray do not use the mark. The `favorite` cause gives no attention event (AttentionMonitor reacts only to state changes and to `exit`).
- **No other server file changes.** SessionListRoute and SessionEventsRoute pass the tracker and scanner summaries through, so they carry `favorite` without a change.
- **History is not live.** ResumeDialog loads the mark when it opens (gatekeeper decision, `requirements.md`).
- **Look and place (implementer's choice inside these limits).**
  - Indicator → after the folder name on line 1 of a row, and after the folder name in the needs-input card. It never shrinks, so the folder name is cut first. It is told apart without colour: the star shape and the name "Favorite".
  - Button → hidden until hover or visible keyboard focus, as "Rename". It sits left of "Rename". On an ended hosted row, EndedEntryActions stay left of it. Tab order: entry, EndedEntryActions, Favorite button, "Rename". The focus ring is the one of "Rename".
  - Error → shown under the entry, as EndedEntryActions does.
- **Orphan keys.** The store never removes a key. A hosted session that never got a Claude Code session id leaves its hosted id in the file. It is small and harmless. Assumption.
- **e2e data folder.** `playwright.config.ts` already starts the e2e server with `AI_CLIENT_DATA_DIR` on a temporary folder, so no change. The folder is kept between runs. An e2e test that marks a session must remove the mark before it ends.
- **Tests (knowledge base `electron-e2e-separate`, `narrow-batch-tests`).** Vitest for INT-1 to INT-6, and for INT-9, INT-10, INT-12 and INT-13 with their dependencies. Playwright e2e in the browser for the list, the reload, the two tabs and the history. No Electron e2e: no desktop file changes.

## Human acceptance

### Scenario: The user marks a session as favorite from the list

- REQ → REQ-1, REQ-2, REQ-3, REQ-9, REQ-13
- Given → a hosted session is in the group "Running" and another session sits below it
- When → the user presses "Mark as Favorite" on its entry with the keyboard
- Then → the entry shows the favorite indicator and keeps its place in its group

### Scenario: The favorite indicator shows in the resume history

- REQ → REQ-4
- Given → the user marked a session as favorite, and the session has ended
- When → the user opens "Resume Session"
- Then → the row of that session shows the favorite indicator, and the other rows show none

### Scenario: The user removes the mark

- REQ → REQ-5
- Given → a favorite session shows the indicator in the list
- When → the user presses "Remove Favorite" on its entry
- Then → the indicator is gone from the entry, and a new "Resume Session" dialog shows none on its row

### Scenario: Any session can be marked, also in the Ended group and in another terminal

- REQ → REQ-2, REQ-3
- Given → an ended session and a session in another terminal are in the list
- When → the user marks both
- Then → both entries show the favorite indicator, in the groups "Ended" and "In Other Terminals"

### Scenario: The mark survives reload and restart

- REQ → REQ-6
- Given → a session is marked as favorite
- When → the user reloads the page, and then restarts the client
- Then → the entry of the session shows the favorite indicator after each of them

### Scenario: The mark survives a Resume

- REQ → REQ-7
- Given → an ended favorite session
- When → the user resumes it from its entry
- Then → the resumed session shows the favorite indicator, and so does its row after the same step from the resume history and with "Resume Here"

### Scenario: Every open page gets the change

- REQ → REQ-8
- Given → the client is open in two browser tabs, and in the desktop app
- When → the user marks a session in the first tab
- Then → the second tab and the desktop app show the indicator without a reload

### Scenario: Dismiss keeps the mark

- REQ → REQ-10
- Given → an ended favorite session in the list
- When → the user dismisses it and opens "Resume Session"
- Then → the row of that session shows the favorite indicator

### Scenario: The indicator is clear without colour and in English

- REQ → REQ-11, REQ-12
- Given → a favorite session in the list
- When → the user hovers the indicator, in the dark and in the light theme
- Then → it is a star shape, and the tooltip says "Favorite"
