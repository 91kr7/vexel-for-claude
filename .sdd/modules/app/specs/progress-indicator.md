---
module: app
component: ProgressIndicator
type: UI component
---

# ProgressIndicator

**Purpose** → the one look of "in progress", for a loading area and for an action that runs.

## Contract

- `ProgressIndicator({ label?, className? })` → marks an area whose data loads.
  - shows a rotating LoaderCircleIcon, then `label`. Default `label` → "Caricamento…".
  - role `status`: screen readers read `label`. Its text is exactly `label`.
  - text in `--color-text-muted`.
  - `className` → extra class.
- `Spinner()` → the same rotating icon alone, decorative (`aria-hidden`). It marks an action in progress inside its button.
  - a button whose action runs → shows `Spinner` in place of its icon, is disabled and has `aria-busy="true"`. Its text and accessible name do not change.

## Rules and invariants

- A button shows no status text: the content of a button is not a live region for screen readers, so the button uses `aria-busy`.
- With `prefers-reduced-motion: reduce` the icon does not rotate. The label or the disabled button still marks the state.

## Dependencies

- IconSet (`LoaderCircleIcon`)

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-29`, `plan-claude_sessions_client-ui_redesign/REQ-31`, `plan-claude_sessions_client-ui_redesign/REQ-1`
