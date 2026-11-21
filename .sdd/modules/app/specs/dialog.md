---
module: app
component: Dialog
type: UI component
---

# Dialog

**Purpose** → the shared modal frame of every dialog: header with "[Esc]", body, footer with "Cancel" and one primary action, Enter and Esc. It copies `#modal-new-session` of `.sdd/mockups/studio-dark/mock.html`.

## Contract

Props:
- `title` → the heading. It is the accessible name of the dialog.
- `description` → optional text or markup at the top of the body. It is the accessible description of the dialog.
- `children` → the content under the description.
- `primaryLabel`, `onPrimary()` → the primary action. Optional: without them the dialog has no primary action.
- `primaryDisabled` → the primary action is disabled. Default `false`.
- `primaryBusy` → the primary action runs: its button shows the Spinner (ProgressIndicator), is disabled and has `aria-busy="true"`. Its name does not change. Default `false`.
- `onCancel()` → called by "Cancel" (or "Close"), by "[Esc]" and by the Esc key.
- `initialFocus` → `dialog` (default) or `cancel` (the "Cancel" or "Close" button).
- `formName` → optional accessible name of the form that holds the body and the footer.
- `className` → extra class of the frame.
- `tone` → `default` or `warning`. Warning dialogs use WarningDialog.
- `accent` → `error` (default) or `attn`. The colour of a `warning` tone. No effect on the `default` tone.

