# Module processes

| Component | Type | Path | Responsibility | Spec |
|-----------|------|------|----------------|------|
| ProcessReader | backend service | `src/server/processes/process-reader.ts` | Reads `/proc` on request: the current user's processes with PID, parent, start time, arguments, folder, app markers of the environment, and listening TCP ports | `specs/process-reader.md` |
| classifyProcesses | backend function | `src/server/processes/process-kind.ts` | Kind of each listed process: app server, test server, fake Claude or Claude session | `specs/process-kind.md` |
| isHanging | backend function | `src/server/processes/hanging-rule.ts` | A session whose parent server is gone, or a server whose launcher is gone | `specs/hanging-rule.md` |
| ProcessList | backend service | `src/server/processes/process-list.ts` | Rows of the app's processes with port, folder, label and marks, in a fixed order; overlapping calls share one read | `specs/process-list.md` |
| ProcessesRoute | REST endpoint | `src/server/processes/processes-route.ts` | `GET /api/processes`: the rows of ProcessList, read at each call | `specs/processes-route.md` |
| loadProcesses | frontend function | `src/web/settings/processes-client.ts` | Page call of `GET /api/processes`: the rows, or `failed` on any error or bad answer | `specs/processes-client.md` |
| runningTimeText | frontend function | `src/web/settings/running-time.ts` | Running time as "42s", "5m", "2h 05m" or "3d 4h" | `specs/running-time.md` |
| ProcessesSection | UI component | `src/web/settings/ProcessesSection.tsx` | "Processes" menu of the settings popup: "Refresh", the loading, failure and empty states, one row per process | `specs/processes-section.md` |
