---
batch: project-session-start
feature: Start a session from a project
closed_req: [REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24]
depends: [project-list]
---

# Batch project-session-start — Start a session from a project

Requirements: `.sdd/plans/plan-recent_projects/requirements.md`. Visual reference: `.sdd/mockups/recent_projects/mock.html`, steps "2 · Nome della sessione" and "3 · Sessione avviata". The mock binds the look and the layout. Its data is sample data.

In this plan, "name dialog" means the dialog that asks for the session name. The mock titles it "New session". It is not the existing "New Claude Code Session" dialog (FolderChooser), which this batch does not touch.

Do not build the "Session started in ..." toast of the mock step 3. The new session opening in the main area is the only feedback.

The project list was built by batch project-list. Its components are listed in `.sdd/modules/folders/index.md`.

## What this batch builds

- Name dialog → asks for the session name of the chosen project, then starts the session in its folder.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/sessions/start-session-route.ts` | Accept an optional `name`. A `name` that is not a string (`invalid_name`) or longer than 200 characters after trim (`name_too_long`) gives `400` before any start. | REQ-18, REQ-22 | — |
| INT-2 | modify | `src/server/sessions/start-session-route.ts` | After the start, set a trimmed, non-empty `name` with SessionNameStore, with the key rule of RenameSessionRoute, before the `201`. An empty name or a name of spaces only sets no name. | REQ-16, REQ-18, REQ-19 | INT-1 |
| INT-3 | modify | `src/server/main.ts` | Pass the tracker and the SessionNameStore to `registerStartSessionRoute`, which today gets only the registry. | REQ-16, REQ-18 | INT-2 |
| INT-4 | create | frontend, folders area | Name dialog on Dialog, as in the mock: title "New session", the project (Avatar, name, path), field "Session name" with the focus, the hint, "Cancel" and "Start Session". Enter starts; Esc and "Cancel" close it with no start. | REQ-14, REQ-20, REQ-21, REQ-23, REQ-24 | — |
| INT-5 | create | frontend, folders area | "Start Session" in the name dialog sends the folder and the field text, trimmed and at most 200 characters, to `POST /api/sessions`. It is busy while the request runs. A failure shows the ErrorMessage "Could not start the session.", and the dialog stays open. | REQ-16, REQ-18, REQ-19, REQ-22, REQ-24 | INT-3, INT-4 |
| INT-6 | modify | project list of batch project-list (`src/web/folders/`, see `.sdd/modules/folders/index.md`) | A click, Enter or Space on an available row calls a new `onChoose(project)` prop. An available row shows the mock's "▶ New session" label on hover. An unavailable row calls nothing. | REQ-14, REQ-15 | — |
| INT-7 | modify | `src/web/AppLayout.tsx` | `onChoose` opens the name dialog for that project. A start closes it, and the new session becomes the open one. A cancel closes it, and the focus goes back to the row. | REQ-14, REQ-17, REQ-21 | INT-5, INT-6 |

## Human acceptance

### Scenario: the user starts a named session in a past project

- REQ → REQ-14, REQ-16, REQ-17, REQ-18, REQ-20, REQ-23, REQ-24
- Given → the side column shows the project list, with an available folder "shop-api"
- When → the user presses Enter on the "shop-api" row, types "  Rate limiter tests  " and presses Enter
- Then → the session "Rate limiter tests" is open in the main area, in the folder of "shop-api"
- And → the session list shows the same session with the label "Rate limiter tests"

### Scenario: an empty name gives the default label

- REQ → REQ-19
- Given → the name dialog is open for an available folder
- When → the user leaves the field with spaces only and presses "Start Session"
- Then → the new session is open, and its list entry shows the default label

### Scenario: the user cancels the name dialog

- REQ → REQ-21
- Given → the name dialog is open for an available folder
- When → the user presses Esc
- Then → the dialog closes, the session list has no new session, and the focus is back on the project row

### Scenario: an unavailable folder starts nothing

- REQ → REQ-15
- Given → the project list shows a folder marked "Folder not found"
- When → the user clicks that row
- Then → no dialog opens, and the session list has no new session

### Scenario: the start fails

- REQ → REQ-22
- Given → the name dialog is open for a folder that was deleted after the list loaded
- When → the user presses "Start Session"
- Then → the dialog shows "Could not start the session." and stays open
- And → the session list has no new session
