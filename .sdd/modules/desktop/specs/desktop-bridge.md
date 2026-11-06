---
module: desktop
component: DesktopBridge
type: Electron preload
---

# DesktopBridge

**Purpose** → the preload of the window. The page reports its open session through it, receives "open this session", reads the absolute path of a dropped file, and drives the window buttons.

## Contract

- exposes `window.desktopBridge` to every page in the window (the StartupPage included), with these functions and nothing else:
  - `reportOpenSession(sessionId)` → `sessionId` is a string, or `null` for no open session. It sends the value to DesktopApp on the IPC channel `desktop-bridge:open-session-changed`. Any other value is ignored.
  - `onOpenSession(listener) → unsubscribe` → `listener(sessionId)` for each string that DesktopApp sends on the IPC channel `desktop-bridge:open-session`, until `unsubscribe()`.
  - `getPathForFile(file) → string` → the absolute path on disk of a dropped `File`, a file or a folder from the file manager, through Electron `webUtils`. An empty string means no path: a `File` that does not come from the disk (e.g. made by the page), or a value that is not a `File`. It never throws.
  - `closeWindow()` → sends `desktop-bridge:window-close`.
  - `minimizeWindow()` → sends `desktop-bridge:window-minimize`.
  - `toggleMaximizeWindow()` → sends `desktop-bridge:window-toggle-maximize`.
  - `isWindowMaximized() → Promise<boolean>` → asks `desktop-bridge:window-is-maximized`. Any answer other than `true` gives `false`.
  - `onWindowMaximizedChange(listener) → unsubscribe` → `listener(maximized)` for each boolean that DesktopApp sends on `desktop-bridge:window-maximized`, until `unsubscribe()`.

## Rules and invariants

- It runs sandboxed, with context isolation. The page gets only these functions, with no Node and no Electron access.
- Electron runs a sandboxed preload as a script, so it is emitted as CommonJS.

## Requirements served

- `plan-session_notifications/REQ-12`, `plan-session_notifications/REQ-13`
- `plan-mac_title_bar/REQ-16`, `plan-mac_title_bar/REQ-17`, `plan-mac_title_bar/REQ-18`, `plan-mac_title_bar/REQ-21`, `plan-mac_title_bar/REQ-23`
- `plan-terminal_addons/REQ-46`
