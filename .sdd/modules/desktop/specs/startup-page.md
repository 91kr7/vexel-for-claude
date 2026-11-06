---
module: desktop
component: StartupPage
type: UI page
---

# StartupPage

**Purpose** → what the window shows before the client page: the wait for the backend, or the error when it cannot start.

## Contract

- `startupPageHtml(state) → string` → a complete HTML document.
- `startupPageUrl(state) → string` → the same document as a `data:text/html` URL.
- `state` → `{ kind: "loading" }` or `{ kind: "error", outputLines: string[] }`.

Description:
- a 48 px bar across the top, then one centred column on the light background of the client. Title of the document: "Vexel for Claude".

Shows:
- both states → the top bar, in the light top bar colours (`#efeae0`, 1 px line `rgba(28, 25, 23, 0.08)` at the bottom). It is a drag area (`-webkit-app-region: drag`): it moves the window, and a double click maximizes or restores it.
- both states → the three window buttons at the left of the bar, 14 px from the edge and centred in its height. Same look, symbols, names and hover rule as the WindowButtons (module app): 12 px circles 8 px apart, `#ff5f57`, `#febc2e`, `#28c840`, symbols in black at 52 %. Focus from the keyboard shows a 2 px `#0065ae` ring 2 px away. The group is not a drag area.
- loading → "Starting the backend…" with a rotating indicator.
- error → "The backend could not start." in the error colour. Below it, the output lines in a monospace block, one per row, in the order given.
- the output lines are shown as plain text: HTML in a line is never interpreted.

Actions (through `window.desktopBridge`, the DesktopBridge):
- red → `closeWindow()`. Yellow → `minimizeWindow()`. Green → `toggleMaximizeWindow()`.
- the green button asks `isWindowMaximized()` at load and follows `onWindowMaximizedChange`: maximized → name "Restore" and the arrows that point in; else "Maximize" and the arrows that point out.
- no bridge → the buttons show and do nothing.

## Rules and invariants

- English text. Always the client's light theme, whatever theme the client saved: canvas `#f4f1ea`, text `#1c1917`, error `#9f1239`, indicator in the accent `#0065ae`. The other tones are light ThemeTokens values too. `color-scheme` is `light`.
- The page loads nothing: no network request. Its Content-Security-Policy allows inline styles and only the page's own inline script, by its SHA-256 hash. Any other script never runs.
- It does not import `src/web`.

## Dependencies

- DesktopBridge, as `window.desktopBridge`

## Requirements served

- `plan-desktop_app/REQ-7`
- `plan-light_theme/REQ-20`
- `plan-mac_title_bar/REQ-10`, `plan-mac_title_bar/REQ-23`
