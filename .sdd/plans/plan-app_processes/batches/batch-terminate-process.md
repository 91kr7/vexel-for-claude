---
batch: terminate-process
feature: Terminate a process
closed_req: [REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34]
depends: [processes-list]
---

# Batch terminate-process — Terminate a process

Requirements → `.sdd/plans/plan-app_processes/requirements.md`. Its "Words used below" list defines the process kinds, "current instance", "hosted" and "hanging". Batch processes-list built the "Processes" menu of the settings popup. Its components are in `.sdd/modules/` (the indexes give their paths). Each row has a kind, a PID and a start time. This batch adds "Terminate" with a confirmation on every row.

## What this batch builds

- **Terminate service** → checks that the PID is still the listed process, then ends that one process and reports how it went.
- **Terminate route** → a server route that the page calls with the PID and start time of a row.
- **Terminate confirmation** → the warning dialog that names the process before anything ends.

The desktop bridge also gets a "quit the app" request. After the current instance has been terminated, the desktop app quits.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, processes area | Identity check: before any signal, read the PID again with the process reader. It must have the same start time, the current user and a listed kind. Else the outcome is `gone` and no signal leaves. | REQ-30 | — |
| INT-2 | create | backend, processes area | Terminate one process: `SIGTERM` to its PID only, never to its process group. Then wait up to 5 s for the end. Outcome: `ended`, `running`, or `not_allowed` on `EPERM`. | REQ-29, REQ-32 | INT-1 |
| INT-3 | create | backend, processes area | A Claude session hosted by the current instance: stop it with `stop()` of its SessionRegistry session, as StopSessionRoute does. Wait for its end, then give the outcome of INT-2. | REQ-28, REQ-32 | INT-1 |
| INT-4 | create | backend, processes area | The current instance: answer `ended` first, then send `SIGTERM` to the server's own PID. The server then stops as on any `SIGTERM` (Server spec). | REQ-23 | INT-1 |
| INT-5 | create | backend, processes area | Route `POST /api/processes/terminate`, body with PID and start time: INT-1, then INT-4, INT-3 or INT-2. Answers the outcome. A bad body answers `400`. | REQ-23, REQ-30, REQ-31, REQ-32, REQ-34 | INT-2, INT-3, INT-4 |
| INT-6 | modify | `src/server/main.ts` | Register the route of INT-5 with the SessionRegistry and the server's own PID. | REQ-23 | INT-5 |
| INT-7 | create | frontend, settings area | Page call of the route: gives the outcome, or `failed` on a network error, another status or a body of the wrong shape. | REQ-31, REQ-32, REQ-34 | INT-5 |
| INT-8 | create | frontend, settings area | Terminate confirmation: a WarningDialog in the `error` tone over the popup, "Cancel" focused, primary "Terminate". Title and text from "Texts", by kind. | REQ-24, REQ-25, REQ-26, REQ-27, REQ-33 | — |
| INT-9 | modify | Processes section of batch processes-list (path in `.sdd/modules/app/index.md`) | Each row gets a "Terminate" button that opens INT-8. On confirm: the button is busy, INT-7 runs, then the list reloads. "Cancel" or Esc changes nothing. | REQ-23, REQ-31, REQ-33, REQ-34 | INT-7, INT-8 |
| INT-10 | modify | Processes section of batch processes-list | An outcome `running`, `not_allowed` or `failed` keeps its error under the row after the reload, by PID and start time. `ended` and `gone` leave no message. | REQ-31, REQ-32 | INT-9 |
| INT-11 | modify | `src/web/styles.css` | Style of the row's "Terminate" button (`.button-danger` look, compact) and of the row error, with theme tokens only. | REQ-23, REQ-33 | INT-9 |
| INT-12 | modify | `src/desktop/desktop-bridge.cts` | Add a "quit the app" request of the page to `window.desktopBridge`, next to the window requests. | REQ-26 | — |
| INT-13 | modify | `src/desktop/window-actions.ts` | On the quit request of its own page, run the quit flow that DesktopApp gives it. Requests of other senders are ignored, as for the window requests. | REQ-26 | INT-12 |
| INT-14 | modify | `src/desktop/main.ts` | Give WindowActions the quit flow of the tray "Quit", without the QuitCheck question. It stops a backend the app started, as today, and quits also when the backend was reused. | REQ-26 | INT-13 |
| INT-15 | modify | `src/web/desktop-bridge.ts` | useDesktopBridge gives a quit request that calls the bridge in the desktop window, and does nothing in a browser. | REQ-26 | INT-12 |
| INT-16 | modify | Processes section of batch processes-list | After the outcome `ended` for the current instance's row, send the quit request of INT-15. | REQ-26 | INT-9, INT-15 |

