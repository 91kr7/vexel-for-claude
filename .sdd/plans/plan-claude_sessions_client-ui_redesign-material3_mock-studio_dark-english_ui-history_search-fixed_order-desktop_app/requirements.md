---
slug: claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order-desktop_app
date: 2026-11-06
spec: .sdd/analysis/claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order-desktop_app.md
status: validated
---

# Requirements — Desktop app that also runs the backend

"The desktop app" is the new desktop application. "The window" is its window. "The browser client" is the client page opened in a browser, as today.

## Feature: Desktop window

| ID | Requirement |
|----|-------------|
| REQ-1 | The user can open the client in a desktop application window, without a browser. |
| REQ-2 | The desktop app appears in the application menu of the Linux desktop, like other installed apps. |
| REQ-3 | The window shows the same page, with the same features, as the browser client. |
| REQ-4 | Launching the desktop app starts the backend when no backend is running. |
| REQ-5 | When a backend already runs on the machine, the desktop app uses it and does not start a second one. |
| REQ-6 | Launching the desktop app while it already runs shows the existing window and does not open a second app. |
| REQ-7 | When the backend cannot start, the window shows an error message that says so, not an empty page. |
| REQ-8 | The backend started by the desktop app is reachable from the local machine only. |
| REQ-9 | The window shows the session list within about 5 seconds of the launch, backend start included. |
| REQ-10 | While the desktop app runs, the browser client stays reachable from the local machine. |

## Feature: Window and tray

| ID | Requirement |
|----|-------------|
| REQ-11 | Closing the window leaves the backend and every session running. |
| REQ-12 | While the desktop app runs, an icon stays in the system tray, also when the window is closed. |
| REQ-13 | The tray icon offers an action that reopens the window with the current sessions. |
| REQ-14 | The tray icon offers an action that quits the desktop app. |
| REQ-15 | Quitting stops the backend and ends its sessions, when the desktop app started that backend. |
| REQ-16 | Quitting leaves the backend and its sessions running, when the desktop app did not start that backend. |
| REQ-17 | Quitting asks for confirmation when it stops the backend and at least one session is working or needs input. |

## Assumptions

These are not human decisions. The gatekeeper confirmed "REQ-17", "REQ-9" and "Close before the tray exists" on 2026-11-06.

- **REQ-9.** The tests check "within 5 seconds".
- **REQ-10.** It comes from the spec's assumption: the request asks not to need the browser, not to remove it.
- **REQ-16.** It comes from the spec's assumption: the desktop app does not stop what the user started elsewhere.
- **REQ-17.** The spec asks for the confirmation on every quit. It also says that the confirmation follows the rule for stopping a working session. When the desktop app did not start the backend, quitting ends no session (REQ-16), so there is nothing to confirm. REQ-17 therefore asks for it only when the quit stops the backend.
- **REQ-6 with the window closed.** A second launch also shows the window when the window is closed and only the tray icon is left. The spec's risks rely on this when the tray is hidden.
- **Close before the tray exists.** The "Desktop window" feature comes first. Until "Window and tray" is done, closing the window quits the desktop app and leaves the backend running. No session is lost, and "Window and tray" replaces this behaviour before the merge.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Linux only, on the user's machine. The user installs the desktop app once, by hand.
- No change to the features or the look of the page.
- Out of scope: start at login, operating system notifications, a needs-input count on the tray icon, other operating systems, distribution to other users, installers for an app store, automatic updates, removing browser access, remote access.
- Every requirement of `plan-claude_sessions_client` and of the later plans of this client stays true, up to `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order`.
