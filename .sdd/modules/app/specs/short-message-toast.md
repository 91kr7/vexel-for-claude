---
module: app
component: ShortMessageToast
type: UI component
---

# ShortMessageToast

**Purpose** → a small status box that shows one short text for a few seconds.

## Contract

- `useShortMessage() → { text, show }`
  - `text` → the text to show, or `null`. It starts at `null`.
  - `show(text)` → `text` becomes the given text. 4 s later it goes back to `null`.
  - `show` while a text shows → the new text replaces it, and the 4 s start again. This also holds for the same text.

Description:
- `ShortMessageToast({ text })` → nothing when `text` is `null`. Else a `.vx-glass` box with `role="status"`: a decorative 8 px round dot in `--role-accent`, then the text, 8 px apart.

Shows:
- fixed at the bottom right of the window, 20 px from the right and bottom edges, at most the window width minus 40 px.
- while the needs-input snackbar shows → 8 px above it, never over it.
- padding 8 × 14 px, `--radius-frame` corners, 1 px `--role-border-strong` border, top line and `--shadow-frame`, mono 12 px, `--text-primary`.
- at the level of the needs-input snackbar: above the page, below the dialogs and their backdrop.
- it does not take the pointer.

## Dependencies

- WebEntry, ThemeTokens, NeedsInputSnackbar (its place)

## Requirements served

- `plan-keyboard_shortcuts/REQ-9`
- `plan-dark_blue_theme/REQ-15`
