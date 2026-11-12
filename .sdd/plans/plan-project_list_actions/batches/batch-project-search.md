---
batch: project-search
feature: Project search
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11]
depends: [favorite-project]
---

# Batch project-search — Project search

Requirements: `.sdd/plans/plan-project_list_actions/requirements.md`. There is no mock. The search bar has the look of the search bar of the ResumeDialog (module history).

The search runs in the page, on the projects the store already holds. It sends no request. It matches the full folder path, the path the row shows.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/folders/ProjectList.tsx` | Search bar between the title and the rows: SearchIcon, a field "Search projects", and "Clear Search" (XIcon) while the text is not empty. "Clear Search" empties the text and puts the focus back in the field. Both show the focus ring. | REQ-1, REQ-6, REQ-9, REQ-11 | — |
| INT-2 | modify | `src/web/folders/ProjectList.tsx` | At each keystroke, show only the store rows whose full path contains the text, ignoring case, in the store order. An empty text shows every row. The rows keep their actions and `onChoose`. | REQ-2, REQ-3, REQ-4, REQ-8, REQ-10 | INT-1 |
| INT-3 | modify | `src/web/folders/ProjectList.tsx` | When the store has projects but no row matches, show a compact empty AreaState: "No projects match", then the search text in quotes. The search bar stays. | REQ-5, REQ-11 | INT-2 |
| INT-4 | modify | `src/web/AppLayout.tsx` | Each press of "Projects" in the rail shows the ProjectList with an empty search, also when the "Projects" view is already shown. | REQ-7 | INT-1 |

## Human acceptance

### Scenario: the user finds a project by typing part of its path

- REQ → REQ-1, REQ-2, REQ-3, REQ-9, REQ-10, REQ-11
- Given → the Projects list shows some hundreds of projects, one of them in `/home/dev/work/Vexel-Client`
- When → the user moves the focus with Tab to "Search projects" and types "vexel"
- Then → at each letter, with no delay, the list shows only the projects whose path contains "vexel" in any case

### Scenario: the filtered list keeps the favorites at the top

- REQ → REQ-4
- Given → the favorite project `/home/dev/api` and the projects `/home/dev/app` and `/home/dev/apex`
- When → the user types "ap" in the search bar
- Then → the three projects show in the order of the full list, the favorite first

### Scenario: no project matches

- REQ → REQ-5
- Given → no project path contains "zzz"
- When → the user types "zzz" in the search bar
- Then → the list shows an empty state that says no project matches "zzz"

### Scenario: the user clears the search

- REQ → REQ-6
- Given → the search bar holds "vexel" and the list shows one project
- When → the user presses "Clear Search"
- Then → the search bar is empty and the full list is back

### Scenario: the search starts empty at each opening

- REQ → REQ-7
- Given → the user typed "vexel" in the search bar, then pressed "Sessions" in the rail
- When → the user presses "Projects" in the rail
- Then → the search bar is empty and the list shows every project

### Scenario: the user starts a session from a filtered list

- REQ → REQ-8
- Given → the search bar holds "vexel" and the list shows the project `/home/dev/work/Vexel-Client`
- When → the user chooses that project and confirms the name dialog
- Then → a new session starts in that folder, as from the full list
