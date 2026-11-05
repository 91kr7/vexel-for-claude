---
module: app
component: WebEntry
type: UI entry point
---

# WebEntry

**Purpose** → the HTML page, the script that mounts the React app, and the global styles.

## Contract

- the page has `lang="it"` and the title "Sessioni Claude".
- the page declares `color-scheme: light dark`. Scrollbars and native controls follow the system theme.
- the script renders AppLayout in `#root`, with the global styles.
- the global styles take every value from ThemeTokens and use the BundledFont for the UI text.
- buttons → secondary by default. The class `button-primary` gives the primary look, the class `button-danger` the danger look. A disabled button looks dimmed.
- the element with the keyboard focus, when focused from the keyboard, shows a ring in `--color-focus-ring`.
- the terminal area keeps a dark background in both themes.

## Dependencies

- AppLayout
- ThemeTokens
- BundledFont

## Requirements served

- `plan-claude_sessions_client/REQ-1`
- `plan-claude_sessions_client-ui_redesign/REQ-1`
- `plan-claude_sessions_client-ui_redesign/REQ-2`
- `plan-claude_sessions_client-ui_redesign/REQ-3`
- `plan-claude_sessions_client-ui_redesign/REQ-5`
