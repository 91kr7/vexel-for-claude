---
module: desktop
component: WindowActions
type: backend service
---

# WindowActions

**Purpose** → the main process side of the window buttons. It closes, minimizes, and maximizes or restores the window when the page asks, and tells the page the maximized state.

## Contract

- `connectWindowActions(window, ipc)` → listens on `ipc` (Electron's `ipcMain`) for requests of the window's own web contents:
  - `desktop-bridge:window-close` → `window.close()`. It is the same close as the native close button, so the `close` handler of DesktopApp decides what happens.
  - `desktop-bridge:window-minimize` → the window minimizes.
  - `desktop-bridge:window-toggle-maximize` → a maximized window restores (unmaximize). Any other window maximizes.
  - `desktop-bridge:window-is-maximized` (invoke) → answers `true` when the window is maximized, else `false`.
- each `maximize` and `unmaximize` of the window, from any cause → it sends `window.isMaximized()` to the page on `desktop-bridge:window-maximized`.

## Rules and invariants

- A request from another web contents than the window's does nothing. The state question gets `false`.
- A request or a state change after the window is destroyed does nothing.
- It never hides or shows the window by itself.

## Requirements served

- `plan-mac_title_bar/REQ-16`, `plan-mac_title_bar/REQ-17`, `plan-mac_title_bar/REQ-18`, `plan-mac_title_bar/REQ-21`, `plan-mac_title_bar/REQ-23`
