---
module: app
component: ErrorMessage
type: UI component
---

# ErrorMessage

**Purpose** → the one look of a failure the user sees.

## Contract

- `ErrorMessage({ children, className? })` → `children` is the Italian text of the failure.
  - shows CircleXIcon, then the text, both in `--color-error`.
  - role `alert`: screen readers announce it when it appears. Its text is exactly `children`.
  - `className` → extra class.

## Rules and invariants

- The icon is decorative. It adds nothing to the text that screen readers read.
- `--color-error` reaches 4.5:1 on every surface of both themes (ThemeTokens).

## Dependencies

- IconSet (`CircleXIcon`), ThemeTokens

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-30`, `plan-claude_sessions_client-ui_redesign/REQ-1`, `plan-claude_sessions_client-ui_redesign/REQ-3`
