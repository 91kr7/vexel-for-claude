# Technical debt

Known defects and shortcuts that were left open on purpose. One row per item. An item leaves the table when the fix that closes it is merged; its row then moves to "Closed" with the fix.

| Id | Date | What | Contract broken | Evidence | Proposed fix | Decided by |
|----|------|------|-----------------|----------|--------------|------------|
| TD-1 | 2026-11-18 | Settings → Processes: after a confirmed *Terminate*, the row of the ended process can stay in the list until *Refresh*. Overlapping reads of the process list share one read, so the reload after the terminate can get the rows of a read that started before the process ended. | `plan-app_processes/REQ-31`. The spec `.sdd/modules/processes/specs/process-list.md` ("calls that overlap share one read") conflicts with it. | `e2e/terminate-process.spec.ts:209`: 30/30 green with 1 worker; 6/20 red with another client reading the list at the same time; fails at times in the complete e2e run with 3 workers. | A load that starts after a terminate always does its own fresh read; or the page drops the row of a process the terminate reported `ended`. | The human, 2026-11-18: release v1.2.1 without this fix (gate log `.sdd/gates/wsl_support.md`). |

## Closed

| Id | Date closed | Closed by |
|----|-------------|-----------|
