---
module: git
component: DiffView
type: UI component
---

# DiffView

**Purpose** → shows the diff of one file as a unified view, drawn by the open-source diff component. `batch-history` reuses it.

## Contract

Description:
- the lines of the diff in Roboto Mono, one table row per line, without wrapping (horizontal scroll). No line-number gutter.

Props:
- `diff` → `{ binary, cut, lines }`.

Shows:
- `added` line → "+" and its text, in the success colour (`--emerald-400`) on a light tint of it.
- `removed` line → "-" and its text, in the error colour (`--color-error`) on a light tint of it.
- `context` line → a space and its text, in the normal text colour.
- `hunk` line → its text in a row of its own, muted (`--text-muted`). Lines before any hunk line show with no header row.
- every colour comes from the theme tokens, so the view follows the light and the dark theme.
- `binary` → only the note "Binary file, no diff shown".
- `cut` → after the lines, the note "Diff cut at 5,000 lines" (also when the 5 MB cap cut it first).
- no lines and not binary → an empty view.

## Dependencies

- react-diff-view (npm): the lines become its hunks in the frontend; the server output does not change.

## Requirements served

- `plan-git_graph/REQ-1`, `plan-git_graph/REQ-2`, `plan-git_graph/REQ-4`
- `plan-git_explorer/REQ-12`, `plan-git_explorer/REQ-14`, `plan-git_explorer/REQ-15`
