---
module: app
component: WarningDialog
type: UI component
---

# WarningDialog

**Purpose** → the Dialog frame for a risky action: focus on "Cancel", and the primary action in rose or amber.

## Contract

Props:
- the same as Dialog, except `tone` and `initialFocus`.
- `accent` → `error` (default) or `attn` (amber).

Shows:
- role `alertdialog`, `aria-modal="true"`, the Dialog frame with no icon.
- `error` → the description as in Dialog. The primary action is `.button-danger` (rose, look of `#subbar-stop-btn`).
- `attn` → the description sits in a banner with the look of `#permission-banner`: `.vx-surface-2`, 1 px amber-500 border at 40 %, 12 px radius, padding 14 px, `shadow-lg`. Inside: the amber-400 triangle icon (16 px), 10 px gap, the text in weight 500 and `--text-primary`. The primary action is `.button-attn` (amber).
- "Cancel" → `.button-neutral`. While it has the focus, it shows the focus ring, whatever moved the focus there.

Focus:
- on open → "Cancel". So Enter cancels until the user moves the focus.

## Rules and invariants

- It opens above the other dialogs.
- Everything else (Enter, Esc, "[Esc]", focus trap, focus return, backdrop) is the Dialog contract.

## Dependencies

- Dialog
- IconSet (`TriangleAlertIcon`), ThemeTokens, WebEntry

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-28`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-48`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-49`
