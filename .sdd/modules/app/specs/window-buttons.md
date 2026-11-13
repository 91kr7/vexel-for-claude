---
module: app
component: WindowButtons
type: UI component
---

# WindowButtons

**Purpose** → the window buttons of the desktop window: red, yellow and green round buttons in the Vexel look (macOS style), or Windows 11 caption buttons in the Windows 11 look. They close the window to the tray, minimize it, and maximize or restore it.

## Contract

Props:
- `look` → `'vexel'` or `'windows11'` (LookStore `Look`). Default: `'vexel'`.

Vexel look shows:
- a row of three 12 px circles, 8 px apart, in this order: red `--window-close`, yellow `--window-minimize`, green `--window-maximize`. 6 px of extra space after the green one.
- each button holds an 8 px symbol in `--window-symbol`:
  - red → a cross (`XIcon`). Yellow → a minus (`MinusIcon`).
  - green, window not maximized → two arrows that point out (`Maximize2Icon`). Maximized → two arrows that point in (`Minimize2Icon`).
- pointer over the group, gaps included → all three symbols are visible.
- pointer away from the group → the symbols are hidden: only the colours show. Keyboard focus does not show them.

Windows 11 look shows:
- a row of three caption buttons, in this order: minimize, maximize or restore, close. Each is 46 px wide and as high as the top bar, with no gap and no radius; the row ends flush with the right edge of the window.
- each button holds a 10 px glyph drawn with a 1 px line in `--text-primary`, always visible: a line (minimize), a square (maximize), two overlapping squares (restore, when maximized), a cross (close).
- hover → `--caption-hover` background; pressed → `--caption-pressed`.
- close hover → `--caption-close` (`#c42b1c`) background and a white glyph; pressed → `--caption-close-pressed`.
- keyboard focus → the focus ring of the page, drawn inside the button.

Actions:
- red, or close → `closeWindow()`. Yellow, or minimize → `minimizeWindow()`. Green, or maximize/restore → `toggleMaximizeWindow()` (useDesktopBridge).
- a click does not take the focus: the focus stays where it was.

Accessible names:
- "Close", "Minimize", and "Maximize" or "Restore" by the window state (`useWindowMaximized`).

Keyboard:
- the three are buttons in the Tab order. Enter and Space act as a click. Focus from the keyboard shows the focus ring of the page (`:focus-visible`).

## Rules and invariants

- The group is never a drag area (`-webkit-app-region: no-drag`), also in the gaps between the buttons.
- The group sits above the dialog backdrop (z-index 120, above 100 and 110): visible and clickable while a dialog is open.
- Vexel look: the colours and the symbol colour are the same in both themes.
- Windows 11 look: the glyph and hover colours follow the theme; the close red is the same in both.

## Dependencies

- useDesktopBridge (`closeWindow`, `minimizeWindow`, `toggleMaximizeWindow`, `useWindowMaximized`)
- IconSet (`XIcon`, `MinusIcon`, `Maximize2Icon`, `Minimize2Icon`, `CaptionMinimizeGlyph`, `CaptionMaximizeGlyph`, `CaptionRestoreGlyph`, `CaptionCloseGlyph`), ThemeTokens, Windows11Look

## Requirements served

- `plan-mac_title_bar/REQ-15`, `plan-mac_title_bar/REQ-16`, `plan-mac_title_bar/REQ-17`, `plan-mac_title_bar/REQ-18`, `plan-mac_title_bar/REQ-19`, `plan-mac_title_bar/REQ-20`, `plan-mac_title_bar/REQ-21`, `plan-mac_title_bar/REQ-22`, `plan-mac_title_bar/REQ-24`, `plan-mac_title_bar/REQ-26`, `plan-mac_title_bar/REQ-27`, `plan-mac_title_bar/REQ-28`
