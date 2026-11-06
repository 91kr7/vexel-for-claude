---
module: desktop
component: DesktopBridge
type: Electron preload
---

# DesktopBridge

**Purpose** → the preload of the window. The page reports its open session through it, and receives "open this session".

## Contract

- exposes `window.desktopBridge` to the page in the window, with two functions and nothing else:
  - `reportOpenSession(sessionId)` → `sessionId` is a string, or `null` for no open session. It sends the value to DesktopApp on the IPC channel `desktop-bridge:open-session-changed`. Any other value is ignored.
  - `onOpenSession(listener) → unsubscribe` → `listener(sessionId)` for each string that DesktopApp sends on the IPC channel `desktop-bridge:open-session`, until `unsubscribe()`.

## Rules and invariants

- It runs sandboxed, with context isolation. The page gets only these two functions, with no Node and no Electron access.
- Electron runs a sandboxed preload as a script, so it is emitted as CommonJS.

## Requirements served

- `plan-session_notifications/REQ-12`, `plan-session_notifications/REQ-13`
