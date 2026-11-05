---
module: app
component: BundledFont
type: configuration
---

# BundledFont

**Purpose** → the fonts of the client, Roboto Flex for the UI and Roboto Mono for paths, code and the terminal, shipped with the client.

## Contract

- `@font-face` declares, as in the mock boards, latin subset only, `font-display: swap`:
  - `Roboto Flex` → weights 400 to 800, width 25% to 151%.
  - `Roboto Mono` → weights 400 and 500, from one file.
- The font files are `woff2` in the repository, copied from the mock folder. The build copies them into the client's own assets.
- Guarantees: the page loads the fonts from the client's origin, never from another server.

## Rules and invariants

- The licence file (SIL OFL 1.1, with the Roboto Flex and Roboto Mono copyright lines) sits next to the font files.
- The client ships no other font.

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-1`
- `plan-claude_sessions_client-ui_redesign/REQ-6`
- `plan-claude_sessions_client-ui_redesign/REQ-7`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-5`
