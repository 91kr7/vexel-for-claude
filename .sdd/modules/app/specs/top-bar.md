---
module: app
component: TopBar
type: UI component
---

# TopBar

**Purpose** → the 48 px bar on top of the page: the logo, the brand, the shortcuts button, the theme switch, the look switch, the plan usage button and "New Session". In the desktop window it is also the title bar that moves the window. It copies "1. TOP APP BAR" of `.sdd/mockups/studio-dark/mock.html`, without its other controls.

## Contract

Props:
- `onNewSession()` → called by "New Session".
- `shortcutsPanelOpen`, `onToggleShortcutsPanel()` → passed to the ShortcutsButton.
- `planUsageOpen`, `onTogglePlanUsage()` → passed to the PlanUsageButton.

Shows:
- a `header`, 48 px high, padding 0 × 14 px, `--bg-surface-2`, 1 px `--border-subtle` line at the bottom. Items centred, at the two ends, 12 px apart. Its text cannot be selected.
- on the left, 8 px apart:
  - the logo mark → a decorative 28 px square, 8 px radius, a 135° gradient from `--accent-primary` to `--accent-deep`, "VX" in mono 12 px weight 500 and `--on-accent`.
  - "Vexel" (14/20 px, weight 600, letter spacing −0.025em) and "for Claude" (mono 10 px, `--text-muted`), 8 px apart on the same baseline.
- on the right, 6 px apart:
  - the ShortcutsButton, right before the ThemeSwitch.
  - the ThemeSwitch.
  - the LookSwitch, right after the ThemeSwitch.
  - the PlanUsageButton, right after the LookSwitch and before "New Session".
  - the button "New Session" → `.button-primary .button-bar` with the plus icon at 14 px.

Actions:
- "New Session" → `onNewSession()`.

Desktop window (`isDesktopWindow()` is `true`):
- Vexel look → the WindowButtons (macOS look) at the left end, before the logo mark.
- Windows 11 look → the WindowButtons (Windows look) at the right end, after "New Session", flush with the window edge. Nothing at the left end.
- the `header` is a drag area (`-webkit-app-region: drag`): dragging it moves the window, and a double click maximizes or restores it, by the desktop's title bar action.
- its controls (buttons, links, fields) are `no-drag`: a click or a double click acts on the control only.
- the logo, the brand and the space between the two ends stay in the drag area.

Browser (`isDesktopWindow()` is `false`):
- no drag area and no WindowButtons, with no space kept for them. The bar is the same as before the desktop title bar.

## Rules and invariants

- The bar holds no control other than the ShortcutsButton, the ThemeSwitch, the LookSwitch, the PlanUsageButton, "New Session" and, in the desktop window, the WindowButtons: no search, settings, session pill or sidebar switch.
- The logo mark adds nothing to the accessible names of the page.
- The bar keeps the theme tokens in both cases: dark in the dark theme, light in the light theme, and it changes with the rest of the page.
- In the desktop window there is a drag area at every window width: the logo and the brand are never controls.

## Dependencies

- ShortcutsButton, ThemeSwitch, LookSwitch, LookStore (`useLook`), PlanUsageButton, IconSet (`PlusIcon`), ThemeTokens, WebEntry
- useDesktopBridge (`isDesktopWindow`), WindowButtons

## Requirements served

- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-14`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-6`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-16`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-52`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-53`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-13`
- `plan-light_theme/REQ-1`
- `plan-usage_limits/REQ-1`, `plan-usage_limits/REQ-2`
- `plan-keyboard_shortcuts/REQ-22`, `plan-keyboard_shortcuts/REQ-24`, `plan-keyboard_shortcuts/REQ-29`
- `plan-mac_title_bar/REQ-6`, `plan-mac_title_bar/REQ-7`, `plan-mac_title_bar/REQ-8`, `plan-mac_title_bar/REQ-9`, `plan-mac_title_bar/REQ-12`, `plan-mac_title_bar/REQ-13`, `plan-mac_title_bar/REQ-14`, `plan-mac_title_bar/REQ-15`, `plan-mac_title_bar/REQ-25`
