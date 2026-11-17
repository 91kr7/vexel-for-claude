---
module: app
component: ColorDissolve
type: frontend function
---

# ColorDissolve

**Purpose** → runs a theme or look change as a cross-fade of the whole page, from the old colours to the new ones.

## Contract

- `dissolveColors(apply)` → `apply` is the change of the page colours (the mark on the root and what follows it).
  - the browser has view transitions and motion is on → the page cross-fades from a picture of the old colours to the live page in the new colours, over `--motion-duration-enter` with `--motion-ease-enter`. `apply` runs after the old picture is taken.
  - reduced motion (`--motion-duration-enter` is 0) → `apply` runs at once, no cross-fade.
  - no view transitions, or no page → `apply` runs at once.
  - a new call during a dissolve → the running dissolve ends at once and the new one starts; every `apply` still runs, in call order.
- Effect on the whole page: every area takes part, the terminal and the commit graph included. The new picture is taken one frame after `apply` (at most 100 ms later), so the areas that recolour after the change (terminal, commit graph) are already in the new colours.
- The cross-fade never takes input: keys and shortcuts work as usual.
  - a press of the pointer during the dissolve → the dissolve ends at once, in the new colours, and the press (down, up, click) reaches the element under the pointer, which also takes the focus when it can.
- It does not throw and leaves no failed promise when a newer change cuts it short.

## Rules and invariants

- At the end no area keeps an old colour: the page shown is the live page.
- The dissolve looks the same in every theme and look: its duration and easing are the motion tokens.

## Dependencies

- MotionTokens (duration and easing), ExitPresence (`motionDurationMs`)

## Requirements served

- `plan-ui_transitions/REQ-14`, `plan-ui_transitions/REQ-15`, `plan-ui_transitions/REQ-25`, `plan-ui_transitions/REQ-26`, `plan-ui_transitions/REQ-28`, `plan-ui_transitions/REQ-32`
