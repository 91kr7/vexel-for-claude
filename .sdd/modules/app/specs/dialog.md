---
module: app
component: Dialog
type: UI component
---

# Dialog

**Purpose** → the shared modal frame of every dialog, drawn as board "Dialoghi": icon, title, description, content, "Annulla" and one primary action, with Enter and Esc.

## Contract

Description:
- a modal over the whole page and the terminal. From top to bottom: the icon, the centred title and description, the caller's content, and one action row on the right: "Annulla" first, then the primary action.

Props:
- `title` → the heading. It is the accessible name of the dialog.
- `description` → optional text or markup under the title. It is the accessible description of the dialog.
- `icon` → optional decorative icon on top.
- `children` → the content between the title and the action row.
- `primaryLabel`, `onPrimary()` → the primary action.
- `primaryDisabled` → the primary action is disabled. Default `false`.
- `primaryBusy` → the primary action runs: its button shows the Spinner (ProgressIndicator), is disabled and has `aria-busy="true"`. Its name does not change. Default `false`.
- `onCancel()` → called by "Annulla" and by Esc.
- `initialFocus` → `dialog` (default) or `cancel`.
- `formName` → optional accessible name of the form that holds the content and the action row.
- `className` → extra class of the modal.
- `tone` → `default` or `warning`. Warning dialogs use WarningDialog.
- `accent` → `error` (default) or `attn`. The colour of a `warning` tone. No effect on the `default` tone.

Shows (board `role="dialog"` frame; sizes in px):
- the scrim → the whole page under the dialog, black at 32 % (`--color-backdrop`), both themes. The dialog sits centred in it, with 48 px above and below and 24 px at the sides.
- the frame → up to 520 wide and as tall as the scrim allows, 28 radius, `--dialog` background, padding 24, shadow `0 8px 24px` black at 25 % (`--shadow-modal`). Its parts are in one column with a 16 gap.
- the icon (`default` tone) → 24, `--primary`, centred.
- the title → `.headline-s` at weight 400, centred, 8 below it. The description → `.body-m`, `--on-surface-variant`, centred.
- the action row → right-aligned, 8 gap, 8 above it. Both buttons are `.btn` `.label-l` with padding 0 24:
  - "Annulla" → text button in `--primary`, transparent.
  - primary, `default` tone → `button-primary`: `--primary` background, `--on-primary` text.
- a keyboard focus on an action button → a 3 px `--primary` ring, 2 px away.
- `tone` `default` → role `dialog`. `tone` `warning` → role `alertdialog`, see WarningDialog.
- `aria-modal="true"`.

Keyboard:
- Esc → `onCancel()`. Nothing else happens.
- Enter, focus on a button → that button acts. The dialog adds nothing.
- Enter, focus anywhere else in the dialog → `onPrimary()`, unless the primary action is disabled or busy. A content element that handles Enter itself (prevents its default) keeps it.
- Tab and Shift+Tab → move among the dialog elements only, and wrap from the last to the first and back. A radio group counts as one stop: its checked radio, or any of its radios when none is checked.

Focus:
- on open → `cancel` focuses "Annulla". `dialog` keeps the focus on a content element that takes it on mount (e.g. `autoFocus`); otherwise it focuses the dialog itself.
- a click on the scrim does not move the focus out of the dialog.
- on close → the focus goes back to the element that had it before the dialog opened, if that element is still on the page.

## Rules and invariants

- Stacked dialogs → Esc and Enter act on the dialog that holds the focus, which is the top one. The dialog below stays open.
- The dialog never submits a page form. It sends no request on its own.
- A frame taller than the scrim allows does not grow past it. The caller's content decides what scrolls.

## Dependencies

- IconSet (`TriangleAlertIcon`, warning tone without `icon`)
- ProgressIndicator (`Spinner`)
- ThemeTokens, WebEntry (type and button classes)

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-25`, `plan-claude_sessions_client-ui_redesign/REQ-26`, `plan-claude_sessions_client-ui_redesign/REQ-27`
- `plan-claude_sessions_client-ui_redesign/REQ-1`, `plan-claude_sessions_client-ui_redesign/REQ-4`, `plan-claude_sessions_client-ui_redesign/REQ-5`, `plan-claude_sessions_client-ui_redesign/REQ-31`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-44`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-49`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-51`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-52`
