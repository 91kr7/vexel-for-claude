---
module: app
component: Dialog
type: UI component
---

# Dialog

**Purpose** → the shared modal frame of every dialog: title, content, one primary action and "Annulla", with Enter and Esc.

## Contract

Description:
- a modal over the whole page and the terminal. It holds a title, an optional description, the caller's content, and one action row: "Annulla" first, then the primary action.

Props:
- `title` → the heading. It is the accessible name of the dialog.
- `description` → optional paragraph under the title. It is the accessible description of the dialog.
- `children` → the content between the title and the action row.
- `primaryLabel`, `onPrimary()` → the primary action.
- `primaryDisabled` → the primary action is disabled. Default `false`.
- `onCancel()` → called by "Annulla" and by Esc.
- `initialFocus` → `dialog` (default) or `cancel`.
- `formName` → optional accessible name of the form that holds the content and the action row.
- `className` → extra class of the modal.
- `tone` → `default` or `warning`. Warning dialogs use WarningDialog.

Shows:
- `tone` `default` → role `dialog`, primary button with the primary style (`button-primary`).
- `tone` `warning` → role `alertdialog`, see WarningDialog.
- `aria-modal="true"`.

Keyboard:
- Esc → `onCancel()`. Nothing else happens.
- Enter, focus on a button → that button acts. The dialog adds nothing.
- Enter, focus anywhere else in the dialog → `onPrimary()`, unless the primary action is disabled. A content element that handles Enter itself (prevents its default) keeps it.
- Tab and Shift+Tab → move among the dialog elements only, and wrap from the last to the first and back.

Focus:
- on open → `cancel` focuses "Annulla". `dialog` keeps the focus on a content element that takes it on mount (e.g. `autoFocus`); otherwise it focuses the dialog itself.
- a click on the backdrop does not move the focus out of the dialog.
- on close → the focus goes back to the element that had it before the dialog opened, if that element is still on the page.

## Rules and invariants

- Stacked dialogs → Esc and Enter act on the dialog that holds the focus, which is the top one. The dialog below stays open.
- The dialog never submits a page form. It sends no request on its own.

## Dependencies

- IconSet (`TriangleAlertIcon`, warning tone only)

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-25`, `plan-claude_sessions_client-ui_redesign/REQ-26`, `plan-claude_sessions_client-ui_redesign/REQ-27`
- `plan-claude_sessions_client-ui_redesign/REQ-1`, `plan-claude_sessions_client-ui_redesign/REQ-4`, `plan-claude_sessions_client-ui_redesign/REQ-5`