Shows (sizes in px):
- the backdrop → the whole page, dimmed by `--color-backdrop` (black at 65 %; in Light a slate tint, `#0f172a` at 20 %), no blur, padding 16. In Light the light dim keeps the 60 % frame a light surface close to the page canvas, not grey (Gatekeeper decision, 2026-11-20, on the human's request). The frame sits centred in it.
- the frame → `.vx-popup-glass` (the raised surface at 60 %, the page behind it blurred by 8) with a 1 `--role-border-strong` border, `--radius-frame`, top line and `--shadow-frame`, full width up to 448, as tall as the backdrop allows. No icon.
- the header → no fill of its own (the frame glass shows), padding 12 × 16, 1 `--role-border-subtle` line below. From the left: an 8 accent dot (decorative), the title (14/20, weight 600), and on the right the button "[Esc]" (mono 12/16, `--text-muted`, `--text-primary` on hover).
- the body → padding 16, items 14 apart, text 12/16. The description first, in `--text-secondary`; bold parts in `--text-primary`.
- the footer → no fill of its own (the frame glass shows), 1 `--role-border-subtle` line above, padding 12 × 16, buttons on the right, 8 apart: "Cancel" (`.button-neutral`), then the primary action. `default` tone → `.button-primary`. No primary action → one button "Close" (`.button-neutral`) in place of "Cancel".
- `tone` `default` → role `dialog`. `tone` `warning` → role `alertdialog`, see WarningDialog.
- `aria-modal="true"`.

Motion (MotionTokens):
- on open → the backdrop dim fades in and the frame follows 40 ms later: it rises 6 px and grows from 95 % on the spring curve, while its fade ends in 150 ms. The focus rules apply from the first frame of the effect: Esc and Enter work at once.
- leaving (`useLeaving()` of ExitPresence is `true`) → the reverse: the frame zooms out slightly while the backdrop dim fades out. The leaving dialog:
  - takes no pointer input: clicks reach the page below;
  - ignores keys and traps no focus;
  - has no `aria-modal` and is hidden from assistive technologies (`aria-hidden`), so the page shortcuts work at once;
  - gives the focus back at once, as on close. Its final removal does not move the focus again.
- reduced motion → no fade and no zoom.

Keyboard:
- Esc → `onCancel()`. Nothing else happens.
- Enter, focus on a button → that button acts. The dialog adds nothing.
- Enter, focus anywhere else in the dialog → `onPrimary()`, unless the primary action is disabled or busy. No primary action → Enter adds nothing. A content element that handles Enter itself (prevents its default) keeps it.
- Tab and Shift+Tab → move among the dialog elements only, "[Esc]" included, and wrap from the last to the first and back. A radio group counts as one stop: its checked radio, or any of its radios when none is checked.

Actions:
- "[Esc]" → `onCancel()`, as "Cancel". Its accessible name is "Close (Esc)".

Focus:
- on open → `cancel` focuses "Cancel". `dialog` keeps the focus on a content element that takes it on mount (e.g. `autoFocus`); otherwise it focuses the dialog itself.
- a click on the backdrop does not move the focus out of the dialog.
- on close, or when it starts to leave → the focus goes back to the element that had it before the dialog opened, if that element is still on the page.

## Rules and invariants

- Mount → the dialog sits at the end of the page body, wherever the caller renders it. No text, spacing or layout style of the caller reaches it: the header, body and footer spacing above holds in every dialog, nested ones included (e.g. inside Settings), and the backdrop always covers the whole window. Long text wraps inside the body; no text or button crosses the frame border.
- Stacked dialogs → Esc and Enter act on the dialog that holds the focus, which is the top one. The dialog below stays open.
- The dialog never submits a page form. It sends no request on its own.
- The frame blur always reaches the page behind the backdrop, during the open and leave effects too: the backdrop fades its dim, never its opacity.
- A backdrop blur inside the frame (the sticky folder headings of ResumeDialog) also sees the page behind the frame, once the open effect ends. So a transparent element with a blur looks like the frame at rest and blurs only what scrolls under it. Gatekeeper decision, 2026-11-20, on the human's request: the glass, border and top line are one layer behind the content, with the same look as before.
- Text, icons, borders, accent buttons and banners inside the frame stay fully opaque. In Light, cards, rows, fields and neutral buttons take the soft tint `--popup-inner-fill` (white at 50 %) in place of solid white (Gatekeeper decision, 2026-11-20, on the human's request; for these elements in Light it supersedes `plan-popup_glass/REQ-5`).
- A frame taller than the backdrop allows does not grow past it. The caller's content decides what scrolls.
- Desktop window: the frame is never a drag area (`-webkit-app-region: no-drag`), also over the TopBar. The backdrop sets no drag value, so the TopBar drag area outside the frame still moves the window.
- Desktop window: the WindowButtons stay above the backdrop, visible and clickable. They are outside the dialog: Tab never reaches them, and a click on them leaves the focus in the dialog.

## Dependencies

- IconSet (`TriangleAlertIcon`, `attn` warning)
- ProgressIndicator (`Spinner`)
- ThemeTokens, WebEntry (surface and button classes)
- MotionTokens, ExitPresence (`useLeaving`)

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-25`, `plan-claude_sessions_client-ui_redesign/REQ-26`, `plan-claude_sessions_client-ui_redesign/REQ-27`, `plan-claude_sessions_client-ui_redesign/REQ-31`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-52`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-43`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-44`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-45`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-47`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-52`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-4`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-9`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-13`
- `plan-mac_title_bar/REQ-8`, `plan-mac_title_bar/REQ-11`, `plan-mac_title_bar/REQ-24`
- `plan-keyboard_shortcuts/REQ-29`, `plan-keyboard_shortcuts/REQ-30`, `plan-keyboard_shortcuts/REQ-33`
- `plan-dark_blue_theme/REQ-3`
- `plan-ui_transitions/REQ-1`, `plan-ui_transitions/REQ-2`, `plan-ui_transitions/REQ-26`, `plan-ui_transitions/REQ-27`
- `plan-popup_glass/REQ-1`, `plan-popup_glass/REQ-2`, `plan-popup_glass/REQ-5`, `plan-popup_glass/REQ-8`, `plan-popup_glass/REQ-9`, `plan-popup_glass/REQ-10`, `plan-popup_glass/REQ-11`, `plan-popup_glass/REQ-12`, `plan-popup_glass/REQ-13`
- `plan-cool_slate_light/REQ-1`, `plan-cool_slate_light/REQ-11`
