---
batch: subagents-only
feature: Turn panel with subagents only
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7]
depends: []
---

# Batch subagents-only — Turn panel with subagents only

REQ ids refer to `plan-subagent_panel/requirements.md`. Ids of the form `plan-session_activity/REQ-n` refer to the plan that built the turn panel. The words "turn", "step", "main conversation" and "turn panel" have the meaning of `plan-session_activity/requirements.md`.

All the paths are in the index of the module `activity`.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/activity/turn-tree.ts` | `turnTreeOf`: the tree no longer carries the steps of the main conversation. `TurnTree` loses `steps`, and `SubagentGroup` loses `step`. | REQ-1 | — |
| INT-2 | modify | `src/server/activity/turn-tree.ts` | `turnChangeOf`: the whole tree only for a first tree or a new turn number. An update has no step part. | REQ-1 | INT-1 |
| INT-3 | modify | `src/server/activity/turn-tree.ts` | Groups form by today's step rule, then sort by the earliest start of their subagents. Inside a group, the subagents sort by start. Nested groups and `earlier` use the same order. A missing start sorts last; equal starts keep the step order. | REQ-2, REQ-3 | INT-1 |
| INT-4 | modify | `src/web/activity/turn-store.ts` | `TurnTree` and the `update` frame lose `steps`, and a group loses `step`, as in INT-1 and INT-2. | REQ-1 | INT-2 |
| INT-5 | modify | `src/web/activity/TurnTreeView.tsx` | No step and no "Show N earlier steps". Under the section "Still running from earlier turns", the groups of the turn, one under the other, in the order of the tree. | REQ-1, REQ-2, REQ-3 | INT-3, INT-4 |
| INT-6 | modify | `src/web/activity/TurnTreeView.tsx` | A turn with no group → a compact AreaState `empty` "No subagents in this turn." in the place of the groups. It also shows under the section of earlier turns. | REQ-5 | INT-5 |
| INT-7 | modify | `src/web/activity/TurnTreeView.tsx` | Scrolling: the view follows at first. While it follows, each tree change keeps in view the card of the latest started subagent, at any level. A user scroll up stops it, and a user scroll to the end starts it again. | REQ-4 | INT-5 |

## Decisions

- **The tree stops carrying the main steps (INT-1, INT-2, INT-4). Gatekeeper decision, 2026-11-27.** The panel no longer shows them. If the tree kept them, every text and tool call of the main conversation would still send a frame to the page.
- **TurnModel does not change.** It keeps the steps of the main conversation, because the group rule needs their order. After this batch, nothing reads their text.
- **Group rule unchanged (INT-3).** Groups form as today (`plan-session_activity/batch-turn-panel`, "Group rule"). Only their order changes (requirements, "At the same time").
- **Latest started subagent (INT-7).** It is the subagent with the latest `startedAt` among all the subagents of the tree, nested and earlier ones included. A subagent with no `startedAt` does not count.
- **Look of the list (INT-5).** The groups stack with the 8 px gap that the cards of a group already use. The cards, the grids and the nested groups keep their look.
- **Long turns.** The limit of 200 steps leaves with the steps. Every subagent of the turn shows. `plan-session_activity/REQ-45` and `REQ-46` stay true.
- **REQ-6 and REQ-7 need no code change. Gatekeeper decision, 2026-11-27.** TurnPanel and the `status` of `turnTreeOf` already meet them, and this batch leaves both as they are. The batch tests them again after the change.
- **Specs updated with no code change.** TurnRoute forwards what `turnChangeOf` gives, so its code stays. Its spec no longer names steps in the frames. The spec of TurnPanel no longer names "its shown steps".
- **Replaced requirements.** The specs of the touched components drop `plan-session_activity/REQ-29`, `REQ-30`, `REQ-31` and `REQ-42` from "Requirements served", and cite the REQs of this plan.
- **Tests.** Tests are the tester's work, not an INT. Vitest covers `turnTreeOf`, `turnChangeOf` and useTurn. Playwright e2e in the browser covers the panel. The existing tests and fixtures that expect steps in the panel change with this batch.
- **No Electron run** in any automatic cycle (knowledge base `electron-e2e-separate`). `plan-session_activity/REQ-48` stays covered by the existing Electron spec, which the human runs on request. If that spec expects steps, the tester updates it without running it.

## Human acceptance

### Scenario: The panel shows only the subagents of the turn, in start order

- REQ → REQ-1, REQ-2, REQ-3
- Given → the user sent a message, and Claude wrote a text, ran `git status`, started one sdd-analyst subagent, then two sdd-developer subagents in one message
- When → the user opens the turn panel
- Then → the panel shows the sdd-analyst card, then the two sdd-developer cards side by side
- And → the panel shows no user message, no text of Claude and no "Bash: git status"

### Scenario: A workflow sits at the start of its first agent

- REQ → REQ-2, REQ-3
- Given → Claude launched a workflow, wrote a text, then started an sdd-tester subagent, and the first agent of the workflow started after the sdd-tester
- When → the user opens the turn panel
- Then → the sdd-tester card comes first, then the agents of the workflow side by side, as one group

### Scenario: The panel follows the latest subagent

- REQ → REQ-4
- Given → the turn panel is open on a running turn with more subagent cards than fit in it, and the user has not scrolled
- When → Claude starts a new subagent, then the user scrolls up, and Claude starts another one
- Then → the panel scrolls to the card of the first new subagent, and stays still after the user's scroll up

### Scenario: A turn with no subagents

- REQ → REQ-5, REQ-6
- Given → a session whose last turn ended after Claude answered with no subagent
- When → the user opens the turn panel
- Then → the header shows "Ended", and the panel says "No subagents in this turn."

### Scenario: A session with no turn

- REQ → REQ-7
- Given → a new hosted session where the user has sent no message yet
- When → the user opens the turn panel
- Then → the panel says "No turn yet."
