---
module: sessions
component: TerminalSearchBox
type: UI component
---

# TerminalSearchBox

**Purpose** → the search box at the top right of the terminal panel of SessionView: the field, the match count, "previous", "next" and "close".

## Contract

Description:
- one row over the top right corner of the terminal panel, 8 px from its top and right edges, above the terminal text. Surface 2, 1 px `--border-strong` border, 8 px radius, shadow.

Props:
- `query` → the text of the field.
- `results` → `{ index, total }` of the last search, or `null` when there is none yet. `index` starts at 0; `-1` means the current match is past the highlight limit of the search.
- `inputRef` → optional ref to the field.
- `onQueryChange(query)` → called at each change of the field, with its new text.
- `onNext()`, `onPrevious()`, `onClose()` → called by the actions below.

Shows, in order:
- a decorative search icon.
- the field → a text box named "Search in terminal", placeholder "Search", mono 12 px. It takes the focus when the box mounts.
- the count (`role="status"`), mono 11 px:
  - `query` empty or `results` null → empty.
  - `total` 0 → "No results".
  - `index` from 0 → "<index + 1> of <total>", e.g. "3 of 12".
  - `index` -1 and `total` above 0 → "<total>+ results".
- "Previous match", "Next match" and "Close search" → icon buttons (chevron up, chevron down, X), with these accessible names and the tooltips "Previous match (Shift+Enter)", "Next match (Enter)" and "Close (Esc)".
- the box is a `role="search"` landmark named "Terminal search".

Actions:
- Enter in the field → `onNext()`. Shift+Enter in the field → `onPrevious()`. The browser default is prevented.
- Esc anywhere in the box → `onClose()`. The browser default is prevented and the key does not reach the ancestors.
- "Previous match" → `onPrevious()`. "Next match" → `onNext()`. "Close search" → `onClose()`.
- Tab moves through the field, "Previous match", "Next match" and "Close search", in this order. Each one shows the focus ring when it has the keyboard focus.

## Rules and invariants

- The box sends nothing to the pty: its keys stay in the page.
- The box does not search. SessionView runs the search and passes `results`.

## Dependencies

- IconSet (`SearchIcon`, `ChevronUpIcon`, `ChevronDownIcon`, `XIcon`), ThemeTokens, WebEntry (module app)

## Requirements served

- `plan-terminal_addons/REQ-24`, `plan-terminal_addons/REQ-25`, `plan-terminal_addons/REQ-26`, `plan-terminal_addons/REQ-27`, `plan-terminal_addons/REQ-28`, `plan-terminal_addons/REQ-30`
