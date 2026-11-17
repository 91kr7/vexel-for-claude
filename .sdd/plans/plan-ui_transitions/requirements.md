---
slug: ui_transitions
date: 2026-11-17
spec: .sdd/analysis/ui_transitions.md
status: validated
---

# Requirements — UI transitions

Words used below, as in the spec:

- "Effect" → one of the new animated transitions of this plan. "Existing effects" are the ones the app already has, such as the star "pop" and the status-dot pulse.
- "Reduced motion" → the system setting that asks apps for less motion.
- "Main area" → the area that shows the selected session: its terminal or its conversation.

## Feature: Modal dialogs

| ID | Requirement |
|----|-------------|
| REQ-1 | When any modal dialog opens (Settings, Resume session, New session, Session name or a Warning dialog), its backdrop fades in and its box enters with a slight zoom. |
| REQ-2 | When one of these dialogs closes, the reverse effect plays: the box zooms out slightly and the backdrop fades out. |

Human decision (2026-11-17): the effect covers every modal dialog, the New session dialog included.

## Feature: Popovers, snackbar, toasts

| ID | Requirement |
|----|-------------|
| REQ-3 | The Plan Usage popover, the "needs input" snackbar, the short-message toast and the newer-version notice enter by sliding up from the bottom with a fade. |
| REQ-4 | The same elements leave with the reverse effect: they slide down and fade out. |

## Feature: Git Explorer panel

| ID | Requirement |
|----|-------------|
| REQ-5 | When the Git Explorer panel opens, it slides in from its side of the window. |
| REQ-6 | When the Git Explorer panel closes, it slides out to its side of the window. |

## Feature: Session list panel (removed)

Removed by human decision (2026-11-17): the app has no collapse or expand of the session list panel. The ids stay unused, so existing references keep their meaning.

| ID | Requirement |
|----|-------------|
| REQ-7 | Removed by human decision. |
| REQ-8 | Removed by human decision. |
| REQ-9 | Removed by human decision. |

## Feature: Session switch

| ID | Requirement |
|----|-------------|
| REQ-10 | When the user selects another session, the main area changes with a cross-fade. |
| REQ-11 | After the selection, the main area shows only the content of the selected session; the content of two sessions never stays mixed. |
| REQ-12 | The terminals of both sessions keep their content, scroll position and typed input across the cross-fade. |
| REQ-13 | When the cross-fade ends, the terminal of the selected session shows the correct layout for its size. |

## Feature: Theme change

| ID | Requirement |
|----|-------------|
| REQ-14 | When the user changes the theme or the window look, the colours of the app change with a colour dissolve. |
| REQ-15 | The terminal colours change with the same transition, and no area stays in the old theme after it ends. |

## Feature: Cascading lists

| ID | Requirement |
|----|-------------|
| REQ-16 | When the session list first appears, its items enter in sequence. |
| REQ-17 | When the project list first appears, its items enter in sequence. |
| REQ-18 | A new session slides into the session list. |
| REQ-19 | A removed session fades out of the session list. |
| REQ-20 | The cascade does not play again when a list refreshes with the same items. |
| REQ-21 | The cascade does not play when the user changes the sort, filter or search of a list; the items update at once, except new and removed sessions. |
| REQ-22 | The whole cascade of a list ends within a fixed time limit that does not grow with the number of items. |

## Feature: Tab change

| ID | Requirement |
|----|-------------|
| REQ-23 | When the user switches between the Changes and History tabs of the Git Explorer, the content changes with a fade and a small slide. |
| REQ-24 | When the user switches between the sections of the Settings dialog, the content changes with a fade and a small slide. |

## Feature: Common rules of the effects

These REQs apply to every effect above.

| ID | Requirement |
|----|-------------|
| REQ-25 | When the system asks for reduced motion, every new effect is off and each change happens at once. |
| REQ-26 | An effect never blocks input: the user can click, type and use keyboard shortcuts while it plays. |
| REQ-27 | A dialog, popover or panel takes the focus and accepts keys, such as Escape, from the start of its opening effect. |
| REQ-28 | An action that interrupts an effect wins: the UI ends in the state of the last action. |
| REQ-29 | A dialog or panel that is already open when the app starts, such as a restored Git Explorer, appears without its opening effect. |
| REQ-30 | The existing effects keep working as today. |
| REQ-31 | Every new effect lasts at most 300 ms; the cascade of a whole list (REQ-22) ends within 600 ms. |
| REQ-32 | The effects look the same in every theme and window look. |

## Assumptions

- **Durations (REQ-22, REQ-31).** 300 ms per effect and 600 ms for a whole cascade. Gatekeeper decision: both are inside the spec's "a few hundred milliseconds at most" (Non-functional).
- **Session list (REQ-18, REQ-19).** The slide-in and fade-out apply to every entry of the session list, external sessions included. Gatekeeper decision: spec requirement 7 names "the items of the session list" with no exclusion.
- **Theme change (REQ-14).** The dissolve plays for any theme or look change made while the app is open, never on the first paint at app start. Gatekeeper decision: derived from spec requirement 6 and the spec assumption on what appears at app start.
- **Sections of Settings (REQ-24).** They are the navigation entries inside the Settings dialog (spec assumption).
- **Reduced motion (REQ-25).** It follows the rule the app already uses for its existing effects.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- The UI offers no new option to turn the effects off or to choose their speed (human decision).
- The effects stay smooth on every supported platform, WSL included. A change made for WSL never breaks the app on Ubuntu.
- Out of scope: any width animation of the session list panel (human decision); effects on surfaces not named above (hover effects, title bar), changes to the existing effects, any change to the behaviour of the app other than how its changes are animated.
