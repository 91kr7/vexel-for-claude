---
module: app
component: ReservedKeys
type: configuration
---

# ReservedKeys

**Purpose** → the key combinations that Claude Code, the desktop and the browser use, each with its owner. A shortcut can never take them.

## Contract

- `reservedKeyOwner(press) → 'Claude Code' | 'the desktop' | 'the browser' | null` → the owner of a press, or `null` when no one owns it. `press` is a KeyPress of the ShortcutMap.
- "alone" below → exactly the modifiers named, no other one, Meta included. Every listed combination is without Meta, so any Meta press belongs to the desktop. The owners are checked in this order; the first one that has the combination is returned.

  | Owner | Combinations |
  |-------|--------------|
  | Claude Code | Ctrl + any letter, alone. Alt + B, D, F, O, P, T, Y, M or V, alone. Ctrl+Enter. Ctrl+Shift+- (`Minus`) |
  | the desktop | Any press with Meta (Super). Alt+Tab, Alt+Shift+Tab, Alt+F1, Alt+F2, Alt+F4, Alt+F7, Alt+F8, Alt+F10, Alt+Space. Ctrl+Alt + any arrow, also with Shift. Ctrl+Alt+T, Ctrl+Alt+Delete |
  | the browser | Ctrl+Shift+T, Ctrl+Shift+N, Ctrl+Shift+W, Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+PageUp, Ctrl+PageDown |

- the keys are physical keys (`code`): Ctrl+T is `KeyT` on every layout.
- e.g. Ctrl+T, Ctrl+W, Ctrl+N → Claude Code, not the browser, by the order above.

## Requirements served

- `plan-settings_dialog/REQ-29`
