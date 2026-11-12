---
batch: project-list
feature: Project list
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13]
depends: []
---

# Batch project-list — Project list

Requirements: `.sdd/plans/plan-recent_projects/requirements.md`. Visual reference: `.sdd/mockups/recent_projects/mock.html`, step "1 · Elenco progetti". The mock binds the look and the layout. Its data is sample data.

Do not build these parts of the mock: the session count per folder, the folder count in the list header ("7 folders") and the search filter of the mock script. The next batch makes a row start a session and adds the "▶ New session" hover label. In this batch a click on a row does nothing.

## What this batch builds

- Project list store → loads the project folders each time the list opens, and keeps the last loaded list on screen while it reloads.
- Project list → the content of the side column in the "Projects" view: title, project rows, loading, empty state and load error.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/history/past-session-list-route.ts` | Add to each group a mark that tells whether `folder` exists on disk as a folder, checked at each request. The rest of the answer does not change. | REQ-10 | — |
| INT-2 | create | frontend, folders area | Project list store: on each open, `GET /api/past-sessions`. One project per group, in the route order, with the folder, the `lastActivity` of its first session and the availability mark. The last loaded list stays shown while a new load runs. | REQ-3, REQ-4, REQ-5, REQ-7, REQ-8, REQ-12 | INT-1 |
| INT-3 | create | frontend, folders area | Project list: title "Projects", then one row per project as in the mock (Avatar, folder name, full path, "Last activity" with RelativeTime). An unavailable row is dimmed, shows "Folder not found" and is `aria-disabled`. | REQ-6, REQ-10, REQ-11, REQ-13 | INT-2 |
| INT-4 | create | frontend, folders area | States of the project list, with AreaState: loading on the first load, the empty state "No projects yet" and a load error. Rows are focusable buttons with the focus ring; only the rows scroll. | REQ-9, REQ-11, REQ-12, REQ-13 | INT-3 |
| INT-5 | modify | `src/web/NavigationRail.tsx` | Add "Projects" (FolderIcon, tooltip "Projects") between "Sessions" and "Resume", with `onShowProjects()`. The active style goes to the shown destination ("Sessions" or "Projects"), no longer always to "Sessions". | REQ-1, REQ-11, REQ-13 | — |
| INT-6 | modify | `src/web/AppLayout.tsx` | Keep the shown side view. "Projects" puts the project list in the list panel, in place of the "Sessions" title and the SessionList, with the same width and edge. "Sessions" brings the sessions back. | REQ-2, REQ-8 | INT-4, INT-5 |
| INT-7 | modify | `src/web/AppLayout.tsx` | "Projects" in the rail moves the focus to the first project row, or keeps it on the button when the list has no row. The rail badge stays visible in both views. | REQ-11 | INT-6 |

## Human acceptance

### Scenario: the user sees the past projects in the side column

- REQ → REQ-1, REQ-2, REQ-3, REQ-4, REQ-6, REQ-7, REQ-11, REQ-13
- Given → Claude Code saved conversations in three folders on this machine, one of them from a terminal only
- When → the user presses "Projects" in the rail
- Then → the side column shows "Projects" with the three folders, the most recent first, each with its path and its last activity
- And → the "Recent" list of the "New Claude Code Session" dialog shows the same three folders

### Scenario: the list is still there after a restart and shows new projects

- REQ → REQ-5, REQ-8
- Given → the project list shows two folders, and the user restarts the client
- When → the user uses Claude Code in a third folder from a terminal, then presses "Projects" again
- Then → the list shows the three folders

### Scenario: a deleted folder stays in the list, marked

- REQ → REQ-10
- Given → a folder of the list was deleted from the disk
- When → the user presses "Projects"
- Then → the folder is still in the list, dimmed, with "Folder not found"

### Scenario: no project yet

- REQ → REQ-9
- Given → Claude Code has no saved conversation on this machine
- When → the user presses "Projects"
- Then → the side column shows an empty state that says there are no projects

### Scenario: a long list opens at once and works from the keyboard

- REQ → REQ-11, REQ-12
- Given → the machine has some hundreds of project folders, and the list was opened once
- When → the user moves the focus to "Projects" with Tab and presses Enter
- Then → the list shows at once, and the focus ring is on the first project row

### Scenario: the user goes back to the sessions

- REQ → REQ-2
- Given → the side column shows the project list
- When → the user presses "Sessions" in the rail
- Then → the side column shows the session list again, and "Sessions" has the active style
