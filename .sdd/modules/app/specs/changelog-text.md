---
module: app
component: ChangelogText
type: UI component
---

# ChangelogText

**Purpose** → shows the text of a release changelog as readable elements, never as raw markup and never as code.

## Contract

Props:
- `text` → the changelog, in the markup subset of the release instruction (root `CLAUDE.md`, "Releases").

Blocks (one per group of lines; blank lines separate groups; `\r\n` counts as a line end):
- `#` to `######` then a space, then text → a heading (`h4`, whatever the level), without the `#` signs.
- `-`, `*` or `+` then a space, at any indent → an item of a bullet list (`ul` / `li`). Consecutive items form one list. A following indented line that is not an item continues the item.
- any other lines → one paragraph (`p`), the lines joined by a space.

Inline, inside headings, items and paragraphs:
- `` `code` `` → `code`, its content as plain text.
- `**text**` or `__text__` → bold (`strong`).
- `*text*` or `_text_` → italic (`em`). `_` inside a word (`snake_case`) stays text.
- `[label](address)` → with an `http` or `https` address, a link (`a`) to it with `target="_blank"` and `rel="noopener noreferrer"`. Any other address → the label as plain text, no link.
- `![alt](address)` → left out: no image, no text.
- anything else, raw HTML included (`<script>`, `<button>`, `<img>`) → plain text, shown as written.

## Rules and invariants

- The text never becomes HTML: no element exists other than those listed above, no attribute comes from the text except a link's `http`/`https` address.
- The component loads no remote content.

## Dependencies

- DesktopApp (module desktop): links with a target open in the system browser

## Requirements served

- `plan-release_changelog/REQ-9`, `plan-release_changelog/REQ-10`, `plan-release_changelog/REQ-11`
