---
module: app
component: WarningDialog
type: UI component
---

# WarningDialog

**Purpose** → the Dialog frame for a risky action, drawn as the stop confirmation of board "Dialoghi".

## Contract

Props:
- the same as Dialog, except `tone` and `initialFocus`.
- `accent` → `error` (default) or `attn` (amber).
- `icon` → the icon in the circle. Default `TriangleAlertIcon`.

Shows (board `role="alertdialog"` frame; sizes in px):
- role `alertdialog`, `aria-modal="true"`.
- the Dialog frame, up to 360 wide.
- the icon → 24, centred in a 48 circle on top:
  - `error` → `--error-container` circle, `--on-error-container` icon.
  - `attn` → `--attn-container` circle, `--on-attn-container` icon.
- the title with 12 below it.
- the primary button → a transparent text button with the class `button-danger`: `--error` text (`error`) or `--attn` text (`attn`).
- "Annulla" → the Dialog text button in `--primary`. While it has the focus, it shows the 3 px `--primary` ring 2 px away, whatever moved the focus there.

Focus:
- on open → "Annulla". So Enter cancels until the user moves the focus.

## Rules and invariants

- It opens above the other dialogs.
- Everything else (Enter, Esc, focus trap, focus return, scrim) is the Dialog contract.

## Dependencies

- Dialog
- IconSet (`TriangleAlertIcon`), ThemeTokens

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-28`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-47`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-48`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-50`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-51`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-52`
