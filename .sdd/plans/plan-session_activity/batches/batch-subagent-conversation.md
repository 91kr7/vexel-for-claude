---
batch: subagent-conversation
feature: Subagent conversation
closed_req: [REQ-49, REQ-50, REQ-51, REQ-52, REQ-53, REQ-54, REQ-55]
depends: [turn-panel]
---

# Batch subagent-conversation — Subagent conversation

REQ ids refer to `plan-session_activity/requirements.md`. The words "turn panel" and "subagent conversation" are defined there.

The turn panel and the subagent card come from `batch-turn-panel`. The sidechain option of `itemsOf` comes from `batch-latest-text/INT-1`. Their paths are in the indexes of the modules `activity` and `external`.

## What this batch builds

- **Subagent conversation route** → a WebSocket that streams the items of one subagent file, then the new ones live.
- **Subagent item content route** → the full content of one tool call or tool result of a subagent.
- **Conversation body** → the message list of ConversationView, taken out of it, so a subagent conversation shows the same way.
- **Subagent conversation** → the view of one subagent inside the turn panel, with "Back".

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/external/transcript-reader.ts` | `readFrom` and `readItem` get the sidechain option of `batch-latest-text/INT-1`. Without it nothing changes. | REQ-49, REQ-50 | — |
| INT-2 | modify | `src/server/external/transcript-reader.ts` | New exported lookup: the subagent file of an agent id, next to a main transcript. An id with characters other than letters, digits, `-` and `_`, or no such file → none. | REQ-49 | — |
| INT-3 | create | backend, module `activity` | Subagent conversation route: WebSocket `GET /api/sessions/:id/subagents/:agentId/conversation`, for a hosted or external id. Same frames and 1000 ms checks as ConversationStreamRoute, on the subagent file, with the sidechain option. Unknown session or agent → close `4404`. | REQ-49, REQ-51, REQ-52 | INT-1, INT-2 |
| INT-4 | create | backend, module `activity` | Subagent item content route: `GET /api/sessions/:id/subagents/:agentId/items?offset=<n>&block=<n>`, with the answers of ItemContentRoute, on the subagent file, with the sidechain option. | REQ-50 | INT-1, INT-2 |
| INT-5 | modify | `src/server/main.ts` | Registers the routes of INT-3 and INT-4. The LocalAccessGuard covers them, as every route. | REQ-49 | INT-3, INT-4 |
| INT-6 | create | frontend, module `external` | Conversation body, taken out of ConversationView: items, tool cards, loading of full content, scrolling, "N new messages", new socket every 2 s. It takes the stream address, the content address and the name of user items. | REQ-50, REQ-51 | — |
| INT-7 | modify | `src/web/external/ConversationView.tsx` | Uses INT-6 for its content. Nothing visible changes for an external session. | REQ-50 | INT-6 |
| INT-8 | create | frontend, module `activity` | Subagent conversation: a bar with "Back", the type, the description and the state; below it INT-6 on the routes of INT-3 and INT-4, with user items named "Task". No input field. Esc inside it acts as "Back". | REQ-49, REQ-50, REQ-54, REQ-55 | INT-6 |
| INT-9 | modify | frontend, module `activity`: the subagent card of `batch-turn-panel/INT-10` | The card becomes a button named "Open Conversation: <type>". A click, Enter or Space opens the conversation. It shows the focus ring. | REQ-49, REQ-55 | — |
| INT-10 | modify | frontend, module `activity`: the turn panel of `batch-turn-panel/INT-11` | Shows INT-8 in place of the tree for the chosen subagent. "Back" returns to the tree, with its scroll kept and the focus on that card. The session view around it does not change. | REQ-53, REQ-54, REQ-55 | INT-8, INT-9 |

## Decisions

- **Place.** The conversation opens inside the turn panel, in place of the tree (requirements, "Place of the subagent conversation"). The terminal or the conversation of the session stays on screen (REQ-53).
- **Same look as an external session (REQ-50).** The conversation body is taken out of ConversationView and used by both. The tests of ConversationView must stay green with no change of their expectations.
- **Name of the user items. Gatekeeper decision, 2026-11-26.** In a subagent conversation the user items come from the parent agent, not from the user. So they are named "Task", not "You". The first one is the task.
- **Read-only.** The two routes open files read-only, as ConversationStreamRoute and ItemContentRoute. The agent id check of INT-2 keeps a request inside the `subagents/` folder.
- **A subagent that leaves the tree.** An open conversation stays open when its subagent ends or a new turn starts. A new session in the view closes the panel, as today.
- **Tests.** Vitest for INT-1 to INT-4, with fake subagent files. Vitest or Playwright for INT-6 and INT-7: the existing ConversationView tests must pass unchanged. Playwright e2e in the browser for the conversation, with fixture files. No Electron e2e: the panel's desktop check is in `batch-turn-panel/INT-16` (knowledge base `electron-e2e-separate`).

## Human acceptance

### Scenario: The user reads the live conversation of a subagent

- REQ → REQ-49, REQ-50, REQ-51, REQ-53
- Given → a hosted session at work runs an sdd-tester subagent, and the turn panel is open
- When → the user clicks the card of the subagent
- Then → the panel shows its conversation read-only, from its task to its latest step, with the tool cards of an external session, and the terminal stays on screen
- And → a new step of the subagent appears within 2 seconds

### Scenario: The conversation of an ended subagent

- REQ → REQ-52
- Given → the turn panel of an external session shows a finished subagent and a stopped one
- When → the user clicks each card
- Then → each conversation opens, with its last step at the end

### Scenario: One action returns to the tree

- REQ → REQ-54
- Given → the panel shows the conversation of a subagent
- When → the user clicks "Back"
- Then → the panel shows the tree again, at the same scroll place

### Scenario: The full content of a tool card

- REQ → REQ-50
- Given → the conversation of a subagent shows a tool result cut to 5 lines
- When → the user opens that tool card
- Then → the card shows the full output, as in the conversation of an external session

### Scenario: The conversation works with the keyboard

- REQ → REQ-55
- Given → the turn panel is open
- When → the user tabs to a subagent card, presses Enter, then presses Esc
- Then → the conversation opens and closes, the focus goes back to the card, and each focused element shows the focus ring
