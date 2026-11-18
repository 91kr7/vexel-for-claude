---
module: processes
component: classifyProcesses
type: backend function
---

# classifyProcesses

**Purpose** → gives the kind of each process the app lists, from the facts of ProcessReader.

## Contract

- `classifyProcesses(facts, { appName, ownPid }) → Map<pid, ProcessKind>` → only the listed processes are in the map.
- `ProcessKind` → `app-server`, `test-server`, `fake-claude` or `claude-session`.

```
fake CLI  = an argument that is or ends with "test-support/fake-claude.mjs"
test env  = markers.testServer, or markers.claudeCli is or ends with "test-support/fake-claude.mjs"
server    = argv[0] base name is "node" or "nodejs"
            and an argument is "src/server/main.ts" or ends with "/src/server/main.ts"
            and cwdPackageName = appName
electron  = argv[0] base name is "electron", no argument starts with "--type="
            and cwdPackageName = appName

for each process:
  fake CLI                                   → fake-claude
  pid = ownPid                               → test env ? test-server : app-server
  server and no child process is a server    → test env ? test-server : app-server
  server with a child server (a launcher such as tsx) → not listed
  electron and test env                      → test-server
  markers.sessionId set and the parent has not the same sessionId → claude-session
  otherwise                                  → not listed
```

## Rules and invariants

- A Claude process without `AI_CLIENT_SESSION_ID` is external and not listed.
- The descendants of a Claude session that keep its session id are not listed.
- An Electron instance of the app without the test environment is not listed.

## Dependencies

- ProcessReader (`ProcessFacts`)

## Requirements served

- `plan-app_processes/REQ-2`, `plan-app_processes/REQ-3`, `plan-app_processes/REQ-4`, `plan-app_processes/REQ-5`, `plan-app_processes/REQ-7`
