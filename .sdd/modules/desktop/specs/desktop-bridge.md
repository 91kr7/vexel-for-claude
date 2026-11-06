---
module: desktop
component: DesktopBridge
type: Electron preload
---

# DesktopBridge

**Purpose** → the preload of the window. The page reports its open session through it, receives "open this session", and reads the absolute path of a dropped file.

## Contract

- exposes `window.desktopBridge` to the page in the window, with three functions and nothing else:
  - `reportOpenSession(sessionId)` → `sessionId` is a string, or `null` for no open session. It sends the value to DesktopApp on the IPC channel `desktop-bridge:open-session-changed`. Any other value is ignored.
  - `onOpenSession(listener) → unsubscribe` → `listener(sessionId)` for each string that DesktopApp sends on the IPC channel `desktop-bridge:open-session`, until `unsubscribe()`.
  - `getPathForFile(file) → string` → the absolute path on disk of a dropped `File`, a file or a folder from the file manager, through Electron `webUtils`. An empty string means no path: a `File` that does not come from the disk (e.g. made by the page), or a value that is not a `File`. It never throws.

## Rules and invariants

- It runs sandboxed, with context isolation. The page gets only these three functions, with no Node and no Electron access.
- Electron runs a sandboxed preload as a script, so it is emitted as CommonJS.

## Requirements served

- `plan-session_notifications/REQ-12`, `plan-session_notifications/REQ-13`
- `plan-terminal_addons/REQ-46`
