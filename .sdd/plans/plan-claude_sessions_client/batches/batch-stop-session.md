---
batch: stop-session
feature: Stop a session
closed_req: [REQ-23, REQ-24]
depends: [session-list]
---

# Batch — Stop a session

## What this batch builds

- **Stop route** (backend) → ends the CLI process of a hosted session.
- **Stop action** (frontend) → the button "Termina" and its confirmation.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, sessions area | Stop route: sends SIGTERM to the CLI process of the session, then SIGKILL if it is still alive after 5 seconds. The state tracker then shows the session as ended. | REQ-23 | — |
| INT-2 | modify | `src/server/main.ts` | Register INT-1. | REQ-23 | INT-1 |
| INT-3 | create | frontend, session area | Stop action: a button "Termina" in the open-session area, hidden when the session has ended. It calls INT-1. | REQ-23 | INT-1 |
| INT-4 | create | frontend, session area | Confirmation of the stop action (INT-3): when the session is "In lavorazione", ask for confirmation first, with "Termina" and "Annulla". In other states, stop at once. | REQ-24 | INT-3 |

## Human acceptance

### Scenario: The user stops an idle session

- REQ → REQ-23
- Given → an open session "In attesa"
- When → the user clicks "Termina"
- Then → the session ends and its entry shows "Terminata"

### Scenario: Stopping a working session asks for confirmation

- REQ → REQ-24
- Given → an open session "In lavorazione"
- When → the user clicks "Termina"
- Then → the page asks for confirmation before it stops the session
- And → on "Annulla" the session keeps working
