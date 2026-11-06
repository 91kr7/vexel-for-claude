---
module: desktop
component: TrayIcon
type: UI component
---

# TrayIcon

**Purpose** → the icon of the desktop app in the system tray, with the menu that reopens the window or quits.

## Contract

Description:
- an icon in the system tray, created by DesktopApp at launch. It shows the AppIcon (PNG).

Shows:
- the tooltip "Vexel for Claude".
- a menu with two items, in this order: "Open Window", "Quit".

Actions:
- "Open Window" → runs the `openWindow` action that DesktopApp gives.
- "Quit" → runs the `quit` action that DesktopApp gives.

Exports:
- `TRAY_TOOLTIP` → `"Vexel for Claude"`.
- `trayMenuTemplate({ openWindow, quit })` → the two menu items above, each with its label and its action.

## Rules and invariants

- The icon stays from the launch until the app quits, also while the window is hidden.
- The labels are in English, like the rest of the GUI.

## Dependencies

- AppIcon

## Requirements served

- `plan-desktop_app/REQ-12`, `plan-desktop_app/REQ-13`, `plan-desktop_app/REQ-14`
