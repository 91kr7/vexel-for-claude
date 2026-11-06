---
module: app
component: WindowButtons
type: UI component
---

# WindowButtons

**Purpose** → the red, yellow and green round buttons of the desktop window, in the macOS look. They close the window to the tray, minimize it, and maximize or restore it.

## Contract

Shows:
- a row of three 12 px circles, 8 px apart, in this order: red `--window-close`, yellow `--window-minimize`, green `--window-maximize`. 6 px of extra space after the green one.
- each button holds an 8 px symbol in `--window-symbol`:
  - red → a cross (`XIcon`). Yellow → a minus (`MinusIcon`).
  - green, window not maximized → two arrows that point out (`Maximize2Icon`). Maximized → two arrows that point in (`Minimize2Icon`).
- pointer over the group, gaps included → all three symbols are visible.
- pointer away from the group → the symbols are hidden: only the colours show. Keyboard focus does not show them.

Actions:
- red → `closeWindow()`. Yellow → `minimizeWindow()`. Green → `toggleMaximizeWindow()` (useDesktopBridge).
- a click does not take the focus: the focus stays where it was.

Accessible names:
- "Close", "Minimize", and "Maximize" or "Restore" by the window state (`useWindowMaximized`).

Keyboard:
- the three are buttons in the Tab order. Enter and Space act as a click. Focus from the keyboard shows the focus ring of the page (`:focus-visible`).

## Rules and invariants

- The group is never a drag area (`-webkit-app-region: no-drag`), also in the gaps between the buttons.
- The group sits above the dialog backdrop (z-index 120, above 100 and 110): visible and clickable while a dialog is open.
- The colours and the symbol colour are the same in both themes.

## Dependencies

- useDesktopBridge (`closeWindow`, `minimizeWindow`, `toggleMaximizeWindow`, `useWindowMaximized`)
- IconSet (`XIcon`, `MinusIcon`, `Maximize2Icon`, `Minimize2Icon`), ThemeTokens

## Requirements served

- `plan-mac_title_bar/REQ-15`, `plan-mac_title_bar/REQ-16`, `plan-mac_title_bar/REQ-17`, `plan-mac_title_bar/REQ-18`, `plan-mac_title_bar/REQ-19`, `plan-mac_title_bar/REQ-20`, `plan-mac_title_bar/REQ-21`, `plan-mac_title_bar/REQ-22`, `plan-mac_title_bar/REQ-24`, `plan-mac_title_bar/REQ-26`, `plan-mac_title_bar/REQ-27`, `plan-mac_title_bar/REQ-28`
