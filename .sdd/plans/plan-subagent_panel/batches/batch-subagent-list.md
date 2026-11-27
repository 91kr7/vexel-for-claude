---
batch: subagent-list
feature: Subagents as a list
closed_req: [REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13]
depends: [subagents-only]
---

# Batch subagent-list — Subagents as a list

REQ ids refer to `plan-subagent_panel/requirements.md`. Ids of the form `plan-session_activity/REQ-n` refer to the plan that built the turn panel. "Turn" and "turn panel" have the meaning of `plan-session_activity/requirements.md`.

Words of this batch:

- "Row" → the entry of one subagent in the turn panel, in the place of its card.
- "Level" → a subagent that no subagent started is at level 0. A subagent started by a subagent of level n is at level n + 1.
- "Group" → the subagents of one message, or of one workflow launch, as `turnTreeOf` forms them. Its "members" are its own subagents, not the subagents nested under them.

All the paths are in the index of the module `activity`.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/activity/SubagentCard.tsx` | The card becomes the row of one subagent: the full width of its place, and never wider. Its fields, button and look stay, and a text that does not fit still ends with an ellipsis. The nested groups (`children`) leave it. | REQ-8, REQ-9, REQ-13 | — |
| INT-2 | modify | `src/web/activity/TurnTreeView.tsx` | No grid. A group shows its rows one below the other, 8 px apart. After a row come the groups of its children, one level further right, at any depth. The groups of earlier turns show the same way. | REQ-8, REQ-9 | INT-1, INT-7 |
| INT-3 | modify | `src/web/activity/TurnTreeView.tsx` | A group of two or more → one vertical line in the gutter of its level, from its first member row to its last, with a short tick on each member row. A group of one has no line. The groups of earlier turns follow the same rule. | REQ-10, REQ-11, REQ-12 | INT-2 |
| INT-4 | modify | `src/web/activity/TurnTreeView.tsx` | The scrolling area never scrolls sideways. At the smallest width of the panel (360 px), a row of level 3 keeps at least 240 px. | REQ-13 | INT-2 |
| INT-5 | modify | `src/server/activity/turn-model.ts` | A subagent started from the main conversation of an earlier turn keeps the `message` of the call that started it, or of the Workflow call of its launch. It still has no `startedBy`. | REQ-10, REQ-12 | — |
| INT-6 | modify | `src/server/activity/turn-tree.ts` | `earlier` becomes a list of groups, like `groups`. Earlier subagents with the same kept `message` form one group; one with no `message` is a group of its own. Start order as today. `turnChangeOf` compares `earlier` as it compares `groups`. | REQ-10, REQ-12 | INT-5 |
| INT-7 | modify | `src/web/activity/turn-store.ts` | `TurnTree` and the `update` frame carry `earlier` as a list of groups, as in INT-6. | REQ-10, REQ-12 | INT-6 |

## Decisions

- **Data change only for earlier turns (INT-5 to INT-7).** `turnTreeOf` already gives the groups of the current turn, the nested groups and their start order. Only `earlier` comes as a flat list of ids: TurnModel drops the link of a call from an earlier turn. The view takes the level from the depth of a group in the tree.
- **Message of an earlier call (INT-5).** TurnModel finds it whether the metadata of the subagent comes before or after the call. Like a call of a subagent, a call of the main conversation is remembered until the metadata of its subagent comes, among the latest 2,000. All the agents of one workflow launch share the message of its Workflow call, so they stay one group.
- **Gutter (INT-2, INT-3, INT-4).** Every level, level 0 included, starts with a gutter of the same width, at most 16 px. The gutter holds the line of the groups of that level. A row with no line keeps its gutter empty, so the rows of one level line up. So a row of level n is as wide as the panel minus n + 1 gutters.
- **Line and ticks (INT-3). Gatekeeper decision, 2026-11-27.** The line also passes beside the rows nested under a member, down to the next member. Only the tick tells a member row from a nested row: this makes REQ-11 checkable. The colour and thickness come from ThemeTokens, and the implementer chooses them.
- **Any depth (INT-2, INT-4). Gatekeeper decision, 2026-11-27.** Every level adds one gutter, also after level 3. A cap on the indent would break REQ-9. Three levels is the case to test.
- **Earlier turns (INT-3, INT-6). Gatekeeper decision, 2026-11-27.** The subagents of one message of an earlier turn are a group, by `requirements.md`, "At the same time". In "Still running from earlier turns" they show with the line and the ticks, as in the current turn. That section shows only running subagents (`plan-session_activity/REQ-39`). So a group there holds its running members only, and with one left it has no line. A subagent whose message is not known is a group of its own.
- **Look of a row (INT-1).** The row keeps the surface, border and fields of the card, in the same order, on several lines. The latest text keeps its two lines. The component keeps its name, SubagentCard, and its spec calls what it draws a row. Its accessible names stay: "Subagent: <type>" and "Open Conversation: <type>".
- **Styles.** The styles of the rows, the gutter and the line go in `src/web/styles.css`, with the other styles of the turn panel.
- **Scrolling (REQ-4).** The rule does not change. The view now shows the row of the latest started subagent, and the rows nested under it are no longer part of that row.
- **REQ-1 to REQ-7 stay closed in `subagents-only`.** This batch changes the view that shows REQ-2 to REQ-5, so its tests check them again.
- **Specs updated with no code change.** The spec of TurnPanel says "row" where it says "card": a row opens the conversation, and "Back" returns the focus to the button of that row. The spec of TurnRoute names the `earlier` groups in its frames, because TurnRoute forwards what `turnChangeOf` gives.
- **Replaced requirement.** The spec of TurnTreeView drops `plan-session_activity/REQ-37` from "Requirements served" and cites REQ-8 to REQ-13. The spec of turnTreeOf keeps it, because the function still forms the groups, and adds REQ-10 and REQ-12.
- **Tests.** Tests are the tester's work, not an INT. Vitest covers the kept message of TurnModel, the `earlier` groups of `turnTreeOf` and `turnChangeOf`, and useTurn. Playwright e2e in the browser covers the rows, the indent, the line and its ticks, a group of an earlier turn, and the panel at its smallest width with three levels. The existing tests and fixtures that expect cards side by side, nested cards inside a card, or `earlier` as ids change with this batch.
- **No Electron run** in any automatic cycle (knowledge base `electron-e2e-separate`). If the Electron spec expects cards side by side, the tester updates it without running it.

## Human acceptance

### Scenario: The subagents show as a list, with a group joined on the left

- REQ → REQ-8, REQ-10, REQ-12
- Given → in the current turn Claude started one sdd-analyst subagent, then two sdd-developer subagents in one message
- When → the user opens the turn panel
- Then → the panel shows three rows as wide as the panel, one below the other: sdd-analyst, then the two sdd-developers
- And → a line on the left joins the two sdd-developer rows, and the sdd-analyst row has no line

### Scenario: A nested subagent shows indented under its parent

- REQ → REQ-9, REQ-11
- Given → two sdd-developer subagents run as one group, and the first one started an sdd-tester subagent
- When → the user opens the turn panel
- Then → the sdd-tester row shows between the two sdd-developer rows, one level further right
- And → the line of the group has a tick on each sdd-developer row, and none on the sdd-tester row

### Scenario: A group still running from an earlier turn stays joined

- REQ → REQ-10, REQ-12
- Given → in the previous turn Claude started two sdd-developer subagents in one message and one sdd-tester subagent in another; all three still run, and the user sent a new message
- When → the user opens the turn panel
- Then → under "Still running from earlier turns", a line on the left joins the two sdd-developer rows
- And → the sdd-tester row has no line

### Scenario: Three levels of nesting fit in the narrow panel

- REQ → REQ-8, REQ-9, REQ-13
- Given → the window is so narrow that the turn panel has its smallest width, and the turn has subagents nested down to level 3
- When → the user opens the turn panel
- Then → each nested row is one level further right than its parent, and every row reaches the right edge of the panel
- And → the panel has no horizontal scrollbar

### Scenario: A row shows the same fields as the card

- REQ → REQ-8, `plan-session_activity/REQ-32` to `REQ-36`
- Given → an sdd-developer subagent of the current turn runs `npm test`
- When → the user opens the turn panel
- Then → the sdd-developer row shows its type, its task, its model, "Running", its duration, its latest text and "Bash: npm test"

### Scenario: A click on a row opens the subagent conversation

- REQ → REQ-8, `plan-session_activity/REQ-49`
- Given → the turn panel shows the row of an sdd-developer subagent
- When → the user clicks that row
- Then → the conversation of the sdd-developer opens in the panel