## Notes for the implementer

- One level only: `SIGTERM`, never `SIGKILL`, and no "force". The one exception is INT-3: a hosted session follows `Session.stop()` (`SIGTERM`, then `SIGKILL` after 5 s), exactly like the stop from the session list.
- Never `kill(-pid)`, never `pkill` or `killall`. Only the confirmed PID gets a signal (knowledge base `no-kill-by-pattern`).
- Terminating an app server ends its sessions because the server stops them itself on `SIGTERM`. The route sends them no signal (REQ-29).
- A test server gets the same confirmation text as another app server: it can host sessions too.
- The current instance's row reads `ended` in the page. In the browser the next reload fails, and the menu shows the load failure of batch processes-list. In the desktop app the app quits (INT-12 to INT-16).
- The desktop quit asks no second question: the user has already confirmed. Test it with unit tests of WindowActions and of the desktop quit flow, not with an Electron spec.
- Tests → never terminate the current instance or a process on port 4001 in e2e: the e2e server is the current instance. Test INT-4 in a unit test with an injected signal call. In e2e the "This instance" confirmation is opened and then cancelled. A process to terminate is started by the test itself, with its PID recorded.
- REQ-30 → test it in a unit test: same PID, other start time, gives `gone` and no signal.
- No test needs the desktop window. An Electron spec, if any, goes in the Electron group (knowledge base `electron-e2e-separate`).

## Texts

| Where | Text |
|-------|------|
| Row action | "Terminate" |
| Title | "Terminate the Process?" |
| Name of the process | "**<kind> · PID <pid>**", then " · port <port>" or " · <session label>" when known |
| Current instance | "This is the instance you are using. Terminating it closes the app and ends every session it hosts." |
| Another app server or a test server | "The sessions it hosts end too." |
| Primary action | "Terminate" |
| Not ended | "The process did not end." |
| No rights | "You are not allowed to end this process." |
| Failure | "Could not terminate the process." |

## Human acceptance

### Scenario: The confirmation names the process

- REQ → REQ-23, REQ-24, REQ-25, REQ-27, REQ-33, REQ-34
- Given → in the browser or the desktop app, the "Processes" menu lists another app server on port 3200
- When → the user moves to its "Terminate" with Tab and presses Enter
- Then → a rose confirmation names "App server", its PID and "port 3200", says its sessions end too, and "Cancel" has the focus

### Scenario: Only the confirmed process ends

- REQ → REQ-29, REQ-31
- Given → the list shows a hanging "Fake Claude" among other rows, and the confirmation for it is open
- When → the user chooses "Terminate"
- Then → the list reloads without that row
- And → every other row is still listed

### Scenario: A hosted session ends as from the session list

- REQ → REQ-28
- Given → the confirmation for a "Claude session" marked "Hosted here" is open
- When → the user chooses "Terminate"
- Then → the row leaves the list, and the session list shows the session as ended, as after its own "Terminate"

### Scenario: The current instance warns before closing the app

- REQ → REQ-26
- Given → the "Processes" menu is open
- When → the user chooses "Terminate" on the row marked "This instance"
- Then → the confirmation says that terminating closes the app and ends every session it hosts
- And → optional desktop check: in the desktop app, choosing "Terminate" in that confirmation closes the desktop app

### Scenario: The process does not end

- REQ → REQ-32
- Given → a listed process ignores `SIGTERM`, and its confirmation is open
- When → the user chooses "Terminate"
- Then → after a few seconds the row is still there with "The process did not end."

### Scenario: A reused PID is safe

- REQ → REQ-30
- Given → the confirmation for a process is open, and that process ended and a new process got its PID
- When → the user chooses "Terminate"
- Then → the old row leaves the list, and the new process keeps running
