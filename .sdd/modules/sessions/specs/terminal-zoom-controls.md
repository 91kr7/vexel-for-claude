---
module: sessions
component: TerminalZoomControls
type: UI component
---

# TerminalZoomControls

**Purpose** → the three footer controls of SessionView that make the terminal text smaller, restore its default size, or make it larger.

## Contract

Description:
- one row of three buttons, 2 px apart, in a group named "Terminal text size".

Props:
- `size` → the current terminal text size in px.
- `onSmaller()`, `onReset()`, `onLarger()` → called by the actions below.

Shows, in order:
- "Smaller text" → an icon button (minus icon, 26 px, `--text-secondary`), tooltip "Smaller text (Ctrl+-)". Disabled when `size` is 8 or less.
- the default size button → 44 px wide, the text "<size> px" in mono 11 px (e.g. "12 px"). Accessible name "Default text size (<size> px)", tooltip "Default text size (Ctrl+0)". Never disabled.
- "Larger text" → an icon button (plus icon, 26 px, `--text-secondary`), tooltip "Larger text (Ctrl+=)". Disabled when `size` is 32 or more.
- hover on an enabled button → `--bg-surface-3` background, `--text-primary` text.

Actions:
- "Smaller text" → `onSmaller()`. The default size button → `onReset()`. "Larger text" → `onLarger()`.
- a disabled button does nothing.
- Tab reaches each enabled button, in this order. Enter or Space activates it. Each one shows the focus ring when it has the keyboard focus.

## Rules and invariants

- The controls do not change the size themselves. SessionView passes `size` and handles the calls.

## Dependencies

- TerminalFontSizeStore (the 8 and 32 px limits)
- IconSet (`MinusIcon`, `PlusIcon`), ThemeTokens (module app)

## Requirements served

- `plan-terminal_addons/REQ-35`, `plan-terminal_addons/REQ-41`, `plan-terminal_addons/REQ-45`
