---
slug: app_processes
date: 2026-11-18
spec: .sdd/analysis/app_processes.md
status: validated
---

# Requirements — Processes section in the settings

Words used below:

- "Popup" → the settings popup of `settings_dialog.md`. Its side menu today has "Appearance", "Shortcuts" and "Updates".
- "Section" → the new "Processes" menu of the popup.
- "Process kind" → one of four kinds: app server, test server, fake Claude, Claude session.
- "App server" → a server of this app, also an old one on another port.
- "Test server" → a server started by the tests, including a test instance of the desktop app.
- "Fake Claude" → a fake Claude process started by the tests.
- "Claude session" → a Claude Code process started by an app server or a test server.
- "Current instance" → the app server that serves the open client.
- "Hosted" → a Claude session is hosted by the app server that started it.
- "Hanging" → a Claude session or a fake Claude whose parent app server is no longer running. Also an app server or a test server whose launcher (the desktop app or the test runner) is no longer running.
- "Session stop confirmation" → the confirmation of the stop action in the session list.

## Feature: Process list

| ID | Requirement |
|----|-------------|
| REQ-1 | The popup has a "Processes" menu, after the "Updates" menu. |
| REQ-2 | The section lists every running app server. |
| REQ-3 | The section lists every running test server. |
| REQ-4 | The section lists every running fake Claude. |
| REQ-5 | The section lists every running Claude session. |
| REQ-6 | The list includes processes that no running app server knows about, such as leftovers of a crashed or stopped server. |
| REQ-7 | The list does not include a Claude session that the user started outside the app. |
| REQ-8 | The list shows only processes of the current user. |
| REQ-9 | Under WSL the list shows only processes inside the Linux distribution, and no Windows process. |
| REQ-10 | The list loads each time the user opens the section. |
| REQ-11 | The section has a "Refresh" action that reloads the list. |
| REQ-12 | With no process to show, the section says so in one line. |
| REQ-13 | Each row shows the process kind, the PID and how long the process has been running. |
| REQ-14 | The row of an app server or a test server shows the port it listens on. |
| REQ-15 | The row of a Claude session shows its project folder. |
| REQ-16 | The row of a Claude session shows the session label when the app knows it. |
| REQ-17 | The row of the current instance is marked "this instance". |
| REQ-18 | The row of a Claude session hosted by the current instance says so. |
| REQ-19 | The row of a hanging process is marked as hanging. |
| REQ-20 | Opening the section or refreshing the list does not slow down or interrupt a running session. |
| REQ-21 | The section, its list and "Refresh" work with the keyboard, with a visible focus. |
| REQ-22 | The section works the same in the desktop app and in the browser. |

## Feature: Terminate a process

| ID | Requirement |
|----|-------------|
| REQ-23 | Every row has a "Terminate" action, the row of the current instance included. |
| REQ-24 | "Terminate" opens a confirmation in the style of the session stop confirmation, with "Cancel" focused first. |
| REQ-25 | The confirmation names the process: its kind, its PID, and its port or its session label when known. |
| REQ-26 | The confirmation for the current instance says that terminating it closes the app and every session it hosts. |
| REQ-27 | The confirmation for another app server says that the sessions it hosts end too. |
| REQ-28 | Terminating a Claude session hosted by the current instance has the same result as stopping it from the session list. |
| REQ-29 | Terminating ends only the chosen process, and never its child processes. |
| REQ-30 | The app never ends a process other than the one the user confirmed, also when a new process reused the same PID. |
| REQ-31 | After a confirmed terminate the list refreshes, and the row disappears when the process has ended. |
| REQ-32 | When the process does not end, or the user lacks the rights to end it, the row stays and shows a short error. |
| REQ-33 | "Terminate" and its confirmation work with the keyboard, with a visible focus. |
| REQ-34 | Terminate works the same in the desktop app and in the browser. |

## Assumptions

- **Menu, not section (REQ-1).** The spec says "a fifth section". Since `settings_dialog.md` REQ-53 the popup groups its sections in menus. "Processes" is a new menu with one section, after "Updates".
- **Hanging (REQ-19).** Gatekeeper decision, not a human decision (2026-11-18). The spec rule for Claude sessions and fake Claude stays. An app server or a test server is hanging too, when the desktop app or the test runner that launched it is no longer running. The raw request names "vecchi server dell'app su altre porte, server dei test" among the "processi rimasti appesi" (spec, "Request"). A server started by hand from a shell has no such launcher and is never hanging. The current instance is never hanging.
- **Menu (REQ-1).** Gatekeeper decision, not a human decision (2026-11-18): confirmed as written.
- **No live update (REQ-10, REQ-11, REQ-31).** The list does not update by itself while the section is open (spec, "Assumptions").
- **Children after terminate (REQ-29).** The children of a terminated process stay in the list, marked as hanging. The user ends them one by one (spec, "Assumptions").
- **One terminate level (REQ-24).** There is no "force" option (spec, "Assumptions").

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- The section works on Ubuntu and under WSL.
- On Ubuntu every existing behaviour stays as it is today (knowledge base `wsl-keeps-ubuntu-working`).
- Every new text is in English, like the rest of the client.
- The other menus of the popup and the session stop flow do not change.
- Out of scope: the "Out of scope" list of the spec (`.sdd/analysis/app_processes.md`, "Scope").
