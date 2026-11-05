---
module: sessions
component: SessionRegistry
type: backend service
---

# SessionRegistry

**Purpose** → starts Claude Code CLI sessions in pseudo-terminals and keeps every session the client hosts, by id.

## Contract

- `new SessionRegistry(options?)`
  - `options.command` → the CLI executable. Default: the environment variable `AI_CLIENT_CLAUDE_CLI`, or `claude` when the variable is not set or empty.
- `start(cwd) → Session` → spawns the CLI in a pty, with `cwd` as working directory.
  - arguments: none. No permission flag and no settings flag.
  - environment: the server environment, plus `TERM=xterm-256color` and `COLORTERM=truecolor`.
  - initial size: 120 columns, 30 rows.
  - the session gets a new unique id (UUID).
- `get(id) → Session | undefined` → the session with that id, also after its process ended.

`Session`:

- `id`, `cwd` → read only.
- `exited` → `true` once the process ended.
- `write(data)` → sends the data to the pty as typed input. No effect after the process ended.
- `resize(cols, rows)` → resizes the pty and its mirror. No effect after the process ended.
- `attach(viewer) → detach()` → connects a viewer `{ send(data), end() }`.
  - the first `send` carries the snapshot of the mirror (TerminalMirror)
  - after it, every new pty output reaches `send`, in order, with nothing lost or repeated between snapshot and live output
  - after the process ended, `end()` is called once
  - attaching to an ended session → `send(snapshot)`, then `end()`
  - `detach()` → the viewer gets nothing more. The process keeps running.

## Rules and invariants

- A session's process stops only when it exits by itself or the server stops. Viewers never stop it.
- Only `write` sends input to the pty. The registry never writes to it on its own.
- Every pty output goes to the session mirror, also when no viewer is attached.
- Several viewers can attach to the same session. Each gets the full sequence.

## Dependencies

- TerminalMirror

## Requirements served

- `plan-claude_sessions_client/REQ-1`, `plan-claude_sessions_client/REQ-6`, `plan-claude_sessions_client/REQ-7`, `plan-claude_sessions_client/REQ-10`
