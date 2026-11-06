---
request_slug: claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order-desktop_app
date: 2026-11-06
type: evolution
size: ordinary
reference: .sdd/analysis/claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order.md
---

# Analysis — Desktop app that also runs the backend

## Request

> voglio poter eseguire questa app dentro ad elytron o come si chiama.... in modo da non doverla aprire dal browser. si puo' fare in mod oche elytron esegua anche il backend?

## Reference

[claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order.md](claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order.md) → fixed order of sessions in the session list, the latest step of the client. Today the user starts the backend separately and opens the client page in a browser. Sessions keep running when the page closes, and they end when the backend stops ([claude_sessions_client.md](claude_sessions_client.md), lines 62 and 80).

Changes:
- The client also runs as a desktop application, in its own window.
- The desktop app starts the backend, so the user does not start it separately.
- Closing the window does not stop the backend. A system tray icon keeps the app reachable, and the user quits from there.
- Every other requirement of the reference stays true, including the features and the look of the page.

## Summary

Run the client as a desktop application that also starts the backend, so the user does not need a browser. Closing the window leaves the sessions running, and a tray icon reopens the window or quits the app.

## Human decisions

- 2026-11-06 → Closing the window leaves the backend and the sessions running in the background, with an icon in the system tray. Reopening the app shows the same sessions. The user quits for real from the tray icon.

## Requirements

### Functional

Launch
- The user must be able to open the client in a desktop application window, without a browser.
- The desktop app must be available in the application menu of the Linux desktop, like other installed apps.
- The window must show the same page, with the same features, as the browser client.
- Launching the desktop app must start the backend when the backend is not running.
- When a backend already runs on the machine, the desktop app must use it and not start a second one.
- Launching the desktop app while it already runs must show the existing window, not open a second app.
- When the backend cannot start, the window must show an error message that says so, not an empty page.

Window and tray
- Closing the window must leave the backend and every session running.
- While the desktop app runs, an icon must stay in the system tray, also when the window is closed.
- The tray icon must offer an action that reopens the window with the current sessions.
- The tray icon must offer an action that quits the desktop app.
- Quitting must stop the backend and end its sessions, when the desktop app started that backend.
- Quitting must ask for confirmation when at least one session is working or needs input.

### Non-functional

- The backend started by the desktop app must keep the current access limit: reachable from the local machine only.
- The window must show the session list within about 5 seconds of the launch, backend start included.

## Assumptions

- This is an evolution, not a fix. A desktop window was never specified, so it is new behaviour. The orchestrator decided this.
- The client stays reachable from the browser while the desktop app runs, on the local machine only, as today. The request asks not to need the browser, not to remove it. The orchestrator decided this.
- The request names Electron. The technology of the desktop app is left to the architecture phase.
- When the desktop app uses a backend it did not start, quitting closes the app and leaves that backend running. The app does not stop what the user started elsewhere.
- The confirmation before quitting follows the existing rule for stopping a working session ([claude_sessions_client.md](claude_sessions_client.md), line 60).
- The app runs only on the user's Linux machine, the environment of the base analysis. The user installs it once, by hand.

## Risks

- Some Linux desktops hide tray icons by default. With the window closed, the user can then reopen it only by launching the app again, and cannot quit from the tray.
- With the window closed, the user can forget that sessions still run. They keep using memory and plan quota.
- Two backends on the same machine would show and drive the same sessions twice. The requirement to reuse a running backend prevents this.

## Scope

In scope:
- A desktop window for the existing client, and its entry in the application menu.
- Start of the backend by the desktop app, and reuse of a backend that already runs.
- The tray icon with reopen and quit.
- One running instance of the desktop app at a time.

Out of scope:
- Starting the app or the backend automatically at login.
- Operating system notifications, or a needs-input count on the tray icon.
- Operating systems other than Linux.
- Distribution to other users, installers for an app store, and automatic updates.
- Any change to the features or the look of the page.
- Removing browser access.
- Remote access from other machines.
