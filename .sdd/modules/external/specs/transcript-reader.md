---
module: external
component: TranscriptReader
type: backend service
---

# TranscriptReader

**Purpose** → finds the transcript of a Claude Code session and turns its lines into the items of the read-only conversation view.

## Contract

- `new TranscriptReader(options?)`
  - `options.claudeDir` → the Claude Code folder. Default: `defaultClaudeDir()` of SessionHistory.
- `locate(cwd, sessionId) → Promise<string | undefined>` → the path of the transcript file.
  - first choice: `<claudeDir>/projects/<cwd with each character that is not a letter or a digit replaced by "-">/<sessionId>.jsonl`.
  - when that file does not exist: the first `<claudeDir>/projects/<any folder>/<sessionId>.jsonl` that exists.
  - no file, or a `sessionId` with characters other than letters, digits, `-` and `_` → `undefined`.
- `readFrom(file, offset) → Promise<{ items, offset }>` → the items of the complete lines after byte `offset`.
  - the returned `offset` is the byte after the last complete line read (a line ends with `\n`). A partial last line is read by a later call.
  - a file shorter than `offset`, or a file that cannot be read → no items, same `offset`.
- `itemsOf(entry) → ConversationItem[]` (exported function) → the items of one parsed transcript line.

`ConversationItem`:

- `{ kind: "user", text }` → a user message.
- `{ kind: "assistant", text }` → a text reply of Claude.
- `{ kind: "tool_call", name, summary }` → a tool call: the tool name and a one-line summary of its input.
- `{ kind: "tool_result", text, truncated }` → a tool result cut to its first 5 lines. `truncated` is `true` when lines were cut.

Line to items:

```
not valid JSON, not an object, isSidechain = true or isMeta = true    → none
type "user":
    the user message by SessionHistory userMessageOf, when not null    → user item
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

Tool call summary:

```
value = the first string among input.command, input.file_path, input.path, input.pattern,
        input.url, input.query, input.description, input.prompt
        else the first string value of input
        else JSON of input ("" when there is no input)
summary = value with whitespace collapsed to one space, trimmed, cut to 120 characters
          plus "…" when it was longer
```

## Rules and invariants

- It opens files read-only. It never creates, changes or deletes anything under `claudeDir`.
- It reads `projects` only.

## Dependencies

- SessionHistory (module history), for `defaultClaudeDir()` and `userMessageOf`

## Requirements served

- `plan-claude_sessions_client/REQ-33`, `plan-claude_sessions_client/REQ-36`
