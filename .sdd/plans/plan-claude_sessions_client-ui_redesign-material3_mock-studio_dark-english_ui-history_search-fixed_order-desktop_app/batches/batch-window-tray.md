---
batch: window-tray
feature: Window and tray
closed_req: REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17
depends: desktop-window
---

# Batch — Window and tray

Closing the window no longer quits the desktop app. A tray icon reopens the window or quits. Quitting stops the backend only when the desktop app started it, and it asks first when a session is busy.

## What this batch builds

- **Tray icon** (desktop area) → the icon in the system tray, with the actions "Open Window" and "Quit".
- **Quit check** (desktop area) → decides if quitting needs a confirmation, from the sessions of the backend.

## Decisions

- **Modify targets in the desktop area.** The Desktop app and the Backend launcher are created by `desktop-window`. Their paths are in the indexes (`.sdd/modules/`) after that batch. The `Where` column names them by component.
- **Tray labels.** "Open Window" and "Quit". English, like the rest of the GUI.
- **Busy sessions.** The quit check reads `GET /api/sessions`. It counts the hosted sessions, not the external ones, whose state is working or needs input. External sessions run in other terminals, so stopping the backend does not end them.
- **Confirmation.** A native Electron dialog, because the window can be closed when the user quits. Title "Quit Vexel for Claude?". Text "N sessions are working or need input. Quitting ends them." ("1 session is…" for one). Buttons "Cancel" (the default) and "Quit". It follows the rule of StopSessionButton for a working session.
- **No confirmation** when the desktop app did not start the backend (REQ-16, REQ-17), or when `GET /api/sessions` does not answer.
- **Stopping the backend.** The desktop app sends `SIGTERM` to the backend it started and waits for it to exit before it quits. The server then stops every hosted session (INT-5). This also changes `npm start` stopped with Ctrl+C: its sessions now end in an orderly way, as `plan-claude_sessions_client` already expects.
- **Close replaces the temporary behaviour** of `desktop-window`: the window hides, and the app quits only from the tray.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | desktop area | Tray icon with the app icon of `desktop-window`, present from launch until quit. Menu with "Open Window" and "Quit". | REQ-12, REQ-13, REQ-14 | — |
| INT-2 | modify | Desktop app (desktop area, from `desktop-window`) | Closing the window hides it, and the app keeps running. "Open Window" and a second launch show and focus it again. The page stays loaded, so it shows the current sessions. | REQ-6, REQ-11, REQ-13 | INT-1 |
| INT-3 | create | desktop area | Quit check: when the app started the backend, count the busy hosted sessions from `GET /api/sessions`. If the count is above zero, show the confirmation and return the user's choice. | REQ-17 | — |
| INT-4 | modify | Desktop app and Backend launcher (desktop area, from `desktop-window`) | "Quit" runs the quit check. If the user confirms, or nothing needs confirmation, stop the backend the app started and wait for its exit, then quit. A backend the app did not start keeps running. | REQ-14, REQ-15, REQ-16, REQ-17 | INT-1, INT-3 |
| INT-5 | modify | `src/server/main.ts` | On `SIGTERM` and `SIGINT`, call `stop()` on every running session of the SessionRegistry. Wait for their exit, then close the server and exit. | REQ-15 | — |

The developer updates the spec of Server and the specs of the Desktop app and the Backend launcher. They write the specs of the two new components, and update the indexes.

## Human acceptance

### Scenario: Sessions keep running with the window closed

- REQ → REQ-11, REQ-12, REQ-13
- Given → the desktop app started the backend, and a session is working
- When → the user closes the window
- Then → the tray icon stays, and the session keeps working in the browser client
- And → "Open Window" in the tray shows the window with that session still there

### Scenario: Quitting asks first and stops the backend

- REQ → REQ-14, REQ-15, REQ-17
- Given → the desktop app started the backend, and a session is working
- When → the user chooses "Quit" in the tray
- Then → the app asks "Quit Vexel for Claude?"
- And → after "Quit" in that dialog, the window and the tray icon disappear, and `http://127.0.0.1:3000` no longer answers

### Scenario: Quitting leaves a backend the user started elsewhere

- REQ → REQ-16, REQ-17
- Given → the user started the backend with `npm start`, then opened "Vexel for Claude", and a session is working
- When → the user chooses "Quit" in the tray
- Then → the app closes without a confirmation
- And → the browser client still shows the session working

### Scenario: A second launch brings back the closed window

- REQ → REQ-6, REQ-13
- Given → the desktop app runs with its window closed
- When → the user opens "Vexel for Claude" from the menu
- Then → the window shows again with the current sessions, and no second app starts
