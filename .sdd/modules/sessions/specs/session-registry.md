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
  - `options.settingsPath` → a Claude Code settings file (HookSettings). Default: none.
  - `options.stopTimeoutMs` → how long `Session.stop()` waits before `SIGKILL`. Default: 5000.
- `start(cwd, resume?) → Session` → spawns the CLI in a pty, with `cwd` as working directory.
  - `resume` → `{ sessionId, firstUserMessage? }`: the past Claude Code session to resume.
  - arguments: `--settings <settingsPath>` when `settingsPath` is set, then `--resume <sessionId>` when `resume` is given. Nothing else. Never a permission flag.
  - environment: the server environment, plus `TERM=xterm-256color`, `COLORTERM=truecolor` and `AI_CLIENT_SESSION_ID=<session id>`.
  - initial size: 120 columns, 30 rows.
  - the session gets a new unique id (UUID).
  - calls every `onSessionStart` listener with the session before it returns.
- `onSessionStart(listener) → unsubscribe` → `listener(session)` for each session started later.
- `get(id) → Session | undefined` → the session with that id, also after its process ended.
- `list() → Session[]` → every session started, in start order, ended ones included.

`Session`:

- `id`, `cwd` → read only.
- `pid` → the process id of the CLI.
- `resumedFrom` → the `resume` given to `start`, or `undefined`.
- `exited` → `true` once the process ended.
- `onExit(listener) → unsubscribe` → `listener()` once, when the process ends. A listener added after the end is never called.
- `write(data)` → sends the data to the pty as typed input. No effect after the process ended.
- `stop()` → sends `SIGTERM` to the process. If the process is still alive after `stopTimeoutMs`, sends `SIGKILL`.
  - no effect after the process ended, or while a previous `stop()` is still waiting.
  - the end of the process follows the normal path: `exited`, `onExit` listeners, viewers' `end()`.
- `resize(cols, rows)` → resizes the pty and its mirror. No effect after the process ended.
- `attach(viewer) → detach()` → connects a viewer `{ send(data), end() }`.
  - the first `send` carries the snapshot of the mirror (TerminalMirror)
  - after it, every new pty output reaches `send`, in order, with nothing lost or repeated between snapshot and live output
  - after the process ended, `end()` is called once
  - attaching to an ended session → `send(snapshot)`, then `end()`
  - `detach()` → the viewer gets nothing more. The process keeps running.

## Rules and invariants

- A session's process stops only when it exits by itself, when `stop()` is called, or when the server stops. Viewers never stop it.
- Only `write` sends input to the pty. The registry never writes to it on its own.
- Every pty output goes to the session mirror, also when no viewer is attached.
- Several viewers can attach to the same session. Each gets the full sequence.

## Dependencies

- TerminalMirror

## Requirements served

- `plan-claude_sessions_client/REQ-1`, `plan-claude_sessions_client/REQ-6`, `plan-claude_sessions_client/REQ-7`, `plan-claude_sessions_client/REQ-10`, `plan-claude_sessions_client/REQ-14`, `plan-claude_sessions_client/REQ-23`, `plan-claude_sessions_client/REQ-25`, `plan-claude_sessions_client/REQ-26`
