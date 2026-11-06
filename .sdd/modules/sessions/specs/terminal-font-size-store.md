---
module: sessions
component: TerminalFontSizeStore
type: frontend service
---

# TerminalFontSizeStore

**Purpose** → holds the one text size of all the hosted session terminals of the page, and saves it in the browser.

## Contract

- `MIN_TERMINAL_FONT_SIZE` → 8. `MAX_TERMINAL_FONT_SIZE` → 32. `DEFAULT_TERMINAL_FONT_SIZE` → 12. Sizes are in px.
- `TERMINAL_FONT_SIZE_KEY` → `'ai-client.terminal-font-size'`, the storage key of the saved size.
- `new TerminalFontSizeStore(storage?)` → the size is the value saved under the key when it is a whole number from 8 to 32. Otherwise it is 12: no value, any other text, a value out of range, no `storage`, or `getItem` throws. The store does not write at creation.
- `larger()` → the size grows by 1. At 32 nothing changes.
- `smaller()` → the size drops by 1. At 8 nothing changes.
- `reset()` → the size is 12. At 12 nothing changes.
- a change → the new size is saved under the key as text (e.g. `"13"`), then the `subscribe` listeners are called.
  - `storage` missing, or `setItem` throws → the size still changes and the listeners are called.
- no change → nothing is saved and no listener is called.
- `subscribe(listener) → unsubscribe` → `listener()` after each change of the size.
- `getSnapshot()` → the current size.
- `pageTerminalFontSizeStore()` → the one store of the page, created at the first call, with `localStorage`. `localStorage` not reachable → the store works without saving.
- `useTerminalFontSize(store = pageTerminalFontSizeStore()) → size` → React hook: the current size of `store`, also in a server render. The component re-renders after each change.

## Rules and invariants

- The size is always a whole number from 8 to 32.
- Each browser profile, and the desktop window, keeps its own size. The backend stores nothing.

## Requirements served

- `plan-terminal_addons/REQ-40`, `plan-terminal_addons/REQ-43`, `plan-terminal_addons/REQ-44`
