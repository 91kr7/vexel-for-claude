---
module: app
component: ListCascade
type: frontend hook
---

# ListCascade

**Purpose** → the cascade rule: the items of a list enter one after the other when the list first appears, and the whole cascade ends within the cascade limit.

## Contract

- `cascadeDelaysMs(count, cascadeMaxMs, enterMs) → number[]` → the enter delay of each item position, in ms.

```
room  = max(0, cascadeMaxMs - enterMs)
step  = min(CASCADE_STEP_MS, room / (count - 1))   when count > 1, else 0
delay = round(index * step)
```

  - `CASCADE_STEP_MS` is 40 ms: a short list keeps a 40 ms step; a long list gets a smaller step, so the last delay plus `enterMs` stays within `cascadeMaxMs`.
  - `enterMs` ≥ `cascadeMaxMs` → every delay is 0.
- `useListCascade(keys) → { cascadeOf(key), endCascade() }`
  - `keys` → the keys of the shown items in their order, or `undefined` while the list is not shown yet (e.g. loading).
  - the first render with `keys` defined is the appearance of the list: each of those keys gets the delay of its position, from `--motion-cascade-max` and `--motion-duration-enter` (MotionTokens).
  - `cascadeOf(key)` → while the cascade plays, for a key of the appearance: `{ className: 'cascade-item', style }` with the custom property `--cascade-delay` set to its delay. Else `undefined`.
  - the class `cascade-item` plays the enter effect (fade and rise, `--motion-duration-enter`) after `--cascade-delay`.
  - the cascade ends after the last delay plus the enter duration: from then on `cascadeOf` gives `undefined` for every key.
  - `endCascade()` → ends the cascade at once.

## Rules and invariants

- The cascade plays once per mount of the owner: later changes of `keys` (refresh, reorder, filter) start nothing.
- A key that was not in the appearance never gets a cascade.
- No cascade when the appearance has no key, with reduced motion (durations 0) or with no style sheet.
- The cascade never blocks input: the items are mounted and take clicks, keys and focus from the first render.

## Dependencies

- MotionTokens, ExitPresence (`motionDurationMs`)

## Requirements served

- `plan-ui_transitions/REQ-16`, `plan-ui_transitions/REQ-17`, `plan-ui_transitions/REQ-20`, `plan-ui_transitions/REQ-22`
