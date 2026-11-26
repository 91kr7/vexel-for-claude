---
module: external
component: TranscriptReader
type: backend service
---

# TranscriptReader

**Purpose** → finds the transcript of a Claude Code session and of its subagents, and turns its lines into the items of the read-only conversation view. It also reads the full content of one tool item.

## Contract

- `new TranscriptReader(options?)`
  - `options.claudeDir` → the Claude Code folder. Default: `defaultClaudeDir()` of SessionHistory.
- `locate(cwd, sessionId) → Promise<string | undefined>` → the path of the transcript file.
  - first choice: `<claudeDir>/projects/<cwd with each character that is not a letter or a digit replaced by "-">/<sessionId>.jsonl`.
  - when that file does not exist: the first `<claudeDir>/projects/<any folder>/<sessionId>.jsonl` that exists.
  - no file, or a `sessionId` with characters other than letters, digits, `-` and `_` → `undefined`.
- `readFrom(file, offset, options?) → Promise<{ items, offset }>` → the items of the complete lines after byte `offset`, by `itemsOf` with the same `options`.
  - the returned `offset` is the byte after the last complete line read (a line ends with `\n`). A partial last line is read by a later call.
  - a file shorter than `offset`, or a file that cannot be read → no items, same `offset`.
  - each `tool_call` and `tool_result` item carries its `ref`.
- `readEntriesFrom(file, offset, maxBytes?) → Promise<{ entries, offset, more }>` → the parsed lines after byte `offset`, with no conversion to items.
  - `entries` → one per complete line that is valid JSON and a JSON object (not an array), in file order. Any other line gives nothing.
  - `offset` → the same rule as `readFrom`. A file shorter than `offset`, or a file that cannot be read → no entries, same `offset`, `more` false.
  - `maxBytes` → the call reads at most this many bytes after `offset`. Default: no limit. A single line longer than `maxBytes` is read whole, so the reading always moves on.
  - `more` → `true` when the call stopped at `maxBytes` and the file has more bytes after the returned `offset`. `false` when the call reached the end of the file (a partial last line included).
- `readItem(file, ref, options?) → Promise<string | undefined>` → the full content of the item that `ref` points to.
  - `tool_call` → its whole `input` as JSON indented by 2 spaces. No `input` → `""`.
  - `tool_result` → its whole text, by the "Tool result text" rule below, with no cut.
  - `undefined` when: `ref.offset` is not the start of a complete line; the line is not valid JSON; the block is not a `tool_use` of an `assistant` line or a `tool_result` of a `user` line; the line is a meta entry; the line is a sidechain entry and `options.sidechain` is not `true`; the file cannot be read.
- `subagentFileOf(file, agentId) → Promise<string | undefined>` (exported function) → the file of one subagent, regular or of a workflow.
  - `agentId` → the subagent file name without `.jsonl`, for example `agent-a1b2`: the subagent id of TurnModel.

```
agentId with characters other than letters, digits, "-" and "_"          → undefined
<file without ".jsonl">/subagents/<agentId>.jsonl is a file              → that file
agentId starts with "agent-" → for each run id of the folder
<file without ".jsonl">/subagents/workflows/, as in workflowSubagentFilesOf:
    <run id>/<agentId>.jsonl is a file                                   → the first such file
anything else                                                            → undefined
```
- `subagentFilesOf(file) → Promise<string[]>` (exported function) → the `.jsonl` files of the folder `<file without ".jsonl">/subagents/`, sorted by name. Other files there (for example `*.meta.json`) and sub-folders are left out. No folder, or a folder that cannot be read → `[]`.
- `workflowSubagentFilesOf(file) → Promise<WorkflowSubagentFile[]>` (exported function) → the files of the workflow subagents of the session.
  - run ids → the names of the sub-folders of `<file without ".jsonl">/subagents/workflows/` made of letters, digits, `-` and `_` only, sorted.
  - for each run id, its files `agent-*.jsonl` sorted by name, each as `WorkflowSubagentFile` → `{ file, runId, journal }`. `journal` → the file `journal.jsonl` of the same folder, whether it exists or not.
  - other files (for example `*.meta.json` and `journal.jsonl`) are left out. No folder, or a folder that cannot be read → no file from it.
- `subagentMetaOf(file) → Promise<SubagentMeta>` (exported function) → the metadata of the subagent file `file` (`<folder>/agent-<id>.jsonl`), read from `<file without ".jsonl">.meta.json`.
  - `SubagentMeta` → `{ agentType?, description?, toolUseId?, model?, finished? }`: the fields of the same name, except `model`. The first four when they are strings, `finished` when it is a boolean. A field of another type is absent.
  - `model` → `pickedEffortModel` when it is a string; else `model` when it is a string; else absent.
  - no file, a file that cannot be read, bad JSON, or JSON that is not an object (an array too) → `{}`.
