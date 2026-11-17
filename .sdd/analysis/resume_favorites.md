---
request_slug: resume_favorites
date: 2026-11-17
type: evolution
size: narrow
reference: .sdd/analysis/favorite_session.md
---

# Analysis — Favorites in the resume session popup

## Request

> il popup resume sesssion deve essere più largo e meno alto e devo poter togliere/aggiungere come preferita una sessione e voglio un filtro che consenta di vedere solo le sessioni preferite

## Reference

[favorite_session.md](favorite_session.md) → the user marks a session as favorite only from its session list entry. The resume history popup shows the favorite indicator but has no mark action. A favorites filter is out of scope. The popup also has a search bar that filters by label and project folder ([history_search analysis](claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search.md)).

Changes:
- The resume popup is wider and shorter.
- The user can mark and unmark a favorite from each row of the resume popup.
- The resume popup has a filter that shows only favorite sessions.
- Every other requirement of the reference stays true.

## Summary

Make the resume session popup wider and shorter. Let the user mark and unmark favorites from its rows, and add a filter that shows only the favorite sessions.

## Requirements

### Functional

- The resume popup must be clearly wider than today, about 1.5 times the current width.
- The resume popup must be shorter than today, so it no longer fills almost the whole window.
- The list of past sessions must scroll inside the popup when it does not fit.
- The popup must stay fully visible and usable in a small window.
- Each row of the resume popup must offer an action to mark the session as favorite, or to remove the mark.
- The mark action must not resume the session or close the popup.
- The favorite indicator of the row must update at once after the action.
- A mark changed in the popup must be the same mark that the session list shows, and the session list must update without a reload.
- The popup must offer a filter control that shows only the favorite sessions.
- With the filter on, a row must show only if it is a favorite and it matches the search text.
- With the filter off, the list must behave as it does today.
- The filter must be off each time the popup opens.
- If the user unmarks a session while the filter is on, the row must leave the list.
- With the filter on and no row to show, the popup must show an empty state that says no favorite session matches.
- The filter control must show whether it is on or off, not by colour alone.
- Every new text must be in English, like the rest of the UI.

### Non-functional

- The mark action and the filter control must be usable with the keyboard, with visible focus.
- The search bar must keep the keyboard focus when the popup opens, as today.

## Assumptions

All are gatekeeper decisions, not human decisions.

- This is an evolution of `favorite_session.md`, which stays unchanged. The filter was out of scope there and the request adds new behaviour.
- The mark action goes on each row of the popup, because the request names the popup. The mark from the session list entry stays as it is.
- The filter exists only in the popup. Its state is not saved between openings, so nothing new is persisted.
- The exact size of the popup is a design detail for later phases.

## Scope

In scope:
- New width and height of the resume popup, with the list scrolling inside it.
- Mark and unmark from each row of the popup.
- An "only favorites" filter in the popup, combined with the search.

Out of scope:
- A favorites filter, group or sort in the main session list.
- Saving the filter state between openings of the popup.
- Sorting favorites first in the popup.
- Marking several sessions at once.
- Any change to the other dialogs.
