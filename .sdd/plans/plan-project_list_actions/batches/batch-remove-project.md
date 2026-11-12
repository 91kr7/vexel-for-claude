---
batch: remove-project
feature: Remove a project
closed_req: [REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22]
depends: [favorite-project]
---

# Batch remove-project — Remove a project

Requirements: `.sdd/plans/plan-project_list_actions/requirements.md`. There is no mock. The look follows the project favorite button of batch favorite-project.

Batch favorite-project created the project mark store, the project mark events route and the project mark live store. Their paths are in the folders index (`.sdd/modules/folders/index.md`). This batch extends them.

The rule for a removed project: it is hidden while its removal time is not earlier than its last activity. So any new Claude Code activity in the folder brings it back, terminal-only use included. A hosted session started or resumed in the folder brings it back at once, because the Projects list does not count a hosted session until it ends.

## What this batch builds

- Project remove route → records the removal of a project from the Projects list, and deletes nothing.
- Project remove button → the remove button of a project row.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | backend, folders area: project mark store (batch-favorite-project/INT-1) | Add the removal of a folder, with the server time of the removal, saved in the same file. A removal also clears the project favorite mark of the folder. Add the clearing of a removal. | REQ-14, REQ-15, REQ-18, REQ-19 | — |
| INT-2 | create | backend, folders area | Project remove route: records the removal of an absolute folder path, existing on disk or not. It writes nothing else. | REQ-13, REQ-14, REQ-18 | INT-1 |
| INT-3 | modify | backend, folders area: project mark events route (batch-favorite-project/INT-3) | The marks it sends also carry each removed folder with its removal time. | REQ-20 | INT-1 |
| INT-4 | modify | `src/server/main.ts` | Register INT-2. On each SessionStateTracker change with cause `track` (a hosted session started or resumed), clear the removal of the session folder. | REQ-16 | INT-1, INT-2 |
| INT-5 | modify | frontend, folders area: project mark live store (batch-favorite-project/INT-5) | Keep the removed folders and their removal time from the frames of INT-3. | REQ-15, REQ-20 | INT-3 |
| INT-6 | modify | `src/web/folders/project-list-store.ts` | Leave out a project whose removal time is not earlier than its last activity. A mark change gives a new state at once. The past-sessions route and the "Recent" list of the new-session dialog do not change. | REQ-13, REQ-15, REQ-16, REQ-17, REQ-20 | INT-5 |
| INT-7 | create | frontend, folders area | Project remove button: 20 px icon button "Remove from Projects" with XIcon. A press calls INT-2 at once, with no confirmation. Look, keyboard, busy state and error "Could not remove the project." as the project favorite button. | REQ-12, REQ-13, REQ-21, REQ-22 | INT-2 |
| INT-8 | modify | `src/web/folders/ProjectList.tsx` | Each row gets the project remove button after the favorite button, also an unavailable row. When the focused row leaves the list, the focus goes to the next row, else to the previous one. | REQ-12, REQ-18, REQ-21, REQ-22 | INT-6, INT-7 |

## Human acceptance

### Scenario: the user removes a project from the list

- REQ → REQ-12, REQ-13, REQ-14, REQ-21, REQ-22
- Given → the Projects list shows the projects A, B and C
- When → the user moves the focus with Tab to "Remove from Projects" on the row of B, and presses Enter
- Then → B leaves the list at once, with no question, and the focus ring is on the row of C
- And → the folder of B and its past sessions are still in the "Resume Session" dialog

### Scenario: a removed project stays out, but stays in "Recent"

- REQ → REQ-15, REQ-17
- Given → the user removed B from the Projects list
- When → the user restarts the client and opens the Projects list
- Then → B is not in the list
- And → the "Recent" list of the "New Claude Code Session" dialog still shows B

### Scenario: a removed project comes back after work in a terminal

- REQ → REQ-16
- Given → the user removed B from the Projects list
- When → the user uses Claude Code in the folder of B from a terminal, then opens the Projects list
- Then → B is back in the list, in its place by last activity

### Scenario: a removed project comes back with a new session from the client

- REQ → REQ-16
- Given → the user removed B from the Projects list
- When → the user starts a new session in the folder of B from the "Recent" list of the new-session dialog
- Then → B is back in the Projects list

### Scenario: a removed favorite comes back without its star

- REQ → REQ-19
- Given → B was a favorite project, the user removed it, then used Claude Code in its folder
- When → the user opens the Projects list
- Then → B is in the list without a star, below the favorite projects

### Scenario: the user removes a project whose folder no longer exists

- REQ → REQ-18
- Given → a project row shows "Folder not found"
- When → the user presses "Remove from Projects" on that row
- Then → the row leaves the list

### Scenario: the remove reaches the other pages

- REQ → REQ-20, REQ-22
- Given → the Projects list is open in a browser page and in the desktop app
- When → the user removes a project in the desktop app
- Then → the project leaves the list in the browser page too, with no reload

### Scenario: the remove fails

- REQ → REQ-13
- Given → the server does not answer
- When → the user presses "Remove from Projects" on a project row
- Then → the row stays in the list and shows "Could not remove the project." under it
