---
module: desktop
component: DesktopApp
type: Electron main process
---

# DesktopApp

**Purpose** → the desktop application: one window that shows the client page served by the backend.

## Contract

- launch → it shows the TrayIcon and opens one window "Vexel for Claude", 1280 × 800, on the StartupPage in the loading state. The window has the AppIcon and a hidden menu bar (Alt shows it).
- then it runs `launchBackend` with the repository folder and the log file `backend.log` in the Electron logs folder.
  - ready → the window loads `<origin>/`, the client page of the backend.
  - failed → the window shows the StartupPage in the error state, with the output lines.
- a second launch while the app runs → the running app restores, shows and focuses its window, also when the window is hidden. The second launch exits and opens no window.
- closing the window → the window hides and the app keeps running, with the backend and its sessions. The page stays loaded.
- "Open Window" in the TrayIcon → the same as a second launch: the window restores, shows and focuses.
- quit request ("Quit" in the TrayIcon, or any other quit of the app):
  - it runs `confirmQuit` (QuitCheck) with the ready backend, and the native message box as `ask`.
  - `false` → the app keeps running, nothing changes.
  - `true` → `stopStartedBackend` (BackendLauncher), then the window and the TrayIcon close and the app exits.
  - a quit request while one is already running is ignored.
- quit during the backend start → no confirmation; the server that the launcher is starting is stopped.

## Rules and invariants

- One running app per user session.
- The page in the window has no Node access (Electron defaults: context isolation, sandbox).
- The backend runs outside Electron, with the system Node. node-pty therefore keeps its Node build.
- A backend that the app did not start keeps running after the app quits, with its sessions.
- The app quits only from a quit request, never because its window closes.

## Dependencies

- BackendLauncher, StartupPage, AppIcon, TrayIcon, QuitCheck

## Requirements served

- `plan-desktop_app/REQ-1`, `plan-desktop_app/REQ-3`, `plan-desktop_app/REQ-4`, `plan-desktop_app/REQ-6`, `plan-desktop_app/REQ-7`, `plan-desktop_app/REQ-9`, `plan-desktop_app/REQ-11`, `plan-desktop_app/REQ-12`, `plan-desktop_app/REQ-13`, `plan-desktop_app/REQ-14`, `plan-desktop_app/REQ-15`, `plan-desktop_app/REQ-16`, `plan-desktop_app/REQ-17`
