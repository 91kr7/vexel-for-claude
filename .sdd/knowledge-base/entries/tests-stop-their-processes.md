---
id: tests-stop-their-processes
kind: guideline
scope: development, test
date: 2026-11-18
source: chat after /sdd-auto of app_processes
---

# Tests stop every process they start

**Rule** → A test that starts a process (server, fake Claude, helper) stops it in its cleanup, and the signal must reach the real process: start a server with `process.execPath, ['--import', 'tsx', 'src/server/main.ts']`, never through the `node_modules/.bin/tsx` wrapper. After a run, no test process is left running.

**Why** → The human found 72 test servers left running ("72 server di test? ma siam fuori?") and asked to write down that they must be stopped. Five `src/server/main-*.test.ts` files spawned the tsx wrapper and sent it `SIGKILL`: the wrapper died, the server inside kept running, 36 more at every full unit run.

**How to apply** →
- development: a component that starts child processes gives the tests a way to stop them by PID.
- test: every spawn is tracked and stopped in `afterEach`/`afterAll` by its PID (knowledge base `no-kill-by-pattern`). A test run that leaves processes behind is a defect of the test, to fix before the batch is certified; check with `ps` before and after the run.
