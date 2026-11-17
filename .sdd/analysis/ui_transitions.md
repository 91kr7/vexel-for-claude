---
request_slug: ui_transitions
date: 2026-11-17
type: new
size: ordinary
reference: none
---

# UI transitions

## Request

"puoi modificarmi l'app aggiungendo qualche effetto di transizione figo? magari fammi prima un elenco di quelli che puoi fare"

## Summary

Add animated transitions to seven areas of the app, so that elements that appear, disappear or change move smoothly instead of snapping.
The human saw a list of candidate effects and chose seven. The effects are off when the system asks for reduced motion.

## Business goal

The app must feel more polished and modern. Transitions also show the user where an element comes from and where it goes.
The app must not become slower to use: an effect is decoration, never a wait.

## Requirements

### Functional (human decisions)

1. **Modal dialogs.** On open, the backdrop must fade in and the box must enter with a slight zoom. On close, the reverse must play. This covers every modal dialog of the app, for example Settings, New session (folder chooser), Resume session, Session name and the Warning dialogs.
2. **Popovers, snackbar, toasts.** They must enter by sliding up from the bottom with a fade, and leave with the reverse. This covers the Plan Usage popover, the "needs input" snackbar, the short-message toast and the newer-version notice.
3. **Git Explorer panel.** It must slide in from its side on open and slide out on close.
4. **Session switch.** When the user selects another session, the main area (terminal or conversation) must change with a cross-fade.
5. **Theme change.** When the user changes the theme or the window look, the colours must change with a colour dissolve. The human rejected the variant where the new theme expands as a circle from the click point.
6. **Cascading lists.** The items of the session list and of the project list must enter in sequence. A new session must slide in. A removed session must fade out.
7. **Tab change.** When the user switches between the Changes and History tabs of the Git Explorer, or between the sections of Settings, the content must change with a fade and a small slide.

### Functional (behaviour around the effects)

- When the system asks for reduced motion, every new effect must be off and each change must happen at once. This follows the rule the app already uses for its existing effects.
- The UI must not offer a new option to turn the effects off (human decision).
- An effect must never block input: the user can click, type and use keyboard shortcuts while it plays.
- A dialog, popover or panel must take focus and accept keys (for example Escape) from the start of its opening effect.
- An action that interrupts an effect must win. For example, closing a dialog while it opens, or selecting a third session during a cross-fade, must end in the state of the last action.
- After the user selects a session, the main area must show that session's content only. The content of two sessions must never stay mixed.
- The terminal must keep its content, scroll position and input during the session cross-fade. It must show the correct layout when the cross-fade ends.
- The cascade must play when a list first appears. It must not play again when the list refreshes with the same items.
- On a long list, the whole cascade must end in a short time, so the last items do not appear late.
- The theme transition must also change the terminal colours. No area may stay in the old theme after the transition ends.
- The existing effects (for example the star "pop" and the status-dot pulse) must keep working as today.

### Non-functional

- Every effect must be short. Dialogs, popovers, tabs and the cross-fade must feel immediate, in the order of a few hundred milliseconds at most.
- The effects must look the same in every theme and window look.
- The effects must stay smooth on the platforms the app supports, including WSL.

## Assumptions

- "Sections of Settings" means the navigation entries inside the Settings dialog.
- A dialog or panel that opens on app start (for example a restored Git Explorer) appears without its opening effect.
- The cascade does not replay when the user only changes the sort, filter or search of a list. The items then update without animation, apart from new and removed sessions.

## Risks

- The session cross-fade touches the terminal. A wrong solution can cause flicker, a wrong layout or many resizes of the running session.
- Lists that refresh often can look restless if the cascade or the enter/exit effects replay on each refresh.
- Effects that are too long make the app feel slower, which is the opposite of the goal.
- Existing automated tests can fail if they act on an element while it is still animating.

## Scope

**In scope**
- The seven effects above, on the surfaces named for each.
- Reduced-motion support for all of them.

**Out of scope**
- A setting or menu entry to turn effects off or to choose their speed.
- New effects on surfaces not named above (for example hover effects or the title bar).
- Changes to the existing effects.
- Any change to the behaviour of the app other than how its changes are animated.
