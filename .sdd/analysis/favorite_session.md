---
request_slug: favorite_session
date: 2026-11-11
type: evolution
size: narrow
reference: .sdd/analysis/session_list_improvements.md
---

# Analysis — Favorite session

## Request

> voglio poter marchiare una chat come preferita e quando lo faccio deve comparire un qualcosa che indica che è preferita sia nell'elenco delle sessioni running e terimnated sia quando faccio il riprendi sessione

## Reference

[session_list_improvements.md](session_list_improvements.md) → the session list gets per-session data kept only in the client (the name) and actions on the list entry. The name shows in the list entry and in the resume history.

Changes:
- The user can mark any session as favorite and remove the mark.
- A marked session shows a favorite indicator in the list and in the resume history.
- Every other requirement of the reference stays true.

## Summary

The user marks a session as favorite from its list entry. A favorite indicator then shows on that session in the running and terminated groups of the list, and in the resume history.

## Requirements

### Functional

- The user must be able to mark a session as favorite, and to remove the mark, from its list entry.
- The action must be offered on any session in the list, hosted or external, in any state.
- A favorite session must show a visible indicator on its list entry, in the running groups and in the terminated group.
- A favorite session must show the same indicator on its row in the resume history.
- The indicator must disappear from both places when the user removes the mark.
- The mark must survive a page reload, a client restart and a Resume of the session.
- A change of the mark must appear in every open page and in the desktop app without a reload.
- Marking or unmarking must not change the place or the group of the session in the list.
- Dismiss must not remove the mark, so the session is still marked in the resume history.
- The indicator must not rely on colour alone.
- Every new text must be in English, like the rest of the UI.

### Non-functional

- The mark action must be usable with the keyboard, with visible focus, as the reference requires for the UI.

## Assumptions

All are gatekeeper decisions, not human decisions.

- This is an evolution of the reference, not a new analysis.
- The mark lives only in the client. It never changes Claude Code files or the Claude Code session, like the name in the reference.
- The mark belongs to the conversation, not to the list entry. So it shows in the history for the same conversation, and it stays after a Resume.
- The user marks only from the list entry. The history shows the indicator but offers no mark action.
- The mark does not filter, sort or group anything. The request asks only for an indicator.

## Scope

In scope:
- Mark and unmark on a list entry.
- The favorite indicator in the list (running and terminated groups) and in the resume history.
- Keeping the mark across reload, restart, Resume and Dismiss.

Out of scope:
- A favorites filter, a favorites group, or a different sort order.
- Marking from the header of an open session.
- Marking several sessions at once.
- Sending the mark to Claude Code or reading any favorite from it.
- Any change to the state groups, their order, or drag and drop.
