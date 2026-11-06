---
module: app
component: ThemeStore
type: frontend service
---

# ThemeStore

**Purpose** → holds the active theme of the page and marks it on the page root, so that ThemeTokens restyle the whole client.

## Contract

- `Theme` → `'dark'` or `'light'`. `START_THEME` → `'dark'`.
- `new ThemeStore(root, initial = START_THEME)` → `root` is the element that carries the mark, such as `document.documentElement`. The store takes `initial` as the active theme and marks it at once.
- the mark → the attribute `data-theme` on `root`, with the name of the active theme (`dark` or `light`).
- `toggle()` → dark becomes light, light becomes dark. The mark changes to the new theme, then the `subscribe` listeners are called.
- `subscribe(listener) → unsubscribe` → `listener()` after each change of the theme.
- `getSnapshot()` → the active theme.
- `pageThemeStore()` → the one store of the page, on `document.documentElement`, created at the first call.
- `useTheme(store = pageThemeStore()) → { theme, toggleTheme }` → React hook. `theme` is the active theme of `store`, also in a server render. `toggleTheme()` calls `store.toggle()`. The component re-renders after each change.

## Rules and invariants

- A change of theme only moves the mark. It does not reload the page, remount components or touch any connection.
- The store does not save the theme. Each page load starts from `START_THEME`.

## Dependencies

- ThemeTokens (the styles that read the mark)

## Requirements served

- `plan-light_theme/REQ-3`, `plan-light_theme/REQ-4`
