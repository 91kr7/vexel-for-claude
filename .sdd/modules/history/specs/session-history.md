---
module: history
component: SessionHistory
type: backend service
---

# SessionHistory

**Purpose** → reads the past Claude Code sessions of the machine from the Claude Code history. It never writes.

## Contract

- `new SessionHistory(options?)`
  - `options.claudeDir` → the Claude Code folder. Default: `defaultClaudeDir()`.
- `defaultClaudeDir()` → the environment variable `CLAUDE_CONFIG_DIR` when it is set and not empty, `<home>/.claude` otherwise. `<home>` follows the `HOME` variable.
- `list() → Promise<PastSession[]>` → one entry per file `<claudeDir>/projects/<project>/<sessionId>.jsonl`, the most recently changed first.
  - files deeper in the tree (for example `<sessionId>/subagents/*.jsonl`) are not sessions.
  - no `projects` folder → empty list.
  - a folder or file that cannot be read is skipped.
- `get(sessionId) → Promise<PastSession | undefined>` → the session with that id, or `undefined`.
  - an id with characters other than letters, digits, `-` and `_` → `undefined`. No file is opened.

- `userMessageOf(entry) → string | null` → the first user message rule below, applied to one parsed line.

`PastSession` → `{ id, folder, firstUserMessage, lastModified }`.

- `id` → the file name without `.jsonl`. It is the id that `claude --resume` takes.
- `folder` → the `cwd` of the first entry that has one. `null` when no entry has one.
- `firstUserMessage` → the text of the first user message, trimmed. `null` when the session has none.
- `lastModified` → the time of the last change of the file (`Date`).

First user message (each line of the file is one JSON entry):

```
skip lines that are not valid JSON
skip entries where type ≠ "user", isMeta = true or isSidechain = true
text = message.content when it is a string,
       else the first block of message.content with type "text"
no text (for example only tool_result blocks)          → skip
text has <command-name>N</command-name>:
    <command-args>A</command-args> with A not blank     → "N A"   (e.g. "/review fix the bug")
    otherwise                                          → skip   (e.g. "/clear", "/model")
text starts with "<local-command-"                     → skip   (command output or caveat)
text blank                                             → skip
otherwise                                              → the trimmed text
```

## Rules and invariants

- It opens files read-only. It never creates, changes, moves or deletes anything under `claudeDir`.
- It reads `projects` only. It never reads other folders of `claudeDir`.

## Requirements served

- `plan-claude_sessions_client/REQ-25`, `plan-claude_sessions_client/REQ-26`, `plan-claude_sessions_client/REQ-28`
