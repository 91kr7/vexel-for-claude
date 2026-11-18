---
slug: app_processes
date: 2026-11-18
status: validated
---

# Batches — Processes section in the settings

Requirements → `requirements.md`. Execution order: processes-list → terminate-process.

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [processes-list](batches/batch-processes-list.md) | Process list | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22 | — | todo | The user sees the app processes in the settings |
| [terminate-process](batches/batch-terminate-process.md) | Terminate a process | REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34 | processes-list | todo | The confirmation names the process |

## Assumptions and decisions

- **Reading `/proc` (REQ-8, REQ-9).** The server reads `/proc` directly. Under WSL `/proc` holds only the Linux processes, so no Windows process can show. No shell command and no Windows tool run. Ubuntu and WSL use the same code path (knowledge base `wsl-keeps-ubuntu-working`).
- **Classification (REQ-2 to REQ-7).** By command line, working directory and environment markers. The rules are in batch processes-list, section "Classification". A Claude session is recognised by `AI_CLIENT_SESSION_ID`, which SessionRegistry already sets. The fake CLI is recognised by its path in `test-support/`.
- **Launcher marker (REQ-19).** The desktop app and the test runner pass their PID and start time to the server they start. Without it a server cannot tell "launched by the desktop app" from "started by hand". Servers started before this change have no marker and are never hanging.
- **Session label (REQ-16).** The app knows the label only for the sessions of the current instance (SessionStateTracker). Sessions of other app servers show their folder only.
- **Process identity (REQ-30).** A process is its PID plus its start time from `/proc/<pid>/stat`. The page sends both. The server checks both again just before the signal.
- **Terminate (REQ-28, REQ-29).** `SIGTERM` to the PID only. A session hosted by the current instance goes through `Session.stop()`, the path of the session list. The sessions of a terminated app server end because that server stops them on `SIGTERM`.
- **Desktop quit (REQ-26).** Gatekeeper decision, not a human decision (2026-11-18). After a confirmed terminate of the current instance, the desktop app quits like the tray "Quit". It quits whether or not it started that backend. It asks no second question, because the user has already confirmed. In the browser the page shows the load failure. The request goes through the desktop bridge and WindowActions, which already carry the window requests of the page.
- **Empty line (REQ-12).** Gatekeeper decision, not a human decision (2026-11-18): REQ-12 stays and is covered by a component test.
- **Live list.** No timer and no push: the list reads `/proc` only on opening, on "Refresh" and after a terminate (REQ-20).
- **Texts.** The labels, marks, confirmation texts and errors are fixed in the "Texts" section of each batch. Gatekeeper-level defaults, in English.
- **Tests.** The e2e server is the current instance in e2e, so e2e never confirms its terminate. Test processes are stopped by their PID only (knowledge base `no-kill-by-pattern`). No Electron spec is planned (knowledge base `electron-e2e-separate`).
- **Indexes and specs.** The indexes and specs gave every "modify" place. One source file was opened: `playwright.config.ts`, to see how the e2e server gets its fake CLI.

## Risks

- The classification reads the command line and the environment of each process. A rule that is too wide lists a process of the user that is not the app's, and the user can end it.
- An Electron e2e instance counts as a test server only if its environment carries the test marker or the fake CLI. If the Electron specs pass neither, the implementer of batch processes-list adds the test marker where those specs launch Electron.

## Departures

None.

## Coverage check

- Every REQ is served by at least one INT:
  - processes-list → REQ-1 (INT-12), REQ-2 (INT-2), REQ-3 (INT-2, INT-8), REQ-4, REQ-5 (INT-2), REQ-6 (INT-1, INT-4), REQ-7 (INT-2), REQ-8, REQ-9 (INT-1), REQ-10 (INT-5, INT-6, INT-9, INT-11, INT-12), REQ-11 (INT-5, INT-9, INT-11), REQ-12 (INT-11), REQ-13 (INT-4, INT-10, INT-11), REQ-14 to REQ-16 (INT-4, INT-11), REQ-17, REQ-18 (INT-4, INT-11, INT-13), REQ-19 (INT-3, INT-7, INT-8, INT-11, INT-13), REQ-20 (INT-1, INT-4), REQ-21 (INT-11, INT-12, INT-13), REQ-22 (INT-5, INT-11).
  - terminate-process → REQ-23 (INT-4, INT-5, INT-6, INT-9, INT-11), REQ-24, REQ-25 (INT-8), REQ-26 (INT-8, INT-12 to INT-16), REQ-27 (INT-8), REQ-28 (INT-3), REQ-29 (INT-2), REQ-30 (INT-1, INT-5), REQ-31 (INT-5, INT-7, INT-9, INT-10), REQ-32 (INT-2, INT-3, INT-5, INT-7, INT-10), REQ-33 (INT-8, INT-9, INT-11), REQ-34 (INT-5, INT-7, INT-9).
- Every INT serves at least one REQ. There is no enabling INT.
- No REQ spans two batches.
- REQ-12 → the current instance is always listed, so the empty line cannot show in a real run. The tester covers it with a component test.
