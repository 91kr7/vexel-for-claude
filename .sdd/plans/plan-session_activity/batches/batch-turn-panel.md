---
batch: turn-panel
feature: Turn panel
closed_req: [REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40, REQ-41, REQ-42, REQ-43, REQ-44, REQ-45, REQ-46, REQ-47, REQ-48]
depends: [stall-signal]
---

# Batch turn-panel — Turn panel

REQ ids refer to `plan-session_activity/requirements.md`. The words "turn", "current turn", "step", "main conversation", "running-tool line" and "turn panel" are defined there.

The turn model, the activity monitor, the short duration format and the elapsed time come from `batch-latest-text`. The open tool calls of each conversation come from `batch-stall-signal`. Their paths are in the index of the module `activity`.

## What this batch builds

- **Turn route** → a WebSocket that streams the turn tree of a hosted or external session: the steps of the current turn, with each subagent at the step that started it. The turn model of `batch-latest-text` builds the tree (INT-1 to INT-4).
- **Turn store** → the page side of the turn route.
- **"Turn Panel" button** → opens and closes the panel from the session header.
- **Turn panel** → the panel at the right of the session content.
- **Tree view** → the steps of the turn inside the panel, with the subagent groups at their steps and the nested groups in their parent cards.
- **Subagent card** → the fields of one subagent in the tree.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | backend, module `activity`: the turn model of `batch-latest-text/INT-6` | Keeps the steps of the current turn of the main conversation, in order. A text → plain, cut at 400 characters. A tool call → name, first line of its main argument, outcome: running, completed or error. | REQ-28, REQ-29, REQ-30 | — |
| INT-2 | modify | backend, module `activity`: same model | Links each subagent to the call that started it (metadata `toolUseId`), in the main conversation or in another subagent. Calls that start subagents with no other step between them form one group. | REQ-31, REQ-37, REQ-38 | INT-1 |
| INT-3 | modify | backend, module `activity`: same model | Keeps for each subagent its start and end time (its first and last line) and its model: metadata, else the model of its latest response. A new turn keeps the subagents that still run, apart from the new steps. | REQ-32, REQ-34, REQ-39 | INT-2 |
| INT-4 | modify | backend, module `activity`: the activity monitor of `batch-latest-text/INT-10` | `turnOf(id)` → status (none; running in `working` or `needs_input`; else ended), steps, groups, and per subagent its fields, state, latest text and current tool (`runningToolOf` on its open calls). It notifies the parts that changed. | REQ-28, REQ-33, REQ-35, REQ-36, REQ-40, REQ-41, REQ-44 | INT-3 |
| INT-5 | create | backend, module `activity` | Turn route: WebSocket `GET /api/sessions/:id/turn` for a hosted or external id. First frame: the whole tree. Then only the new steps, the changed steps and the changed subagents. A new turn sends the whole tree. Unknown id → close `4404`. | REQ-27, REQ-43, REQ-45 | INT-4 |
| INT-6 | modify | `src/server/main.ts` | Registers the route of INT-5 with the monitor, the tracker and the scanner. The LocalAccessGuard covers it, as every route. | REQ-27 | INT-5 |
| INT-7 | modify | `src/web/icons/Icons.tsx` | Adds the Lucide `list-tree` icon. | REQ-27 | — |
| INT-8 | create | frontend, module `activity` | Turn store of the open session: opens the route, applies the frames, opens a new socket 2 s after a lost one, as ConversationView. The first frame of a new socket replaces the tree. | REQ-43 | INT-5 |
| INT-9 | create | frontend, module `activity` | "Turn Panel" icon button (`list-tree`) with the look of GitExplorerButton: accessible name and tooltip "Turn Panel", `aria-expanded`, global focus ring. It shows for every session. | REQ-27, REQ-47 | INT-7 |
| INT-10 | create | frontend, module `activity` | Subagent card: type chip, description, model, state pill "Running", "Finished" or "Stopped", duration (elapsed time while running, fixed once ended), latest text on two lines, current tool as the running-tool line. A missing field leaves its place empty. | REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-44 | — |
| INT-11 | create | frontend, module `activity` | Turn panel: region "Turn Panel", look, size and slide of GitExplorerPanel. Header "Current Turn" with the chip "Running" or "Ended". Before the first turn → AreaState `empty` "No turn yet.". | REQ-27, REQ-40, REQ-41, REQ-47 | INT-8 |
| INT-12 | create | frontend, module `activity` | Tree of the panel: the steps in order, a tool step with name, argument and outcome. At its step, a subagent group in a grid of columns of at least 180 px that wraps. Nested groups inside the parent card. Section "Still running from earlier turns" at the top. | REQ-29, REQ-30, REQ-31, REQ-37, REQ-38, REQ-39, REQ-46 | INT-10, INT-11 |
| INT-13 | create | frontend, module `activity`: same tree as INT-12 | Scrolling: at the end (8 px rule of ConversationView) the tree follows the latest step; scrolled up, it stays still. It shows the last 200 steps, with the button "Show N earlier steps" for 200 more. The tree area takes the keyboard focus. | REQ-42, REQ-45, REQ-47 | INT-12 |
| INT-14 | modify | `src/web/sessions/SessionView.tsx` | Puts INT-9 after GitExplorerButton, and INT-11 in the place of the GitExplorerPanel. One side panel at a time: opening one closes the other. The terminal fits the width that is left. | REQ-27 | INT-9, INT-11 |
| INT-15 | modify | `src/web/external/ConversationView.tsx` | Same as INT-14, beside the conversation. INT-9 sits after GitExplorerButton and before "Resume Here". | REQ-27 | INT-9, INT-11 |
| INT-16 | create | e2e, Electron group | Electron e2e spec: in the desktop window, "Turn Panel" opens the panel, and the panel shows the tree of a fixture turn with one subagent. | REQ-48 | INT-14 |

