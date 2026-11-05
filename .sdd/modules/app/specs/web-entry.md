---
module: app
component: WebEntry
type: UI entry point
---

# WebEntry

**Purpose** → the HTML page and the script that mount the React app.

## Contract

- the page has `lang="it"` and the title "Sessioni Claude".
- the script renders AppLayout in `#root`, with the global styles.

## Dependencies

- AppLayout

## Requirements served

- `plan-claude_sessions_client/REQ-1`
