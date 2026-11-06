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
- one centred column on the dark "Studio" background. Title of the document: "Vexel for Claude".

Shows:
- loading → "Starting the backend…" with a rotating indicator.
- error → "The backend could not start." in the error colour. Below it, the output lines in a monospace block, one per row, in the order given.
- the output lines are shown as plain text: HTML in a line is never interpreted.

## Rules and invariants

- English text. Colours from the client's "Studio" theme: canvas `#0b0b0e`, text `#f3f2ee`, error `#fb7185`, indicator in the accent `#8ccfff`.
- The page loads nothing: no script, no network request (its Content-Security-Policy allows only inline styles).
- It does not import `src/web`.

## Requirements served

- `plan-desktop_app/REQ-7`
