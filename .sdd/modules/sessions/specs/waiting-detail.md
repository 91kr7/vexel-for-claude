---
module: sessions
component: waitingDetailOf
type: backend function
---

# waitingDetailOf

**Purpose** → turns the hook event of a permission request or of a question into the detail of what the session waits for.

## Contract

- `WaitingDetail` → one of:
  - `{ kind: "argument", text }` → what the tool will do, e.g. the Bash command or the file path of Edit and Write.
  - `{ kind: "questions", questions: [{ question, options }] }` → the questions of an `AskUserQuestion`, each with the labels of its options (`string[]`, may be empty).
- `waitingDetailOf(event) → WaitingDetail | undefined` → `event` is a hook event `{ hook_event_name, tool_name?, tool_input? }`:

  ```
  hook_event_name is not PreToolUse and not PermissionRequest  → undefined
  tool_name is "AskUserQuestion":
      questions = the items of tool_input.questions with a non-blank string `question`
          options = the non-blank string `label` of each item of its `options` array, in order
      at least one question → { kind: "questions", questions }, in order
      else                  → undefined
  any other tool:
      text = mainArgumentOf(tool_input)
      text is a non-blank string → { kind: "argument", text }
      else                       → undefined
  ```

## Rules and invariants

- The text, the questions and the labels are kept whole: no trim, no cut.
- Items, options and inputs of a wrong shape are skipped, never an error.

## Dependencies

- TranscriptReader `mainArgumentOf` (module external)

## Requirements served

- `plan-remote_notifications/REQ-31`, `plan-remote_notifications/REQ-32`
