# Technical debt

Known defects and shortcuts that were left open on purpose. One row per item. An item leaves the table when the fix that closes it is merged; its row then moves to "Closed" with the fix.

| Id | Date | What | Contract broken | Evidence | Proposed fix | Decided by |
|----|------|------|-----------------|----------|--------------|------------|

## Closed

| Id | Date closed | Closed by |
|----|-------------|-----------|
| TD-1 | 2026-11-23 | Branch `fix/flaky-tests`: a call of `ProcessList.list()` during a read gets the rows of the next read, never of one that started before it. |
| TD-2 | 2026-11-23 | Branch `fix/flaky-tests`: `Session.resize` ignores the error of a pty that closed before the exit event. |
| TD-3 | 2026-11-23 | Branch `fix/flaky-tests`: the test waits up to 15 s for the terminal to attach, and the e2e limits are generous for a loaded machine. |
