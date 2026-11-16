---
module: app
component: ThemeSection
type: UI component
---

# ThemeSection

**Purpose** → the "Theme" section of the settings popup: a choice between the light and the dark theme.

## Contract

Props:
- `store` → optional ThemeStore. Default: the page store (`pageThemeStore()`).

Shows:
- a group named "Theme" (`fieldset` with its legend) with two radios, in this order: "Light", "Dark".
- the radio of the active theme is checked. It follows the store, also when the theme changes from elsewhere (e.g. Alt+A).

Actions:
- choosing the radio that is not checked (click, Space, arrow keys) → `store.toggle()` once. The theme applies to the whole page and is saved (ThemeStore).
- choosing the checked radio → nothing.

Keyboard:
- the group is one Tab stop: the checked radio. Keyboard focus shows the focus ring of the page.

## Dependencies

- ThemeStore (`useTheme`)

## Requirements served

- `plan-settings_dialog/REQ-12`, `plan-settings_dialog/REQ-14`, `plan-settings_dialog/REQ-15`
