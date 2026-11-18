---
slug: new_session_popup
date: 2026-11-18
spec: .sdd/analysis/new_session_popup.md
status: validated
---

# Requirements — new_session_popup

## Feature: New-session popup aligned to the Resume popup

| ID | Requirement |
|----|-------------|
| REQ-1 | The "New Claude Code Session" popup has the same width as the Resume popup in the same window. |
| REQ-2 | The "New Claude Code Session" popup has the same height as the Resume popup in the same window when both have enough content to reach the height limit. With less content, both follow the same height rule. |
| REQ-3 | The "New Claude Code Session" popup appears at the same place in the window as the Resume popup. |
| REQ-4 | The match of width, height and place holds at every window size, also after the window is resized while the popup is open. |
| REQ-5 | When the content of the "New Claude Code Session" popup does not fit, the content scrolls inside the popup and the popup size does not change. |
| REQ-6 | The content and the behaviour of the "New Claude Code Session" popup stay as they are. |
| REQ-7 | The Resume popup keeps its width, height, place and behaviour. |
