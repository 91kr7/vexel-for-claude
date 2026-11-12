---
request_slug: recent_projects
date: 2026-11-12
type: evolution
size: ordinary
reference: .sdd/analysis/claude_sessions_client.md
---

# Analysis — Past projects in the rail

## Request

> voglio che l'applicazione ricordi i progetti sui quali ha lavorato in passato (anche chiudendo l'app) e mi proponga da qualche parte un tastino per vederli ed eventualmente poter avviarne una sessione.  forse questo tasto si puo' mettere nella sidebar. se puoi generami un mock visivo

## Reference

[claude_sessions_client.md](claude_sessions_client.md) → the user starts a new session by choosing a project folder, and resumes past sessions from a list grouped by project folder (lines 83-85). Related analyses:
- [claude_sessions_client-ui_redesign-material3_mock.md](claude_sessions_client-ui_redesign-material3_mock.md), lines 87-88 → the new-session dialog has a "Recenti" list with the project folders of past sessions, most recent first.
- [claude_sessions_client-ui_redesign-material3_mock-studio_dark.md](claude_sessions_client-ui_redesign-material3_mock-studio_dark.md), line 66 → the rail holds "New session", a divider, "Sessions" and "Resume".
- [session_list_improvements.md](session_list_improvements.md), lines 62-72 → the client-only session name and its rules.

Changes:
- A new rail button opens the list of past projects.
- Choosing a project asks for a session name, then starts a new session in that folder.
- Every other requirement of the references stays true.

## Summary

A "Projects" button in the rail shows every project folder where Claude Code was used on this machine. The user picks one, gives the session a name, and a new session starts in that folder.

## Requirements

### Functional

Rail button
- The rail must show a new "Projects" button, with the same style and tooltip behaviour as the other rail buttons.
- The button must open the list of past projects.

Project list
- The list must hold every project folder where Claude Code was used on this machine, terminal-only use included. This is the human's decision.
- The list must use the same source as the "Recenti" list of the new-session dialog, so the two lists hold the same folders.
- The list must survive a page reload and a restart of the client.
- Each entry must show the folder path and the time of the last activity in that folder.
- The list must show the most recent project first.
- The list must show its current content every time the user opens it.
- When no project exists, the list must show an empty state that says so.
- A folder that no longer exists on disk must stay in the list, marked as unavailable, and must not start a session.

Start a session
- Choosing a project must ask for a session name. This is the human's decision.
- Confirming the name must start a new session in that project folder, hosted by the client.
- After the start, the new session must be open in the main area and appear in the session list.
- The name must follow the rename rules of [session_list_improvements.md](session_list_improvements.md): client-only, trimmed, at most 200 characters, shown wherever the label appears.
- An empty name, or a name of spaces only, must start the session with the default label.
- Enter must confirm the name and Esc must cancel. A cancel must start no session.
- When the start fails, the user must see an error message and no session must be added to the list.
- Every new text must be in English, like the rest of the UI.
- The feature must work in the browser page and in the desktop app.

### Non-functional

- The button, the list and the name prompt must be usable with the keyboard, with visible focus, as the earlier analyses require for the UI.
- The list must open with no visible delay, also with some hundreds of projects.

## Assumptions

- This is an evolution, not a fix. The gatekeeper decided this: the request adds a function and corrects nothing.
- "Projects" means project folders. Claude Code already keeps its session history on disk, so the list survives a client restart with no new storage.
- A folder appears in the list once Claude Code has saved at least one conversation there. This is the same rule as "Recenti".
- Whether the list opens as a panel or as a dialog is decided by the visual mock. The requirements hold for both.

## Scope

In scope:
- The "Projects" rail button and the list of past project folders.
- The name prompt and the start of a new session from a chosen project.
- A static visual mock of the button, the list and the name prompt, for the human to review. The orchestrator produces it under `.sdd/mockups/recent_projects/`.

Out of scope:
- Removing or hiding a project from the list. This is the gatekeeper's decision.
- Search, filters, pinning or favorites in the project list.
- Resuming past sessions from the project list. The "Resume" dialog keeps this role.
- Any change to the "Recenti" list, the new-session dialog or the "Resume" dialog.
- Any write to Claude Code files.
