---
module: app
component: useShortcutKeys
type: frontend hook
---

# useShortcutKeys

**Purpose** → the page-level key handler: it turns a key of the ShortcutMap into its command.

## Contract

- `useShortcutKeys(run)` → while the calling component is mounted, one `keydown` listener on the window, in the capture phase. `run(command)` is the latest function passed.
- a `keydown` whose `shortcutCommandOf` gives a command, with no dialog open:
  - `run(command)` is called once;
  - the browser default is cancelled (`preventDefault`), e.g. the Chromium Alt+1 tab switch and the Alt+E menu;
  - the event stops (`stopPropagation`): the focused element, the terminal included, never gets it.
- a dialog is open (an element with `aria-modal="true"` is on the page) → no command runs. The event is not cancelled and not stopped, so the dialog keeps its keys.
- exception: every open dialog is the ShortcutsPanel (class `shortcuts-panel`) and the key gives `toggle-shortcuts-panel` → it runs, cancelled and stopped, as with no dialog. Any other key stays blocked.
- any other key → passes untouched: no command, no `preventDefault`, no stop. This holds for the editing keys of a text field.
- a map key acts also inside a text field.
- unmount → the listener goes.

## Rules and invariants

- the command runs in the same event: no timer, no wait.
- the browser client and the desktop window behave the same.

## Dependencies

- ShortcutMap
- ShortcutsPanel (its class marks the panel)

## Requirements served

- `plan-keyboard_shortcuts/REQ-25`, `plan-keyboard_shortcuts/REQ-29`
- `plan-keyboard_shortcuts/REQ-38`, `plan-keyboard_shortcuts/REQ-39`, `plan-keyboard_shortcuts/REQ-40`, `plan-keyboard_shortcuts/REQ-41`, `plan-keyboard_shortcuts/REQ-42`, `plan-keyboard_shortcuts/REQ-45`, `plan-keyboard_shortcuts/REQ-46`
