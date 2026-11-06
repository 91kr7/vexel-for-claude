---
slug: claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search
date: 2026-11-06
spec: .sdd/analysis/claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search.md
status: validated
---

# Requirements — Search in the session history

"The dialog" is the resume history dialog. "The search text" is the text in its search bar.

## Feature: Search in the session history

| ID | Requirement |
|----|-------------|
| REQ-1 | The dialog shows a search bar above the list of past sessions. |
| REQ-2 | The search bar has the keyboard focus when the dialog opens. |
| REQ-3 | A session matches when the search text appears anywhere in its label or in its project folder path, and in no other field. |
| REQ-4 | The search ignores the difference between upper and lower case. |
| REQ-5 | The list updates while the user types, with no button to press. |
| REQ-6 | A project group with no matching session is hidden. |
| REQ-7 | The filtered list keeps the order of groups and sessions of the full list. |
| REQ-8 | When no session matches, the dialog shows an empty state that says no session matches the search text. |
| REQ-9 | One action clears the search text, and the full list comes back. |
| REQ-10 | An empty search bar shows the full list. |
| REQ-11 | The search bar is empty every time the dialog opens. |
| REQ-12 | Resuming a session from a filtered list works exactly as from the full list. |
| REQ-13 | The search bar placeholder, the clear action, including its accessibility label, and the empty state text are in English. |
| REQ-14 | Esc closes the dialog, also when the search bar has the focus or contains text. |
| REQ-15 | Enter in the search bar does not resume a session. |
| REQ-16 | With some hundreds of past sessions, the list reacts to typing with no visible delay. |
| REQ-17 | The search bar follows the dialog style of the reference. |

## Assumptions

- **Esc and Enter.** REQ-14 and REQ-15 come from the spec's assumptions. They are observable, so they are requirements.
- **Matching.** "Anywhere" in REQ-3 comes from the spec's assumptions: the search text is a plain substring, not a pattern and not a word-start match.
- **Style.** "The reference" in REQ-17 is the dark "Studio" dialog style of `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark`.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- The search only hides entries. The content of each entry does not change.
- Out of scope: search in the text of past conversations, search or filters in the main session list, filters by date or state, saving the search text between openings, changes to other dialogs or screens.
- Every requirement of `plan-claude_sessions_client`, `plan-claude_sessions_client-ui_redesign`, `plan-claude_sessions_client-ui_redesign-material3_mock`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark` and `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui` stays true.
