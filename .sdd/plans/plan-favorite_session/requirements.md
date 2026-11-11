---
slug: favorite_session
date: 2026-11-11
spec: .sdd/analysis/favorite_session.md
status: validated
---

# Requirements — Favorite session

Words used below, as in the spec:

- "Favorite mark" → the client-only mark the user puts on a session. It is not a Claude Code feature.
- "Favorite indicator" → the visible sign that a session has the favorite mark.
- "List entry" → the entry of a session in the session list, a row or the needs-input card.
- "Running groups" → the groups "Needs Input", "Running" and "In Other Terminals". "Terminated group" → the group "Ended" (the spec says "terminated"; the UI says "Ended").
- "Resume history" → the dialog "Resume Session" with the past sessions.

## Feature: Favorite session

| ID | Requirement |
|----|-------------|
| REQ-1 | From its list entry, the user can mark a session as favorite and remove the mark. |
| REQ-2 | The mark action is offered on the list entry of any session, hosted or external, in any state. |
| REQ-3 | A favorite session shows the favorite indicator on its list entry, in the running groups and in the terminated group. |
| REQ-4 | A favorite session shows the same favorite indicator on its row in the resume history. |
| REQ-5 | When the user removes the mark, the favorite indicator disappears from the list and from the resume history. |
| REQ-6 | The favorite mark survives a page reload and a client restart. |
| REQ-7 | The favorite mark survives a Resume of the session. |
| REQ-8 | A change of the favorite mark appears in every open page and in the desktop app without a reload. |
| REQ-9 | Marking or unmarking a session does not change its place or its group in the list. |
| REQ-10 | "Dismiss" does not remove the favorite mark, so the session is still marked in the resume history. |
| REQ-11 | The favorite indicator does not rely on colour alone. |
| REQ-12 | Every new text of the UI is in English. |
| REQ-13 | The mark action is usable with the keyboard, with visible focus. |

## Assumptions

The first two come from the spec, where the gatekeeper decided them. "Live update" is a gatekeeper decision of this planning run. None is a human decision.

- **Resume (REQ-7).** The mark belongs to the conversation, not to the list entry. It survives "Resume" on the list entry, "Resume" in the resume history and "Resume Here".
- **Resume history (REQ-4).** The history shows the indicator only. It offers no mark action.
- **Live update (REQ-8).** It covers the session list. The resume history loads its data each time it opens, so it shows the current mark at that moment.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- The favorite mark lives only in the client. It never changes a Claude Code file or the Claude Code session.
- The mark does not filter, sort or group anything.
- Out of scope: a favorites filter or group, a different sort order, marking from the header of an open session, marking several sessions at once, sending the mark to Claude Code or reading a favorite from it, any change to the state groups, their order or drag and drop.
- Every requirement of `plan-session_list_improvements` and of the plans before it stays true.
