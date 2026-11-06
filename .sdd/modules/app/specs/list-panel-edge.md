---
module: app
component: ListPanelEdge
type: UI component
---

# ListPanelEdge

**Purpose** → the handle on the right edge of the list panel. The user drags it, or moves it with the arrow keys, to change the panel width.

## Contract

Description:
- an 8 px wide strip, as high as the list panel, centred on its right border. It sits above the main area.
- props → `width` (the shown width), `maxWidth` (the widest width the window allows), `onPreview(width)`, `onCommit(width)`.

Shows:
- a separator with the accessible name "Resize Session List", vertical, with value `width`, minimum 180 and maximum `maxWidth`.
- the resize cursor (`col-resize`) on hover and while dragging.
- a 2 px `--accent-primary` line on the panel border on hover, while dragging, and with the keyboard focus.
- the focus ring when focused from the keyboard.

Actions:
- a drag with the primary button → at each pointer move, `onPreview(start width + pointer move since the press)`, kept between 180 and `maxWidth`. At the release, or when the browser cancels the drag, `onCommit` once with the last width.
  - a press and release with no width change → no `onCommit`.
  - the drag selects no text.
- Tab → the edge gets the focus, after the list entries.
- Left arrow / Right arrow, with the focus on the edge → `onCommit(width ∓ 16)`, kept between 180 and `maxWidth`. No call when the width would not change.

## Rules and invariants

- the edge never asks for a width under 180 px or over `maxWidth`.
- `onCommit` is the only call that should save the width; a drag calls it once.

## Requirements served

- `plan-session_list_width/REQ-1`, `plan-session_list_width/REQ-2`, `plan-session_list_width/REQ-12`, `plan-session_list_width/REQ-13`, `plan-session_list_width/REQ-14`
