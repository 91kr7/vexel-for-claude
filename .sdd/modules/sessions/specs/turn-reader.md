---
module: sessions
component: TurnReader
type: backend service
---

# TurnReader

**Purpose** → reads the end of a session transcript. It gives Claude's final response of the last turn, and whether the user interrupted that turn.

## Contract

- `new TurnReader(options?)`
  - `options.transcripts` → finds the transcript file (`locate` of TranscriptReader). Default: a TranscriptReader on the default Claude Code folder.
  - `options.retryMs` → wait before the second read. Default: 1000.
- `lastTurn(folder, claudeSessionId) → Promise<LastTurn>` → the transcript is `transcripts.locate(folder, claudeSessionId)`.

`LastTurn` → `{ interrupted, finalResponse? }`:

- `interrupted` → `true` when the user interrupted the last turn.
- `finalResponse` → the text of Claude's final response. Absent when the turn has none.

The items are the conversation items (`itemsOf` of TranscriptReader) of the complete lines at the end of the file, in order.

```
read the items
the read is complete when:
    the last line that gives items has a user item whose text starts with "[Request interrupted by user"   (interrupt marker)
    or the last item is an assistant item
not complete → wait retryMs, read the items again, once

last line that gives items has an interrupt marker   → { interrupted: true }
last item is an assistant item                       → { interrupted: false, finalResponse }
anything else (a tool call, a tool result, a user
message, no item, no transcript)                     → { interrupted: false }

finalResponse = the texts of the assistant items after the last user or tool_result item, joined by "\n"
```

## Rules and invariants

- It reads at most the last 128 KiB of the file. A line that starts before them is ignored, and so is a last line with no `\n`.
- A line that is not valid JSON gives no item.
- Its promise never rejects. A file that cannot be read gives no item.
- It opens files read-only.

## Dependencies

- TranscriptReader (module external), for `locate` and `itemsOf`

## Requirements served

- `plan-session_notifications/REQ-15`, `plan-session_notifications/REQ-16`, `plan-session_notifications/REQ-17`
