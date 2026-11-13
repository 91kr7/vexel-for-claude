---
slug: project_list_actions
date: 2026-11-13
spec: .sdd/analysis/project_list_actions.md
status: validated
---

# Requirements — project_list_actions

Words used below, as in the spec:

- "Projects list" → the list opened by the "Projects" rail button (`plan-recent_projects`).
- "Project favorite mark" → the client-only mark the user puts on a project. It is not the favorite mark on a session of `plan-favorite_session`. The two marks are separate.
- "Remove" → takes a project out of the Projects list only. It is not "Dismiss" of the session list.

## Feature: Project search

| ID | Requirement |
|----|-------------|
| REQ-1 | The Projects list shows a search bar above the projects. |
| REQ-2 | The search matches the text anywhere in the folder path, ignoring upper and lower case. |
| REQ-3 | The list updates while the user types, with no button to press. |
| REQ-4 | The filtered list keeps the order of the full list, with the favorite projects still at the top. |
| REQ-5 | When no project matches, the list shows an empty state that says no project matches the text. |
| REQ-6 | One user action clears the search and brings back the full list. |
| REQ-7 | The search is empty every time the list opens. |
| REQ-8 | Starting a session from a filtered list works exactly as from the full list. |
| REQ-9 | The search bar is usable with the keyboard, with visible focus. |
| REQ-10 | The list reacts to typing with no visible delay, also with some hundreds of projects. |
| REQ-11 | The search works in the browser page and in the desktop app, and all its new text is in English. |

## Feature: Remove a project

| ID | Requirement |
|----|-------------|
| REQ-12 | Each project row offers a remove action. |
| REQ-13 | Remove takes the project out of the Projects list at once, with no confirmation. |
| REQ-14 | Remove deletes nothing: no folder, no Claude Code file, no session and no history entry. |
| REQ-15 | A removed project stays out of the Projects list after a page reload and a client restart. |
| REQ-16 | A removed project comes back in the Projects list when a new session runs in that folder after the removal. |
| REQ-17 | A removed project stays in the "Recenti" list of the new-session dialog. |
| REQ-18 | Remove works also on a project whose folder no longer exists on disk. |
| REQ-19 | Removing a favorite project also clears its project favorite mark. |
| REQ-20 | A remove appears in every open page and in the desktop app without a reload. |
| REQ-21 | The remove action is usable with the keyboard, with visible focus. |
| REQ-22 | Remove works in the browser page and in the desktop app, and all its new text is in English. |

## Feature: Favorite project

| ID | Requirement |
|----|-------------|
| REQ-23 | Each project row offers an action to put the project favorite mark and to remove it. |
| REQ-24 | A favorite project shows a star on its row. |
| REQ-25 | Favorite projects sit at the top of the Projects list, above all other projects. |
| REQ-26 | The favorite projects among themselves, and the other projects among themselves, are ordered by last activity, most recent first. |
| REQ-27 | The mark works also on a project whose folder no longer exists on disk. |
| REQ-28 | The mark survives a page reload and a client restart. |
| REQ-29 | A change of the mark appears in every open page and in the desktop app without a reload. |
| REQ-30 | The star does not rely on colour alone. |
| REQ-31 | The mark action is usable with the keyboard, with visible focus. |
| REQ-32 | The mark works in the browser page and in the desktop app, and all its new text is in English. |

## Assumptions

All come from the spec, where the gatekeeper decided them, unless marked otherwise.

- **New session (REQ-16).** Any new Claude Code activity in the folder after the removal brings the project back: a session started from the client, a Resume, or a session run only in a terminal. The terminal case is a gatekeeper decision of this planning run, because the Projects list already counts terminal-only use (`plan-recent_projects/REQ-3`).
- **Return without mark (REQ-16, REQ-19).** A project that comes back has no project favorite mark.
- **Search text (REQ-2).** The search matches the folder path as the row shows it. Gatekeeper decision of this planning run: the user searches what they see.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Remove and the project favorite mark live only in the client. They never write to Claude Code files.
- Search, remove and the mark do not change the "Recenti" list, the new-session dialog or the resume history.
- Out of scope: undo of a remove, a screen of hidden projects, actions on several projects at once, saving the last search between openings, search on anything other than the folder path.
- Every requirement of `plan-recent_projects` stays true, except `plan-recent_projects/REQ-4` for removed projects only (REQ-17).
