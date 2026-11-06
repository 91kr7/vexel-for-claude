---
module: app
component: ThemeStore
type: frontend service
---

# ThemeStore

**Purpose** → holds the active theme of the page and marks it on the page root, so that ThemeTokens restyle the whole client.

## Contract

- `Theme` → `'dark'` or `'light'`. `START_THEME` → `'light'`.
- `THEME_KEY` → `'ai-client.theme'`, the storage key of the saved theme.
- `isTheme(value)` → true only for `'dark'` and `'light'`.
- `new ThemeStore(root, initial = START_THEME, storage?)` → `root` is the element that carries the mark, such as `document.documentElement`. The store takes `initial` as the active theme and marks it at once. It does not write to `storage` at creation.
- the mark → the attribute `data-theme` on `root`, with the name of the active theme (`dark` or `light`).
- `toggle()` → dark becomes light, light becomes dark. The mark changes to the new theme, the new theme is saved in `storage` under `THEME_KEY`, then the `subscribe` listeners are called.
  - `storage` missing, or `setItem` throws → the theme still changes on the page and the listeners are called.
- `subscribe(listener) → unsubscribe` → `listener()` after each change of the theme.
- `getSnapshot()` → the active theme.
- `pageThemeStore()` → the one store of the page, created at the first call. Root `document.documentElement`, storage `localStorage`.
  - initial theme → the `data-theme` mark already on the root (set by WebEntry before the first paint) when it is `dark` or `light`; else `START_THEME`.
  - `localStorage` not reachable → the store works without saving.
- `useTheme(store = pageThemeStore()) → { theme, toggleTheme }` → React hook. `theme` is the active theme of `store`, also in a server render. `toggleTheme()` calls `store.toggle()`. The component re-renders after each change.

## Rules and invariants

- A change of theme only moves the mark. It does not reload the page, remount components or touch any connection.
- The saved value is exactly `dark` or `light`. Each browser profile, and the desktop window, keeps its own value. The backend stores nothing.
- WebEntry reads the same key with the same validity rule. The two must change together.

## Dependencies

- ThemeTokens (the styles that read the mark)
- WebEntry (sets the first mark from the saved theme)

## Requirements served

- `plan-light_theme/REQ-3`, `plan-light_theme/REQ-4`, `plan-light_theme/REQ-17`, `plan-light_theme/REQ-19`
