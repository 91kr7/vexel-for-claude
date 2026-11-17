---
module: app
component: TopBar
type: UI component
---

# TopBar

**Purpose** → the 38 px bar on top of the page: the logo, the brand and the plan usage button. In the desktop window it is also the title bar that moves the window. It follows the title bar of `.sdd/mockups/dark_blue_theme/mock.html`.

## Contract

Props:
- `planUsageOpen`, `onTogglePlanUsage()` → passed to the PlanUsageButton.

Shows:
- a `header`, 38 px high, padding 0 × 14 px, on `--role-chrome`, 1 px `--role-border-subtle` line at the bottom. Items centred, at the two ends, 12 px apart. Its text cannot be selected.
- on the left, 8 px apart:
  - the logo mark → a decorative 20 px square, 6 px radius, a 135° gradient from `--accent-primary` to `--accent-deep`, "VX" in mono 10 px weight 500 and `--on-accent`.
  - "Vexel" (13/20 px, weight 600, letter spacing −0.025em) and "for Claude" (mono 10 px, `--text-muted`), 8 px apart on the same baseline.
  - the installed version → `v` followed by the version of useInstalledVersion, e.g. `v0.2.2`, right after "for Claude", 8 px apart, on the same baseline, same style as "for Claude". Plain text, not a control. While the version is `null` (loading or failure) → no version text, and the rest of the bar keeps its layout.
- on the right: the PlanUsageButton.

Desktop window (`isDesktopWindow()` is `true`):
- current look → the WindowButtons (macOS buttons) at the left end, before the logo mark.
- Windows 11 look → the WindowButtons (Windows-style buttons) at the right end, after the PlanUsageButton, flush with the window edge. Nothing before the logo mark.
  - at every window width the WindowButtons stay whole at the right end. When the bar is too narrow, the controls before them go under them and are hidden; the logo and "Vexel" stay visible.
- a change of look moves the WindowButtons at once; the rest of the bar keeps its state.
- the `header` is a drag area (`-webkit-app-region: drag`): dragging it moves the window, and a double click maximizes or restores it, by the desktop's title bar action.
- its controls (buttons, links, fields) are `no-drag`: a click or a double click acts on the control only.
- the logo, the brand, the installed version and the space between the two ends stay in the drag area.

Browser (`isDesktopWindow()` is `false`):
- no drag area and no WindowButtons in either look, with no space kept for them. The bar is the same as before the desktop title bar.

## Rules and invariants

- The bar holds no control other than the PlanUsageButton and, in the desktop window, the WindowButtons: no shortcuts button, "New Session", search, settings, theme switch, look switch, session pill or sidebar switch. The theme and the look are chosen in the SettingsDialog.
- The logo mark adds nothing to the accessible names of the page.
- The bar keeps the theme tokens in both cases: dark in the dark theme, light in the light theme, and it changes with the rest of the page.
- In the desktop window there is a drag area at every window width, in both looks: the logo and the brand are never controls.

## Dependencies

- LookStore (`useLook`), PlanUsageButton, ThemeTokens, WebEntry
- useDesktopBridge (`isDesktopWindow`), WindowButtons
- useInstalledVersion

## Requirements served

- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-14`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-6`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-16`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-52`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-53`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-1`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-13`
- `plan-light_theme/REQ-1`
- `plan-usage_limits/REQ-1`, `plan-usage_limits/REQ-2`
- `plan-mac_title_bar/REQ-6`, `plan-mac_title_bar/REQ-7`, `plan-mac_title_bar/REQ-8`, `plan-mac_title_bar/REQ-9`, `plan-mac_title_bar/REQ-12`, `plan-mac_title_bar/REQ-13`, `plan-mac_title_bar/REQ-14`, `plan-mac_title_bar/REQ-15`, `plan-mac_title_bar/REQ-25`
- `plan-update_check/REQ-13`
- `plan-wsl_support/REQ-18`, `plan-wsl_support/REQ-28`, `plan-wsl_support/REQ-32`, `plan-wsl_support/REQ-33`, `plan-wsl_support/REQ-35`
- `plan-ui_restyle/REQ-1`, `plan-ui_restyle/REQ-2`
- `plan-settings_dialog/REQ-16`, `plan-settings_dialog/REQ-17`, `plan-settings_dialog/REQ-24`
- `plan-dark_blue_theme/REQ-1`, `plan-dark_blue_theme/REQ-2`, `plan-dark_blue_theme/REQ-6`, `plan-dark_blue_theme/REQ-8`
