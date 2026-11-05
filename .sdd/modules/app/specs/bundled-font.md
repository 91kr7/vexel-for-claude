---
module: app
component: BundledFont
type: configuration
---

# BundledFont

**Purpose** → the UI font of the client, Inter, shipped with the client.

## Contract

- `@font-face` declares the family `Inter Variable`, weights 100 to 900, latin subset, `font-display: swap`.
- The font file is a `woff2` in the repository. The build copies it into the client's own assets.
- Guarantees: the page loads the font from the client's origin, never from another server.

## Rules and invariants

- The licence file (SIL OFL 1.1) sits next to the font file.
- The terminal does not use this font. It keeps the font of xterm.js.

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-1`
- `plan-claude_sessions_client-ui_redesign/REQ-6`
- `plan-claude_sessions_client-ui_redesign/REQ-7`
