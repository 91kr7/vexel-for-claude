---
module: app
component: LookStore
type: frontend service
---

# LookStore

**Purpose** → holds the active look of the page, marks it on the page root and saves it, as ThemeStore does for the theme. Windows11Look reads the mark.

## Contract

- `Look` → `'vexel'` (the current look) or `'windows11'`. `START_LOOK` → `'vexel'`.
- `LOOK_KEY` → `'ai-client.look'`, the storage key of the saved look.
- `isLook(value)` → `true` only for `'vexel'` and `'windows11'`.
- `new LookStore(root, initial = START_LOOK, storage?, change?)` → `root` is the element that carries the mark, e.g. `document.documentElement`. The store takes `initial` as the active look and marks it at once, never through `change`. It does not write to `storage` at creation. `change` is a `ColorChange` of ThemeStore; it defaults to running the change at once.
- the mark → the attribute `data-look` on `root`, with the name of the active look.
- `toggle()` → `vexel` becomes `windows11`, `windows11` becomes `vexel`, at once (`getSnapshot`). The new look is saved in `storage` under `LOOK_KEY`. Then, through `change`, the mark takes the active look and the `subscribe` listeners are called.
  - several toggles before `change` runs them → each one marks the active look, so the page ends on the last one.
  - `storage` missing, or `setItem` throws → the look still changes on the page and the listeners are called.
- `subscribe(listener) → unsubscribe` → `listener()` after each change of the look.
- `getSnapshot()` → the active look.
- `pageLookStore()` → the one store of the page, created at the first call. Root `document.documentElement`, storage `localStorage`, change ColorDissolve: each look change after the first paint dissolves.
  - initial look → the `data-look` mark already on the root (set by WebEntry before the first paint) when it is valid; else `START_LOOK`.
- `useLook(store = pageLookStore()) → { look, toggleLook }` → React hook. The component re-renders after each change.

## Rules and invariants

- A change of look only moves the mark. It does not reload the page, remount the page or touch any connection.
- The saved value is exactly `vexel` or `windows11`. The backend stores nothing.
- WebEntry reads the same key with the same validity rule. The two change together.
- The look does not depend on the theme: the two combine freely.

## Dependencies

- Windows11Look (the styles that read the mark), WebEntry (sets the first mark), ColorDissolve (the change of the page store)

## Requirements served

- `plan-wsl_support/REQ-16`, `plan-wsl_support/REQ-20`, `plan-wsl_support/REQ-21`, `plan-wsl_support/REQ-22`, `plan-wsl_support/REQ-24`
- `plan-ui_transitions/REQ-14`
