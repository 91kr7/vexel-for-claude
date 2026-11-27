---
batch: running-subagents
feature: Running subagents only
closed_req: [REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22]
depends: [subagent-list]
---

# Batch running-subagents — Running subagents only

REQ ids refer to `plan-subagent_panel/requirements.md`. Ids of the form `plan-session_activity/REQ-n` refer to the plan that built the panel.

Words of this batch:

- "Subagents panel" → the panel that the code and the earlier batches call "turn panel". REQ-21 gives it its new name. The code keeps its names: TurnPanel, TurnPanelButton, TurnTreeView, useTurn, `turnTreeOf` and the route `/api/sessions/:id/turn`.
- "Row", "level", "group" and "member" → as in `batch-subagent-list`, "Words of this batch".
- "Running" → the state "running" of a subagent (`plan-session_activity/REQ-33`). "Ended" → finished or stopped.

All the paths are in the index of the module `activity`. The code is the one of `subagent-list` (commit bec3b08).

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/activity/turn-tree.ts` | `turnTreeOf`: the tree holds only the running subagents, of the current turn and of earlier turns. An ended subagent is in no group and not in `subagents`. | REQ-14, REQ-16, REQ-18, REQ-19 | — |
| INT-2 | modify | `src/server/activity/turn-tree.ts` | `TurnTree` loses `earlier` and `status`: `groups` holds every group of level 0, formed and sorted as in "Groups and order". `turnChangeOf` no longer compares the two fields. | REQ-14, REQ-15 | INT-1 |
| INT-3 | modify | `src/server/activity/turn-tree.ts` | A running subagent whose parent ended goes in the groups of its nearest running ancestor, or at level 0. Its group sorts by the start of its highest ended ancestor. | REQ-17 | INT-2 |
| INT-4 | modify | `src/web/activity/turn-store.ts` | `TurnTree` and the `update` frame lose `earlier` and `status`, as in INT-2. | REQ-15 | INT-2 |
| INT-5 | modify | `src/web/activity/TurnTreeView.tsx` | No section "Still running from earlier turns": only the groups of `groups`, from level 0 down. | REQ-14, REQ-15 | INT-4 |
| INT-6 | modify | `src/web/activity/TurnTreeView.tsx` | A tree with no group → a compact AreaState `empty` "No subagents running.", in place of "No subagents in this turn.". | REQ-15, REQ-20 | INT-5 |
| INT-7 | modify | `src/web/activity/TurnPanelButton.tsx` | Accessible name and tooltip "Subagents". | REQ-21 | — |
| INT-8 | modify | `src/web/activity/TurnPanel.tsx` | Region name and header title "Subagents". The header has no status chip. | REQ-15, REQ-21 | INT-4 |
| INT-9 | modify | `src/web/activity/TurnPanel.tsx` | No "No turn yet.": a loaded tree always shows the TurnTreeView. `unavailable` says "Subagents not available.". | REQ-15, REQ-20 | INT-4 |
| INT-10 | modify | `src/web/activity/TurnPanel.tsx` | A new turn number no longer starts a new TurnTreeView. The view keeps its scroll place and whether it follows. | REQ-19 | — |
| INT-11 | modify | `src/web/activity/SubagentConversation.tsx` | A new optional prop says that the subagent left the list. Then the bar shows no state pill. | REQ-22 | — |
| INT-12 | modify | `src/web/activity/TurnPanel.tsx` | When the open subagent leaves the tree, the conversation stays open. Its bar keeps the last type and description, with no state (INT-11). | REQ-22 | INT-11 |

## Decisions

- **Data change in `turnTreeOf` only (INT-1 to INT-3).** TurnModel already gives every subagent of the session with its state, start, parent and message, ended parents included. So TurnModel keeps its code.
- **Groups and order (INT-2, INT-3).** A group forms by message: `startedBy.message`, else `earlierMessage`. The step rule of today stays the fallback for a link of the current turn with no message. Else the subagent is a group of its own. A group holds only running members, so the line rule of TurnTreeView gives REQ-18 with no change. The start of a group is the earliest start of its running members (requirements, "Place of a group"). Inside a group and among the groups of one level, the start order of today holds.
- **A subagent whose parent ended (INT-3). Gatekeeper decision, 2026-11-27.** As in requirements, "Place of a subagent whose parent ended". The subagents that one ended parent started by one message stay one group. Equal sort starts keep the start order of the subagents.
- **`number` stays (INT-2).** Only `turnChangeOf` reads it: a whole tree for a first tree or a new number, as today. The page no longer reads it (INT-10). So ActivityMonitor and TurnRoute keep their code, `noTurn()` included.
- **Scrolling (REQ-19).** The rule of TurnTreeView does not change. With INT-1 the latest started subagent is a running one. With INT-10 a new turn no longer resets the view: a user who scrolled up stays where they are.
- **Bar of an ended subagent (INT-11, INT-12). Gatekeeper decision, 2026-11-27.** TurnPanel already keeps the conversation open when its subagent ends. Today its bar then keeps the last state seen, so it would show "Running" for an ended subagent. The tree no longer carries an ended subagent, so the page cannot tell finished from stopped. The bar shows no state pill rather than a wrong one. "Back" works as today: the focus goes to the tree area when the row of that subagent is gone.
- **Text of `unavailable` (INT-9). Gatekeeper decision, 2026-11-27.** "Turn not available." names a turn (REQ-15), so it becomes "Subagents not available.".
- **SubagentCard does not change.** Its finished and stopped looks no longer show in the list. SubagentConversation still uses its state pill.
- **Styles.** The styles of the section of earlier turns and of the status chip of the panel header leave `src/web/styles.css` when nothing else uses them.
- **Specs updated with no code change.** The spec of TurnRoute no longer names `earlier` groups or a status in its frames. The specs of ActivityMonitor and TurnRoute speak of the subagents that run now, not of the tree of the current turn.
- **Replaced requirements.** The specs of the touched components drop the replaced REQs from "Requirements served" and cite REQ-14 to REQ-22. The list of replaced REQs is in `requirements.md`, "Constraints on the whole plan".
- **Indexes.** The rows that name "Turn Panel" or "Current Turn" change: TurnPanelButton, TurnPanel, TurnTreeView and `turnTreeOf` in `activity`, SessionView in `sessions`, ConversationView in `external`.
- **Tests.** Tests are the tester's work, not an INT. Vitest covers `turnTreeOf` (running subagents of any turn, groups with ended members, a child of an ended parent at one and at two levels), `turnChangeOf` and useTurn. Playwright e2e in the browser covers the scenarios below. The existing tests and fixtures change with this batch when they expect "Turn Panel", "Current Turn", "Ended", "No turn yet.", "Still running from earlier turns", "No subagents in this turn." or an ended row.
- **No Electron run** in any automatic cycle (knowledge base `electron-e2e-separate`). If the Electron spec names "Turn Panel", the tester updates it without running it.

## Human acceptance

### Scenario: The panel lists the subagents running now, of any turn

- REQ → REQ-14, REQ-15, REQ-16
- Given → two turns ago Claude started two sdd-developer subagents in one message, and both still run; in the current turn Claude started an sdd-analyst subagent, which has finished, then an sdd-tester subagent, which still runs
- When → the user opens the Subagents panel
- Then → the panel shows three rows: the two sdd-developers joined by a line, then the sdd-tester
- And → it shows no sdd-analyst row and no "Still running from earlier turns", and its header shows only "Subagents"

### Scenario: A subagent leaves the panel when it ends

- REQ → REQ-16, REQ-18
- Given → the Subagents panel shows two sdd-developer rows joined by a line
- When → the user waits until one of the two sdd-developers finishes
- Then → its row leaves the panel within 2 seconds
- And → the row of the other sdd-developer has no line

### Scenario: A subagent whose parent ended takes its place

- REQ → REQ-17
- Given → Claude started an sdd-analyst subagent, then an sdd-developer subagent; later the sdd-analyst started an sdd-tester subagent and finished, and the sdd-tester still runs
- When → the user opens the Subagents panel
- Then → the sdd-tester row comes first, then the sdd-developer row, both at the left edge of the panel

### Scenario: No subagent runs

- REQ → REQ-15, REQ-20
- Given → a session whose last turn ended after Claude answered with no subagent
- When → the user opens the Subagents panel
- Then → the panel says "No subagents running."
- And → it shows no "Ended" mark

### Scenario: The panel and its button are called "Subagents"

- REQ → REQ-21
- Given → a hosted session is open
- When → the user clicks the button "Subagents" in the session header
- Then → the panel opens with the title "Subagents"
- And → the tooltip of the button reads "Subagents"

### Scenario: The panel follows the latest subagent across turns

- REQ → REQ-19
- Given → the Subagents panel shows more rows than fit in it, and the user has not scrolled
- When → the user sends a new message, and Claude starts a new subagent
- Then → the panel scrolls to the row of the new subagent
- And → after the user scrolls up, the next new subagent does not move the panel

### Scenario: An open conversation stays open when its subagent ends

- REQ → REQ-22
- Given → from the Subagents panel, the user opened the conversation of a running sdd-developer
- When → the user waits until the sdd-developer finishes
- Then → the conversation stays open, and its bar no longer shows "Running"
- And → "Back" shows the list without the sdd-developer row
