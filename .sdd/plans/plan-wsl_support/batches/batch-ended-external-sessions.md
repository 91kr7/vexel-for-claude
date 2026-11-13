---
batch: ended-external-sessions
feature: Ended external sessions
closed_req: [REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15]
depends: []
---

# Batch — Ended external sessions

Source: the branch `feature/wsl-support` changes the files of the table below for this feature. Port those changes and adapt them to main. "Ended external entry" means the list entry of an external session that disappeared.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/external/external-session-scanner.ts` | When a listed entry is no longer found, keep it with state `ended` instead of removing it. It keeps its label, client name and favorite mark. It gets `resumable: true` when its conversation is saved, as an ended hosted entry does. | REQ-7, REQ-8, REQ-14, REQ-15 | — |
| INT-2 | modify | `src/server/external/external-session-scanner.ts` | New dependency: the `liveClaudeSessionIds()` of SessionStateTracker. Remove an ended entry when its id is among them, and notify `session-removed`. | REQ-12 | INT-1 |
| INT-3 | modify | `src/server/external/external-session-scanner.ts` | New `dismiss(id)`: removes an ended entry, notifies `session-removed`, and keeps the id from coming back as ended. When that conversation runs again in a terminal, it is listed as a live entry. | REQ-8, REQ-9 | INT-1 |
| INT-4 | modify | `src/server/sessions/dismiss-session-route.ts` | When the tracker has no session `:id`, dismiss the ended external entry with that id through the scanner. Same answers: `204`, `404 session_not_found`, `409 not_ended`. | REQ-9 | INT-3 |
| INT-5 | modify | `src/server/sessions/resume-ended-session-route.ts` | Also accept an ended external entry: its id is the Claude Code session id. Same checks, answers and running-elsewhere check. On `201`, dismiss the entry through the scanner. | REQ-10, REQ-12 | INT-3 |
| INT-6 | modify | `src/server/main.ts` | Give the scanner the tracker's `liveClaudeSessionIds()`. Give the scanner to DismissSessionRoute and ResumeEndedSessionRoute. | REQ-9, REQ-10, REQ-12 | INT-2, INT-4, INT-5 |
| INT-7 | modify | `src/web/sessions/SessionList.tsx` | An ended external entry shows EndedEntryActions, as an ended hosted entry does. It keeps its dashed external border. | REQ-9, REQ-10 | INT-1 |
| INT-8 | modify | `src/web/external/ResumeHereButton.tsx` | New option that skips the running-elsewhere warning. With it, a click or the `resume` shortcut sends the request at once. | REQ-11, REQ-13 | — |
| INT-9 | modify | `src/web/external/ConversationView.tsx` | When the session is ended, use the option of INT-8. Then the `resume` shortcut acts once, as "Resume Here" with no warning. The `dismiss` shortcut acts as "Dismiss" of its entry. | REQ-11, REQ-13 | INT-7, INT-8 |

Notes for the implementer:

- AttentionMonitor needs no change for REQ-14. It already gives no session-end event for external sessions. A test checks that an ended external entry gives no event.
- The list route, the event route and `groupSessions` already put an entry with state `ended` in the "Ended" group. They need no change.
- An ended external entry lives only in the server memory, like an ended hosted entry. It does not survive a restart of the server.
- The client writes nothing to an external session.
- Update the specs of the changed components (modules external, sessions, app). The rule "only ended hosted entries show Dismiss and Resume" of SessionList and the rule "always shows the warning" of ResumeHereButton change.

## Human acceptance

### Scenario: A closed terminal leaves an ended entry in the list

- REQ → REQ-7, REQ-8, REQ-14, REQ-15
- Given → the list shows an external session with a client name and the favorite mark, and the desktop window is in the background
- When → the user closes the terminal of that session
- Then → the entry moves to the "Ended" group with its name, its star, "Resume" and "Dismiss", and stays there
- And → no system notification appears

### Scenario: Dismiss removes the ended entry for good

- REQ → REQ-9
- Given → the ended external entry is open in the main area
- When → the user presses "Dismiss" on the entry
- Then → the entry leaves the list at once, with no confirmation, and the main area shows no open session
- And → after a page reload the entry is still gone, and the session is still in the resume history

### Scenario: Resume from the entry leaves one hosted entry

- REQ → REQ-10, REQ-12
- Given → the list shows an ended external entry with a saved conversation
- When → the user presses "Resume" on the entry
- Then → the session opens in the main area as a hosted session
- And → the list holds only the new hosted entry for that conversation

### Scenario: "Resume Here" on an ended external session shows no warning

- REQ → REQ-11, REQ-12
- Given → the ended external session is open in the main area
- When → the user presses "Resume Here"
- Then → the session resumes in the client with no running-elsewhere warning
- And → the list holds only the new hosted entry for that conversation

### Scenario: The shortcuts act as the buttons

- REQ → REQ-13
- Given → the ended external session is open in the main area
- When → the user presses the Resume shortcut, or the Dismiss shortcut
- Then → the session resumes with no warning, or the entry leaves the list, as with the buttons

### Scenario: A failed resume keeps the entry

- REQ → REQ-10
- Given → the project folder of an ended external entry no longer exists
- When → the user presses "Resume" on the entry
- Then → the user sees "The project folder does not exist." under the entry
- And → the entry stays in the "Ended" group
