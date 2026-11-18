# Module processes

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| ProcessReader | backend service | `src/server/processes/process-reader.ts` | Reads `/proc` on request: the current user's processes with PID, parent, start time, arguments, folder, app markers of the environment, and listening TCP ports; tells whether a PID still runs the same process | `specs/process-reader.md` |
| classifyProcesses | backend function | `src/server/processes/process-kind.ts` | Kind of each listed process: app server, test server, fake Claude or Claude session | `specs/process-kind.md` |
| isHanging | backend function | `src/server/processes/hanging-rule.ts` | A session whose parent server is gone, or a server whose launcher is gone | `specs/hanging-rule.md` |
| ProcessList | backend service | `src/server/processes/process-list.ts` | Rows of the app's processes with port, folder, label and marks, in a fixed order; overlapping calls share one read | `specs/process-list.md` |
| ProcessTerminator | backend service | `src/server/processes/process-terminator.ts` | Checks that a PID is still the listed process, then ends it: `SIGTERM` and a 5 s wait, `Session.stop()` for a hosted session, a self `SIGTERM` after the answer for the current instance | `specs/process-terminator.md` |
| TerminateProcessRoute | REST endpoint | `src/server/processes/terminate-process-route.ts` | `POST /api/processes/terminate`: the outcome of ProcessTerminator, `400` on a bad body | `specs/terminate-process-route.md` |
| ProcessesRoute | REST endpoint | `src/server/processes/processes-route.ts` | `GET /api/processes`: the rows of ProcessList, read at each call | `specs/processes-route.md` |
| loadProcesses | frontend function | `src/web/settings/processes-client.ts` | Page call of `GET /api/processes`: the rows, or `failed` on any error or bad answer | `specs/processes-client.md` |
| terminateProcess | frontend function | `src/web/settings/processes-client.ts` | Page call of `POST /api/processes/terminate`: the outcome, or `failed` on any error or bad answer | `specs/terminate-process-client.md` |
| TerminateProcessDialog | UI component | `src/web/settings/TerminateProcessDialog.tsx` | Rose confirmation that names the process and warns about the current instance or the hosted sessions | `specs/terminate-process-dialog.md` |
| runningTimeText | frontend function | `src/web/settings/running-time.ts` | Running time as "42s", "5m", "2h 05m" or "3d 4h" | `specs/running-time.md` |
| ProcessesSection | UI component | `src/web/settings/ProcessesSection.tsx` | "Processes" menu of the settings popup: "Refresh", the loading, failure and empty states, one row per process with "Terminate", its confirmation and the row error | `specs/processes-section.md` |
