---
request_slug: popup_glass
date: 2026-11-20
type: new
size: narrow
reference: none
---

# Popup glass effect and termination popup margins

## Request

> voglio che tutti i popup abbiano un blur da 8px ed una trasparenza del 60% vanno inoltre fixati i margini del seguente popup!!! [Image #1]

Human clarifications (the image did not reach the session):
- The popup with wrong margins is the session termination popup. This is the confirmation shown when the user terminates a session that is still working.
- "trasparenza del 60%" means the popup background is 60% opaque (40% see-through).
- "tutti i popup" means everything that floats over the page: dialogs, popovers, menus and tooltips.

## Summary

Every floating surface gets a see-through background (60% opaque) that blurs by 8px what lies behind it. The session termination popup gets correct margins.

## Requirements

Functional
- Every dialog, popover, menu and tooltip must have a background at 60% opacity.
- Every one of them must blur the content behind its own surface with an 8px blur.
- Snackbars, toasts and the newer-version notice must follow the same rule, because they float over the page.
- The effect must apply in every theme of the app.
- Text, icons, borders and controls inside a popup must stay fully opaque. Only the background is see-through.
- The text in a popup must stay readable over any content behind it, including a busy terminal.
- The session termination popup must have the same inner spacing as the other dialogs: header, body and footer away from the edges, and even gaps between them.
- No text or button of the session termination popup may touch or cross its border.

Non-functional
- Opening, scrolling and closing a popup must not feel slower than today.
- The current enter and leave effects of the popups must keep working.

## Assumptions

- The 8px blur is on the popup surface (frosted glass). The dim layer behind a dialog keeps no blur, by the human's decision of 2026-11-06 (see Constraints).
- Without the image, "fix the margins" means: align the termination popup with the spacing of the other dialogs.
- Confirmations that reuse the style of the termination popup (for example "Terminate" in the Processes section) get the same margin fix.
- Where the system cannot render the blur, the popup keeps the 60% background and stays readable. No other fallback is needed.
- The dim level of the dialog backdrop does not change.

## Constraints

- On 2026-11-06 the human removed the blur from the dialog backdrop, because it made dialogs scroll slowly (`claude_sessions_client-ui_redesign-material3_mock-studio_dark.md`). The new blur must not bring that slowness back.
- A change made for WSL must not break the app on Ubuntu (knowledge base `wsl-keeps-ubuntu-working`).

## Risks

- A blurred surface can bring back the scroll slowness that led to the 2026-11-06 decision, mostly in long dialogs and in the desktop app.
- At 60% opacity, the text of small popups such as tooltips and menus can lose contrast over bright or busy content, mostly in the light theme.

## Scope

In scope
- Background opacity and blur of all dialogs, popovers, menus, tooltips, snackbars, toasts and the newer-version notice.
- The margins of the session termination popup and of the confirmations that share its style.

Out of scope
- Native operating system menus, the tray menu and native browser tooltips. The app does not draw them.
- The dialog backdrop (its dim level and its lack of blur).
- Other changes to popup layout, content, size or animation.
- A user setting to turn the effect off.
