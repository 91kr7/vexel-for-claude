---
module: desktop
component: DesktopApp
type: Electron main process
---

# DesktopApp

**Purpose** → the desktop application: one window that shows the client page served by the backend.

## Contract

- launch → it opens one window "Vexel for Claude", 1280 × 800, on the StartupPage in the loading state. The window has the AppIcon and a hidden menu bar (Alt shows it).
- then it runs `launchBackend` with the repository folder and the log file `backend.log` in the Electron logs folder.
  - ready → the window loads `<origin>/`, the client page of the backend.
  - failed → the window shows the StartupPage in the error state, with the output lines.
- a second launch while the app runs → the running app restores, shows and focuses its window. The second launch exits and opens no window.
- closing the window → the app quits. A backend that the launcher started keeps running.

## Rules and invariants

- One running app per user session.
- The page in the window has no Node access (Electron defaults: context isolation, sandbox).
- The backend runs outside Electron, with the system Node. node-pty therefore keeps its Node build.

## Dependencies

- BackendLauncher, StartupPage, AppIcon

## Requirements served

- `plan-desktop_app/REQ-1`, `plan-desktop_app/REQ-3`, `plan-desktop_app/REQ-4`, `plan-desktop_app/REQ-6`, `plan-desktop_app/REQ-7`, `plan-desktop_app/REQ-9`
