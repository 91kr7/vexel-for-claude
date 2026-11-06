---
module: app
component: TopBar
type: UI component
---

# TopBar

**Purpose** → the 48 px bar on top of the page: the logo, the brand and "New Session". It copies "1. TOP APP BAR" of `.sdd/mockups/studio-dark/mock.html`, without its other controls.

## Contract

Props:
- `onNewSession()` → called by "New Session".

Shows:
- a `header`, 48 px high, padding 0 × 14 px, `--bg-surface-2`, 1 px `--border-subtle` line at the bottom. Items centred, at the two ends, 12 px apart. Its text cannot be selected.
- on the left, 8 px apart:
  - the logo mark → a decorative 28 px square, 8 px radius, a 135° gradient from `--accent-primary` to `--accent-deep`, "VX" in mono 12 px weight 500 and `--on-accent`.
  - "Vexel" (14/20 px, weight 600, letter spacing −0.025em) and "for Claude" (mono 10 px, `--text-muted`), 8 px apart on the same baseline.
- on the right, the button "New Session" → `.button-primary .button-bar` with the plus icon at 14 px.

Actions:
- "New Session" → `onNewSession()`.

## Rules and invariants

- The bar holds no other control: no search, settings, session pill or sidebar switch.
- The logo mark adds nothing to the accessible names of the page.

## Dependencies

- IconSet (`PlusIcon`), ThemeTokens, WebEntry

## Requirements served

- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-14`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-6`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-16`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-52`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-53`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-13`
