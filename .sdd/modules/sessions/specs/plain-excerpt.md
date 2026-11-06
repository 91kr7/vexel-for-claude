---
module: sessions
component: plainExcerpt
type: backend function
---

# plainExcerpt

**Purpose** → turns a markdown response of Claude into a short plain text, for the turn-end notification.

## Contract

- `plainExcerpt(markdown) → string`

```
for each line:
    a line that starts (after spaces) with ``` or ~~~ is a code fence: it is removed
    a line between two fences is kept as written
    any other line:
        heading mark (1 to 6 "#" and a space, at the start after spaces)    → removed
        list mark ("-", "*", "+", "1." or "1)" and a space, same place)     → removed
        inline code `text`                                          → text, as written
        link [text](url) or image ![text](url)                      → text
        emphasis **text**, __text__, *text*, _text_, ~~text~~       → text
the lines joined by a space, whitespace runs collapsed to one space, ends trimmed
more than 100 characters → the first 99 characters and "…"
```

## Rules and invariants

- The result has at most 100 characters (Unicode code points).
- An emphasis mark needs a non-space character right after the opening mark and right before the closing one. So `2 * 3 * 4` stays as written.
- `_` inside a word is not emphasis: `file_name_here` stays as written.
- A markdown with no text gives `""`.

## Requirements served

- `plan-session_notifications/REQ-16`
