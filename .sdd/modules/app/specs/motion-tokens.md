---
module: app
component: MotionTokens
type: configuration
---

# MotionTokens

**Purpose** → the shared durations and easing of every UI transition, the same in every theme and look.

## Contract

- `--motion-duration-enter` → 300 ms, the opening effect of an element.
- `--motion-duration-exit` → 200 ms, the closing effect of an element. ExitPresence reads it to know how long a closed element stays on screen.
- `--motion-cascade-max` → 600 ms, the whole cascade of a list.
- `--motion-ease-enter` → a soft deceleration that spreads the motion over the whole duration (no jump in the first frames).
- `--motion-ease-exit` → a soft acceleration over the whole duration, the pair of the enter curve.
- with `prefers-reduced-motion: reduce` → the three durations are 0 ms, so every effect that uses them ends at once. A change of the system setting applies at once, with no reload.

## Rules and invariants

- Every effect lasts at most 300 ms; a whole cascade ends within 600 ms, so the last item of a cascade waits at most 300 ms (ListCascade).
- No theme (Light, Dark, Dark Blue) and no look (current, Windows 11) sets these tokens.
- Every new transition takes its duration and easing from these tokens.

## Dependencies

- WebEntry (loads the tokens and holds the reduced-motion rule)

## Requirements served

- `plan-ui_transitions/REQ-22`, `plan-ui_transitions/REQ-25`, `plan-ui_transitions/REQ-30`, `plan-ui_transitions/REQ-31`, `plan-ui_transitions/REQ-32`