## Decisions

- **One reader for the list and the panel.** The activity monitor holds the tree of every session. The route only sends it. The model keeps the steps of the current turn only, with cut texts, and a fixed set of fields per subagent. So a subagent with thousands of steps costs the same as a short one (REQ-45).
- **A turn runs** while the session is `working` or `needs_input`. In any other state the panel marks the turn as ended (REQ-40). Subagents that still run keep the state "Running".
- **Group rule (REQ-37). Gatekeeper decision, 2026-11-26** (requirements, "At the same time"). Subagents started at the same step run side by side, as one group. Claude Code starts parallel subagents with calls in one message. Two subagents started at different steps stay at their own steps, also when their runs overlap, because REQ-31 places each one at its step.
- **Still running from earlier turns (REQ-39).** These subagents show in their own section at the top of the tree, with their cards. A finished one leaves the section at the next update.
- **Model (REQ-32).** The model in the metadata, as recorded by Claude Code. Without it, the model of the latest response line of the subagent. Without both, the field is empty (REQ-44).
- **Current tool (REQ-36).** It has the form of the running-tool line: "<name>: <argument>", then "+N". It has no 1-second hold.
- **Outcome of a tool step (REQ-30).** "Running", "Completed" or "Error", in the colours of the tool cards of ConversationView.
- **Shape of the panel.** Gatekeeper decision of 2026-11-26, recorded in the requirements ("Shape of the turn panel"). The panel is closed when the session view opens, as the git explorer.
- **Look of the subagent card.** Surface `--role-card`, 1 px `--role-border-subtle` border, `--radius-card`, padding 8 × 10 px. The type is a mono chip. The state pill uses the status colours: emerald for running, muted for finished, orange of "Interrupt" for stopped. The latest text and the current tool follow the look of the latest-text line and of the running-tool line.
- **Long turns (REQ-45).** The panel renders the last 200 steps. It renders the earlier ones only on demand, so a turn with thousands of steps does not slow the page.
- **Tests.** Vitest for INT-1 to INT-5 and INT-8, with fake files and a fake clock. Playwright e2e in the browser for the panel, with fixture files. INT-16 is the only Electron spec, in the Electron group (knowledge base `electron-e2e-separate`).

## Human acceptance

### Scenario: The user follows the turn and its subagents

- REQ → REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37, REQ-43
- Given → a hosted session works on a turn: Claude wrote a text, ran `git status`, then started two sdd-developer subagents in one message
- When → the user clicks "Turn Panel" in the session header
- Then → the panel shows the text, "Bash: git status" as completed, and the two subagents side by side under that step, each with type, task, model, "Running", a duration that counts up, its latest text and its current tool
- And → a new step of Claude appears in the panel within 2 seconds

### Scenario: The panel takes the place of the git explorer

- REQ → REQ-27
- Given → an external session in a git repository, with the git explorer open
- When → the user clicks "Turn Panel"
- Then → the git explorer closes and the turn panel opens in its place, at the right of the conversation

### Scenario: A nested subagent appears under its parent

- REQ → REQ-38
- Given → a subagent of the current turn starts a subagent of its own
- When → the user looks at the turn panel
- Then → the new subagent appears inside the card of its parent

### Scenario: An interrupt stops the subagents

- REQ → REQ-33, REQ-34
- Given → the turn panel shows a running subagent
- When → the user interrupts the session
- Then → the subagent shows "Stopped", and its duration stops at its full run time

### Scenario: A background subagent outlives its turn

- REQ → REQ-39, REQ-40
- Given → a turn ended while a background subagent still runs
- When → the user sends a new message to the session
- Then → the panel shows the new turn, and the subagent stays in "Still running from earlier turns"
- And → when the session is idle again, the panel shows the last turn marked "Ended"

### Scenario: A session with no turn

- REQ → REQ-41
- Given → a new hosted session where the user has sent no message yet
- When → the user opens the turn panel
- Then → the panel says "No turn yet."

### Scenario: The panel follows the latest step

- REQ → REQ-42
- Given → the turn panel is open on a running turn, at the end of the tree
- When → new steps arrive, then the user scrolls up and more steps arrive
- Then → the panel scrolls to each new step until the user scrolls up, and then stays still

### Scenario: A large turn stays usable

- REQ → REQ-45, REQ-46
- Given → a turn with thousands of steps and 20 subagents running at once, one of them running for 16 hours
- When → the user opens the turn panel and scrolls it
- Then → the panel reacts at once and shows the 20 subagents in one wrapping group

### Scenario: Missing data hides only its field

- REQ → REQ-44
- Given → a subagent whose metadata has no description and no model, and whose lines have no model
- When → the user opens the turn panel
- Then → its card shows the other fields, with no description and no model

### Scenario: The panel works with the keyboard and in the desktop window

- REQ → REQ-47, REQ-48
- Given → the desktop window shows a session with a running turn
- When → the user reaches "Turn Panel" with Tab, presses Enter, and tabs into the panel
- Then → the panel opens, and each focused element shows the focus ring
