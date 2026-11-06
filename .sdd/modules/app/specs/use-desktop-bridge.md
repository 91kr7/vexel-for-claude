---
module: app
component: useDesktopBridge
type: frontend hook
---

# useDesktopBridge

**Purpose** → the page side of the DesktopBridge: it reports the open session and passes on the "open this session" requests. In a browser it does nothing.

## Contract

- `DesktopBridge` → `{ reportOpenSession(sessionId | null), onOpenSession(listener) → unsubscribe }`, read from `window.desktopBridge`.
- `useDesktopBridge(openSessionId, onOpenSession)`:
  - the bridge exists → `reportOpenSession(openSessionId)` at mount and after each change of `openSessionId`.
  - the bridge exists → each "open this session" request calls `onOpenSession(sessionId)` while the component is mounted. It calls the latest `onOpenSession` given.
  - no bridge (a browser) → nothing.

## Dependencies

- DesktopBridge (module desktop), as `window.desktopBridge`

## Requirements served

- `plan-session_notifications/REQ-12`, `plan-session_notifications/REQ-13`
