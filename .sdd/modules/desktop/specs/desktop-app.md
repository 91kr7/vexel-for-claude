---
module: desktop
component: DesktopApp
type: Electron main process
---

# DesktopApp

**Purpose** → the desktop application: one window that shows the client page served by the backend.

## Contract

- launch → it shows the TrayIcon with no session that needs input, and opens one window "Vexel for Claude", 1280 × 800, on the StartupPage in the loading state. The window opens not maximized, also when the desktop maximizes new frameless windows by itself (GNOME `auto-maximize`): the app undoes a maximize it did not ask for in the first 2 s after it creates the window, then keeps 1280 × 800, centred, against the size the desktop restores in the next second. The window has no native frame, so the desktop draws no title bar. It has the AppIcon and the DesktopBridge preload. It shows no menu bar, also on Alt: the application menu stays and its keys keep working.
- the application menu → the Electron default menu without "Actual Size", "Zoom In" and "Zoom Out". So Ctrl+=, Ctrl++, Ctrl+- and Ctrl+0 never zoom the page and reach the page as plain keys. The other menu items and their keys stay as they are.
- then it runs `launchBackend` with the repository folder and the log file `backend.log` in the Electron logs folder.
  - ready → it starts the AttentionClient on the backend origin, then the window loads `<origin>/`, the client page of the backend.
  - failed → the window shows the StartupPage in the error state, with the output lines.
- the page asks to open a new window (`window.open`, a link with a target):
  - an `http` or `https` address → it opens in the system default browser.
  - any other address → nothing opens.
  - in both cases no Electron window opens and the client window stays on its page.
- a second launch while the app runs → the running app restores, shows and focuses its window, also when the window is hidden. The second launch exits and opens no window.
- closing the window (the desktop's close shortcut and the red window button included) → the window hides and the app keeps running, with the backend and its sessions. The page stays loaded.
- "Open Window" in the TrayIcon → the same as a second launch: the window restores, shows and focuses.
- quit request ("Quit" in the TrayIcon, or any other quit of the app):
  - it runs `confirmQuit` (QuitCheck) with the ready backend, and the native message box as `ask`.
  - `false` → the app keeps running, nothing changes.
  - `true` → `stopStartedBackend` (BackendLauncher), then the window and the TrayIcon close and the app exits.
  - a quit request while one is already running is ignored.
- quit during the backend start → no confirmation; the server that the launcher is starting is stopped.

Window buttons:

- after it creates the window, it connects the WindowActions to it, with `ipcMain`. The page closes, minimizes, and maximizes or restores the window through them.

Notifications:

- one NotificationRules and one SystemNotifications (app name "Vexel for Claude", icon the AppIcon PNG).
- to the rules go: the events and the lists of the AttentionClient, each change of the window focus, and each open session that the page reports through the DesktopBridge.
- the window has the focus → it is focused, visible and not minimized. The focus is read again on `focus`, `blur`, `hide` and `minimize` of the window.
- the commands of the rules go to SystemNotifications, with their `replaces`:
  - `show` → the session, the kind and the NotificationTexts of the event.
  - `show-group` → the session, the kind and the grouped NotificationTexts of the events.
  - `close` → the session.
- a notification that the desktop closes by itself → the rules get `notificationClosed` with its session.
- a click on a notification → the same as "Open Window", then it sends the session id to the page on `desktop-bridge:open-session`.

Tray:

- each list of the AttentionClient → the TrayIcon gets the icon, the tooltip and the menu of that list. This happens whatever the window focus.
- a session entry of the tray menu → the same as a click on a notification of that session.

## Rules and invariants

- One running app per user session.
- The page in the window has no Node access (Electron defaults: context isolation, sandbox). It gets only the DesktopBridge.
- An open-session report from another web contents than the window's is ignored.
- The backend runs outside Electron, with the system Node. node-pty therefore keeps its Node build.
- A backend that the app did not start keeps running after the app quits, with its sessions.
- The app quits only from a quit request, never because its window closes.
- Without the native frame, the window keeps: the resize from every edge and corner, its name "Vexel for Claude" in the task switcher and the dock, and the desktop's window shortcuts. The page moves it through its drag areas (TopBar, StartupPage).

## Dependencies

- BackendLauncher, StartupPage, AppIcon, TrayIcon, QuitCheck
- DesktopBridge, WindowActions, AttentionClient, NotificationRules, NotificationTexts, SystemNotifications, AttentionIcon

## Requirements served

- `plan-desktop_app/REQ-1`, `plan-desktop_app/REQ-3`, `plan-desktop_app/REQ-4`, `plan-desktop_app/REQ-6`, `plan-desktop_app/REQ-7`, `plan-desktop_app/REQ-9`, `plan-desktop_app/REQ-11`, `plan-desktop_app/REQ-12`, `plan-desktop_app/REQ-13`, `plan-desktop_app/REQ-14`, `plan-desktop_app/REQ-15`, `plan-desktop_app/REQ-16`, `plan-desktop_app/REQ-17`
- `plan-session_notifications/REQ-1`, `plan-session_notifications/REQ-3`, `plan-session_notifications/REQ-4`, `plan-session_notifications/REQ-12`, `plan-session_notifications/REQ-13`, `plan-session_notifications/REQ-25`, `plan-session_notifications/REQ-28`
- `plan-session_notifications/REQ-30`, `plan-session_notifications/REQ-32`, `plan-session_notifications/REQ-33`, `plan-session_notifications/REQ-34`, `plan-session_notifications/REQ-36`
- `plan-mac_title_bar/REQ-1`, `plan-mac_title_bar/REQ-2`, `plan-mac_title_bar/REQ-3`, `plan-mac_title_bar/REQ-4`, `plan-mac_title_bar/REQ-5`, `plan-mac_title_bar/REQ-16`, `plan-mac_title_bar/REQ-17`, `plan-mac_title_bar/REQ-18`, `plan-mac_title_bar/REQ-21`
- `plan-terminal_addons/REQ-9`, `plan-terminal_addons/REQ-11`, `plan-terminal_addons/REQ-12`, `plan-terminal_addons/REQ-39`
