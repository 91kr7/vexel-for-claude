---
batch: dismiss-resume
feature: Dismiss and Resume
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13]
depends: []
---

# Batch dismiss-resume — Dismiss and Resume

REQ ids refer to `plan-session_list_improvements/requirements.md`.

## What this batch builds

- **Dismiss route** → removes an ended hosted session from the session list.
- **Entry Resume route** → resumes an ended hosted session from its list entry and removes its ended entry. It is a different route from the resume of the history dialog.
- **Ended entry actions** → the "Dismiss" and "Resume" buttons of an ended hosted entry, with their requests, warning and error.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/sessions/session-state-tracker.ts` | Add `dismiss(id)`: an ended session leaves `get` and `list`, and removal listeners get its id. An unknown or not ended id changes nothing. The Claude Code history is not touched. | REQ-4, REQ-5, REQ-6 | — |
| INT-2 | modify | `src/server/sessions/session-state-tracker.ts` | `SessionSummary` gets `resumable: true` when the session saw a `UserPromptSubmit` or was started with `resumedFrom.sessionId`. Otherwise the field is absent. | REQ-2 | — |
| INT-3 | modify | `src/server/sessions/session-events-route.ts` | A tracker removal sends `{ "type": "session-removed", "id" }`, the frame external removals already use. | REQ-4 | INT-1 |
| INT-4 | create | backend, sessions area | Route `POST /api/sessions/:id/dismiss` → `204` after `dismiss(id)`. `404` for an unknown id. `409 { error: "not_ended" }` for a session that has not ended. | REQ-3, REQ-4, REQ-5 | INT-1 |
| INT-5 | modify | `src/server/history/resume-session-route.ts` | Export the resume step (SessionHistory lookup, folder check, `registry.start`) with its `404` errors, so another route can reuse it. The route answers as today. | REQ-8 | — |
| INT-6 | create | backend, sessions area | Route `POST /api/sessions/:id/resume`, body `{ force? }`. It resumes the tracker's Claude Code session id with the INT-5 step. On `201 { id }` it dismisses the old entry. Without `force`, an id in ExternalSessionCheck → `409 { error: "running_elsewhere" }` and no start. | REQ-8, REQ-9, REQ-11, REQ-12 | INT-1, INT-5 |
| INT-7 | modify | `src/server/main.ts` | Register the INT-4 and INT-6 routes, with the tracker, registry, SessionHistory and ExternalSessionCheck. | REQ-4, REQ-8 | INT-4, INT-6 |
| INT-8 | create | frontend, sessions area | "Dismiss" and "Resume" buttons. "Resume" → `409 running_elsewhere` opens RunningElsewhereWarning, "Resume Anyway" sends `force`. Busy while a request runs. Errors in an ErrorMessage under the entry, texts below. | REQ-4, REQ-8, REQ-9, REQ-12, REQ-13 | INT-4, INT-6 |
| INT-9 | modify | `src/web/sessions/SessionList.tsx` | Only the entry of an ended hosted session shows INT-8. "Resume" only when `resumable`. New prop `onResumed(id)`. The buttons sit beside the entry button, not inside it, with the focus ring. | REQ-1, REQ-2, REQ-3, REQ-13 | INT-2, INT-8 |
| INT-10 | modify | `src/web/AppLayout.tsx` | `onResumed(id)` of SessionList → that session becomes the open one. An open hosted session that leaves the list → no open session (EmptyState). | REQ-7, REQ-10 | INT-9 |

## Decisions

- **Server memory is enough for REQ-5.** Ended hosted sessions live only in the server memory (SessionStateTracker rule). A server restart drops them all. A desktop app that reuses the backend keeps the memory, so a dismissed session stays removed.
- **One server call for Resume (REQ-11).** The resume and the removal of the old entry happen in the same route. A page that closes during the request cannot leave two entries. The new hosted session gets a new id and goes at the end of its new group, by the existing order rules.
- **Running-elsewhere check on the server (REQ-9).** The page does not know if an ended hosted session runs in a terminal. The route checks it and answers `409`. So without a terminal, Resume is one click with no dialog (REQ-8).
- **Saved conversation (REQ-2).** Claude Code writes the transcript once the first prompt is sent. A session that saw no prompt, and was not resumed, has nothing to resume.
- **Error texts**, as in the history dialog: `session_not_found` → "The session no longer exists.", `folder_not_found` → "The project folder does not exist.", any other Resume failure → "Could not resume the session.". A failed Dismiss → "Could not dismiss the session.".
- **Look.** The buttons follow the studio-dark style of the list: small icon buttons with the accessible name and tooltip "Dismiss" or "Resume", visible on hover and on keyboard focus, and reachable with Tab.
- **Tests.** Vitest for INT-1 to INT-6. Playwright e2e in the browser for the user paths. No Electron e2e: this batch does not touch the desktop app (knowledge base `electron-e2e-separate`).

## Human acceptance

### Scenario: The user resumes an ended session with one click

- REQ → REQ-2, REQ-8, REQ-10, REQ-11
- Given → an ended hosted session that had a conversation, in the "Ended" group of the list
- When → the user presses "Resume" on its entry
- Then → the session opens in the main area with no dialog, and its entry is at the end of the "Running" group
- And → the "Ended" group has no entry for that session

### Scenario: The user dismisses an ended session

- REQ → REQ-1, REQ-3, REQ-4
- Given → the list has an ended hosted session, a working session and an external session
- When → the user presses "Dismiss" on the ended entry
- Then → the entry leaves the list at once, with no confirmation
- And → the working and the external entries show neither "Dismiss" nor "Resume"

### Scenario: A dismissed session does not come back, but stays in the history

- REQ → REQ-5, REQ-6
- Given → the user dismissed an ended session
- When → the user reloads the page and opens "Resume Session"
- Then → the list does not show the session
- And → the history dialog lists it, and "Resume" there starts it

### Scenario: Dismissing the open session clears the main area

- REQ → REQ-7
- Given → the ended session is open in the main area
- When → the user presses "Dismiss" on its entry
- Then → the main area shows its "no open session" state

### Scenario: The session still runs in a terminal

- REQ → REQ-9
- Given → the conversation of an ended hosted session now runs in another terminal
- When → the user presses "Resume" on its entry
- Then → the warning "Session Running in a Terminal" opens, and "Resume Anyway" resumes it

### Scenario: Resume fails

- REQ → REQ-12
- Given → the project folder of an ended hosted session was deleted
- When → the user presses "Resume" on its entry
- Then → "The project folder does not exist." shows, and the entry stays in the "Ended" group

### Scenario: A session with no conversation offers only Dismiss

- REQ → REQ-2
- Given → a hosted session ended before the user sent any prompt
- When → the user looks at its entry
- Then → the entry offers "Dismiss" and no "Resume"

### Scenario: Dismiss and Resume with the keyboard

- REQ → REQ-13
- Given → the focus is on the entry of an ended hosted session
- When → the user moves the focus with Tab to "Resume" and presses Enter
- Then → "Resume" shows the focus ring while it has the focus, and the session resumes
- And → "Dismiss" is reached the same way and works with Enter
