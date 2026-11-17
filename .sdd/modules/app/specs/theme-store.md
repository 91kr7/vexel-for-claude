---
module: app
component: ThemeStore
type: frontend service
---

# ThemeStore

**Purpose** → holds the active theme of the page and marks it on the page root, so that ThemeTokens restyle the whole client.

## Contract

- `Theme` → `'light'`, `'dark'` or `'dark-blue'`. `START_THEME` → `'dark-blue'`, the theme of the first start.
- `THEME_KEY` → `'ai-client.theme'`, the storage key of the saved theme.
- `isTheme(value)` → true only for `'light'`, `'dark'` and `'dark-blue'`.
- `ColorChange` → `(apply) => void`, the way a change of the page colours runs.
- `new ThemeStore(root, initial = START_THEME, storage?, change?)` → `root` is the element that carries the mark, such as `document.documentElement`. The store takes `initial` as the active theme and marks it at once, never through `change`. It does not write to `storage` at creation. `change` defaults to running the change at once.
- the mark → the attribute `data-theme` on `root`, with the name of the active theme.
- `setTheme(theme)` → `theme` becomes the active theme at once (`getSnapshot`) and is saved in `storage` under `THEME_KEY`. Then, through `change`, the mark takes the active theme and the `subscribe` listeners are called.
  - several changes before `change` runs them → each one marks the active theme, so the page ends on the last one.
  - `theme` already active → it is saved again and the listeners are called.
  - `storage` missing, or `setItem` throws → the theme still changes on the page and the listeners are called.
- `toggle()` → `setTheme` of the next theme in the cycle Light → Dark → Dark Blue → Light.
- `subscribe(listener) → unsubscribe` → `listener()` after each change of the theme.
- `getSnapshot()` → the active theme.
- `pageThemeStore()` → the one store of the page, created at the first call. Root `document.documentElement`, storage `localStorage`, change ColorDissolve: each theme change after the first paint dissolves.
  - initial theme → the `data-theme` mark already on the root (set by WebEntry before the first paint) when `isTheme` accepts it; else `START_THEME`.
  - `localStorage` not reachable → the store works without saving.
- `useTheme(store = pageThemeStore()) → { theme, toggleTheme, setTheme }` → React hook. `theme` is the active theme of `store`, also in a server render. `toggleTheme()` calls `store.toggle()`, `setTheme(theme)` calls `store.setTheme(theme)`. The component re-renders after each change.

## Rules and invariants

- A change of theme only moves the mark. It does not reload the page, remount components or touch any connection.
- The saved value is exactly `light`, `dark` or `dark-blue`. Every theme is saved, the first-start theme included once chosen. Each browser profile, and the desktop window, keeps its own value. The backend stores nothing.
- WebEntry reads the same key with the same validity rule. The two must change together.

## Dependencies

- ThemeTokens (the styles that read the mark)
- ColorDissolve (the change of the page store)
- WebEntry (sets the first mark from the saved theme)

## Requirements served

- `plan-light_theme/REQ-3`, `plan-light_theme/REQ-4`, `plan-light_theme/REQ-17`, `plan-light_theme/REQ-19`
- `plan-dark_blue_theme/REQ-31`, `plan-dark_blue_theme/REQ-32`, `plan-dark_blue_theme/REQ-34`, `plan-dark_blue_theme/REQ-35`
- `plan-ui_transitions/REQ-14`, `plan-ui_transitions/REQ-28`
