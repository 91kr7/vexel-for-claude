---
module: app
component: useDesktopBridge
type: frontend hook
---

# useDesktopBridge

**Purpose** → the page side of the DesktopBridge: it reports the open session, passes on the "open this session" requests, gives the path lookup of dropped files, keeps a dropped file from replacing the page, and drives the window. In a browser it does nothing.

## Contract

- `DesktopBridge` → `{ reportOpenSession(sessionId | null), onOpenSession(listener) → unsubscribe, getPathForFile(file) → string }`, read from `window.desktopBridge`. The window functions of the DesktopBridge are optional members.
- `desktopFilePathLookup() → ((file) → string) | null`:
  - the bridge exists → a function that gives `getPathForFile(file)` of the bridge (an empty string means no path).
  - no bridge (a browser) → `null`.
- `useDesktopBridge(openSessionId, onOpenSession)`:
  - the bridge exists → `reportOpenSession(openSessionId)` at mount and after each change of `openSessionId`.
  - the bridge exists → each "open this session" request calls `onOpenSession(sessionId)` while the component is mounted. It calls the latest `onOpenSession` given.
  - the bridge exists → while the component is mounted, the page prevents the default action of every `dragover` and `drop` on the window. A file dropped anywhere in the page does not open and does not replace the page. A component that takes the drop (SessionView) handles it on its own element.
  - no bridge (a browser) → nothing: no report, no listener, no drop guard.
- `closeWindow()`, `minimizeWindow()`, `toggleMaximizeWindow()` → call the bridge function of the same name.
- `useWindowMaximized() → boolean` → `false` at first. At mount it asks `isWindowMaximized()` and then follows each `onWindowMaximizedChange`. A change that arrives before the answer wins over it. It stops listening on unmount.
- no bridge, or a bridge without the window functions → the three functions do nothing and `useWindowMaximized()` stays `false`.
- `isDesktopWindow() → boolean` → `true` when the page runs in the desktop window (`window.desktopBridge` exists). `false` in a browser, and where there is no `window`.

## Dependencies

- DesktopBridge (module desktop), as `window.desktopBridge`

## Requirements served

- `plan-session_notifications/REQ-12`, `plan-session_notifications/REQ-13`
- `plan-mac_title_bar/REQ-6`, `plan-mac_title_bar/REQ-14`, `plan-mac_title_bar/REQ-16`, `plan-mac_title_bar/REQ-17`, `plan-mac_title_bar/REQ-18`, `plan-mac_title_bar/REQ-21`, `plan-mac_title_bar/REQ-25`
- `plan-terminal_addons/REQ-46`, `plan-terminal_addons/REQ-53`
