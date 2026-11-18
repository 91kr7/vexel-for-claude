---
batch: processes-list
feature: Process list
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22]
depends: []
---

# Batch processes-list — Process list

Requirements → `.sdd/plans/plan-app_processes/requirements.md`. Its "Words used below" list defines the process kinds, "current instance", "hosted" and "hanging". The settings popup has three menus today: "Appearance", "Shortcuts", "Updates". This batch adds the "Processes" menu with a read-only list. Batch terminate-process adds "Terminate" later.

## What this batch builds

- **Process reader** → reads `/proc` and gives the facts of the current user's processes.
- **Process list** → turns those facts into the rows of the app's processes: kind, PID, start time, port, folder and marks.
- **Processes route** → a server route that gives the rows to the page.
- **Processes section** → the "Processes" menu of the settings popup: the list, "Refresh" and the empty line.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, new processes area | Process reader: reads `/proc` only when it is called, with async reads. For each process of the current user it gives the PID, parent PID, start time, command line, working directory, the app markers of its environment and its listening TCP ports. | REQ-6, REQ-8, REQ-9, REQ-20 | — |
| INT-2 | create | backend, processes area | Kind rule: from the facts of INT-1, gives app server, test server, fake Claude, Claude session, or "not listed". Rules in "Classification" below. | REQ-2, REQ-3, REQ-4, REQ-5, REQ-7 | INT-1 |
| INT-3 | create | backend, processes area | Hanging rule: a Claude session or fake Claude whose parent is not a running app or test server. A server whose launcher marker names a process that no longer runs with that start time. Never the current instance. | REQ-19 | INT-1 |
| INT-4 | create | backend, processes area | Process list: one row per listed process with kind, PID, start time, port, folder, "this instance", hosted by the current instance (SessionRegistry `hostedPids`) with its label (SessionStateTracker), hanging. Overlapping calls share one read. | REQ-6, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-20 | INT-2, INT-3 |
| INT-5 | create | backend, processes area | Route `GET /api/processes`: the rows of INT-4, read at each call. | REQ-10, REQ-11, REQ-22 | INT-4 |
| INT-6 | modify | `src/server/main.ts` | Register the route of INT-5 with the SessionRegistry, the SessionStateTracker and the server's own PID. | REQ-10 | INT-5 |
| INT-7 | modify | `src/desktop/backend-launcher.ts` | A server that `launchBackend` starts gets the launcher marker in its environment: the PID and start time of the desktop app. A reused backend changes nothing. | REQ-19 | — |
| INT-8 | modify | `playwright.config.ts` | The e2e server gets the launcher marker of the test runner and the test marker in its `env`. | REQ-3, REQ-19 | — |
| INT-9 | create | frontend, settings area | Page call of `GET /api/processes`: gives the rows, or a failure on a network error, another status or a body of the wrong shape. | REQ-10, REQ-11 | INT-5 |
| INT-10 | create | frontend, settings area | Running time text from a start time and the current time, with the forms of "Texts". | REQ-13 | — |
| INT-11 | create | frontend, settings area | Processes section: header "Processes" with "Refresh". It loads on mount and on "Refresh". It shows the loading, failure and empty states with AreaState, else one row per process with the texts below. | REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-21, REQ-22 | INT-9, INT-10 |
| INT-12 | modify | `src/web/settings/SettingsDialog.tsx` | Add the menu "Processes" after "Updates", with the start value `processes`. Mount its section only while it shows, so each opening loads the list again. | REQ-1, REQ-10, REQ-21 | INT-11 |
| INT-13 | modify | `src/web/styles.css` | Row styles and the pills "This instance", "Hosted here" and "Hanging", with theme tokens only, so every theme and look works. Visible focus on "Refresh". | REQ-17, REQ-18, REQ-19, REQ-21 | INT-11 |

## Classification

