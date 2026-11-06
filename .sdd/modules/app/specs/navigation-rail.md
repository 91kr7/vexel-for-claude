---
module: app
component: NavigationRail
type: UI component
---

# NavigationRail

**Purpose** → the 52 px column on the left: "New Claude Code Session", then the destinations "Sessions" and "Resume". It copies the top group of `#primary-rail` in `.sdd/mockups/studio-dark/mock.html`.

## Contract

Props:
- `needsInputCount` → the number of sessions in `needs_input`.
- `onNewSession()`, `onShowSessions()`, `onResume()` → called on a click of the matching button.
- `newSessionRef` → optional ref that receives the "New Claude Code Session" button.

Description:
- a `nav` with the label "Main Navigation". One column, 52 px wide, items centred, 6 px apart, padding 10 px above and below, `--bg-surface-1`, 1 px `--border-subtle` line on the right. It has no logo.

Shows, top to bottom:
- "New Claude Code Session" (`.vx-rail-fab`) → 34 × 34 px, 8 px radius, 4 px extra space below, a 135° gradient from `--accent-primary` to `--accent-deep`, the plus icon at 16 px in `--on-accent`, `shadow-sm`. Scaled to 95 % while pressed.
- the divider → 20 × 1 px in `--border-subtle`, 2 px above and below.
- "Sessions" and "Resume" (`.vx-rail-btn`) → 34 × 34 px, 8 px radius, the icon at 17 px (terminal, history) in `--text-secondary`, no text under it. Hover → `--bg-surface-3` and `--text-primary`.
- "Sessions" → always the active style: `aria-current="page"`, `--accent-glow` background, `--accent-primary` icon, 1 px `--accent-border` border, glow `0 0 14px -2px`. A bar 2.5 px wide, rounded on the right, in `--accent-primary`, 8 px left of the button and 8 px from its top and bottom.
- the badge on "Sessions" → the number `needsInputCount` in a pill on the top-right corner (4 px out on each side): at least 14 px wide, 14 px high, padding 0 × 3 px, `--amber-400` fill, mono 10 px weight 500 in `--bg-canvas`. Not shown when the number is 0. Hidden from assistive technology.
- a tooltip per button → on hover, its name ("New Claude Code Session", "Sessions", "Resume") 44 px from the button's left edge: `--bg-surface-3`, 1 px `--border-strong`, padding 3 × 8 px, 6 px radius, 11 px weight 500, shadow `0 6px 16px` black at 40 %. It fades in and slides 4 px in 0.12 s. No shortcut. Hidden from assistive technology.

Actions:
- click on "New Claude Code Session" → `onNewSession()`.
- click on "Sessions" → `onShowSessions()`.
- click on "Resume" → `onResume()`.

## Rules and invariants

- The icons are decorative. The accessible names are "New Claude Code Session", "Sessions" and "Resume".
- The rail sits above the list panel, so a tooltip is never hidden by it.

## Dependencies

- IconSet (`PlusIcon`, `TerminalIcon`, `HistoryIcon`), ThemeTokens

## Requirements served

- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-6`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-14`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-17`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-18`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-19`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-20`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-53`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-9`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-9`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-13`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-15`