- `itemsOf(entry, lineOffset?, options?) → ConversationItem[]` (exported function) → the items of one parsed transcript line.
  - with `lineOffset` → each tool item carries `ref: { offset: lineOffset, block }`. Without it → no `ref`.
  - `options.sidechain: true` → a line with `isSidechain: true` (a line of a subagent file) gives its items as any other line, user message included. Without the option, such a line gives none.
- `mainArgumentOf(input) → string | undefined` (exported function) → the main argument of a tool input, by the "Main argument" rule below. The text is returned as it is: no trim, no cut.

`ConversationItem`:

- `{ kind: "user", text, timestamp? }` → a user message. `timestamp` → the `timestamp` of its line, when it is a string.
- `{ kind: "assistant", text }` → a text reply of Claude.
- `{ kind: "tool_call", name, summary, moreInput?, id?, ref? }` → a tool call: the tool name and a one-line summary of its input.
  - `id` → the `id` of the `tool_use` block, when it is a string.
  - `moreInput: true` → the full input shows more than the summary (rule "More input" below). Absent otherwise.
- `{ kind: "tool_result", text, truncated, isError?, toolUseId?, ref? }` → a tool result cut to its first 5 lines. `truncated` is `true` when lines were cut.
  - `toolUseId` → the `tool_use_id` of the block, when it is a string.
  - `isError: true` → the block has `is_error` `true`. Absent otherwise.
- `ref` → `{ offset, block }`: the byte offset where the item's line starts in the file, and the index of the item's block in `message.content` (counted over all the array elements).

Line to items:

```
not valid JSON, not an object, isMeta = true                          → none
isSidechain = true, without options.sidechain                         → none
type "user":
    the user message by SessionHistory userMessageOf, when not null    → user item
    (with options.sidechain, the line is read as if isSidechain were false)
    each block of message.content with type "tool_result"             → tool_result item
type "assistant", message.content a string, not blank                 → assistant item
type "assistant", for each block of message.content, in order:
    type "text", text not blank                                       → assistant item (trimmed)
    type "tool_use"                                                   → tool_call item
    any other block (for example "thinking")                          → none
any other type                                                        → none
```

Tool result text:

```
content a string                    → that string
content an array                    → the "text" of its blocks with type "text", joined by "\n"
then: trailing whitespace removed; more than 5 lines → first 5 lines, truncated = true
```

Main argument:

```
input an object (an array too) → the first string among input.command, input.file_path, input.path,
                                 input.pattern, input.url, input.query, input.description, input.prompt
                                 else the first string value of input
                                 else none
anything else (no input, null, a string, a number) → none
```

Tool call summary:

```
value = the main argument
        else JSON of input ("" when there is no input)
summary = value with whitespace collapsed to one space, trimmed, cut to 120 characters
          plus "…" when it was longer
```

More input:

```
no input                                                   → no moreInput
input an object with no keys                               → no moreInput
input an object with one key, whose value equals summary   → no moreInput
anything else (more keys, a cut or reflowed value, input
not an object)                                             → moreInput: true
```

## Rules and invariants

- It opens files read-only. It never creates, changes or deletes anything under `claudeDir`.
- It reads `projects` only.

## Assumptions

Metadata file of a subagent, checked on Claude Code 2.1.332, 2026-11-26:

- Claude Code writes `agent-<id>.meta.json` next to `agent-<id>.jsonl` when the subagent starts. It has no `finished` while the subagent runs, and gets `finished: true` when the subagent completes.
- A subagent stopped by the user, or cut by the end of its session, often has no `finished`.
- Workflow subagents live in sub-folders of `subagents/` (`workflows/wf_*/`), with their metadata and the run journal `journal.jsonl`. Their metadata never gets `finished`. `subagentFilesOf` does not list them, so usage figures leave them out.
- The model of the subagent is under the key `pickedEffortModel`. No metadata file has a key `model` (40 files checked, gatekeeper, 2026-11-26). `model` is read only as a fallback, for other versions.

## Dependencies

- SessionHistory (module history), for `defaultClaudeDir()` and `userMessageOf`

## Requirements served

- `plan-claude_sessions_client/REQ-33`, `plan-claude_sessions_client/REQ-36`
- `plan-claude_sessions_client-ui_redesign/REQ-21`, `plan-claude_sessions_client-ui_redesign/REQ-24`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-36`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-39`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-40`
- `plan-session_list_improvements/REQ-15`, `plan-session_list_improvements/REQ-16`
- `plan-session_usage/REQ-3`, `plan-session_usage/REQ-14`, `plan-session_usage/REQ-21`
- `plan-session_activity/REQ-1`, `plan-session_activity/REQ-3`, `plan-session_activity/REQ-4`, `plan-session_activity/REQ-13`, `plan-session_activity/REQ-49`, `plan-session_activity/REQ-50`
- `plan-session_activity/REQ-56`, `plan-session_activity/REQ-57`, `plan-session_activity/REQ-58`, `plan-session_activity/REQ-59`
