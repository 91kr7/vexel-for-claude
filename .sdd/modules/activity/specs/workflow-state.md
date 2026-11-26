---
module: activity
component: workflowSubagentStateOf
type: backend function
---

# workflowSubagentStateOf

**Purpose** → the workflow run rule: tells whether a workflow subagent runs, has finished or was stopped, because its metadata never gets `finished`. It also reads the launch and the end of a workflow in a transcript line.

## Contract

- `workflowSubagentStateOf({ result, launchOver, startedBeforeLatestLaunch, sessionEnded }) → "running" | "finished" | "stopped"`
  - `result` → the run journal has a `result` event of the subagent.
  - `launchOver` → the launch that the subagent started under is over.
  - `startedBeforeLatestLaunch` → its run was launched again after the subagent started (a resume).
  - `sessionEnded` → its session has ended.

```
result is true                                          → "finished"
launchOver, startedBeforeLatestLaunch or sessionEnded   → "stopped"
anything else                                           → "running"
```

- `workflowLaunchOf(entry, toolUseId) → { runId, taskId? } | undefined` → the run and the task that the Workflow call `toolUseId` started. `entry` is the parsed line with the result of that call.

```
no block of message.content with type "tool_result" and tool_use_id = toolUseId,
or that block has is_error true                                  → undefined
text   = the content of that block when a string; else the "text" of its blocks of type "text", joined by "\n"
runId  = toolUseResult.runId when a non-empty string; else the word after "Run ID: " in text
taskId = toolUseResult.taskId when a non-empty string; else the word after "Task ID: " in text; else absent
no runId                                                         → undefined
```

- `taskStopSucceeded(entry, toolUseId) → boolean` → `true` when `entry` holds the result block of the TaskStop call `toolUseId`, the block has no `is_error` true, and its text (as above) contains "Successfully stopped task". Else `false`.
- `notifiedTaskIdOf(text) → string | undefined` → the task id of a task notification, whatever its status.

```
text does not start with "<task-notification>"   → undefined
<task-id>…</task-id> not empty                   → that task id, trimmed
anything else                                    → undefined
```

## Assumptions

Facts read on 2026-11-26 in the files of 6 workflow runs (2026-11-04, 2026-11-23, 2026-11-24):

- The Workflow call returns at once. Its result line has `toolUseResult` with `status: "async_launched"`, `taskId` and `runId`. Its text says "Task ID: <task id>" on the first line and "Run ID: <run id>" further down.
- The run journal (`journal.jsonl`) gets a `started` event when an agent starts and a `result` event when it finishes. A killed agent gets no `result`. The journal is written during the run.
- A workflow ends with a task notification of its task id (`completed`, `stopped`, `killed`), or with no notification after a successful TaskStop, whose result says "Successfully stopped task".
- A resume launches the same run id again, with a new task id. The agents of the earlier launch that did not finish do not go on.

## Dependencies

- SubagentState of subagentStateOf

## Requirements served

- `plan-session_activity/REQ-56`, `plan-session_activity/REQ-60`
