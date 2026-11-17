---
module: app
component: ThemeSection
type: UI component
---

# ThemeSection

**Purpose** → the "Theme" section of the settings popup: a choice between the Light, Dark and Dark Blue themes.

## Contract

Props:
- `store` → optional ThemeStore. Default: the page store (`pageThemeStore()`).

Shows:
- a group named "Theme" (`fieldset` with its legend as heading) with three cards side by side, in this order: "Light", "Dark", "Dark Blue".
- each card is a radio named by its text. It shows a small preview of its theme colours (fixed preview tokens: each card shows its own theme, whatever the active one), then its icon (sun, moon, or moon with a star) and its text.
- each card (ChoiceCard, also used by LookSection) → `--radius-card`, `--role-card` fill, 1 px `--role-border-subtle` border, `--role-border-strong` on hover; its preview area on `--role-card-active`.
- the card of the active theme is checked: `--role-accent` border with a 1 px ring and `--shadow-card`, bold text and a check mark. It follows the store, also when the theme changes from elsewhere (e.g. Alt+A).

Actions:
- choosing a card that is not checked (click, Space, arrow keys) → `store.setTheme(<its theme>)` once. The theme applies to the whole page at once and is saved (ThemeStore).
- choosing the checked card → nothing.

Keyboard:
- the group is one Tab stop: the checked radio. Keyboard focus shows the focus ring of the page around the card.

## Dependencies

- ThemeStore (`useTheme`), IconSet (`SunIcon`, `MoonIcon`, `MoonStarIcon`, `CheckIcon`), ThemeTokens (preview tokens)

## Requirements served

- `plan-settings_dialog/REQ-12`, `plan-settings_dialog/REQ-14`, `plan-settings_dialog/REQ-15`, `plan-settings_dialog/REQ-57`
- `plan-dark_blue_theme/REQ-3`, `plan-dark_blue_theme/REQ-30`, `plan-dark_blue_theme/REQ-31`
