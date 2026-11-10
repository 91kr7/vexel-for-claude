---
module: git
component: DiffView
type: UI component
---

# DiffView

**Purpose** → shows the diff of one file. `batch-history` reuses it.

## Contract

Description:
- the lines of the diff in Roboto Mono, one row per line, without wrapping (horizontal scroll).

Props:
- `diff` → `{ binary, cut, lines }`.

Shows:
- `added` line → "+" and its text, in the success colour (`--emerald-400`).
- `removed` line → "-" and its text, in the error colour (`--color-error`).
- `context` line → a space and its text, in the normal text colour.
- `hunk` line → its text, muted (`--text-muted`).
- `binary` → only the note "Binary file, no diff shown".
- `cut` → after the lines, the note "Diff cut at 5,000 lines" (also when the 5 MB cap cut it first).
- no lines and not binary → an empty view.

## Requirements served

- `plan-git_explorer/REQ-12`, `plan-git_explorer/REQ-14`, `plan-git_explorer/REQ-15`
