---
request_slug: claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order
date: 2026-11-06
type: evolution
size: narrow
reference: .sdd/analysis/claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search.md
---

# Analysis — Fixed order of sessions in the session list

## Request

> attualmete quando ci sono più sessioni di claude attive nella barra delle sessioni queste vengono continuamente spostate di posizione. fai in modo che questo non succeda! le sessioni devono stare fisse ed al massimo le posso spostare io con un drag and adrop

## Reference

[claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search.md](claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search.md) → search in the resume history, the latest step of the client. The session list groups sessions by state, in this order: needs input, running, in other terminals, ended ([claude_sessions_client-ui_redesign-material3_mock.md](claude_sessions_client-ui_redesign-material3_mock.md), lines 59-61). Today the order inside a group follows the activity of the sessions, so entries move by themselves.

Changes:
- The state groups and their order stay. A session still changes group when its state changes.
- Inside a group, the order is fixed. Only the user changes it, with drag and drop.
- Reordering is drag and drop only, by the human's decision. The keyboard requirement of WCAG 2.2 AA in [claude_sessions_client-ui_redesign-material3_mock.md](claude_sessions_client-ui_redesign-material3_mock.md), line 96, does not apply to reordering.
- Every other requirement of the reference stays true.

## Summary

Stop sessions from moving inside their group of the session list. The user can reorder a group with drag and drop.

## Requirements

### Functional

- Inside a group, a session must keep its place when it, or another session, has activity, gets new messages or changes state.
- A new session must appear at the end of its group.
- A session that changes group must appear at the end of the target group.
- When a session leaves a group, the other sessions of that group must keep their relative order.
- The user must be able to drag a session to another place inside the same group.
- A drop outside the session's own group must leave the order unchanged.
- The order set by the user must survive a page reload.

### Non-functional

- While the user drags, the list must show where the session will land.

## Assumptions

- This is an evolution, not a fix. The movement by activity and state was specified ([claude_sessions_client.md](claude_sessions_client.md), line 39). The orchestrator decided this.
- A session that comes back to a group it left goes at the end. Its old place is not remembered, because that is the simpler rule.
- An ended session goes to the ended group, dimmed, per the existing spec. Then it keeps its place there.
- A session taken over with "Riprendi qui" stays the same entry. It keeps its place if it stays in the same group. Otherwise it goes at the end of its new group.
- The order is kept for as long as each session exists. A session that no longer exists drops out of the order.

## Risks

- A live update during a drag can move the dragged session to another group. The drop must not then place it in the wrong group.

## Scope

In scope:
- The order of sessions inside each group of the session list.
- Drag and drop inside a group.

Out of scope:
- Moving a session to another group by hand. The state decides the group.
- Reordering without a mouse: keyboard or "move up/down" actions.
- The order of the groups themselves.
- The resume history dialog and the "Recenti" list of the new-session dialog.
- Any change of look beyond the drag feedback.
