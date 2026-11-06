---
request_slug: claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search
date: 2026-11-06
type: evolution
size: narrow
reference: .sdd/analysis/claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui.md
---

# Analysis — Search in the session history

## Request

> voglio poter ricercare (mediante searchbar) una particolare sessione quando apro il popup dello storico delle sessioni

## Reference

[claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui.md](claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui.md) → the English UI of the client, on top of the dark "Studio" restyle. The resume history dialog lists the past sessions of the machine, grouped by project folder ([claude_sessions_client.md](claude_sessions_client.md), line 61). Search was out of scope in [claude_sessions_client-ui_redesign.md](claude_sessions_client-ui_redesign.md), line 116.

Changes:
- The resume history dialog gets a search bar that filters its list.
- Every other requirement of the reference stays true.

## Summary

Add a search bar to the resume history dialog. The user types text and the list shows only the past sessions that match it.

## Requirements

### Functional

- The resume history dialog must show a search bar above the list of past sessions.
- The search bar must have the keyboard focus when the dialog opens.
- The search must match only the session label and the project folder of each entry. This is the human's decision of 2026-11-06.
- The search must ignore the difference between upper and lower case.
- The list must update while the user types, with no button to press.
- A project group with no matching session must be hidden.
- The order of groups and sessions must stay the same as in the unfiltered list.
- When nothing matches, the dialog must show an empty state in English that says no session matches the text.
- The user must be able to clear the search with one action, and the full list must come back.
- An empty search bar must show the full list.
- The search must start empty every time the dialog opens.
- Resuming a session from a filtered list must work exactly as from the full list.
- The search bar placeholder, the clear action and the empty state must be in English.

### Non-functional

- The list must react to typing with no visible delay, also with some hundreds of past sessions.
- The search bar must follow the dialog style of the reference.

## Assumptions

- This is an evolution, not a fix. The coordinator decided it: search was never required and was out of scope in the earlier analyses.
- A session matches when the typed text appears anywhere in its label or its project folder path.
- Esc keeps its current effect and closes the dialog, as in every dialog of the client.
- Enter does not resume a session the user has not selected, so a search never resumes a session by mistake.
- The list content does not change. The search only hides entries.

## Scope

In scope:
- A search bar in the resume history dialog that filters its list by label and project folder.

Out of scope:
- Search inside the text of past conversations.
- Search or filters in the main session list.
- Filters by date, state or other fields.
- Saving the last search between openings of the dialog.
- Any change to the other dialogs or screens.
