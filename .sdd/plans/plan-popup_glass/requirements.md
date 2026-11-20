---
slug: popup_glass
date: 2026-11-20
spec: .sdd/analysis/popup_glass.md
status: validated
---

# Requirements — Popup glass effect and termination popup margins

Words used below, as in the spec:

- "Popup" → any surface the app draws over the page: dialogs, popovers, menus, tooltips, snackbars, toasts and the newer-version notice. Native OS menus, the tray menu and native browser tooltips are not popups here.
- "Termination popup" → the confirmation shown when the user terminates a session that is still working.

## Feature: Glass popups

| ID | Requirement |
|----|-------------|
| REQ-1 | Every dialog, popover, menu and tooltip has a background at 60% opacity. |
| REQ-2 | Every dialog, popover, menu and tooltip blurs the content behind its own surface with an 8px blur. |
| REQ-3 | Snackbars, toasts and the newer-version notice have the same 60% background and 8px blur. |
| REQ-4 | The 60% background and the 8px blur apply in every theme of the app. |
| REQ-5 | Text, icons, borders and controls inside a popup stay fully opaque; only the background is see-through. |
| REQ-6 | Over any content, a busy terminal included, the text in a popup keeps the theme's text colour and the content right behind it shows blurred, never sharp. |
| REQ-7 | Where the system cannot render the blur, a popup keeps its 60% background and stays readable. |
| REQ-8 | The dialog backdrop keeps its current dim level and has no blur. |
| REQ-9 | Opening, scrolling and closing a popup is not slower than today, in the browser and in the desktop app. |
| REQ-10 | The current enter and leave effects of the popups keep working. |

## Feature: Termination popup margins

| ID | Requirement |
|----|-------------|
| REQ-11 | The termination popup has the same inner spacing as the other dialogs: header, body and footer away from the edges, with even gaps between them. |
| REQ-12 | No text or button of the termination popup touches or crosses its border. |
| REQ-13 | The confirmations that share the style of the termination popup, such as "Terminate" in the Processes section, get the same spacing as REQ-11 and REQ-12. |

## Assumptions

- **Blur on the surface (REQ-2, REQ-8).** The 8px blur is on the popup surface only. The dialog backdrop stays without blur, by the human's decision of 2026-11-06.
- **Opacity against readability (REQ-1, REQ-6).** REQ-1 wins: every popup stays at exactly 60%, small tooltips in the light theme included. Readability relies on the 8px blur and on the theme's current text colours. Gatekeeper decision: the 60% is exactly what the human asked for.
- **How REQ-9 is judged.** In a human acceptance scenario: open, scroll and close the Settings dialog in the desktop app, with no visible stutter compared to today. Gatekeeper decision.
- **Margins (REQ-11).** The image of the request did not reach the session. "Fix the margins" means: align the termination popup with the spacing of the other dialogs.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- A change made for WSL never breaks the app on Ubuntu.
- Out of scope: other changes to popup layout, content, size or animation; a user setting to turn the effect off.
