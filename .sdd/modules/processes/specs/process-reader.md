---
module: processes
component: ProcessReader
type: backend service
---

# ProcessReader

**Purpose** → reads `/proc` on request and gives the facts of the current user's processes.

## Contract

- `new ProcessReader({ procDir?, uid? })` → `procDir` default `/proc`; `uid` default the server's own user id.
- `readProcesses() → Promise<ProcessFacts[]>` → one entry per process whose `/proc/<pid>` owner is `uid`.
  - `pid`, `ppid` → numbers.
  - `startTicks` → field 22 of `/proc/<pid>/stat`, as text. With `pid` it names one process run.
  - `startedAt` → epoch ms: `btime` of `/proc/stat` plus `startTicks` / 100.
  - `argv` → the arguments of `/proc/<pid>/cmdline`.
  - `cwd` → the target of `/proc/<pid>/cwd`; missing when it cannot be read.
  - `cwdPackageName` → `name` of `<cwd>/package.json`; missing when there is no such file or name.
  - `markers` → read from `/proc/<pid>/environ`. No other variable is kept.
    - `sessionId` → value of `AI_CLIENT_SESSION_ID`.
    - `launcher` → `{ pid, startTicks }` from `AI_CLIENT_LAUNCHER`; missing when the value is not `<pid>:<startTicks>`.
    - `testServer` → `true` when `AI_CLIENT_TEST_SERVER` is `1`.
    - `claudeCli` → value of `AI_CLIENT_CLAUDE_CLI`.
  - a process that ends during the read, or whose `stat` or `cmdline` cannot be read → skipped.
  - an environment that cannot be read → no markers (`testServer: false`).
- `readListeningPorts(pids) → Promise<Map<pid, number[]>>` → for each pid, the TCP ports it listens on, sorted.
  - a port counts when a socket inode in `/proc/<pid>/fd` is in the `LISTEN` state of `/proc/net/tcp` or `/proc/net/tcp6`.
  - a process with no listening socket, or whose `fd` folder cannot be read → no entry.
- `isRunning(pid, startTicks) → Promise<boolean>` → `true` when `/proc/<pid>/stat` exists, has the same `startTicks` and the process is not a zombie (`Z`) or dead (`X`). Else `false`, also when the PID now names another process run.

## Rules and invariants

- It reads only when called: no timer, no cache between calls.
- Every read is async. It never runs a shell command or a Windows tool.
- Under WSL `/proc` holds only the Linux processes, so no Windows process is ever read.

## Requirements served

- `plan-app_processes/REQ-6`, `plan-app_processes/REQ-8`, `plan-app_processes/REQ-9`, `plan-app_processes/REQ-20`, `plan-app_processes/REQ-30`, `plan-app_processes/REQ-32`