- Only processes whose `/proc` owner is the current user. Under WSL `/proc` holds only the Linux processes. The reader never calls a Windows tool or a shell command.
- **App server** → a Node process that runs the app's `src/server/main.ts`. Its working directory holds this app: its `package.json` has the app's name.
- **Test server** → an app server whose environment has the test marker, or names the fake CLI of `test-support/` in `AI_CLIENT_CLAUDE_CLI`. An Electron instance of the app with that environment is a test server too. It has no port when it listens on none.
- **Fake Claude** → a process that runs `test-support/fake-claude.mjs`.
- **Claude session** → the top process that has `AI_CLIENT_SESSION_ID` in its environment and is not a fake Claude. Its descendants with the same id are not listed. A Claude process without that variable is external: not listed.
- **Port** → the TCP port the process listens on, from `/proc/net/tcp` and `/proc/net/tcp6` and its socket inodes.
- **Launcher marker** → one environment variable with the PID and start time of the launcher. The desktop app sets it (INT-7), the test runner sets it (INT-8). A server without it was started by hand, or before this change, and is never hanging.
- A process that ends during the read is skipped. An environment that cannot be read gives no marker.

## Notes for the implementer

- The read runs only on a request: no timer, no polling, nothing that waits on the event loop of the sessions (REQ-20).
- The SettingsDialog spec says its only server call is the update check. Update it: the "Processes" menu also loads the list.
- Row order → the current instance first, then app servers, test servers, fake Claude, Claude sessions. Inside a kind, oldest first.
- Tests → e2e runs on the e2e server, which is the current instance. A test that needs another process starts it itself, records its PID and stops it by that PID only (knowledge base `no-kill-by-pattern`). Never touch port 4001.
- No test needs the desktop window. An Electron spec, if any, goes in the Electron group (knowledge base `electron-e2e-separate`).
- On Ubuntu nothing else changes: the launcher marker is a new variable only (knowledge base `wsl-keeps-ubuntu-working`).

## Texts

| Where | Text |
|-------|------|
| Menu and header | "Processes" |
| Action | "Refresh" |
| Kinds | "App server", "Test server", "Fake Claude", "Claude session" |
| Row details | "PID <pid>", "Port <port>", "Running <time>", the project folder, the session label |
| Running time | "<s>s" under one minute, "<m>m", "<h>h <mm>m", "<d>d <h>h" |
| Marks | "This instance", "Hosted here", "Hanging" |
| Empty | "No app processes are running." |
| Load failure | "Could not load the processes." |

## Human acceptance

### Scenario: The user sees the app processes in the settings

- REQ → REQ-1, REQ-2, REQ-5, REQ-8, REQ-10, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-20, REQ-21, REQ-22
- Given → the app runs in the browser or the desktop app, with one working Claude session, and another app server runs on another port
- When → the user opens the settings and chooses "Processes", after "Updates", with the keyboard
- Then → the list shows the current instance as "This instance" and the other server, each with its port, and the session with its folder, its label and "Hosted here"; every row shows its kind, PID and running time
- And → the session keeps working with no pause

### Scenario: Leftovers of a stopped test run show as hanging

- REQ → REQ-3, REQ-4, REQ-6, REQ-19
- Given → a test run was stopped abruptly, and its test server and a fake Claude still run
- When → the user opens the "Processes" menu
- Then → the list shows the "Test server" and the "Fake Claude", both marked "Hanging"

### Scenario: Refresh shows a new process

- REQ → REQ-11
- Given → the "Processes" menu is open, and a new session started in another tab of the app after the list loaded
- When → the user chooses "Refresh"
- Then → the list shows the new "Claude session" row

### Scenario: Processes outside the app stay out

- REQ → REQ-7, REQ-9
- Given → Claude Code runs in an external terminal, and under WSL Windows programs run
- When → the user opens the "Processes" menu
- Then → the list shows no row for the external session and no Windows process

### Scenario: Nothing to show

- REQ → REQ-12
- Given → the list of the server holds no process
- When → the user opens the "Processes" menu
- Then → the menu shows one line: "No app processes are running."
