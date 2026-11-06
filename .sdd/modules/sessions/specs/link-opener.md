---
module: sessions
component: LinkOpener
type: frontend function
---

# LinkOpener

**Purpose** → opens a link of the terminal outside the client window, only when it is a web address.

## Contract

- `isWebAddress(address) → boolean`
  - `true` → the address parses as a URL with the scheme `http` or `https`, in any case (`HTTPS://…` too).
  - `false` → any other scheme (`file:`, `javascript:`, `mailto:`, …) or a text that is not a URL.
- `openLink(address)`
  - a web address → `window.open(address, '_blank', 'noopener,noreferrer')`: a new tab, with no opener and no referrer.
  - any other address → nothing happens.

## Rules and invariants

- The client window never navigates: the address opens only in a new tab (in the desktop app, DesktopApp passes the request to the system browser).

## Requirements served

- `plan-terminal_addons/REQ-10`, `plan-terminal_addons/REQ-11`, `plan-terminal_addons/REQ-12`
