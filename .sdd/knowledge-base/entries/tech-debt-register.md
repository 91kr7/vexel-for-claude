---
id: tech-debt-register
kind: guideline
scope: any
date: 2026-11-18
source: /sdd-auto, fix of wsl_support (release v1.2.1)
---

# Known defects left open go to the technical debt register

**Rule** → A known defect that the human decides not to fix now is recorded in `.sdd/tech-debt.md`, one row per item. It stays there until a fix closes it.

**Why** → The human: "segna nel debito tecnico sta cosa del terminate!" and "scrivi come funziona il debito tecnico nella knolegebase". The defect of Settings → Processes was left open for v1.2.1 and was written only in a gate log and a pull request.

## How it works

**What goes in** → a defect or shortcut that is known and left open on purpose, by a decision of the human. Examples: a release published with a known bug, a flaky test whose cause is in the app and is not fixed in the current cycle. Not in it: work that is simply not done yet, ideas, wishes.

**When an item is added** → in the same branch and the same step where the human accepts to leave the defect open. The orchestrator adds the row and commits it with that step. The subagents never write the register; they report the defect, and the orchestrator brings it to the human.

**Fields of a row** (table "open" at the top of `.sdd/tech-debt.md`):
- `Id` → `TD-<n>`, a number never reused.
- `Date` → the day the item is added.
- `What` → what the user sees, then the cause in one or two sentences.
- `Contract broken` → the REQ id (`plan-<slug>/REQ-<n>`) and any spec that conflicts with it.
- `Evidence` → the test (`file:line`) and the runs that show it.
- `Proposed fix` → the options found, without choosing among them.
- `Decided by` → who decided to leave it open, when, and where it is logged (gate log or pull request).

**When an item is closed** → the fix that closes it is a normal cycle (`/sdd-auto` or the manual commands). When that fix is merged, the orchestrator moves the row to the "Closed" table with the date and the branch or pull request that closed it. The row is never deleted.

**Who reads it**:
- analysis → when a request touches the same area, read the register and cite the item the request closes.
- planning → a batch that closes an item names it (`TD-<n>`) in its decisions.
- test → a failing test that matches an open item is reported with its id; it is still not green (`e2e-green-before-release`).
- release → the release pull request lists the open items it ships with, under "Known issues".
