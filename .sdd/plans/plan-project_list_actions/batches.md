---
slug: project_list_actions
date: 2026-11-13
spec: .sdd/analysis/project_list_actions.md
status: validated
---

# Batches — project_list_actions

Requirements: `requirements.md`. There is no mock for this request.

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [favorite-project](batches/batch-favorite-project.md) | Favorite project | REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32 | — | certified | A favorite project moves to the top of the list |
| [remove-project](batches/batch-remove-project.md) | Remove a project | REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22 | favorite-project | certified | The user removes a project from the list |
| [project-search](batches/batch-project-search.md) | Project search | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11 | favorite-project | implemented | The user finds a project by typing part of its path |

Execution order: favorite-project, then remove-project, then project-search. Remove and search do not depend on each other. They run one after the other because both change `ProjectList.tsx`. favorite-project goes first: remove clears the mark (REQ-19), and the search keeps the favorites at the top (REQ-4).

## Assumptions and decisions

- **Marks on the server.** The project favorite mark and the removal live in one JSON file of the client data folder, as the session favorite marks do. So they survive a client restart, and every page and the desktop app share them (REQ-15, REQ-20, REQ-28, REQ-29). The file is outside the Claude Code folder.
- **Live update.** A new WebSocket route pushes the project marks to every page. A page applies them to the list it already holds, with no new load. Planner decision: the session events route stays as it is.
- **Filter and order in the page.** `GET /api/past-sessions` does not change, so the "Recent" list of the new-session dialog keeps the removed projects (REQ-17). The UI calls that list "Recent"; the spec calls it "Recenti".
- **Return of a removed project** (REQ-16). The rule is in `batch-remove-project.md`. It compares the removal time, from the server clock, with the last activity of the folder. Any later activity brings the project back. This includes a session that was already running in a terminal when the user removed the project.
- **Same folder path.** The folder of a hosted session and the folder of a past-sessions group are the same absolute path for the same project.
- **New texts** (planner decision): "Mark as Favorite", "Remove Favorite" and "Could not change the favorite mark.", as on the session list. "Remove from Projects", "Could not remove the project.", "Search projects", "Clear Search", "No projects match". The star is the FavoriteIndicator of the session list.
- **Row actions.** The favorite and remove buttons sit beside the row button, not inside it, as on the session list. Unavailable rows get them too (REQ-18, REQ-27).
- **Focus.** "Projects" in the rail still moves the focus to the first row (`plan-recent_projects/REQ-11`). The search bar sits before the rows in the Tab order.
- **New components** live in the folders area (module folders). It already owns the Projects list.
- **Desktop app.** The desktop window loads the same page, so no desktop code changes (REQ-11, REQ-22, REQ-32). Knowledge base entry `electron-e2e-separate` applies: any Electron e2e test of these batches goes in the Electron group (`npm run test:e2e:desktop`), never in the default e2e run.

## Departures

None. The change to `plan-recent_projects/REQ-4` for removed projects comes from the spec (REQ-17).

## Coverage check

batch-favorite-project:

| REQ | INT |
|-----|-----|
| REQ-23 | INT-2, INT-7, INT-8 |
| REQ-24 | INT-8 |
| REQ-25 | INT-6 |
| REQ-26 | INT-6 |
| REQ-27 | INT-1, INT-2, INT-8 |
| REQ-28 | INT-1, INT-4, INT-5 |
| REQ-29 | INT-3, INT-4, INT-5, INT-6 |
| REQ-30 | INT-8 |
| REQ-31 | INT-7, INT-8 |
| REQ-32 | INT-7, INT-8 |

batch-remove-project:

| REQ | INT |
|-----|-----|
| REQ-12 | INT-7, INT-8 |
| REQ-13 | INT-2, INT-6, INT-7 |
| REQ-14 | INT-1, INT-2 |
| REQ-15 | INT-1, INT-5, INT-6 |
| REQ-16 | INT-4, INT-6 |
| REQ-17 | INT-6 |
| REQ-18 | INT-1, INT-2, INT-8 |
| REQ-19 | INT-1 |
| REQ-20 | INT-3, INT-5, INT-6 |
| REQ-21 | INT-7, INT-8 |
| REQ-22 | INT-7, INT-8 |

batch-project-search:

| REQ | INT |
|-----|-----|
| REQ-1 | INT-1 |
| REQ-2 | INT-2 |
| REQ-3 | INT-2 |
| REQ-4 | INT-2 |
| REQ-5 | INT-3 |
| REQ-6 | INT-1 |
| REQ-7 | INT-4 |
| REQ-8 | INT-2 |
| REQ-9 | INT-1 |
| REQ-10 | INT-2 |
| REQ-11 | INT-1, INT-3 |

- Every REQ is served by at least one INT. Every INT serves at least one REQ. There is no enabling intervention.
- Each REQ closes in one batch only. REQ-23 to REQ-32 close in favorite-project, REQ-12 to REQ-22 in remove-project, and REQ-1 to REQ-11 in project-search.
- REQ-4 needs the favorite order of favorite-project. It closes in project-search, which depends on favorite-project.
