---
module: desktop
component: TrayIcon
type: UI component
---

# TrayIcon

**Purpose** → the icon of the desktop app in the system tray. It signals the sessions that need input, and its menu opens one of them, reopens the window or quits.

## Contract

Description:
- an icon in the system tray, created by DesktopApp at launch. DesktopApp gives it the needs-input list of the AttentionClient.

Shows:
- the icon → the AppIcon (PNG) when no session needs input; the AttentionIcon (PNG) while at least one does.
- the tooltip → by the number N of sessions that need input:
  - 0 → `"Vexel for Claude"`.
  - 1 → `"Vexel for Claude · 1 session needs input"`.
  - N > 1 → `"Vexel for Claude · N sessions need input"`.
- the menu → one entry per session that needs input, then a separator, then "Open Window" and "Quit". With no such session: only "Open Window" and "Quit", with no separator.
- a session entry → `"<folder name> · <label>"`, by the rule of `notificationTitle` (NotificationTexts). An `&` is doubled, so the menu shows it and does not read it as an access key.
- the order of the session entries:

```
entries with a valid waitingSince → earliest first (the longest waiting first)
then the entries with no waitingSince, or one that is not a valid time
equal times, and the entries of the second group → the order of the list
```

Actions:
- a session entry → runs the `openSession` action with the session id.
- "Open Window" → runs the `openWindow` action that DesktopApp gives.
- "Quit" → runs the `quit` action that DesktopApp gives.

Exports:
- `TRAY_TOOLTIP` → `"Vexel for Claude"`.
- `trayTooltip(waitingCount)` → the tooltip above.
- `trayIconFile(waitingCount)` → `"vexel-for-claude.png"` at 0, else `"vexel-for-claude-attention.png"`. Both files are in the icons folder of the desktop app.
- `trayMenuTemplate({ openWindow, quit, openSession? }, sessions = [])` → the menu items above, each with its label and its action. `sessions` is a list of AttentionSession (AttentionClient).

## Rules and invariants

- The icon stays from the launch until the app quits, also while the window is hidden.
- "Open Window" and "Quit" keep their labels and actions, and they are always the last two items.
- The labels are in English, like the rest of the GUI.

## Dependencies

- AppIcon, AttentionIcon, NotificationTexts, AttentionClient

## Requirements served

- `plan-desktop_app/REQ-12`, `plan-desktop_app/REQ-13`, `plan-desktop_app/REQ-14`
- `plan-session_notifications/REQ-30`, `plan-session_notifications/REQ-32`, `plan-session_notifications/REQ-33`, `plan-session_notifications/REQ-34`, `plan-session_notifications/REQ-35`, `plan-session_notifications/REQ-37`
