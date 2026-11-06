---
module: app
component: ThemeSwitch
type: UI component
---

# ThemeSwitch

**Purpose** → the sun/moon icon button of the top bar that toggles between the dark and the light theme. It copies the look of the top-bar icon buttons "Search Sessions" and "Settings" of `.sdd/mockups/studio-dark/mock.html`.

## Contract

Props:
- `store` → optional ThemeStore. Default: the page store (`pageThemeStore()`).

Shows:
- one button, 32 × 32 px, 8 px radius, the `.vx-surface-1` look, the icon at 16 px in `--text-secondary`, centred.
- dark theme → the moon icon. Light theme → the sun icon.
- hover → `--bg-surface-3`, `--border-strong` border and `--text-primary` icon.
- keyboard focus → the shared focus ring of WebEntry.
- accessible name "Dark theme", with `aria-pressed="true"` in the dark theme and `"false"` in the light theme. The tooltip (`title`) is "Dark theme" too.

Actions:
- click, Enter or Space → `store.toggle()`. The icon and `aria-pressed` follow the new theme.

## Rules and invariants

- The icons are decorative. The name stays "Dark theme" in both themes.
- Only colours change between the themes: size, place and layout stay the same.

## Dependencies

- ThemeStore (`useTheme`), IconSet (`SunIcon`, `MoonIcon`), ThemeTokens, WebEntry

## Requirements served

- `plan-light_theme/REQ-2`, `plan-light_theme/REQ-3`, `plan-light_theme/REQ-5`
