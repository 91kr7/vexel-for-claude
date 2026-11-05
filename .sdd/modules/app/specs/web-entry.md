---
module: app
component: WebEntry
type: UI entry point
---

# WebEntry

**Purpose** → the HTML page, the script that mounts the React app, and the global styles.

## Contract

- the page has `lang="it"` and the title "Vexel for Claude".
- the page declares `color-scheme: light dark`. Scrollbars and native controls follow the system theme.
- the script renders AppLayout in `#root`, with the global styles.
- the global styles take every value from ThemeTokens. The UI text uses Roboto Flex, `--font-mono` text uses Roboto Mono.
- buttons → secondary by default. The class `button-primary` gives the primary look, the class `button-danger` the danger look. A disabled button looks dimmed.
- global classes, IDENTICAL to the `<style>` block of board "Sessione ospitata":

| Class | Look |
|-------|------|
| `.brand` | Roboto Flex, weight 800, width 125, grade 50, letter spacing −0.5 px |
| `.label-l` | 14/20 px, weight 500, letter spacing 0.1 px |
| `.label-m` | 12/16 px, weight 500, letter spacing 0.5 px |
| `.body-l` | 16/24 px, letter spacing 0.5 px |
| `.body-m` | 14/20 px, letter spacing 0.25 px |
| `.body-s` | 12/16 px, letter spacing 0.4 px |
| `.title-m` | 16/24 px, weight 500, letter spacing 0.15 px |
| `.title-l` | 22/28 px, weight 500 |
| `.headline-s` | 24/32 px, weight 500 |
| `.mono` | Roboto Mono |
| `.btn` | inline flex, gap 8 px, height 40 px, padding 0 20 px 0 16 px, radius 20 px, no border. The caller sets its colours |
| `.chip` | inline flex, gap 6 px, height 28 px, padding 0 10 px 0 8 px, radius 8 px. Its icons are 16 px |
| `.icon` | 20 px (`--icon-size`), no fill, stroke in the text colour, width 2, round caps and joins |

- the element with the keyboard focus, when focused from the keyboard, shows a ring in `--color-focus-ring`.
- the terminal area has the `--term-bg` background of the active theme.

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
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-1`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-5`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-12`
