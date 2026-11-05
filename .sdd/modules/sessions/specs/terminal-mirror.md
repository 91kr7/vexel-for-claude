---
module: sessions
component: TerminalMirror
type: backend service
---

# TerminalMirror

**Purpose** → a headless terminal that receives all the output of one session. It gives the current screen and scrollback as one string that a new viewer can replay.

## Contract

- `new TerminalMirror(cols, rows)` → an empty terminal of that size, with 10 000 lines of scrollback.
- `write(data)` → feeds pty output to the terminal.
- `resize(cols, rows)` → changes the terminal size.
- `snapshot() → Promise<string>` → the serialized screen and scrollback (escape sequences included).
  - the result contains all the data passed to `write` before the call, even data the terminal has not parsed yet
  - writing the result into an empty terminal of the same size reproduces the same screen

## Rules and invariants

- Scrollback holds at most 10 000 lines. Older lines are dropped.

## Requirements served

- `plan-claude_sessions_client/REQ-1`, `plan-claude_sessions_client/REQ-4`
