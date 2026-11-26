---
batch: workflow-subagents
feature: Workflow subagents
closed_req: [REQ-56, REQ-57, REQ-58, REQ-59, REQ-60]
depends: [subagent-conversation]
---

# Batch workflow-subagents — Workflow subagents

REQ ids refer to `plan-session_activity/requirements.md`. The words "workflow", "workflow subagent", "subagent type" and "turn panel" are defined there.

The turn model and the activity monitor come from `batch-latest-text`. The subagent file lookup by agent id comes from `batch-subagent-conversation/INT-2`. Their paths are in the indexes of the modules `activity` and `external`.

## What this batch builds

- **Workflow run rule** → tells whether a workflow subagent runs, has finished or was stopped, because its metadata never gets `finished`.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/external/transcript-reader.ts` | New exported lookup of the workflow subagent files: the `agent-*.jsonl` files of each folder `subagents/workflows/<run id>/`, each with its run id, sorted by name. `subagentFilesOf` does not change. | REQ-56, REQ-57, REQ-58 | — |
| INT-2 | modify | `src/server/external/transcript-reader.ts` | The subagent file lookup of `batch-subagent-conversation/INT-2` also finds `subagents/workflows/<run id>/agent-<id>.jsonl`. The run id gets the same character check as the agent id. | REQ-59 | — |
| INT-3 | create | backend, module `activity` | Workflow run rule. A `result` event of the subagent in its run journal → finished. Else: its launch is over, it started before the latest launch of its run, or the session ended → stopped. Else → running. | REQ-56, REQ-60 | — |
| INT-4 | modify | backend, module `activity`: the turn model of `batch-latest-text/INT-6` | Records each workflow launch, in any conversation: the Workflow call, its run id (`toolUseResult.runId`, else "Run ID: " in the result text), its task id and its time. A task notification or a successful TaskStop for that task id ends the launch. | REQ-58, REQ-60 | — |
| INT-5 | modify | backend, module `activity`: the turn model of `batch-latest-text/INT-6` | Keeps each workflow subagent as a subagent: lines, metadata, `started` and `result` events of its run journal, state (INT-3). It links it to the latest launch of its run that started before its first line. | REQ-56, REQ-57, REQ-58, REQ-60 | INT-3, INT-4 |
| INT-6 | modify | backend, module `activity`: the activity monitor of `batch-latest-text/INT-9` | Also reads the files of INT-1, their metadata and the `journal.jsonl` of each run: new lines only, inside the same byte limit per poll. | REQ-56, REQ-57, REQ-58 | INT-1, INT-5 |

## Decisions

- **Facts read in the real files** on 2026-11-26: 6 workflow runs and 148 agent files of 2026-11-04, 2026-11-23 and 2026-11-24, read-only.
  - Each run has a folder `<session>/subagents/workflows/<run id>/` with `agent-<id>.jsonl`, `agent-<id>.meta.json` and `journal.jsonl`. Each agent line has `isSidechain: true`, `agentId` and `timestamp`.
  - The metadata has `agentType` ("workflow-subagent" in every file), `description` (the agent label, for example "review:git"), `workflowPhase` and `pickedEffortModel`. It has no `toolUseId` and no `finished`.
  - The journal has `{"type":"launched"}`, then `started` and `result` events with `agentId`, `label` and `phase`. Its lines have no time. A finished agent has a `result` event. A killed agent does not.
  - Launch → the result line of the Workflow call has `toolUseResult` with `status: "async_launched"`, `taskId` and `runId`. Its text also says "Run ID: <run id>".
  - End → a user line with `<task-notification>`, `<task-id>`, `<tool-use-id>` and `<status>` (seen: `completed`, `stopped`, `killed`). A run that Claude stopped with TaskStop had no notification: only the TaskStop call with `task_id` and its result "Successfully stopped task".
  - A resume launches the same run id again, with a new task id. The journal gets no second `launched`.
- **Not used:** `<session>/workflows/<run id>.json`. It holds the run status, but its agent states stayed "progress" in a killed run, and it is not known whether it is written during the run.
- **Usage figures do not change.** `subagentFilesOf` keeps skipping sub-folders, so UsageMonitor does not count workflow subagents. That would change `plan-session_usage`, which is out of scope.
- **Subagent type. Gatekeeper decision, 2026-11-26.** A workflow subagent shows the type that Claude Code records: "workflow-subagent" (REQ-4, REQ-19, REQ-32). Its task description in the turn panel is its label.
- **Place in the tree.** One group per launch, at the step of the Workflow call (requirements, "One group per workflow"). A subagent cannot start a workflow, so the Workflow call is always a step of the main conversation. After a resume, each subagent sits at the launch it started under.
- **No UI change.** The latest-text line, the stall signal, the turn panel and the subagent conversation show a workflow subagent with their existing parts. The subagent conversation route finds its file through INT-2.
- **Live run, optional. Gatekeeper decision, 2026-11-26.** When a live run is possible, the developer runs one short workflow and checks the facts above. Otherwise the batch relies on the facts read in the files, and does not stop. The run rule (INT-3) must hold whether the journal is written during the run or only at its end.
- **Tests.** Vitest for INT-1 to INT-6, with fixture runs: completed, stopped by TaskStop, ended by a `killed` notification, resumed, and cut by the end of the session. The e2e tests are the tester's work. No Electron e2e (knowledge base `electron-e2e-separate`).

## Human acceptance

### Scenario: A running workflow keeps the session at work

- REQ → REQ-56
- Given → a session whose turn ended after Claude launched a workflow of 4 agents
- When → one agent of the workflow writes "Checking the Maven resolution"
- Then → the idle entry shows "workflow-subagent: Checking the Maven resolution · 0 s"

### Scenario: A silent workflow agent shows in the stall signal

- REQ → REQ-57
- Given → a session at work whose only running work is a workflow agent that runs `mvn test`
- When → nothing new is written for 6 minutes
- Then → the entry shows "No activity for 6 min · workflow-subagent: mvn test running"

### Scenario: The turn panel shows the agents of a workflow

- REQ → REQ-58
- Given → a turn in which Claude launched a workflow of 4 agents
- When → the user opens the turn panel
- Then → the 4 agents appear side by side as one group at the Workflow step, each with its label, model, state, duration, latest text and current tool

### Scenario: The conversation of a workflow agent

- REQ → REQ-59
- Given → the turn panel shows the agents of a workflow
- When → the user clicks the card of one agent
- Then → the panel shows its conversation, from its task to its latest step, and updates it live

### Scenario: An ended workflow stops keeping the session at work

- REQ → REQ-60
- Given → a session that is idle while its workflow runs
- When → the user asks Claude to stop the workflow, with 2 agents finished and 2 still running
- Then → the turn panel shows 2 agents "Finished" and 2 "Stopped", and the entry no longer shows the latest-text line
