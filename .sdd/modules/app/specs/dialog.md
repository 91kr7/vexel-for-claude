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
- `primaryLabel`, `onPrimary()` → the primary action.
- `primaryDisabled` → the primary action is disabled. Default `false`.
- `primaryBusy` → the primary action runs: its button shows the Spinner (ProgressIndicator), is disabled and has `aria-busy="true"`. Its name does not change. Default `false`.
- `onCancel()` → called by "Cancel", by "[Esc]" and by the Esc key.
- `initialFocus` → `dialog` (default) or `cancel`.
- `formName` → optional accessible name of the form that holds the body and the footer.
- `className` → extra class of the frame.
- `tone` → `default` or `warning`. Warning dialogs use WarningDialog.
- `accent` → `error` (default) or `attn`. The colour of a `warning` tone. No effect on the `default` tone.

Shows (sizes in px):
- the backdrop → the whole page, black at 65 % (`--color-backdrop`), no blur, padding 16. The frame sits centred in it.
- the frame → `.vx-surface-2` with a 1 `--border-strong` border, 12 radius, `shadow-2xl`, full width up to 448, as tall as the backdrop allows. No icon.
- the header → padding 12 × 16, 1 `--border-subtle` line below. From the left: an 8 accent dot (decorative), the title (14/20, weight 600), and on the right the button "[Esc]" (mono 12/16, `--text-muted`, `--text-primary` on hover).
- the body → padding 16, items 14 apart, text 12/16. The description first, in `--text-secondary`; bold parts in `--text-primary`.
- the footer → `--bg-surface-1`, 1 `--border-subtle` line above, padding 12 × 16, buttons on the right, 8 apart: "Cancel" (`.button-neutral`), then the primary action. `default` tone → `.button-primary`.
- `tone` `default` → role `dialog`. `tone` `warning` → role `alertdialog`, see WarningDialog.
- `aria-modal="true"`.

Keyboard:
- Esc → `onCancel()`. Nothing else happens.
- Enter, focus on a button → that button acts. The dialog adds nothing.
- Enter, focus anywhere else in the dialog → `onPrimary()`, unless the primary action is disabled or busy. A content element that handles Enter itself (prevents its default) keeps it.
- Tab and Shift+Tab → move among the dialog elements only, "[Esc]" included, and wrap from the last to the first and back. A radio group counts as one stop: its checked radio, or any of its radios when none is checked.

Actions:
- "[Esc]" → `onCancel()`, as "Cancel". Its accessible name is "Close (Esc)".

Focus:
- on open → `cancel` focuses "Cancel". `dialog` keeps the focus on a content element that takes it on mount (e.g. `autoFocus`); otherwise it focuses the dialog itself.
- a click on the backdrop does not move the focus out of the dialog.
- on close → the focus goes back to the element that had it before the dialog opened, if that element is still on the page.

## Rules and invariants

- Stacked dialogs → Esc and Enter act on the dialog that holds the focus, which is the top one. The dialog below stays open.
- The dialog never submits a page form. It sends no request on its own.
- A frame taller than the backdrop allows does not grow past it. The caller's content decides what scrolls.

## Dependencies

- IconSet (`TriangleAlertIcon`, `attn` warning)
- ProgressIndicator (`Spinner`)
- ThemeTokens, WebEntry (surface and button classes)

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-25`, `plan-claude_sessions_client-ui_redesign/REQ-26`, `plan-claude_sessions_client-ui_redesign/REQ-27`, `plan-claude_sessions_client-ui_redesign/REQ-31`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-52`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-43`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-44`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-45`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-47`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-52`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-4`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-9`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-13`
