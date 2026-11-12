---
slug: recent_projects
date: 2026-11-12
spec: .sdd/analysis/recent_projects.md
status: validated
---

# Batches — recent_projects

Requirements: `requirements.md`. Visual reference: `.sdd/mockups/recent_projects/mock.html`.

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [project-list](batches/batch-project-list.md) | Project list | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13 | — | certified | The user sees the past projects in the side column |
| [project-session-start](batches/batch-project-session-start.md) | Start a session from a project | REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24 | project-list | todo | The user starts a named session in a past project |

Execution order: project-list, then project-session-start.

## Assumptions and decisions

- **Not built from the mock** (gatekeeper decision). The session count per folder, the folder count in the list header and the "Session started in ..." toast are not requirements. The implementer must not build them, the toast included. The analysis does not ask for them (`.sdd/analysis/recent_projects.md`, Requirements).
- **One source for both lists.** The project list reads `GET /api/past-sessions`, the route that feeds "Recent" in the new-session dialog. This keeps the two lists equal (REQ-4). It also keeps the rules of that route, for example: a folder appears only after a session there has a first user message. The analysis sets the same rule.
- **Availability on the server.** The route adds to each group a mark that tells whether the folder exists (batch-project-list/INT-1). The new-session dialog ignores the new field, so "Recent" does not change.
- **No visible delay** (REQ-12). The side column switches at once. The first open shows a loading state. Later opens show the last loaded list at once, and update it when the new answer arrives (REQ-8).
- **Side column.** The project list takes the place of the session list in the same panel. It uses the same width and the same resize edge.
- **Last activity** uses the existing RelativeTime format. The mock texts ("2 h ago", "Yesterday") are sample data.
- **The name is set by the start route** (batch-project-session-start/INT-1, INT-2). The route checks the name before it starts the session. So a bad name starts no session (REQ-22), and the list never shows the new session without its name. The new-session dialog sends no name and keeps working as today.
- **Desktop app.** The desktop window loads the same page, so no desktop code changes (REQ-13, REQ-24). Following the knowledge base entry `electron-e2e-separate`, any Electron e2e test of these batches goes in the Electron group (`npm run test:e2e:desktop`), never in the default e2e run.
- **New components** live in the frontend folders area (module folders): it already owns the choice of a project folder for a new session.

## Departures

None.

## Coverage check

batch-project-list:

| REQ | INT |
|-----|-----|
| REQ-1 | INT-5 |
| REQ-2 | INT-6 |
| REQ-3 | INT-2 |
| REQ-4 | INT-2 |
| REQ-5 | INT-2 |
| REQ-6 | INT-3 |
| REQ-7 | INT-2 |
| REQ-8 | INT-2, INT-6 |
| REQ-9 | INT-4 |
| REQ-10 | INT-1, INT-3 |
| REQ-11 | INT-3, INT-4, INT-5, INT-7 |
| REQ-12 | INT-2, INT-4 |
| REQ-13 | INT-3, INT-4, INT-5 |

batch-project-session-start:

| REQ | INT |
|-----|-----|
| REQ-14 | INT-4, INT-6, INT-7 |
| REQ-15 | INT-6 |
| REQ-16 | INT-2, INT-3, INT-5 |
| REQ-17 | INT-7 |
| REQ-18 | INT-1, INT-2, INT-3, INT-5 |
| REQ-19 | INT-2, INT-5 |
| REQ-20 | INT-4 |
| REQ-21 | INT-4, INT-7 |
| REQ-22 | INT-1, INT-5 |
| REQ-23 | INT-4 |
| REQ-24 | INT-4, INT-5 |

- Every REQ is served by at least one INT, and every INT serves at least one REQ. There is no enabling intervention.
- Each REQ closes in one batch only: REQ-1 to REQ-13 in project-list, REQ-14 to REQ-24 in project-session-start.
