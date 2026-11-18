---
request_slug: app_processes
date: 2026-11-18
type: evolution
size: ordinary
reference: .sdd/analysis/settings_dialog.md
---

# Analysis — Processes section in the settings

## Request

> Aggiungi nelle Impostazioni una nuova sezione "Processi" che mostra i processi in esecuzione legati all'app, compresi tutti i processi rimasti appesi (vecchi server dell'app su altre porte, server dei test, processi del finto Claude dei test, sessioni Claude avviate dall'app). Per ogni processo un pulsante "Termina" con conferma, come per le sessioni. Deve funzionare su Ubuntu e sotto WSL. Scelte del richiedente: mostrare tutti i processi appesi, non solo quelli che l'app conosce; terminazione con conferma.

## Reference

[settings_dialog.md](settings_dialog.md) → the settings popup opens from the bottom of the navigation rail. It has four sections: theme, window look, shortcuts, updates. It put new settings out of scope (line 131).

Related:
- [claude_sessions_client-ui_redesign-material3_mock.md](claude_sessions_client-ui_redesign-material3_mock.md) → the stop confirmation of a session: the session name, the consequence text, "Cancel" with the initial focus (lines 24, 89).
- [wsl_support.md](wsl_support.md) → the app runs on Ubuntu and under WSL.

Changes:
- A fifth section, "Processes", lists the running processes related to the app, including processes left hanging.
- Each process has a "Terminate" action with a confirmation.

## Summary

The settings popup gets a "Processes" section. It lists the app's own processes, including leftovers from old app servers, tests and Claude sessions. The user can terminate each one after a confirmation.

## Requirements

### Functional

The section
- The settings popup must have a "Processes" section, after the existing sections.
- The section must list the running processes of four kinds: app servers, test servers, fake Claude processes of the tests, and Claude sessions started by the app.
- The list must include processes that no running app instance knows about, such as leftovers of a crashed or stopped server.
- The list must not include Claude sessions that the user started outside the app.
- The list must show only processes of the current user.
- The list must load when the user opens the section.
- The section must have a "Refresh" action that reloads the list.
- With no process to show, the section must say so in one line.

Each row
- Each row must show the kind of the process, its PID and how long it has been running.
- A server row must show the port it listens on.
- A Claude session row must show its project folder, and the session label when the app knows it.
- The row of the current app instance must be marked "this instance".
- A row of a Claude session hosted by the current instance must say so.
- A process whose parent app server is no longer running must be marked as hanging.

Terminate
- Every row must have a "Terminate" action, the current instance included.
- "Terminate" must open a confirmation in the style of the session stop confirmation, with "Cancel" focused first.
- The confirmation must name the process: kind, PID, and port or session label when known.
- The confirmation of the current instance must say that terminating it closes the app and every session it hosts.
- The confirmation of another app server must say that the sessions it hosts end too.
- Terminating a Claude session hosted by the current instance must have the same result as stopping it from the session list.
- Terminating must end only the chosen process, never its child processes.
- The app must never end a process other than the one the user confirmed, even if a new process reused the same PID.
- After a confirmed terminate, the list must refresh, and the row must disappear when the process has ended.
- When the process does not end, or the user lacks the rights to end it, the row must stay and show a short error.

### Non-functional

- The section must work on Ubuntu and under WSL.
- On Ubuntu every existing behaviour must stay as it is today (knowledge base `wsl-keeps-ubuntu-working`).
- Under WSL the list must show only processes inside the Linux distribution, not Windows processes.
- The section must work in the desktop app and in the browser, like the rest of the settings.
- The section and its actions must work with the keyboard, with a visible focus.
- Every new text must be in English, like the rest of the client.
- Opening the section or refreshing the list must not slow down or interrupt running sessions.

## Assumptions

- This is an evolution, not a fix: it adds a feature that [settings_dialog.md](settings_dialog.md) left out of scope. The gatekeeper decided this.
- The current instance gets a "Terminate" action. The request asks for one on every process, and the human chose terminate with a confirmation after being told it closes the app. The gatekeeper decided this.
- External Claude sessions are not listed, because the request names only the sessions the app started. The gatekeeper confirmed this.
- Terminating ends only the chosen process. Its children stay in the list, marked as hanging, and the user ends them one by one. The gatekeeper confirmed this.
- The labels are "Processes" and "Terminate", in English. The gatekeeper confirmed this.
- Only the current user's processes are shown, and only on the Linux side under WSL. The gatekeeper confirmed this.
- The list does not update by itself while the section is open. It refreshes on opening, on "Refresh" and after a terminate.
- A test instance of the desktop app counts as a test server.
- Terminate has a single level. The request asks for no "force" option.

## Risks

- The human's live instance runs from the same folder as the test servers. Another app server in the list can be a live instance with working sessions, and terminating it ends them. The confirmation text is the only guard.
- Terminating the current instance by mistake closes the app and every hosted session. The confirmation is the only guard.
- A wrong classification can show a process of the user that does not belong to the app, and the user can end it.
- A wrong classification can also hide a hanging process, and the user then believes nothing is left.
- A process can end, or its PID can be reused, between the list and the confirmation.

## Scope

In scope:
- The "Processes" section in the settings popup, with the list, the row details and "Refresh".
- "Terminate" with a confirmation on every listed process, the current instance included.
- Ubuntu and WSL.

Out of scope:
- Claude sessions started outside the app, and processes of other users.
- Windows processes under WSL, and support for macOS or native Windows.
- Terminating a process together with its children, and a "force" terminate.
- Automatic cleanup of hanging processes, at launch or on a schedule.
- Terminating several processes at once.
- Showing resource use (CPU, memory) of the processes.
- Any change to the other settings sections or to the session stop flow.
