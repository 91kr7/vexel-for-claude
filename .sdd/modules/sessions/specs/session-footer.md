---
module: sessions
component: SessionFooter
type: UI component
---

# SessionFooter

**Purpose** → the footer bar under the terminal or the conversation of an open session: the place of the session, its figures and, at the right end, the items the view puts there.

## Contract

Props:
- `session` → `{ folder, usage? }` of the open session. Optional.
- `lead` → text shown before the path, e.g. "Open in Another Terminal · ". Optional.
- `end` → items shown at the right end. Optional.

Shows:
- a `footer`, 40 px high (its top line included), padding 0 × 16 px, `--bg-surface-1`, 1 px `--border-subtle` line above. One row, 8 px gaps.
- on the left, with `session` → the place: `lead` in `--text-muted` 11 px, then the full folder path in mono 11 px, `--text-secondary`. One line; text too long ends with "…". The tooltip of the place (`title`) is the full path.
- after the place → the SessionFigures of `session.usage`.
- `end` at the right end of the row.
- without `session` → no place, no lead and no figures. `end` still shows.

## Rules and invariants

- The footer never wraps, never shrinks and is never higher than 40 px, so the area above it keeps its height.
- When the row is too narrow, the place shrinks first. The figures and `end` are never cut.

## Dependencies

- SessionFigures
- ThemeTokens, WebEntry (module app)

## Requirements served

- `plan-session_list_width/REQ-19`, `plan-session_list_width/REQ-20`, `plan-session_list_width/REQ-21`, `plan-session_list_width/REQ-25`, `plan-session_list_width/REQ-28`, `plan-session_list_width/REQ-29`
