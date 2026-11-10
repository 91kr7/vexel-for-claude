---
module: git
component: parseDiff
type: backend function
---

# parseDiff

**Purpose** → turns the unified diff of one file into lines marked by kind. `batch-history` reuses it.

## Contract

- `parseDiff(output, truncated = false) → FileDiff`
  - `truncated` → `output` stops before the end of the diff: its last partial line gives no line, and `cut` is `true`.
- `FileDiff` → `{ binary, cut, lines }`
  - `lines` → `{ kind, text }[]`:
    - `hunk` → a `@@ … @@` line; `text` is the whole line;
    - `added` → a `+` line, `removed` → a `-` line, `context` → a ` ` line; `text` is the line without its first character.
  - `binary` → `true` when git says the file is binary ("Binary files … differ" or a binary patch); then `lines` is empty.
  - `cut` → `true` when the diff has more than 5,000 lines (then `lines` holds the first 5,000), or when `truncated`.

## Rules and invariants

- File headers (`diff --git`, `index`, `---`, `+++`, mode, rename and similarity lines) give no line.
- The note "\ No newline at end of file" gives no line.
- Empty output → `{ binary: false, cut: false, lines: [] }`.
- Exactly 5,000 lines → not cut.

## Requirements served

- `plan-git_explorer/REQ-12`, `plan-git_explorer/REQ-14`, `plan-git_explorer/REQ-15`
