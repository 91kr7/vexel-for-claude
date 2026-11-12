---
request_slug: project_list_actions
date: 2026-11-13
type: evolution
size: ordinary
reference: .sdd/analysis/recent_projects.md
---

# Analysis — Projects list: search, remove, favorite

## Request

> aggiungi le seguenti feature: search bar per ricercare i progetti, possibilità di rimuovere dalla lista i progetti, possibilità di mettere come preferito un progetto

## Reference

[recent_projects.md](recent_projects.md) → the "Projects" rail button opens the list of every project folder where Claude Code was used. The most recent project comes first. The user picks one to start a session there. Search, removal and favorites were out of scope (lines 80-81).

Changes:
- The Projects list gets a search bar.
- The user can remove a project from the Projects list.
- The user can mark a project as favorite. Favorites sit at the top of the list.
- A removed project is no longer in both lists. This changes the rule "the two lists hold the same folders" ([recent_projects.md](recent_projects.md), line 41), for removed projects only.
- Every other requirement of the reference stays true.

## Summary

Three actions on the Projects list. The user can search the list by folder path, remove a project from it, and mark a project as favorite so that it stays at the top.

## Requirements

### Functional

Search
- The Projects list must show a search bar above the projects.
- The search must match the text anywhere in the folder path, ignoring upper and lower case.
- The list must update while the user types, with no button to press.
- The filtered list must keep the order of the full list, favorites included.
- When nothing matches, the list must show an empty state that says no project matches the text.
- The user must be able to clear the search with one action, and the full list must come back.
- The search must start empty every time the list opens.
- Starting a session from a filtered list must work exactly as from the full list.

Remove
- Each project row must offer a remove action.
- Remove must take the project out of the Projects list at once, with no confirmation.
- Remove must delete nothing: no folder, no Claude Code file, no session, no history entry.
- A removed project must stay out of the Projects list after a page reload and a client restart.
- A removed project must come back in the Projects list when a new session runs in that folder after the removal. This is the human's decision.
- A removed project must stay in the "Recenti" list of the new-session dialog. This is the human's decision.
- Remove must also work on a project whose folder no longer exists on disk.
- Removing a favorite project must also clear its favorite mark.

Favorite
- Each project row must offer an action to mark the project as favorite, and to remove the mark.
- A favorite project must show a star on its row.
- Favorite projects must sit at the top of the list, above all other projects. This is the human's decision.
- The other projects must stay ordered by last activity, most recent first.
- The mark must also work on a project whose folder no longer exists on disk.
- The mark must survive a page reload and a client restart.

Common
- A remove or a change of mark must appear in every open page and in the desktop app without a reload.
- Every new text must be in English, like the rest of the UI.
- The features must work in the browser page and in the desktop app.

### Non-functional

- The search bar, remove and favorite must be usable with the keyboard, with visible focus, as the reference requires for the UI.
- The list must react to typing with no visible delay, also with some hundreds of projects.
- The star must not rely on colour alone.

## Assumptions

- This is an evolution, not a fix. The gatekeeper decided this: the reference put these features out of scope on purpose.
- The decisions above not marked as the human's decision are gatekeeper decisions.
- Remove and favorite live only in the client. They never write to Claude Code files, as the reference requires.
- Favorite projects are ordered among themselves by last activity, most recent first, like the other projects.
- A resumed session in a removed folder counts as a new session there, so the project comes back.
- A removed project that comes back has no favorite mark, because the remove cleared it.
- The search and the mark do not change the "Recenti" list or the resume history.
- Remove does not need a confirmation, the same as "Dismiss" in [session_list_improvements.md](session_list_improvements.md).

## Risks

- A remove has no undo and no list of hidden projects. A project removed by mistake comes back only with a new session in its folder.
- The Projects list and the "Recenti" list now differ. A user may not understand why a removed project still appears in "Recenti".

## Scope

In scope:
- A search bar on the Projects list, matching the folder path.
- Remove of a project from the Projects list, and its return on new activity.
- Favorite mark on a project, its star, and the favorites at the top of the list.

Out of scope:
- Undo of a remove, and a screen that lists hidden projects.
- Acting on several projects at once.
- Search, remove or favorite in the "Recenti" list or in the resume history.
- Search on anything other than the folder path.
- Saving the last search between openings of the list.
- Any write to Claude Code files.
