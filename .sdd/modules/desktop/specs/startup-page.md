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
- both states → the top bar: empty, the light top bar colours (`#efeae0`, 1 px line `rgba(28, 25, 23, 0.08)` at the bottom). All of it is a drag area (`-webkit-app-region: drag`): it moves the window, and a double click maximizes or restores it.
- loading → "Starting the backend…" with a rotating indicator.
- error → "The backend could not start." in the error colour. Below it, the output lines in a monospace block, one per row, in the order given.
- the output lines are shown as plain text: HTML in a line is never interpreted.

## Rules and invariants

- English text. Always the client's light theme, whatever theme the client saved: canvas `#f4f1ea`, text `#1c1917`, error `#9f1239`, indicator in the accent `#0065ae`. The other tones are light ThemeTokens values too. `color-scheme` is `light`.
- The page loads nothing: no script, no network request (its Content-Security-Policy allows only inline styles).
- It does not import `src/web`.

## Requirements served

- `plan-desktop_app/REQ-7`
- `plan-light_theme/REQ-20`
- `plan-mac_title_bar/REQ-10`
