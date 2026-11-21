---
module: sessions
component: TerminalZoomControls
type: UI component
---

# TerminalZoomControls

**Purpose** → the three footer controls of SessionView that make the terminal text smaller, restore its default size, or make it larger.

## Contract

Description:
- one row of three buttons, 4 px apart, in a group named "Terminal text size". The group is a pill: padding 2 × 4 px, `--radius-pill` corners, `--border-pill`, on `--role-pill`.

Props:
- `size` → the current terminal text size in px.
- `onSmaller()`, `onReset()`, `onLarger()` → called by the actions below.

Shows, in order:
- "Smaller text" → a 16 px icon button with 4 px corners (minus icon, 12 px, `--text-secondary`), tooltip "Smaller text (<keys>)". Disabled when `size` is 8 or less.
- the default size button → 16 px high, at least 38 px wide, the text "<size> px" in mono 10.5 px with tabular figures (e.g. "12 px"). Accessible name "Default text size (<size> px)", tooltip "Default text size (<keys>)". Never disabled.
- "Larger text" → a 16 px icon button with 4 px corners (plus icon, 12 px, `--text-secondary`), tooltip "Larger text (<keys>)". Disabled when `size` is 32 or more.
- `<keys>` → `rowKeysText` of the ShortcutMap rows "Smaller text", "Default text size" and "Larger text": by default "Ctrl+-", "Ctrl+0" and "Ctrl+= / Ctrl++". A change of these keys shows at once.
- hover on an enabled button → `--role-hover` background, `--text-primary` text.

Actions:
- "Smaller text" → `onSmaller()`. The default size button → `onReset()`. "Larger text" → `onLarger()`.
- a disabled button does nothing.
- Tab reaches each enabled button, in this order. Enter or Space activates it. Each one shows the focus ring when it has the keyboard focus.

## Rules and invariants

- The controls do not change the size themselves. SessionView passes `size` and handles the calls.

## Dependencies

- TerminalFontSizeStore (the 8 and 32 px limits)
- ShortcutMap, UserShortcutKeys (module app)
- IconSet (`MinusIcon`, `PlusIcon`), ThemeTokens (module app)

## Requirements served

- `plan-terminal_addons/REQ-35`, `plan-terminal_addons/REQ-41`, `plan-terminal_addons/REQ-45`
- `plan-settings_dialog/REQ-38`
- `plan-dark_blue_theme/REQ-12`, `plan-dark_blue_theme/REQ-14`
