---
slug: claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order
date: 2026-11-06
spec: .sdd/analysis/claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order.md
status: validated
---

# Requirements — Fixed order of sessions in the session list

"A group" is one of the state groups of the session list: needs input, running, in other terminals, ended. "The order" is the order of the sessions inside one group.

## Feature: Fixed order

| ID | Requirement |
|----|-------------|
| REQ-1 | Inside a group, a session keeps its place when it or another session has activity, gets new messages or changes state. |
| REQ-2 | A new session appears at the end of its group. |
| REQ-3 | A session that changes group appears at the end of the target group. |
| REQ-4 | When a session leaves a group, the other sessions of that group keep their relative order. |
| REQ-5 | After a page reload, every group shows its sessions in the same order as before the reload. |

## Feature: Reorder by drag and drop

| ID | Requirement |
|----|-------------|
| REQ-6 | The user can drag a session to another place inside the same group. |
| REQ-7 | A drop outside the session's own group leaves the order unchanged. |
| REQ-8 | A drop of a session that changed group during the drag leaves the order unchanged. |
| REQ-9 | The order set by the user survives a page reload. |
| REQ-10 | While the user drags, the list shows where the session will land. |

## Assumptions

These are not human decisions. The gatekeeper confirmed "Reload of the fixed order", "First load", "Group change during a drag" and "Same browser". The others apply the spec's assumptions.

- **Reload of the fixed order.** The spec asks only that the order set by the user survives a reload (REQ-9). REQ-5 extends this to the order nobody has changed yet. Without it, a reload would sort by activity again, and the spec says only the user changes the order.
- **First load.** When no saved order exists, for example on the first load after this change, each group starts in today's activity order. From then on that order is fixed.
- **Group change during a drag.** REQ-8 comes from the spec's risk. It is the safe rule: the drop does nothing, and the session stays at the end of its new group (REQ-3).
- **Return to a group.** A session that comes back to a group it left goes at the end (REQ-3). Its old place is not remembered.
- **"Resume Here".** The spec assumes that a session taken over with "Resume Here" stays the same entry. In the client it does not: "Resume Here" starts a new hosted session with a new id (ResumeHereButton spec). So the hosted session is a new entry, at the end of its group (REQ-2). The external entry follows its own state, as today. The planner found this in Step 3. The gatekeeper accepted it on 2026-11-06; see `batches.md`.
- **Ended sessions.** An ended session moves to the ended group, dimmed, as today (REQ-3). Then it keeps its place there.
- **Same browser.** "Page reload" means the same browser. Another browser, or a browser with its site data cleared, starts again from the first-load order. The client is a local tool with a single user, so no server-side store.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- The state groups, their order and the rule that the state decides the group stay as they are.
- Reordering is drag and drop only, by the human's decision. The WCAG 2.2 AA keyboard requirement of `plan-claude_sessions_client-ui_redesign-material3_mock` does not apply to reordering.
- A click on a session that the user does not drag still opens it.
- The only change of look is the drag feedback of REQ-10. It follows the dark "Studio" style of `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark`.
- Out of scope: moving a session to another group by hand, reordering without a mouse, the order of the groups, the resume history dialog and the "Recent" list of the new-session dialog.
- Every requirement of `plan-claude_sessions_client`, `plan-claude_sessions_client-ui_redesign`, `plan-claude_sessions_client-ui_redesign-material3_mock`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui` and `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search` stays true. The only change: inside a group, the order no longer follows the activity of the sessions.
