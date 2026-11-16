---
module: app
component: LookSection
type: UI component
---

# LookSection

**Purpose** → the "Window Look" section of the settings popup: a choice between the macOS look and the Windows 11 look.

## Contract

Props:
- `store` → optional LookStore. Default: the page store (`pageLookStore()`).

Shows:
- a group named "Window Look" (`fieldset` with its legend as heading) with two cards side by side, in this order: "macOS" (look `vexel`), "Windows 11" (look `windows11`).
- each card is a radio named by its text. It shows a small window preview (three coloured dots on the left, or the three Windows caption buttons on the right), then its icon (`MacWindowIcon` or `WindowsLogoIcon`) and its text.
- the card of the active look is checked, marked as in ThemeSection. It follows the store.

Actions:
- choosing the card that is not checked (click, Space, arrow keys) → `store.toggle()` once. The look applies to the whole page and is saved (LookStore).
- choosing the checked card → nothing.

Keyboard:
- the group is one Tab stop: the checked radio. Keyboard focus shows the focus ring of the page around the card.

## Rules and invariants

- offered in the desktop window and in the browser. In the browser a change of look shows no window buttons (TopBar).

## Dependencies

- LookStore (`useLook`), IconSet (`MacWindowIcon`, `WindowsLogoIcon`, `CheckIcon`)

## Requirements served

- `plan-settings_dialog/REQ-13`, `plan-settings_dialog/REQ-14`, `plan-settings_dialog/REQ-15`, `plan-settings_dialog/REQ-20`, `plan-settings_dialog/REQ-57`
