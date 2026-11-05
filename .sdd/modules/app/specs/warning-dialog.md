---
module: app
component: WarningDialog
type: UI component
---

# WarningDialog

**Purpose** → the Dialog frame for a risky action. It looks different from the other dialogs.

## Contract

Props:
- the same as Dialog, except `tone` and `initialFocus`.

Shows:
- role `alertdialog`, `aria-modal="true"`.
- a warning icon before the title, in the warning colour.
- a top border in the warning colour.
- the primary button with the danger style (`button-danger`).

Focus:
- on open → "Annulla". So Enter cancels until the user moves the focus.

## Rules and invariants

- It opens above the other dialogs.
- Everything else (Enter, Esc, focus trap, focus return) is the Dialog contract.

## Dependencies

- Dialog

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-28`
