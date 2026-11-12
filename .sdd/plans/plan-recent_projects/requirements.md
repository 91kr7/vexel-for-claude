---
slug: recent_projects
date: 2026-11-12
spec: .sdd/analysis/recent_projects.md
status: validated
---

# Requirements — recent_projects

Visual reference: `.sdd/mockups/recent_projects/mock.html`. It sets the look, the layout and the interaction. The list lives in the side column, and the name prompt is a dialog (gatekeeper decision, taken from the mock).

## Feature: Project list

| ID | Requirement |
|----|-------------|
| REQ-1 | The rail shows a "Projects" button with the same style and tooltip behaviour as the other rail buttons. |
| REQ-2 | The "Projects" button switches the side column to the project list, like the "Sessions" button switches it to the session list. |
| REQ-3 | The list holds every project folder where Claude Code saved at least one conversation on this machine, terminal-only use included. |
| REQ-4 | The list holds the same folders as the "Recenti" list of the new-session dialog. |
| REQ-5 | The list keeps its content after a page reload and after a restart of the client. |
| REQ-6 | Each entry shows the folder path and the time of the last activity in that folder. |
| REQ-7 | The list shows the most recent project first. |
| REQ-8 | Each time the user opens the list, it shows its current content. |
| REQ-9 | When no project exists, the list shows an empty state that says so. |
| REQ-10 | A folder that no longer exists on disk stays in the list, marked as unavailable. |
| REQ-11 | The "Projects" button and the list are usable with the keyboard, with visible focus. |
| REQ-12 | The list opens with no visible delay, also with some hundreds of projects. |
| REQ-13 | The project list works in the browser page and in the desktop app, and all its new text is in English. |

## Feature: Start a session from a project

| ID | Requirement |
|----|-------------|
| REQ-14 | Choosing an available project opens a dialog that asks for a session name. |
| REQ-15 | Choosing an unavailable project opens no dialog and starts no session. |
| REQ-16 | Confirming the name starts a new session in that project folder, hosted by the client. |
| REQ-17 | After the start, the new session is open in the main area and appears in the session list. |
| REQ-18 | The session name follows the rename rules of `.sdd/analysis/session_list_improvements.md`: client-only, trimmed, at most 200 characters, shown wherever the label appears. |
| REQ-19 | An empty name, or a name of spaces only, starts the session with the default label. |
| REQ-20 | Enter in the dialog confirms the name. |
| REQ-21 | Esc or the dialog's cancel action closes the dialog and starts no session. |
| REQ-22 | When the start fails, the user sees an error message and no session is added to the session list. |
| REQ-23 | The name dialog is usable with the keyboard, with visible focus. |
| REQ-24 | Starting a session from a project works in the browser page and in the desktop app, and all its new text is in English. |
