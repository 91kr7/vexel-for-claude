---
module: history
component: ExternalSessionCheck
type: backend service
---

# ExternalSessionCheck

**Purpose** → tells which Claude Code sessions still run in a process the client does not host, for example a terminal.

## Contract

- `new ExternalSessionCheck(options?)`
  - `options.claudeDir` → the Claude Code folder. Default: `defaultClaudeDir()` of SessionHistory.
  - `options.procDir` → the process folder. Default: `/proc`.
- `runningSessionIds(hostedPids) → Promise<Set<string>>` → the `sessionId` values of the files `<claudeDir>/sessions/<pid>.json` where:
  - the name is only digits plus `.json`
  - `<procDir>/<pid>` exists (the process is alive)
  - `<pid>` is not in `hostedPids` (the pids of the processes the client hosts)
- `runningSessions(hostedPids) → Promise<RunningSessionFile[]>` → the same files as `runningSessionIds`, with their data: `{ pid, sessionId, cwd?, kind?, status?, updatedAt? }`.
  - `pid` → the number in the file name.
  - `cwd`, `kind`, `status` → present only when they are strings in the file. `updatedAt` → present only when it is a number.
- a file with invalid JSON or without a string `sessionId` → ignored.
- no `sessions` folder → empty set (empty array for `runningSessions`).

## Rules and invariants

- It never opens a file of `<claudeDir>/sessions` whose name is not `<digits>.json`. The `<pid>.<hash>.key` files hold credentials.
- It opens files read-only and never writes under `claudeDir`.

## Dependencies

- SessionHistory (for `defaultClaudeDir()`)

## Requirements served

- `plan-claude_sessions_client/REQ-27`, `plan-claude_sessions_client/REQ-29`
