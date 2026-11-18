---
module: processes
component: ProcessTerminator
type: backend service
---

# ProcessTerminator

**Purpose** → ends one listed process after checking that its PID still names the listed process, and reports how it went.

## Contract

- `new ProcessTerminator({ reader, registry, ownPid, appName, signal?, endTimeoutMs?, sessionEndTimeoutMs?, pollMs? })`
  - `registry` gives `list()` of the hosted sessions (`pid`, `exited`, `stop()`, `onExit(listener)`).
  - `signal(pid, name)` → default `process.kill`. `endTimeoutMs` default 5000, `sessionEndTimeoutMs` default 7000, `pollMs` default 100.
- `terminate(pid, startedAt) → Promise<{ outcome, afterAnswer? }>`, `outcome` one of `ended`, `gone`, `running`, `not_allowed`.

```
facts = reader.readProcesses()                      // a fresh read
if no fact has pid, or its startedAt ≠ startedAt,
   or classifyProcesses(facts) gives pid no kind     → gone, no signal
else if pid = ownPid                                → ended, afterAnswer = signal(ownPid, SIGTERM)
else if a running registry session has pid          → session.stop(), wait for its exit up to sessionEndTimeoutMs
                                                       → exited: ended; else running
else signal(pid, SIGTERM)
   EPERM                                            → not_allowed
   ESRCH                                            → ended
   then every pollMs: reader.isRunning(pid, startTicks)
   false within endTimeoutMs                        → ended
   still true at endTimeoutMs                       → running
```

- a pid that is not an integer ≥ 1 → `gone`, no read and no signal.
- `afterAnswer` → only for the current instance. `terminate` itself sends nothing to `ownPid`.

## Rules and invariants

- One signal only: `SIGTERM` to the confirmed PID. Never `SIGKILL`, never a process group (`-pid`), never a name pattern.
- A hosted session follows `Session.stop()` exactly, as the stop from the session list (it sends `SIGKILL` itself after 5 s).
- The children of the process get no signal. An app server ends its sessions by itself on `SIGTERM`.
- The end check uses the start ticks, so a PID reused during the wait counts as ended and is never signalled.

## Dependencies

- ProcessReader, classifyProcesses
- SessionRegistry (module sessions)

## Requirements served

- `plan-app_processes/REQ-23`, `plan-app_processes/REQ-28`, `plan-app_processes/REQ-29`, `plan-app_processes/REQ-30`, `plan-app_processes/REQ-32`
