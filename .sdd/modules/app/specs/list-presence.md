---
module: app
component: ListPresence
type: frontend hook
---

# ListPresence

**Purpose** → the items of a list with their motion phase: items added after the first appearance enter, removed items stay while they play their exit.

## Contract

- `useListPresence(items, keyOf) → { key, item, phase }[]`
  - `items` → the current items, or `undefined` while the list is not shown (e.g. loading): then the result is empty.
  - `phase` → `shown`, `entering` or `leaving`.
- first defined `items` (the appearance) → every item `shown`.
- an item whose key was not in the previous items → `entering` for `--motion-duration-enter`, then `shown`.
- an item whose key leaves the items → it stays in the result as `leaving`, with its last value, near its previous position, for `--motion-duration-exit`; then it is gone.
- a key that comes back while `leaving` → `entering` again, with its new value. The UI ends in the state of the last action.
- an item that stays → keeps its phase and gets its new value. A new order or a new value starts nothing.
- duration 0 (reduced motion) or not set (no style sheet) → no `entering` and no `leaving`: removed items are gone at once.

## Dependencies

- MotionTokens, ExitPresence (`motionDurationMs`)

## Requirements served

- `plan-ui_transitions/REQ-18`, `plan-ui_transitions/REQ-19`, `plan-ui_transitions/REQ-20`
