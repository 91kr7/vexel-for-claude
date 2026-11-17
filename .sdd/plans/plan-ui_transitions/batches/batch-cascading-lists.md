---
batch: cascading-lists
feature: Cascading lists
closed_req: [REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22]
depends: [modal-dialogs]
---

# Batch cascading-lists

The motion base and the exit presence come from batch modal-dialogs.

## What this batch builds

- **Cascade rule** → gives each item of a list its enter delay, so the items enter in sequence and the whole cascade ends within the cascade limit of the motion base, however long the list is.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | frontend, app area | Cascade rule: enter delay per item position, scaled so the last item ends within 600 ms. It plays once per appearance of a list, and never for items added later. | REQ-20, REQ-22 | — |
| INT-2 | modify | `src/web/sessions/SessionList.tsx` | When the entries first appear (after `loading`, or when the Sessions view shows), they enter through the cascade rule. Refreshes, group moves and drag reorders play nothing. | REQ-16, REQ-20, REQ-21 | INT-1 |
| INT-3 | modify | `src/web/sessions/SessionList.tsx` | After the first appearance, a new entry, hosted or external, slides in. | REQ-18 | INT-2 |
| INT-4 | modify | `src/web/sessions/SessionList.tsx` | A removed entry fades out through the exit presence. It takes no click while it leaves; the other entries keep their keys and focus. | REQ-19, REQ-26 | INT-2 |
| INT-5 | modify | `src/web/folders/ProjectList.tsx` | When the rows first appear (each time the Projects view shows), they enter through the cascade rule. A search change and a list reload play nothing. | REQ-17, REQ-20, REQ-21 | INT-1 |

Notes:

- The cascade never delays the focus that AppLayout puts on the first project row or on a session entry: the focus and the keys work during the cascade.
- The existing star "pop" and status-dot pulse of the entries and rows stay as they are (REQ-30).

## Human acceptance

### Scenario: the session list enters in cascade

- REQ → REQ-16, REQ-22
- Given → the app is closed, and at least five sessions run
- When → the user starts the app
- Then → the session entries enter one after the other, and the last one is on screen in well under a second

### Scenario: new sessions slide in and removed ones fade out

- REQ → REQ-18, REQ-19, REQ-20
- Given → the session list is on screen, with an ended session
- When → the user starts a new session, then clicks "Dismiss" on the ended one
- Then → the new entry slides in, the dismissed entry fades out, and the other entries do not play the cascade again

### Scenario: the project list enters in cascade, but search does not replay it

- REQ → REQ-17, REQ-21, REQ-26
- Given → the machine has several project folders
- When → the user clicks "Projects" in the rail, then types in the search bar
- Then → the rows enter one after the other, and the typed text filters them at once, with no new cascade
