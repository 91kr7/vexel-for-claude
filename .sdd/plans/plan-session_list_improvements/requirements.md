---
slug: session_list_improvements
date: 2026-11-06
spec: .sdd/analysis/session_list_improvements.md
status: validated
---

# Requirements — Session list: dismiss and resume, running tool, rename

Words used below:

- "Ended hosted session" → a session that the client started and that has ended. It sits in the ended group of the list.
- "Default label" → the start of the first user message, the label every entry shows today.
- "Tool line" → the new line of a list entry that shows the running tool.
- "Name" → the client-only name the user gives a session. It is not the Claude Code session name.

## Feature: Dismiss and Resume

| ID | Requirement |
|----|-------------|
| REQ-1 | The entry of an ended hosted session offers the action "Dismiss". |
| REQ-2 | The entry of an ended hosted session offers the action "Resume" only when the session has a saved conversation. |
| REQ-3 | No entry other than an ended hosted session offers "Dismiss" or "Resume". |
| REQ-4 | "Dismiss" removes the session from the list at once, with no confirmation. |
| REQ-5 | A dismissed session does not come back to the list after a page reload or a client restart. |
| REQ-6 | A dismissed session stays in the resume history and stays resumable from there. |
| REQ-7 | When the user dismisses the open session, the main area returns to its state with no open session. |
| REQ-8 | "Resume" resumes the session with one click and no dialog, as a resume from the history does. |
| REQ-9 | "Resume" shows the running-elsewhere warning when the session runs in another terminal. |
| REQ-10 | After "Resume", the resumed session is open in the main area. |
| REQ-11 | After "Resume", the list holds one entry for that conversation, at the end of its new state group, and no ended entry for it. |
| REQ-12 | When "Resume" fails, the entry stays in the ended group and the user sees an error message. |
| REQ-13 | "Dismiss" and "Resume" are usable with the keyboard, with visible focus. |

## Feature: Running tool

| ID | Requirement |
|----|-------------|
| REQ-14 | The entry of a working session, hosted or external, shows a tool line with the tool that Claude runs at that moment. |
| REQ-15 | The tool line shows the tool name and the main argument that the tool-call card of the conversation view shows for that call, for example "Bash: npm test". |
| REQ-16 | For a tool with no main argument, the tool line shows the tool name only. |
| REQ-17 | A main argument longer than the entry is cut on one line with an ellipsis. |
| REQ-18 | For a command on several lines, the tool line shows only its first line. |
| REQ-19 | When several tools run at the same time, the tool line shows the last one that started and the count of the others, for example "+2". |
| REQ-20 | The tool line ignores the tool calls made inside a subagent. |
| REQ-21 | A tool stays on the tool line for at least 1 second, unless another tool replaces it or the turn ends. |
| REQ-22 | When no tool runs, the entry shows no tool line. |
| REQ-23 | Entries that need input, are idle or have ended show no tool line. |
| REQ-24 | The tool line shows a tool within 2 seconds of its start, for hosted and external sessions. |

## Feature: Rename

| ID | Requirement |
|----|-------------|
| REQ-25 | From its list entry, the user can give a name to any session in the list, hosted or external, in any state. |
| REQ-26 | The name replaces the default label in the list entry, the session header and the stop confirmation. |
| REQ-27 | The name replaces the default label in the notifications about that session. |
| REQ-28 | The name replaces the default label in the tray menu of the desktop app. |
| REQ-29 | The name replaces the default label in the resume history. |
| REQ-30 | The history search matches the name in place of the default label. |
| REQ-31 | An empty name, or a name of spaces only, brings back the default label. |
| REQ-32 | The client removes the spaces at the start and at the end of a name. |
| REQ-33 | The client never saves a name longer than 200 characters. |
| REQ-34 | During the edit, Enter confirms the name and Esc cancels the change. |
| REQ-35 | The name survives a page reload and a client restart. |
| REQ-36 | The name survives a resume of the session from the list entry, from the resume history and with "Resume Here". |
| REQ-37 | A new name appears in every open page and in the desktop app without a reload. |
| REQ-38 | Renaming does not change the place of the session in the list. |
| REQ-39 | Rename is usable with the keyboard, with visible focus. |

## Assumptions

The gatekeeper confirmed "Length limit", "Resume Here" and "Notifications and tray" on 2026-11-06. The others apply the spec.

- **Resumable from the terminal (REQ-6).** The spec also asks that a dismissed session stays resumable from the terminal. Dismiss writes nothing to Claude Code files, so the terminal is not touched. No REQ tests it.
- **Order after "Resume" (REQ-11).** The spec's assumption puts a resumed session at the end of its new group, per the order rules of the reference.
- **Length limit (REQ-33).** The limit applies after the spaces at the start and end are removed. The edit field stops input at 200 characters, with no error message.
- **"Resume Here" (REQ-36).** The spec says the name survives "a Resume of the session". "Resume Here" resumes the same conversation, so the name survives it too.
- **Notifications and tray (REQ-27, REQ-28).** The name applies to notifications and tray entries shown after the rename. A notification already on screen does not change.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Every new text of the UI is in English.
- The name lives only in the client. It never becomes the Claude Code session name, and the client writes nothing to Claude Code files.
- The client never removes an ended session by itself.
- Out of scope: Dismiss or Resume for external sessions, removing several sessions at once, undo of a dismiss, new actions in the header of an open session, Claude Code session names, tool history or tool details beyond the current tool, any change to the state groups, their order or drag and drop.
- Every requirement of `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order` and of the plans before it stays true.
