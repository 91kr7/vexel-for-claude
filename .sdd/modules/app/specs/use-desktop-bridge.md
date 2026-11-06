---
module: app
component: useDesktopBridge
type: frontend hook
---

# useDesktopBridge

**Purpose** → the page side of the DesktopBridge: it reports the open session, passes on the "open this session" requests, gives the path lookup of dropped files, and keeps a dropped file from replacing the page. In a browser it does nothing.

## Contract

- `DesktopBridge` → `{ reportOpenSession(sessionId | null), onOpenSession(listener) → unsubscribe, getPathForFile(file) → string }`, read from `window.desktopBridge`.
- `desktopFilePathLookup() → ((file) → string) | null`:
  - the bridge exists → a function that gives `getPathForFile(file)` of the bridge (an empty string means no path).
  - no bridge (a browser) → `null`.
- `useDesktopBridge(openSessionId, onOpenSession)`:
  - the bridge exists → `reportOpenSession(openSessionId)` at mount and after each change of `openSessionId`.
  - the bridge exists → each "open this session" request calls `onOpenSession(sessionId)` while the component is mounted. It calls the latest `onOpenSession` given.
  - the bridge exists → while the component is mounted, the page prevents the default action of every `dragover` and `drop` on the window. A file dropped anywhere in the page does not open and does not replace the page. A component that takes the drop (SessionView) handles it on its own element.
  - no bridge (a browser) → nothing: no report, no listener, no drop guard.

## Dependencies

- DesktopBridge (module desktop), as `window.desktopBridge`

## Requirements served

- `plan-session_notifications/REQ-12`, `plan-session_notifications/REQ-13`
- `plan-terminal_addons/REQ-46`, `plan-terminal_addons/REQ-53`
