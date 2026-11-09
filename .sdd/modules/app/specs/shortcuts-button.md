---
module: app
component: ShortcutsButton
type: UI component
---

# ShortcutsButton

**Purpose** → the keyboard icon button of the top bar that opens and closes the ShortcutsPanel. It has the look of the ThemeSwitch.

## Contract

Props:
- `open` → the ShortcutsPanel is open.
- `onToggle()` → called by a press.

Shows:
- one button with the keyboard icon, with the size, look, hover and focus ring of the ThemeSwitch.
- accessible name "Keyboard Shortcuts", tooltip (`title`) "Keyboard Shortcuts (Alt+S)".
- `aria-haspopup="dialog"`, and `aria-expanded` is `open`.
- `open` → the button sits above the dialog backdrop: visible and clickable, like the WindowButtons.
- desktop window → `no-drag`, as every control of the TopBar.

Actions:
- click, Enter or Space → `onToggle()`.
- a mouse press does not take the focus: the focus stays where it was, also inside the open panel.

## Rules and invariants

- The icon is decorative: the name stays "Keyboard Shortcuts".
- `open` is `false` → the button is below any dialog backdrop, like the other controls of the page.

## Dependencies

- IconSet (`KeyboardIcon`), ThemeSwitch (look), ThemeTokens, WebEntry

## Requirements served

- `plan-keyboard_shortcuts/REQ-22`, `plan-keyboard_shortcuts/REQ-23`, `plan-keyboard_shortcuts/REQ-24`, `plan-keyboard_shortcuts/REQ-29`
