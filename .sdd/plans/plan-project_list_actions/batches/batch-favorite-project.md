---
batch: favorite-project
feature: Favorite project
closed_req: [REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32]
depends: []
---

# Batch favorite-project — Favorite project

Requirements: `.sdd/plans/plan-project_list_actions/requirements.md`. There is no mock. The look follows the Projects list as it is today, and the favorite mark of the session list (FavoriteButton, FavoriteIndicator of module sessions).

The "project favorite mark" is separate from the session favorite mark. Do not store it in SessionFavoriteStore and do not show it on sessions.

## What this batch builds

- Project mark store → keeps the project favorite mark of each folder in a JSON file of the client data folder. The next batch adds the removal of a project to it.
- Project favorite route → sets or clears the project favorite mark of a folder.
- Project mark events route → a WebSocket that pushes the project marks to every open page.
- Project mark live store → the project marks of the page, kept current by the events route.
- Project favorite button → the star button of a project row.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, folders area | Project mark store: the project favorite mark by folder path, in a JSON file of the folder given by `dataDirOf`, saved at each change as SessionFavoriteStore does. Change listeners. It reads and writes nothing under the Claude Code folder. | REQ-27, REQ-28 | — |
| INT-2 | create | backend, folders area | Project favorite route: sets or clears the project favorite mark of an absolute folder path. The folder may be missing on disk. | REQ-23, REQ-27 | INT-1 |
| INT-3 | create | backend, folders area | Project mark events route (WebSocket): sends the current project marks on connect, then again after each change of the store. | REQ-29 | INT-1 |
| INT-4 | modify | `src/server/main.ts` | Load the project mark store at start, from the same data folder as the session stores. Register INT-2 and INT-3. | REQ-28, REQ-29 | INT-1, INT-2, INT-3 |
| INT-5 | create | frontend, folders area | Project mark live store: connects to INT-3 and keeps the project marks of the page. It connects again every 2 s after a loss, as LiveSessionStore does. | REQ-28, REQ-29 | INT-3 |
| INT-6 | modify | `src/web/folders/project-list-store.ts` | Each project gets its favorite mark from INT-5. Favorite projects come first; each part keeps the route order, so the most recent first. A mark change gives a new state at once, with no new load. | REQ-25, REQ-26, REQ-29 | INT-5 |
| INT-7 | create | frontend, folders area | Project favorite button: 20 px icon button "Mark as Favorite", or "Remove Favorite" with a filled StarIcon, that calls INT-2. Look, keyboard, busy state and error "Could not change the favorite mark." as the session FavoriteButton. | REQ-23, REQ-31, REQ-32 | INT-2 |
| INT-8 | modify | `src/web/folders/ProjectList.tsx` | A favorite row shows the FavoriteIndicator. Each row gets the project favorite button beside the row button, not inside it. An unavailable row gets it too, and the button works there. | REQ-23, REQ-24, REQ-27, REQ-30, REQ-31, REQ-32 | INT-6, INT-7 |

## Human acceptance

### Scenario: a favorite project moves to the top of the list

- REQ → REQ-23, REQ-24, REQ-25, REQ-26, REQ-31, REQ-32
- Given → the Projects list shows the projects A, B and C, A the most recent, and none is favorite
- When → the user moves the focus with Tab to "Mark as Favorite" on the row of C, and presses Enter
- Then → C shows a star and sits at the top, above A and B, which keep their order

### Scenario: two favorites are ordered by last activity

- REQ → REQ-25, REQ-26
- Given → C is the only favorite project, and B is more recent than C
- When → the user presses "Mark as Favorite" on the row of B
- Then → the list shows B, then C, both with a star, then A

### Scenario: the user removes the mark

- REQ → REQ-23, REQ-26
- Given → C is the only favorite project, at the top of the list
- When → the user presses "Remove Favorite" on the row of C
- Then → C loses its star and goes back to its place by last activity

### Scenario: the star is not only a colour

- REQ → REQ-24, REQ-30
- Given → a favorite project in the Projects list
- When → the user points at the star of its row
- Then → the star is a filled star shape, and the tooltip "Favorite" shows

### Scenario: the mark works on a folder that no longer exists

- REQ → REQ-27
- Given → a project row shows "Folder not found"
- When → the user presses "Mark as Favorite" on that row
- Then → the row shows a star and sits at the top of the list, still marked "Folder not found"

### Scenario: the mark reaches the other pages and survives a restart

- REQ → REQ-28, REQ-29, REQ-32
- Given → the Projects list is open in a browser page and in the desktop app
- When → the user marks a project as favorite in the browser page
- Then → the desktop app shows the star and the project at the top, with no reload
- And → after a client restart, both show the project with its star at the top

### Scenario: the mark cannot be changed

- REQ → REQ-23
- Given → the server does not answer
- When → the user presses "Mark as Favorite" on a project row
- Then → the row shows "Could not change the favorite mark." under it, and no star
