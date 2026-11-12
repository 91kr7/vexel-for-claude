---
id: no-kill-by-pattern
kind: guideline
scope: development, test
date: 2026-11-13
source: /sdd-auto, batch favorite-project of project_list_actions
---

# Never stop processes by name or pattern

**Rule** → Never stop processes by name or pattern (`pkill -f`, `killall` and similar). A process you start yourself is stopped only by its own PID.

**Why** → The human's own app runs from this same folder (`node --import tsx src/server/main.ts`, port 4001) and hosts the live Claude Code sessions. A developer ran `pkill -f "src/server/main.ts"` to stop a throwaway server, stopped the human's instance too, and ended its sessions, the working one included.

**How to apply** →
- development: a server started for a quick check records its PID at start and is stopped with `kill <PID>`. Never touch port 4001.
- test: the same rule for any server or Electron instance outside what Playwright starts and stops by itself.
