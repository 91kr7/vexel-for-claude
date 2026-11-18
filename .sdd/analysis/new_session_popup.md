---
request_slug: new_session_popup
date: 2026-11-18
type: evolution
size: narrow
reference: .sdd/analysis/recent_projects.md
---

# Analysis — New session popup aligned to the Resume popup

## Request

> puoi allineare altezza larghezzae posizione del popup "new Claude Code session" al popup "resume"?

## Reference

[recent_projects.md](recent_projects.md) → the new-session dialog has a "Recenti" list. That analysis put any change to the new-session dialog out of its scope (line 83).

[resume_favorites.md](resume_favorites.md) → the Resume popup was made wider and shorter, so it no longer fills almost the whole window. Its list scrolls inside it and it stays usable in a small window (lines 36-41).

Changes:
- The "New Claude Code session" popup takes the width, the height and the position of the Resume popup.
- Every other requirement of the references stays true.

## Summary

Give the "New Claude Code session" popup the same width, height and position in the window as the Resume popup. The Resume popup is the reference and does not change.

## Requirements

- The "New Claude Code session" popup must have the same width as the Resume popup.
- The "New Claude Code session" popup must have the same height as the Resume popup.
- The "New Claude Code session" popup must appear at the same place in the window as the Resume popup.
- The match must hold at every window size.
- When the content does not fit, the content must scroll inside the popup. The popup size must not change.
- The content and the behaviour of the popup must stay as they are.

## Assumptions

- This is an evolution, not a fix. The gatekeeper decided this: no stated requirement of the new-session popup is broken.
- "Position" means the placement of the popup in the window, such as its vertical and horizontal alignment. It does not mean the layout inside the popup.
- "Same size" means the same size rule as the Resume popup, so both popups behave the same when the window changes.
- The Resume popup is taken as it is after [resume_favorites.md](resume_favorites.md).
- How the two popups share their size is a design decision for later phases.

## Scope

In scope:
- Width, height and position of the "New Claude Code session" popup.

Out of scope:
- Any change to the Resume popup.
- Any change to the content, the actions or the look inside the new-session popup.
- Any change to the other dialogs, such as the settings popup or the confirmations.
