---
module: sessions
component: droppedPathsText
type: frontend function
---

# droppedPathsText

**Purpose** → turns the absolute paths of a drop into the text that the drop inserts at the session input.

## Contract

- `droppedPathsText(paths) → string`
  - each path in the given order, each one followed by one space, the last one included. e.g. `['/a', '/b']` → `/a /b `.
  - a path made only of plain characters stays as it is. Plain characters: letters and digits (any script), `/`, `.`, `_`, `-`, `+`, `,`, `:`, `=`, `@`, `%`.
  - any other path (a space, or a shell-special character such as `'`, `"`, `$`, `&`, `(`, `*`, `\`, `~`, `!`) → wrapped in single quotes. A `'` inside it is written as `'\''`. e.g. `/home/me/My Docs` → `'/home/me/My Docs'`, `/tmp/it's` → `'/tmp/it'\''s'`.
  - no paths → an empty string.

## Rules and invariants

- The quoting follows the native terminal of the Linux desktop: a shell reads each quoted path back as one word, equal to the path.

## Requirements served

- `plan-terminal_addons/REQ-48`, `plan-terminal_addons/REQ-49`
